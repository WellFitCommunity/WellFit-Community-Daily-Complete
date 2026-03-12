// =====================================================
// MCP DRG Grouper Server (Standalone)
// Purpose: AI-powered MS-DRG assignment as independent SaaS API
//
// Extracted from mcp-medical-coding-server for monetization.
// Hospitals integrate via MCP protocol or REST wrapper.
// No WellFit or Envision Atlus UI required.
//
// TIER 3 (admin): Requires service role key for DB writes
// Auth: Supabase apikey + service role key + clinical role
// Rate: 20 req/min (AI calls are expensive)
//
// Advisory only — never auto-assigns codes.
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
import { createDRGGrouperHandlers } from "./drgGrouperHandlers.ts";
import { createRevenueHandlers } from "./revenueHandlers.ts";
import { createRevenueOptimizerHandlers } from "./revenueOptimizerHandlers.ts";

// Server configuration — Tier 3 (admin), standalone product
const SERVER_CONFIG = {
  name: "mcp-drg-grouper-server",
  version: "1.0.0",
  tier: "admin" as const
};

// Rate limit: 20 req/min (stricter — every call invokes Claude)
const RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000,
  keyPrefix: 'mcp:drg_grouper'
};

// Input validation schemas
const VALIDATION: ToolSchemaRegistry = {
  run_drg_grouper: {
    encounter_id: { type: 'uuid', required: true },
    patient_id: { type: 'uuid', required: true }
  },
  get_drg_result: {
    encounter_id: { type: 'uuid', required: true }
  },
  estimate_reimbursement: {
    payer_type: { type: 'string', required: true }
  },
  validate_coding: {
    encounter_id: { type: 'uuid', required: true },
    service_date: { type: 'string', required: true }
  },
  flag_revenue_risk: {
    encounter_id: { type: 'uuid', required: true },
    service_date: { type: 'string', required: true }
  },
  get_payer_rules: {
    payer_type: { type: 'string', required: true },
    fiscal_year: { type: 'number', required: true }
  }
};

// Initialize as Tier 3 — requires service role key for DB writes
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

if (!initResult.supabase) {
  throw new Error(
    `MCP DRG Grouper server requires service role key: ${initResult.error}`
  );
}

const sb = initResult.supabase;
const { handleRunDRGGrouper, handleGetDRGResult } = createDRGGrouperHandlers(sb, logger);
const { handleEstimateReimbursement, handleGetPayerRules } = createRevenueHandlers(sb, logger);
const { handleFlagRevenueRisk, handleValidateCoding } = createRevenueOptimizerHandlers(sb, logger);

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
          logger,
          requiredScope: "mcp:drg_grouper"
        });

        if (!authResult.authorized) {
          logger.security("DRG_GROUPER_ACCESS_DENIED", {
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

        logger.info("DRG_GROUPER_TOOL_CALL", {
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
        let result: unknown;
        switch (name) {
          case 'run_drg_grouper':
            result = await handleRunDRGGrouper(securedArgs);
            break;
          case 'get_drg_result':
            result = await handleGetDRGResult(securedArgs);
            break;
          case 'estimate_reimbursement':
            result = await handleEstimateReimbursement(securedArgs);
            break;
          case 'get_payer_rules':
            result = await handleGetPayerRules(securedArgs);
            break;
          case 'flag_revenue_risk':
            result = await handleFlagRevenueRisk(securedArgs);
            break;
          case 'validate_coding':
            result = await handleValidateCoding(securedArgs);
            break;
          default:
            return new Response(JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32602, message: `Unknown tool: ${name}`, data: { requestId } },
              id
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // AI tools require clinical review flagging
        const aiTools = ['run_drg_grouper', 'flag_revenue_risk'];
        const safetyFlags: Array<'ai_generated' | 'requires_clinical_review'> =
          aiTools.includes(name)
            ? ['ai_generated', 'requires_clinical_review']
            : [];

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
              provenance: buildProvenance(
                aiTools.includes(name) ? 'ai_generated' : 'database',
                {
                  dataFreshnessISO: new Date().toISOString(),
                  safetyFlags: safetyFlags.length > 0 ? safetyFlags : undefined
                }
              )
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
    logger.error("DRG_GROUPER_API_ERROR", {
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
