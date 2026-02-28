// =====================================================
// MCP Prior Authorization API Server
// CMS-0057-F Compliance (January 2027 Mandate)
// Purpose: FHIR-based Prior Authorization API
// Features: Submit PA, check status, manage appeals
// Standards: Da Vinci PAS IG, HL7 FHIR R4
//
// TIER 3 (admin): Requires service role key for database writes
// Auth: Supabase apikey + service role key + clinical role verification
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkMCPRateLimit, getRequestIdentifier, getCallerRateLimitId, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handlePing,
  handleHealthCheck,
  MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyClinicalAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  CallerIdentity
} from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity, resolveTenantId } from "../_shared/mcpIdentity.ts";
import { validateForTool, validationErrorResponse, type ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// P2-1: Input validation schemas for prior auth tools
const VALIDATION: ToolSchemaRegistry = {
  create_prior_auth: {
    patient_id: { type: 'uuid', required: true },
    payer_id: { type: 'string', required: true, maxLength: 100 },
    service_codes: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'string' },
    diagnosis_codes: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'string' },
    urgency: { type: 'enum', values: ['stat', 'urgent', 'routine'] },
    ordering_provider_npi: { type: 'npi' },
    rendering_provider_npi: { type: 'npi' },
    facility_npi: { type: 'npi' },
    date_of_service: { type: 'date' },
    clinical_notes: { type: 'string', maxLength: 10000 },
    requested_units: { type: 'number', min: 1, max: 9999, integer: true },
  },
  submit_prior_auth: {
    prior_auth_id: { type: 'uuid', required: true },
  },
  get_prior_auth: {
    prior_auth_id: { type: 'uuid' },
    auth_number: { type: 'string', maxLength: 100 },
  },
  get_patient_prior_auths: {
    patient_id: { type: 'uuid', required: true },
    status: { type: 'enum', values: ['active', 'pending', 'completed'] },
  },
  record_decision: {
    prior_auth_id: { type: 'uuid', required: true },
    decision_type: { type: 'enum', required: true, values: ['approved', 'denied', 'partial_approval', 'pended', 'cancelled'] },
    approved_units: { type: 'number', min: 0, max: 99999, integer: true },
    approved_start_date: { type: 'date' },
    approved_end_date: { type: 'date' },
    appeal_deadline: { type: 'date' },
    denial_reason_description: { type: 'string', maxLength: 2000 },
  },
  create_appeal: {
    prior_auth_id: { type: 'uuid', required: true },
    decision_id: { type: 'uuid' },
    appeal_reason: { type: 'string', required: true, maxLength: 5000 },
    appeal_type: { type: 'enum', values: ['reconsideration', 'peer_to_peer', 'external_review'] },
    clinical_rationale: { type: 'string', maxLength: 10000 },
  },
  check_prior_auth_required: {
    patient_id: { type: 'uuid', required: true },
    service_codes: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'string' },
    date_of_service: { type: 'date', required: true },
  },
  get_pending_prior_auths: {
    hours_threshold: { type: 'number', min: 1, max: 720, integer: true },
  },
  get_prior_auth_statistics: {
    start_date: { type: 'date' },
    end_date: { type: 'date' },
  },
  cancel_prior_auth: {
    prior_auth_id: { type: 'uuid', required: true },
    reason: { type: 'string', maxLength: 2000 },
  },
  to_fhir_claim: {
    prior_auth_id: { type: 'uuid', required: true },
  },
};

// Initialize as Tier 3 (admin) - requires service role key for DB writes
const SERVER_CONFIG = {
  name: "mcp-prior-auth-server",
  version: "1.1.0",
  tier: "admin" as const
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

// If init failed, this server cannot operate
if (!initResult.supabase) {
  throw new Error(`MCP Prior Auth server requires service role key: ${initResult.error}`);
}

// Non-null after guard - TypeScript needs this explicit assignment
const sb = initResult.supabase;
const { handleToolCall } = createToolHandlers(sb, logger);

// =====================================================
// MCP JSON-RPC Server
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    // Rate limiting
    const rateLimitId = getRequestIdentifier(req);
    const rateLimitResult = checkMCPRateLimit(rateLimitId, MCP_RATE_LIMITS.prior_auth);

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.prior_auth, corsHeaders);
    }

    // Parse JSON-RPC request
    const body = await req.json();
    const { method, params, id } = body;

    // Handle MCP JSON-RPC methods
    switch (method) {
      case "initialize": {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            protocolVersion: "2025-11-25",
            serverInfo: {
              name: "mcp-prior-auth-server",
              version: "1.1.0"
            },
            capabilities: {
              tools: {}
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/list": {
        // Auth required on Tier 3 — P1-2
        const listCaller = await extractCallerIdentity(req, { serverName: SERVER_CONFIG.name, logger });
        if (!listCaller) {
          return createUnauthorizedResponse(
            "Authentication required for tool discovery on admin servers",
            requestId, corsHeaders
          );
        }
        return new Response(JSON.stringify(createToolsListResponse(TOOLS, id)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        if (!name || !TOOLS[name as keyof typeof TOOLS]) {
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32602, message: `Unknown tool: ${name}`, data: { requestId } },
            id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // AUTH GATE: Verify caller has clinical/admin access
        const authResult = await verifyClinicalAccess(req, {
          serverName: SERVER_CONFIG.name,
          toolName: name,
          logger
        });

        if (!authResult.authorized) {
          logger.security("PRIOR_AUTH_ACCESS_DENIED", {
            requestId,
            tool: name,
            reason: authResult.error
          });

          if (authResult.statusCode === 401) {
            return createUnauthorizedResponse(authResult.error || "Unauthorized", requestId, corsHeaders);
          }
          return createForbiddenResponse(authResult.error || "Forbidden", requestId, corsHeaders);
        }

        const caller = authResult.caller as CallerIdentity;

        // P1-3: Identity-based rate limiting (per user/key, not just IP)
        const identityRateResult = checkMCPRateLimit(
          getCallerRateLimitId(caller), MCP_RATE_LIMITS.prior_auth
        );
        if (!identityRateResult.allowed) {
          return createRateLimitResponse(identityRateResult, MCP_RATE_LIMITS.prior_auth, corsHeaders);
        }

        // P0-2: Resolve tenant from caller identity, not tool args
        const resolvedTenant = resolveTenantId(
          caller,
          (args || {}).tenant_id as string | undefined,
          logger,
          requestId
        );

        // Override tenant_id in args with identity-resolved value
        const securedArgs = { ...(args || {}) };
        if (resolvedTenant) {
          securedArgs.tenant_id = resolvedTenant;
        }

        logger.info("PRIOR_AUTH_TOOL_CALL", {
          requestId,
          tool: name,
          userId: caller.userId,
          role: caller.role,
          tenantId: resolvedTenant
        });

        // P2-1: Validate tool arguments before dispatch
        const validationErrors = validateForTool(name, securedArgs, VALIDATION);
        if (validationErrors && validationErrors.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        const result = await handleToolCall(name, securedArgs);

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            metadata: {
              tool: name,
              executionTimeMs: Date.now() - startTime,
              requestId,
              caller: {
                userId: caller.userId,
                role: caller.role
              }
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
          error: { code: -32601, message: `Method not found: ${method}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("PRIOR_AUTH_API_ERROR", { requestId, errorMessage: error.message });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32603, message: error.message, data: { requestId } },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
