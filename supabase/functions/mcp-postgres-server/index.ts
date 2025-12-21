// =====================================================
// MCP PostgreSQL Server
// Purpose: Safe, controlled database operations via MCP
// Features: RLS enforcement, query whitelisting, audit logging
// =====================================================

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkMCPRateLimit, getRequestIdentifier, createRateLimitResponse, createRateLimitHeaders, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";

// Environment
const SUPABASE_URL = SUPABASE_URL;
const SERVICE_KEY = SB_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase credentials");

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// =====================================================
// SECURITY: Query Whitelist
// Only allow specific, pre-approved query patterns
// =====================================================

interface WhitelistedQuery {
  name: string;
  description: string;
  query: string;
  parameters: string[];
  returnsRows: boolean;
  maxRows?: number;
}

const WHITELISTED_QUERIES: Record<string, WhitelistedQuery> = {
  // Patient queries (read-only, no PHI returned)
  "get_patient_count_by_risk": {
    name: "get_patient_count_by_risk",
    description: "Get count of patients by risk level",
    query: `SELECT risk_level, COUNT(*) as count FROM patients WHERE tenant_id = $1 GROUP BY risk_level`,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_readmission_risk_summary": {
    name: "get_readmission_risk_summary",
    description: "Get readmission risk distribution",
    query: `
      SELECT
        CASE
          WHEN readmission_risk_30 >= 0.7 THEN 'high'
          WHEN readmission_risk_30 >= 0.4 THEN 'medium'
          ELSE 'low'
        END as risk_category,
        COUNT(*) as patient_count
      FROM patients
      WHERE tenant_id = $1 AND readmission_risk_30 IS NOT NULL
      GROUP BY risk_category
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_encounter_summary": {
    name: "get_encounter_summary",
    description: "Get encounter counts by status and type",
    query: `
      SELECT
        encounter_type,
        status,
        COUNT(*) as count,
        DATE_TRUNC('day', encounter_date) as date
      FROM encounters
      WHERE tenant_id = $1
        AND encounter_date >= NOW() - INTERVAL '30 days'
      GROUP BY encounter_type, status, DATE_TRUNC('day', encounter_date)
      ORDER BY date DESC
    `,
    parameters: ["tenant_id"],
    returnsRows: true,
    maxRows: 100
  },
  "get_sdoh_flags_summary": {
    name: "get_sdoh_flags_summary",
    description: "Get SDOH risk flag distribution",
    query: `
      SELECT
        flag_type,
        severity,
        COUNT(*) as count
      FROM sdoh_flags
      WHERE tenant_id = $1 AND resolved = false
      GROUP BY flag_type, severity
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_medication_adherence_stats": {
    name: "get_medication_adherence_stats",
    description: "Get medication adherence statistics",
    query: `
      SELECT
        CASE
          WHEN adherence_rate >= 0.8 THEN 'good'
          WHEN adherence_rate >= 0.5 THEN 'moderate'
          ELSE 'poor'
        END as adherence_category,
        COUNT(*) as patient_count
      FROM (
        SELECT patient_id, AVG(taken::int) as adherence_rate
        FROM medication_logs
        WHERE tenant_id = $1 AND log_date >= NOW() - INTERVAL '30 days'
        GROUP BY patient_id
      ) adherence
      GROUP BY adherence_category
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  // Billing queries
  "get_claims_status_summary": {
    name: "get_claims_status_summary",
    description: "Get claims by status",
    query: `
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_charges), 0) as total_charges
      FROM claims
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_billing_revenue_summary": {
    name: "get_billing_revenue_summary",
    description: "Get billing revenue by date",
    query: `
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as claim_count,
        COALESCE(SUM(total_charges), 0) as charges,
        COALESCE(SUM(amount_paid), 0) as collected
      FROM claims
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `,
    parameters: ["tenant_id"],
    returnsRows: true,
    maxRows: 30
  },
  // Care coordination queries
  "get_care_plan_summary": {
    name: "get_care_plan_summary",
    description: "Get care plan statistics",
    query: `
      SELECT
        status,
        COUNT(*) as count
      FROM care_plans
      WHERE tenant_id = $1
      GROUP BY status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_task_completion_rate": {
    name: "get_task_completion_rate",
    description: "Get task completion statistics",
    query: `
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
      FROM care_tasks
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  // Referral queries
  "get_referral_summary": {
    name: "get_referral_summary",
    description: "Get referral statistics by source",
    query: `
      SELECT
        ers.organization_name,
        pr.status,
        COUNT(*) as count
      FROM patient_referrals pr
      JOIN external_referral_sources ers ON pr.referral_source_id = ers.id
      WHERE pr.tenant_id = $1
        AND pr.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY ers.organization_name, pr.status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  // Shift/operations queries
  "get_bed_availability": {
    name: "get_bed_availability",
    description: "Get bed availability by unit",
    query: `
      SELECT
        unit,
        status,
        COUNT(*) as count
      FROM beds
      WHERE tenant_id = $1
      GROUP BY unit, status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_shift_handoff_summary": {
    name: "get_shift_handoff_summary",
    description: "Get shift handoff statistics",
    query: `
      SELECT
        shift_type,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_duration_minutes
      FROM shift_handoffs
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY shift_type, status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  // Dashboard metrics (aggregated, no PHI)
  "get_dashboard_metrics": {
    name: "get_dashboard_metrics",
    description: "Get key dashboard metrics",
    query: `
      SELECT
        (SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND enrollment_type = 'app') as active_members,
        (SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND readmission_risk_30 >= 0.7) as high_risk_patients,
        (SELECT COUNT(*) FROM encounters WHERE tenant_id = $1 AND encounter_date::date = CURRENT_DATE) as todays_encounters,
        (SELECT COUNT(*) FROM care_tasks WHERE tenant_id = $1 AND status = 'pending') as pending_tasks,
        (SELECT COUNT(*) FROM sdoh_flags WHERE tenant_id = $1 AND resolved = false) as active_sdoh_flags
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  // Quality metrics
  "get_quality_metrics": {
    name: "get_quality_metrics",
    description: "Get quality measure performance",
    query: `
      SELECT
        measure_code,
        measure_name,
        numerator,
        denominator,
        CASE WHEN denominator > 0 THEN (numerator::float / denominator * 100) ELSE 0 END as performance_rate
      FROM quality_measures
      WHERE tenant_id = $1
        AND reporting_period >= DATE_TRUNC('quarter', CURRENT_DATE)
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  }
};

// =====================================================
// MCP Tools Definition
// =====================================================

const TOOLS = {
  "execute_query": {
    description: "Execute a pre-approved query against the database",
    inputSchema: {
      type: "object",
      properties: {
        query_name: {
          type: "string",
          description: "Name of the whitelisted query to execute",
          enum: Object.keys(WHITELISTED_QUERIES)
        },
        tenant_id: { type: "string", description: "Tenant ID for RLS" },
        parameters: {
          type: "object",
          description: "Additional query parameters",
          additionalProperties: true
        }
      },
      required: ["query_name", "tenant_id"]
    }
  },
  "list_queries": {
    description: "List all available pre-approved queries",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  "get_table_schema": {
    description: "Get schema information for a table",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to describe"
        }
      },
      required: ["table_name"]
    }
  },
  "get_row_count": {
    description: "Get row count for a table with optional tenant filter",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Table name" },
        tenant_id: { type: "string", description: "Optional tenant ID filter" }
      },
      required: ["table_name"]
    }
  }
};

// Safe tables that can have schema/counts retrieved
const SAFE_TABLES = new Set([
  'patients', 'encounters', 'claims', 'care_plans', 'care_tasks',
  'medications', 'allergies', 'sdoh_flags', 'referral_alerts',
  'beds', 'shift_handoffs', 'quality_measures', 'code_cpt',
  'code_icd10', 'code_hcpcs', 'questionnaire_responses'
]);

// =====================================================
// Audit Logging
// =====================================================

async function logMCPRequest(params: {
  userId?: string;
  tenantId?: string;
  tool: string;
  queryName?: string;
  rowsReturned: number;
  executionTimeMs: number;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await sb.from("mcp_query_logs").insert({
      user_id: params.userId,
      tenant_id: params.tenantId,
      tool_name: params.tool,
      query_name: params.queryName,
      rows_returned: params.rowsReturned,
      execution_time_ms: params.executionTimeMs,
      success: params.success,
      error_message: params.errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    // Fallback to claude_usage_logs if mcp_query_logs doesn't exist
    try {
      await sb.from("claude_usage_logs").insert({
        user_id: params.userId,
        request_id: crypto.randomUUID(),
        request_type: `mcp_postgres_${params.tool}`,
        response_time_ms: params.executionTimeMs,
        success: params.success,
        error_message: params.errorMessage,
        created_at: new Date().toISOString()
      });
    } catch {
      console.error("[MCP Postgres Audit Log Error]:", err);
    }
  }
}

// =====================================================
// Request Handler
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Rate limiting
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.postgres);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.postgres, corsHeaders);
  }

  try {
    const { method, params } = await req.json();

    // MCP Protocol: List tools
    if (method === "tools/list") {
      return new Response(JSON.stringify({
        tools: Object.entries(TOOLS).map(([name, def]) => ({ name, ...def }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;
      const startTime = Date.now();

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      let result: any;
      let rowsReturned = 0;

      switch (toolName) {
        case "execute_query": {
          const { query_name, tenant_id, parameters: extraParams } = toolArgs;

          const queryDef = WHITELISTED_QUERIES[query_name];
          if (!queryDef) {
            throw new Error(`Query '${query_name}' is not whitelisted`);
          }

          // Execute the query with tenant_id parameter via RPC
          const { data, error } = await sb.rpc('execute_safe_query', {
            query_text: queryDef.query,
            params: JSON.stringify([tenant_id, ...(extraParams ? Object.values(extraParams) : [])])
          });

          if (error) {
            // Log detailed error for debugging
            console.error(`[MCP Postgres] Query '${query_name}' failed:`, error);
            throw new Error(`Query '${query_name}' failed: ${error.message}`);
          }

          result = data;

          // Apply row limit
          if (Array.isArray(result) && queryDef.maxRows) {
            result = result.slice(0, queryDef.maxRows);
          }

          rowsReturned = Array.isArray(result) ? result.length : 1;
          break;
        }

        case "list_queries": {
          result = Object.entries(WHITELISTED_QUERIES).map(([name, def]) => ({
            name,
            description: def.description,
            parameters: def.parameters,
            maxRows: def.maxRows
          }));
          rowsReturned = result.length;
          break;
        }

        case "get_table_schema": {
          const { table_name } = toolArgs;

          if (!SAFE_TABLES.has(table_name)) {
            throw new Error(`Table '${table_name}' schema is not accessible`);
          }

          const { data, error } = await sb.rpc('get_table_columns', {
            p_table_name: table_name
          });

          if (error) {
            // Fallback: use information_schema directly
            const { data: schemaData, error: schemaError } = await sb
              .from('information_schema.columns')
              .select('column_name, data_type, is_nullable, column_default')
              .eq('table_name', table_name)
              .limit(100);

            if (schemaError) {
              throw new Error(`Schema lookup failed: ${schemaError.message}`);
            }
            result = schemaData;
          } else {
            result = data;
          }

          rowsReturned = Array.isArray(result) ? result.length : 0;
          break;
        }

        case "get_row_count": {
          const { table_name, tenant_id } = toolArgs;

          if (!SAFE_TABLES.has(table_name)) {
            throw new Error(`Table '${table_name}' is not accessible`);
          }

          let query = sb.from(table_name).select('*', { count: 'exact', head: true });

          if (tenant_id) {
            query = query.eq('tenant_id', tenant_id);
          }

          const { count, error } = await query;

          if (error) {
            throw new Error(`Count failed: ${error.message}`);
          }

          result = { table: table_name, count: count || 0 };
          rowsReturned = 1;
          break;
        }

        default:
          throw new Error(`Tool ${toolName} not implemented`);
      }

      const executionTimeMs = Date.now() - startTime;

      // Audit log
      await logMCPRequest({
        userId: toolArgs.userId,
        tenantId: toolArgs.tenant_id,
        tool: toolName,
        queryName: toolArgs.query_name,
        rowsReturned,
        executionTimeMs,
        success: true
      });

      return new Response(JSON.stringify({
        content: [{ type: "json", data: result }],
        metadata: {
          rowsReturned,
          executionTimeMs,
          queryName: toolArgs.query_name
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error(`Unknown MCP method: ${method}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({
      error: {
        code: "internal_error",
        message: errorMessage
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
