// =====================================================
// MCP Patient Context Server
// Purpose: Canonical cross-system patient data path (Shared Spine S5)
//
// This server wraps patientContextService as MCP tools so any AI
// agent — clinical, community, or shared — can fetch patient context
// through a single authoritative surface. Eliminates per-feature
// ad-hoc queries against patient tables.
//
// ATLUS principles this serves:
//   - Unity:          one source of truth for patient context
//   - Accountability: every response carries context_meta with
//                     data_sources, warnings, and fetch_duration_ms
//
// TIER 2 (user_scoped): Authenticated clinical/admin users only
// Auth: JWT validation — RLS enforces tenant isolation
// Rate: 100 req/min via MCP_RATE_LIMITS.patient_context
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  checkMCPRateLimit,
  getRequestIdentifier,
  createRateLimitResponse,
  MCP_RATE_LIMITS,
} from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  handlePing,
  handleHealthCheck,
  type MCPInitResult,
} from "../_shared/mcpServerBase.ts";
import { getRequestId, createUnauthorizedResponse } from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity } from "../_shared/mcpIdentity.ts";
import {
  validateForTool,
  validationErrorResponse,
  type ToolSchemaRegistry,
} from "../_shared/mcpInputValidator.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// -------------------------------------------------------
// Input validation
// -------------------------------------------------------
const VALIDATION: ToolSchemaRegistry = {
  get_patient_context: {
    patient_id: { type: "uuid", required: true },
    include_contacts: { type: "boolean" },
    include_timeline: { type: "boolean" },
    include_risk: { type: "boolean" },
    timeline_days: { type: "number", min: 1, max: 365 },
    max_timeline_events: { type: "number", min: 1, max: 500 },
  },
  get_minimal_context: {
    patient_id: { type: "uuid", required: true },
  },
  get_patient_contacts: {
    patient_id: { type: "uuid", required: true },
  },
  get_patient_timeline: {
    patient_id: { type: "uuid", required: true },
    days: { type: "number", min: 1, max: 365 },
    max_events: { type: "number", min: 1, max: 500 },
  },
  get_patient_risk_summary: {
    patient_id: { type: "uuid", required: true },
  },
  patient_exists: {
    patient_id: { type: "uuid", required: true },
  },
};

// -------------------------------------------------------
// Server initialization (user_scoped tier)
// -------------------------------------------------------
const SERVER_CONFIG = {
  name: "mcp-patient-context-server",
  version: "1.0.0",
  tier: "user_scoped" as const,
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

if (!initResult.supabase) {
  throw new Error("mcp-patient-context-server requires a Supabase client");
}

const sb = initResult.supabase;
const { handleToolCall } = createToolHandlers(sb, logger);

const RATE_LIMIT = MCP_RATE_LIMITS.patient_context;

// -------------------------------------------------------
// Main handler (MCP JSON-RPC)
// -------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkMCPRateLimit(identifier, RATE_LIMIT);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, RATE_LIMIT, corsHeaders);
    }

    const body = await req.json();
    const { method, params, id } = body;

    switch (method) {
      case "initialize":
        return new Response(JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "tools/list":
        return new Response(JSON.stringify(createToolsListResponse(TOOLS, id)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        logger.info("Patient context tool call", { tool: name });

        // ping is unauthenticated (health check only)
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, {
            supabase: sb,
            logger,
            canRateLimit,
          });
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: { content: [{ type: "text", text: JSON.stringify(pingResult, null, 2) }] },
              id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // All other tools require auth (PHI access)
        const caller = await extractCallerIdentity(req, {
          serverName: SERVER_CONFIG.name,
          toolName: name,
          logger,
        });

        if (!caller) {
          return createUnauthorizedResponse(
            "Authentication required. Provide a valid Bearer token.",
            requestId,
            corsHeaders
          );
        }

        const validationErrors = validateForTool(name, args, VALIDATION);
        if (validationErrors && validationErrors.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        const result = await handleToolCall(name, args || {});
        const executionTimeMs = Date.now() - startTime;

        // Audit log with caller identity (NOT the patient_id — per adversarial
        // audit lesson: the cost/activity trail records who accessed, not
        // the subject of the access).
        await logMCPAudit(sb, logger, {
          serverName: SERVER_CONFIG.name,
          toolName: name,
          requestId,
          userId: caller.userId,
          success: !(result as { error?: string }).error,
          executionTimeMs,
          metadata: {
            tool: name,
            patient_id: (args || {}).patient_id,
            had_error: Boolean((result as { error?: string }).error),
          },
        });

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              metadata: {
                tool: name,
                executionTimeMs,
                provenance: {
                  dataSource: "canonical_patient_context",
                  safetyFlags: ["rls_enforced", "audit_logged", "phi_access"],
                },
              },
            },
            id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify(createErrorResponse(-32601, `Method not found: ${method}`, id)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Patient context server error", {
      errorMessage: error.message,
      requestId,
    });

    const errorResponse = createErrorResponse(-32603, error.message, null);
    return new Response(
      JSON.stringify({
        ...errorResponse,
        error: {
          ...(errorResponse.error as Record<string, unknown>),
          data: { requestId },
        },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
