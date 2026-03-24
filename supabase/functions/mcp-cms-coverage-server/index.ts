// =====================================================
// MCP CMS Coverage Database Server
// Purpose: Medicare coverage lookups for prior authorization
// Features: LCD/NCD search, coverage requirements, article lookup
// Data: Real CMS reference data from Supabase database tables
//
// TIER 2 (user_scoped): Authenticated reference data queries
// Auth: JWT validation for authenticated users
// Fallback: Hardcoded subset when DB unavailable (Tier 1 resilience)
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { getRequestIdentifier } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  handlePing,
  handleHealthCheck,
  checkInMemoryRateLimit,
  type MCPInitResult,
} from "../_shared/mcpServerBase.ts";
import { getRequestId } from "../_shared/mcpAuthGate.ts";
import { validateForTool, validationErrorResponse, type ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// P2-6: Declarative input validation schemas
const VALIDATION: ToolSchemaRegistry = {
  search_lcd: {
    query: { type: 'string', required: true },
    state: { type: 'state' },
    status: { type: 'enum', values: ['active', 'future', 'retired'] },
    limit: { type: 'number', min: 1, max: 100, integer: true },
  },
  search_ncd: {
    query: { type: 'string', required: true },
    status: { type: 'enum', values: ['active', 'future', 'retired'] },
    limit: { type: 'number', min: 1, max: 100, integer: true },
  },
  get_lcd_details: {
    lcd_id: { type: 'string', required: true },
  },
  get_ncd_details: {
    ncd_id: { type: 'string', required: true },
  },
  get_coverage_requirements: {
    code: { type: 'string', required: true },
    code_type: { type: 'enum', values: ['cpt', 'hcpcs', 'icd10'] },
    state: { type: 'state' },
  },
  check_prior_auth_required: {
    cpt_code: { type: 'string', required: true },
    state: { type: 'state' },
  },
  get_mac_contractors: {
    state: { type: 'state', required: true },
  },
  get_coverage_articles: {
    code: { type: 'string', required: true },
    article_type: { type: 'enum', values: ['billing', 'coding', 'utilization', 'all'] },
  },
};

// Initialize as Tier 2 (user_scoped) — queries real CMS database tables
// Falls back to hardcoded data if DB unavailable
const SERVER_CONFIG = {
  name: "mcp-cms-coverage-server",
  version: "2.0.0",
  tier: "user_scoped" as const
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

// Supabase client for database lookups (optional — falls back to hardcoded)
const sb = initResult.supabase ?? null;
const { handleToolCall } = createToolHandlers(logger, sb);

// =====================================================
// Main Handler (MCP JSON-RPC Protocol)
// =====================================================

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
    // Rate limiting (in-memory + identity-based when available)
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkInMemoryRateLimit(identifier, 100, 60000);

    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Rate limit exceeded" },
        id: null
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
        }
      });
    }

    const body = await req.json();
    const { method, params, id } = body;

    switch (method) {
      case "initialize": {
        return new Response(JSON.stringify(
          createInitializeResponse(SERVER_CONFIG, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/list": {
        return new Response(JSON.stringify(
          createToolsListResponse(TOOLS, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        logger.info("CMS Coverage tool call", { tool: name, hasDB: sb !== null });

        // P2-6: Declarative input validation
        const validationErrors = validateForTool(name, args, VALIDATION);
        if (validationErrors && validationErrors.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        // Handle ping tool
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, { supabase: sb, logger, canRateLimit });
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(pingResult, null, 2) }]
            },
            id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const result = await handleToolCall(name, args || {});
        const executionTimeMs = Date.now() - startTime;

        // P3-2: Success audit logging
        if (sb) {
          await logMCPAudit(sb, logger, {
            serverName: SERVER_CONFIG.name,
            toolName: name,
            requestId,
            success: true,
            executionTimeMs,
            metadata: { tool: name },
          });
        }

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            metadata: {
              tool: name,
              executionTimeMs
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify(
          createErrorResponse(-32601, `Method not found: ${method}`, id)
        ), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("CMS Coverage server error", { errorMessage: error.message, requestId });

    const errorResponse = createErrorResponse(-32603, error.message, null);
    return new Response(JSON.stringify({
      ...errorResponse,
      error: {
        ...(errorResponse.error as Record<string, unknown>),
        data: { requestId }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
