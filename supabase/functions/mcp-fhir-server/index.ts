// =====================================================
// MCP FHIR Server - Entry Point (Thin Router)
// Purpose: Supabase serve() entry point with MCP protocol routing
// Features: Bundle export, resource CRUD, validation, EHR sync
//
// TIER 3 (admin): Requires service role key for FHIR operations
// Auth: Supabase apikey + service role key + clinical role verification
//
// Decomposed modules:
//   types.ts          - All interfaces and type definitions
//   tools.ts          - MCP tool definitions and FHIR table mappings
//   bundleBuilder.ts  - FHIR Bundle construction and Patient mapping
//   validation.ts     - FHIR resource validation rules
//   audit.ts          - FHIR operation audit logging
//   resourceQueries.ts - Patient bundle export and resource search
//   patientSummary.ts - CCD-style patient summary builder
//   toolHandlers.ts   - Tool handler dispatch and business logic
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handleHealthCheck,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyClinicalAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  type CallerIdentity
} from "../_shared/mcpAuthGate.ts";

import { TOOLS } from "./tools.ts";
import { executeToolHandler } from "./toolHandlers.ts";

// =====================================================
// Server Initialization
// =====================================================

const SERVER_CONFIG = {
  name: "mcp-fhir-server",
  version: "1.1.0",
  tier: "admin" as const
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// Tier 3 requires service role - fail fast if not available
if (!initResult.supabase) {
  throw new Error(`MCP FHIR server requires service role key: ${initResult.error}`);
}

const sb = initResult.supabase;

// =====================================================
// Request Handler
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

  try {
    const body = await req.json();
    const { method, params, id } = body;

    // MCP Protocol: Initialize handshake (no auth required - discovery)
    if (method === "initialize") {
      return new Response(JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools (no auth required - discovery)
    if (method === "tools/list") {
      return new Response(JSON.stringify(createToolsListResponse(TOOLS, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;

      if (!TOOLS[toolName as keyof typeof TOOLS]) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32602, message: `Unknown tool: ${toolName}`, data: { requestId } },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ============================================================
      // AUTH GATE: Verify caller has clinical access for FHIR operations
      // ============================================================
      const authResult = await verifyClinicalAccess(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger
      });

      if (!authResult.authorized) {
        logger.security("FHIR_ACCESS_DENIED", {
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
      logger.info("FHIR_TOOL_CALL", {
        requestId,
        tool: toolName,
        userId: caller.userId,
        role: caller.role,
        tenantId: caller.tenantId
      });

      // Delegate to tool handler
      const { result, executionTimeMs } = await executeToolHandler(
        toolName,
        toolArgs,
        {
          sb,
          logger,
          serverConfig: SERVER_CONFIG,
          initResult,
          caller: {
            userId: caller.userId,
            role: caller.role,
            tenantId: caller.tenantId
          }
        }
      );

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          metadata: {
            tool: toolName,
            executionTimeMs,
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
      error: { code: -32601, message: `Unknown MCP method: ${method}`, data: { requestId } },
      id: null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("FHIR_SERVER_ERROR", { requestId, errorMessage });

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
