// =====================================================
// MCP Cultural Competency Server
// Purpose: Culturally-informed clinical context for AI skills
// Features: 8 population profiles, communication guidance,
//           clinical considerations, barriers, SDOH codes,
//           traditional remedy interaction checking
//
// TIER 2 (user_scoped): Authenticated reference data
// Auth: JWT validation for authenticated users
// Rate: 30 req/min (reference data, not high-frequency)
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
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// Initialize as external_api tier (hardcoded reference data, no DB needed)
// Auth is handled via Supabase apikey header (edge function access)
const SERVER_CONFIG = {
  name: "mcp-cultural-competency-server",
  version: "1.0.0",
  tier: "external_api" as const,
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

  // Health check endpoint (GET)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    // Rate limiting: 30 req/min for reference data
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkInMemoryRateLimit(identifier, 30, 60000);

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Rate limit exceeded" },
          id: null,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    const body = await req.json();
    const { method, params, id } = body;

    switch (method) {
      case "initialize": {
        return new Response(
          JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "tools/list": {
        return new Response(
          JSON.stringify(createToolsListResponse(TOOLS, id)),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        logger.info("Cultural competency tool call", { tool: name });

        // Handle ping tool
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, {
            supabase: null,
            logger,
            canRateLimit,
          });
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(pingResult, null, 2),
                  },
                ],
              },
              id,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const result = await handleToolCall(name, args || {});

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
              ],
              metadata: {
                tool: name,
                executionTimeMs: Date.now() - startTime,
                provenance: {
                  dataSource: "reference_data",
                  safetyFlags: ["reference_only"],
                },
              },
            },
            id,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify(
            createErrorResponse(-32601, `Method not found: ${method}`, id)
          ),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Cultural competency server error", {
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
