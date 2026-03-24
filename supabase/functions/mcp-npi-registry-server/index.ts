// =====================================================
// MCP NPI Registry Server
// Purpose: National Provider Identifier validation and lookup
// Features: NPI search, validation, provider details, taxonomy codes
// API: CMS NPI Registry API (https://npiregistry.cms.hhs.gov/api)
//
// TIER 1 (external_api): No Supabase required - calls public CMS API
// Auth: Supabase apikey header only (for edge function access)
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
} from "../_shared/mcpServerBase.ts";
import { getRequestId } from "../_shared/mcpAuthGate.ts";
import { validateForTool, validationErrorResponse, type ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// P2-1: Input validation schemas for NPI registry tools
const VALIDATION: ToolSchemaRegistry = {
  validate_npi: {
    npi: { type: 'npi', required: true },
  },
  lookup_npi: {
    npi: { type: 'npi', required: true },
  },
  search_providers: {
    first_name: { type: 'string', maxLength: 100 },
    last_name: { type: 'string', maxLength: 100 },
    organization_name: { type: 'string', maxLength: 200 },
    taxonomy_description: { type: 'string', maxLength: 200 },
    city: { type: 'string', maxLength: 100 },
    state: { type: 'state' },
    postal_code: { type: 'zip' },
    enumeration_type: { type: 'enum', values: ['NPI-1', 'NPI-2'] },
    limit: { type: 'number', min: 1, max: 200, integer: true },
  },
  search_by_specialty: {
    taxonomy_code: { type: 'string', required: true, maxLength: 20 },
    state: { type: 'state' },
    city: { type: 'string', maxLength: 100 },
    limit: { type: 'number', min: 1, max: 200, integer: true },
  },
  get_taxonomy_codes: {
    specialty: { type: 'string', required: true, maxLength: 200 },
    category: { type: 'enum', values: ['individual', 'organization', 'all'] },
  },
  bulk_validate_npis: {
    npis: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'npi' },
  },
  get_provider_identifiers: {
    npi: { type: 'npi', required: true },
  },
  check_npi_deactivation: {
    npi: { type: 'npi', required: true },
  },
};

// Initialize as Tier 1 (external_api) - no Supabase required
const SERVER_CONFIG = {
  name: "mcp-npi-registry-server",
  version: "1.1.0",
  tier: "external_api" as const
};

const initResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;
const { handleToolCall } = createToolHandlers(logger);

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
    // Rate limiting (in-memory since no Supabase required)
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

        logger.info("NPI Registry tool call", { tool: name });

        // Handle ping tool
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, { supabase: null, logger, canRateLimit });
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

        // P2-1: Validate tool arguments before dispatch
        const validationErrors = validateForTool(name, args || {}, VALIDATION);
        if (validationErrors && validationErrors.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        const result = await handleToolCall(name, args || {});
        const executionTimeMs = Date.now() - startTime;

        // P3-1: Success audit logging
        if (initResult.supabase) {
          await logMCPAudit(initResult.supabase, logger, {
            serverName: SERVER_CONFIG.name,
            toolName: name,
            success: true,
            executionTimeMs,
            metadata: { argsKeys: Object.keys(args || {}) }
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
    logger.error("NPI Registry server error", { errorMessage: error.message, requestId });

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
