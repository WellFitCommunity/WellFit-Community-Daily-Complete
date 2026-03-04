// =====================================================
// MCP PostgreSQL Server
// Purpose: Safe, controlled database operations via MCP
// Features: RLS enforcement, query whitelisting, audit logging
//
// TIER 2 (user_scoped): Uses ANON key + RLS for tenant isolation
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
import { getRequestId } from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity, resolveTenantId } from "../_shared/mcpIdentity.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// Initialize as Tier 2 (user_scoped) - uses anon key with RLS
const SERVER_CONFIG = {
  name: "mcp-postgres-server",
  version: "1.2.0",
  tier: "user_scoped" as const
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

if (!initResult.supabase) {
  throw new Error(`MCP Postgres server requires Supabase configuration: ${initResult.error}`);
}

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

  // Health check endpoint
  if (req.method === "GET" && new URL(req.url).pathname.endsWith("/health")) {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  const requestId = getRequestId(req);

  // P3-3: Body size limit (512KB)
  const bodySizeResponse = checkBodySize(req, MCP_BODY_LIMIT_BYTES, corsHeaders);
  if (bodySizeResponse) return bodySizeResponse;

  // Rate limiting
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.postgres);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.postgres, corsHeaders);
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake
    if (method === "initialize") {
      return new Response(JSON.stringify(
        createInitializeResponse(SERVER_CONFIG, id)
      ), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools
    if (method === "tools/list") {
      return new Response(JSON.stringify(
        createToolsListResponse(TOOLS, id)
      ), {
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

      // Per-request client for RLS (P0-1 security fix)
      const userClient = createPerRequestClient(req);

      // P0-2: Extract tenant from caller identity
      const caller = await extractCallerIdentity(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger,
      });
      // S2-2: Persistent identity-based rate limiting (cross-instance)
      if (caller && initResult.supabase) {
        const identityRateResult = await checkPersistentRateLimit(
          initResult.supabase, getCallerRateLimitId(caller), MCP_RATE_LIMITS.postgres
        );
        if (!identityRateResult.allowed) {
          return createRateLimitResponse(identityRateResult, MCP_RATE_LIMITS.postgres, corsHeaders);
        }
      }

      const resolvedTenantId = resolveTenantId(
        caller,
        toolArgs.tenant_id as string | undefined,
        logger,
        requestId
      );

      const { result, rowsReturned } = await handleToolCall(
        toolName,
        toolArgs,
        userClient,
        SERVER_CONFIG,
        initResult,
        caller,
        resolvedTenantId,
        requestId
      );

      const executionTimeMs = Date.now() - startTime;

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          metadata: {
            rowsReturned,
            executionTimeMs,
            queryName: toolArgs.query_name,
            requestId,
            provenance: buildProvenance('database', {
              dataFreshnessISO: new Date().toISOString()
            })
          }
        },
        id
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId
        }
      });
    }

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${method}` },
      id
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": requestId
      }
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("MCP Postgres server error", {
      errorMessage: error.message,
      requestId
    });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32603, message: error.message },
      id: null
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-Id": requestId
      }
    });
  }
});
