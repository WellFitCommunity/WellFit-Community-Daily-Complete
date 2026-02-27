// =====================================================
// MCP Edge Functions Server
// Purpose: Orchestrate and monitor Supabase Edge Functions via MCP
// Features: Function discovery, invocation, status tracking, audit logging
//
// TIER 3 (admin): Requires service role key to invoke edge functions
// Auth: Supabase apikey + service role key + admin role verification
// =====================================================

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkMCPRateLimit, getRequestIdentifier, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handleHealthCheck,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyAdminAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  CallerIdentity
} from "../_shared/mcpAuthGate.ts";
import { resolveTenantId } from "../_shared/mcpIdentity.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// Server configuration
const SERVER_CONFIG = {
  name: "mcp-edge-functions-server",
  version: "1.1.0",
  tier: "admin" as const
};

// Initialize with tiered approach - Tier 3 requires service role
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// Tier 3 requires service role - fail fast if not available
if (!initResult.supabase) {
  throw new Error(`MCP Edge Functions server requires service role key: ${initResult.error}`);
}

const sb = initResult.supabase;
const SERVICE_KEY = SB_SECRET_KEY;
const { handleToolCall } = createToolHandlers(sb, logger, SUPABASE_URL, SERVICE_KEY);

// =====================================================
// Request Handler (MCP JSON-RPC Protocol)
// =====================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  // Rate limiting (P0-7)
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.edgeFunctions);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.edgeFunctions, corsHeaders);
  }

  try {
    const body = await req.json();
    const { method, params, id } = body;

    const authHeader = req.headers.get('Authorization');
    const authToken = authHeader?.replace('Bearer ', '');

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
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32602, message: `Unknown tool: ${toolName}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // AUTH GATE: Verify caller has admin access
      const authResult = await verifyAdminAccess(req, {
        serverName: SERVER_CONFIG.name,
        toolName: toolName,
        logger
      });

      if (!authResult.authorized) {
        logger.security("EDGE_FUNCTIONS_ACCESS_DENIED", {
          requestId,
          tool: toolName,
          reason: authResult.error
        });

        if (authResult.statusCode === 401) {
          return createUnauthorizedResponse(authResult.error || "Unauthorized", requestId, corsHeaders);
        }
        return createForbiddenResponse(authResult.error || "Forbidden", requestId, corsHeaders);
      }

      const caller = authResult.caller as CallerIdentity;

      // P0-2: Resolve tenant from caller identity, not tool args
      const resolvedTenant = resolveTenantId(
        caller,
        (toolArgs?.payload?.tenant_id ?? toolArgs?.tenant_id) as string | undefined,
        logger,
        requestId
      );

      logger.info("EDGE_FUNCTIONS_TOOL_CALL", {
        requestId,
        tool: toolName,
        userId: caller.userId,
        role: caller.role,
        tenantId: resolvedTenant
      });

      const result = await handleToolCall(
        toolName,
        toolArgs,
        SERVER_CONFIG,
        initResult,
        caller,
        resolvedTenant,
        authToken
      );

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          metadata: {
            tool: toolName,
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

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${method}`, data: { requestId } },
      id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("EDGE_FUNCTIONS_API_ERROR", { requestId, errorMessage });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: errorMessage,
        data: { requestId }
      },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
