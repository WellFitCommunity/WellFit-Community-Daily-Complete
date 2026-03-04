// =====================================================
// MCP Medical Codes Server
// Purpose: Unified access to CPT, ICD-10, HCPCS, and modifier codes
// Features: Smart search, code validation, bundling rules, audit logging
//
// TIER 2 (user_scoped): Uses ANON key + RLS for public reference data
// Auth: Supabase apikey + user JWT (RLS enforced)
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkMCPRateLimit, checkPersistentRateLimit, getRequestIdentifier, getCallerRateLimitId, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  createErrorResponse,
  createPerRequestClient,
  handleHealthCheck,
  checkBodySize,
  buildProvenance,
  MCP_BODY_LIMIT_BYTES,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import { getRequestId, createUnauthorizedResponse } from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity } from "../_shared/mcpIdentity.ts";
import { validateForTool, validationErrorResponse, type ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// P2-1: Input validation schemas for medical codes tools
const VALIDATION: ToolSchemaRegistry = {
  search_cpt: {
    query: { type: 'string', required: true, maxLength: 200 },
    category: { type: 'string', maxLength: 100 },
    limit: { type: 'number', min: 1, max: 100, integer: true },
  },
  search_icd10: {
    query: { type: 'string', required: true, maxLength: 200 },
    chapter: { type: 'string', maxLength: 100 },
    limit: { type: 'number', min: 1, max: 100, integer: true },
  },
  search_hcpcs: {
    query: { type: 'string', required: true, maxLength: 200 },
    level: { type: 'enum', values: ['I', 'II'] },
    limit: { type: 'number', min: 1, max: 100, integer: true },
  },
  get_modifiers: {
    code: { type: 'string', required: true, maxLength: 10 },
    code_type: { type: 'enum', values: ['cpt', 'hcpcs'] },
  },
  validate_code_combination: {
    cpt_codes: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'string' },
    icd10_codes: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'string' },
    modifiers: { type: 'array', maxItems: 20, itemType: 'string' },
  },
  check_bundling: {
    cpt_codes: { type: 'array', required: true, minItems: 1, maxItems: 50, itemType: 'string' },
  },
  get_code_details: {
    code: { type: 'string', required: true, maxLength: 10 },
    code_type: { type: 'enum', required: true, values: ['cpt', 'icd10', 'hcpcs'] },
  },
  suggest_codes: {
    description: { type: 'string', required: true, maxLength: 2000 },
    code_types: { type: 'array', maxItems: 3, itemType: 'string' },
    limit: { type: 'number', min: 1, max: 20, integer: true },
  },
  get_sdoh_codes: {
    category: { type: 'enum', values: ['housing', 'food', 'transportation', 'employment', 'education', 'social', 'all'] },
  },
};

// Server configuration
const SERVER_CONFIG = {
  name: "mcp-medical-codes-server",
  version: "1.2.0",
  tier: "user_scoped" as const
};

// Initialize with tiered approach - Tier 2 uses ANON key + RLS
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

// Tier 2 requires Supabase for code lookups
if (!initResult.supabase) {
  throw new Error(`MCP Medical Codes server requires SUPABASE_URL and SB_ANON_KEY: ${initResult.error}`);
}

// Non-null after guard
const sb = initResult.supabase;
const { handleToolCall } = createToolHandlers(sb, logger);

// =====================================================
// Request Handler (MCP JSON-RPC Protocol)
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Health endpoint for monitoring
  if (new URL(req.url).pathname.endsWith("/health")) {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  // P3-3: Body size limit (512KB)
  const bodySizeResponse = checkBodySize(req, MCP_BODY_LIMIT_BYTES, corsHeaders);
  if (bodySizeResponse) return bodySizeResponse;

  // Rate limiting
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.medicalCodes);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.medicalCodes, corsHeaders);
  }

  try {
    const requestId = getRequestId(req);
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake
    if (method === "initialize") {
      return new Response(JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools
    if (method === "tools/list") {
      return new Response(JSON.stringify(createToolsListResponse(TOOLS, id)), {
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

      // P0-8: Auth gate — require valid authenticated JWT before tool execution
      const caller = await extractCallerIdentity(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger,
      });

      if (!caller) {
        return createUnauthorizedResponse(
          "Authentication required. Provide a valid Bearer token.",
          requestId,
          corsHeaders
        );
      }

      // S2-2: Persistent identity-based rate limiting (cross-instance)
      if (initResult.supabase) {
        const identityRateResult = await checkPersistentRateLimit(
          initResult.supabase, getCallerRateLimitId(caller), MCP_RATE_LIMITS.medicalCodes
        );
        if (!identityRateResult.allowed) {
          return createRateLimitResponse(identityRateResult, MCP_RATE_LIMITS.medicalCodes, corsHeaders);
        }
      }

      // P2-1: Validate tool arguments before dispatch
      const validationErrors = validateForTool(toolName, toolArgs, VALIDATION);
      if (validationErrors && validationErrors.length > 0) {
        return validationErrorResponse(validationErrors, id, corsHeaders);
      }

      // Per-request client: forwards caller's JWT so RLS evaluates against
      // the actual user, not the global anon key (P0-1 security fix)
      const userClient = createPerRequestClient(req);

      const { result, codesReturned } = await handleToolCall(
        toolName,
        toolArgs,
        userClient,
        SERVER_CONFIG,
        initResult,
        caller?.userId
      );

      const executionTimeMs = Date.now() - startTime;

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          metadata: {
            codesReturned,
            executionTimeMs,
            tool: toolName,
            requestId,
            provenance: buildProvenance('database', {
              safetyFlags: ['reference_only']
            })
          }
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(
      createErrorResponse(-32601, `Method not found: ${method}`, id)
    ), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Medical codes server error", {
      errorMessage: error.message,
      stack: error.stack
    });

    return new Response(JSON.stringify(
      createErrorResponse(-32603, error.message, null)
    ), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
