// =====================================================
// MCP Medical Coding Processor Server (#12)
// Chain 6: Per-Day Encounter Ledger + DRG Grouping
//
// Purpose: Auto-capture and optimize inpatient revenue
//   by aggregating all billable activity per calendar day,
//   running DRG grouping, and validating charge completeness.
//
// TIER 3 (admin): Requires service role key for DB writes
// Auth: Supabase apikey + service role key + clinical role
// Rate: 30 req/min (AI calls + DB writes)
//
// Advisory only — never auto-files charges or codes.
// All suggestions require human review and confirmation.
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  checkMCPRateLimit,
  checkPersistentRateLimit,
  getRequestIdentifier,
  getCallerRateLimitId,
  createRateLimitResponse
} from "../_shared/mcpRateLimiter.ts";
import type { RateLimitConfig } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createToolsListResponse,
  handleHealthCheck,
  checkBodySize,
  buildProvenance,
  MCP_BODY_LIMIT_BYTES
} from "../_shared/mcpServerBase.ts";
import type { MCPInitResult } from "../_shared/mcpServerBase.ts";
import {
  verifyClinicalAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse
} from "../_shared/mcpAuthGate.ts";
import type { CallerIdentity } from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity, resolveTenantId } from "../_shared/mcpIdentity.ts";
import {
  validateForTool,
  validationErrorResponse
} from "../_shared/mcpInputValidator.ts";
import type { ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// Server configuration — Tier 3 (admin)
const SERVER_CONFIG = {
  name: "mcp-medical-coding-server",
  version: "1.0.0",
  tier: "admin" as const
};

// Rate limit: 30 req/min (moderate — involves AI calls + DB writes)
const RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
  keyPrefix: 'mcp:medical_coding'
};

// Input validation schemas
const VALIDATION: ToolSchemaRegistry = {
  get_payer_rules: {
    payer_type: {
      type: 'enum',
      required: true,
      values: ['medicare', 'medicaid', 'commercial', 'tricare', 'workers_comp']
    },
    fiscal_year: { type: 'number', required: true, integer: true, min: 2020, max: 2040 },
    state_code: { type: 'state' },
    rule_type: {
      type: 'enum',
      values: ['drg_based', 'per_diem', 'case_rate', 'percent_of_charges', 'fee_schedule']
    },
    acuity_tier: {
      type: 'enum',
      values: ['icu', 'step_down', 'med_surg', 'rehab', 'psych', 'snf', 'ltac']
    }
  },
  upsert_payer_rule: {
    payer_type: {
      type: 'enum',
      required: true,
      values: ['medicare', 'medicaid', 'commercial', 'tricare', 'workers_comp']
    },
    fiscal_year: { type: 'number', required: true, integer: true, min: 2020, max: 2040 },
    rule_type: {
      type: 'enum',
      required: true,
      values: ['drg_based', 'per_diem', 'case_rate', 'percent_of_charges', 'fee_schedule']
    },
    effective_date: { type: 'date', required: true },
    expiration_date: { type: 'date' },
    state_code: { type: 'state' },
    base_rate_amount: { type: 'number', min: 0, max: 999999.99 },
    capital_rate_amount: { type: 'number', min: 0, max: 999999.99 },
    wage_index_factor: { type: 'number', min: 0.1, max: 5.0 },
    per_diem_rate: { type: 'number', min: 0, max: 999999.99 },
    allowable_percentage: { type: 'number', min: 0, max: 100 },
    max_days: { type: 'number', integer: true, min: 1, max: 9999 },
    outlier_threshold: { type: 'number', min: 0 },
    rule_description: { type: 'string', maxLength: 2000 },
    source_reference: { type: 'string', maxLength: 500 }
  },
  aggregate_daily_charges: {
    patient_id: { type: 'uuid', required: true },
    encounter_id: { type: 'uuid', required: true },
    service_date: { type: 'date', required: true }
  },
  get_daily_snapshot: {
    encounter_id: { type: 'uuid', required: true },
    service_date: { type: 'date' }
  },
  save_daily_snapshot: {
    encounter_id: { type: 'uuid', required: true },
    patient_id: { type: 'uuid', required: true },
    admit_date: { type: 'date', required: true },
    service_date: { type: 'date', required: true },
    day_number: { type: 'number', required: true, integer: true, min: 1, max: 9999 }
  },
  run_drg_grouper: {
    encounter_id: { type: 'uuid', required: true },
    patient_id: { type: 'uuid', required: true }
  },
  get_drg_result: {
    encounter_id: { type: 'uuid', required: true }
  },
  optimize_daily_revenue: {
    encounter_id: { type: 'uuid', required: true },
    service_date: { type: 'date', required: true }
  },
  validate_charge_completeness: {
    encounter_id: { type: 'uuid', required: true },
    service_date: { type: 'date', required: true }
  },
  get_revenue_projection: {
    payer_type: {
      type: 'enum',
      required: true,
      values: ['medicare', 'medicaid', 'commercial', 'tricare', 'workers_comp']
    },
    fiscal_year: { type: 'number', integer: true, min: 2020, max: 2040 },
    encounter_id: { type: 'uuid' },
    drg_weight: { type: 'number', min: 0, max: 100 },
    state_code: { type: 'state' },
    wage_index_override: { type: 'number', min: 0.1, max: 5.0 }
  }
};

// Initialize as Tier 3 — requires service role key for DB writes
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

if (!initResult.supabase) {
  throw new Error(
    `MCP Medical Coding server requires service role key: ${initResult.error}`
  );
}

const sb = initResult.supabase;
const { handleToolCall } = createToolHandlers(sb, logger);

// =====================================================
// MCP JSON-RPC Server
// =====================================================
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check (GET)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  // Body size limit (512KB)
  const bodySizeResponse = checkBodySize(req, MCP_BODY_LIMIT_BYTES, corsHeaders);
  if (bodySizeResponse) return bodySizeResponse;

  try {
    // IP-based rate limiting (DoS protection)
    const rateLimitId = getRequestIdentifier(req);
    const rateLimitResult = checkMCPRateLimit(rateLimitId, RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, RATE_LIMIT, corsHeaders);
    }

    // Parse JSON-RPC
    const body = await req.json();
    const { method, params, id } = body;

    switch (method) {
      case "initialize": {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2025-11-25",
            serverInfo: {
              name: SERVER_CONFIG.name,
              version: SERVER_CONFIG.version
            },
            capabilities: { tools: {} }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/list": {
        // Tier 3: auth required for tool discovery
        const listCaller = await extractCallerIdentity(req, {
          serverName: SERVER_CONFIG.name,
          logger
        });
        if (!listCaller) {
          return createUnauthorizedResponse(
            "Authentication required for tool discovery on admin servers",
            requestId, corsHeaders
          );
        }
        return new Response(
          JSON.stringify(createToolsListResponse(TOOLS, id)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        // Validate tool exists
        if (!name || !TOOLS[name as keyof typeof TOOLS]) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32602,
              message: `Unknown tool: ${name}`,
              data: { requestId }
            },
            id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // AUTH GATE: clinical/admin access required
        const authResult = await verifyClinicalAccess(req, {
          serverName: SERVER_CONFIG.name,
          toolName: name,
          logger
        });

        if (!authResult.authorized) {
          logger.security("MEDICAL_CODING_ACCESS_DENIED", {
            requestId,
            tool: name,
            reason: authResult.error
          });

          if (authResult.statusCode === 401) {
            return createUnauthorizedResponse(
              authResult.error || "Unauthorized", requestId, corsHeaders
            );
          }
          return createForbiddenResponse(
            authResult.error || "Forbidden", requestId, corsHeaders
          );
        }

        const caller = authResult.caller as CallerIdentity;

        // Identity-based rate limiting (cross-instance)
        const identityRateResult = await checkPersistentRateLimit(
          sb, getCallerRateLimitId(caller), RATE_LIMIT
        );
        if (!identityRateResult.allowed) {
          return createRateLimitResponse(
            identityRateResult, RATE_LIMIT, corsHeaders
          );
        }

        // Resolve tenant from caller identity
        const resolvedTenant = resolveTenantId(
          caller,
          (args || {}).tenant_id as string | undefined,
          logger,
          requestId
        );

        const securedArgs = { ...(args || {}) };
        if (resolvedTenant) {
          securedArgs.tenant_id = resolvedTenant;
        }

        logger.info("MEDICAL_CODING_TOOL_CALL", {
          requestId,
          tool: name,
          userId: caller.userId,
          role: caller.role,
          tenantId: resolvedTenant
        });

        // Validate tool arguments
        const validationErrors = validateForTool(name, securedArgs, VALIDATION);
        if (validationErrors && validationErrors.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        // Dispatch to handler
        const result = await handleToolCall(name, securedArgs);

        // Determine provenance based on tool type
        const aiTools = ['run_drg_grouper', 'optimize_daily_revenue'];
        const dataSource = aiTools.includes(name) ? 'ai_generated' : 'database';
        const safetyFlags = aiTools.includes(name)
          ? ['ai_generated' as const, 'requires_clinical_review' as const]
          : undefined;

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [{
              type: "text",
              text: JSON.stringify(result, null, 2)
            }],
            metadata: {
              tool: name,
              executionTimeMs: Date.now() - startTime,
              requestId,
              caller: {
                userId: caller.userId,
                role: caller.role
              },
              provenance: buildProvenance(dataSource, {
                dataFreshnessISO: new Date().toISOString(),
                safetyFlags
              })
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
            data: { requestId }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("MEDICAL_CODING_API_ERROR", {
      requestId,
      errorMessage: error.message
    });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: error.message,
        data: { requestId }
      },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
