// =====================================================
// MCP Cultural Competency Server
// Purpose: Culturally-informed clinical context for AI skills
// Features: 8 population profiles, communication guidance,
//           clinical considerations, barriers, SDOH codes,
//           traditional remedy interaction checking
//
// TIER 2 (user_scoped): Authenticated reference data
// Auth: JWT validation for authenticated users
// Rate: 100 req/min via MCP_RATE_LIMITS.cultural_competency
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkMCPRateLimit, getRequestIdentifier, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
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
import { validateForTool, validationErrorResponse, type ToolSchemaRegistry } from "../_shared/mcpInputValidator.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// P2-7: Declarative input validation schemas
const POPULATION_VALUES = [
  "veterans", "unhoused", "latino", "black_aa",
  "isolated_elderly", "indigenous", "immigrant_refugee", "lgbtq_elderly",
] as const;

const VALIDATION: ToolSchemaRegistry = {
  get_cultural_context: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
  },
  get_communication_guidance: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
    context: { type: 'enum', values: ['clinical', 'emergency', 'discharge', 'medication', 'end_of_life'] },
  },
  get_clinical_considerations: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
    conditions: { type: 'array', itemType: 'string' },
  },
  get_barriers_to_care: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
  },
  get_sdoh_codes: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
  },
  check_drug_interaction_cultural: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
    medications: { type: 'array', required: true, minItems: 1, itemType: 'string' },
  },
  get_trust_building_guidance: {
    population: { type: 'enum', required: true, values: [...POPULATION_VALUES] },
  },
};

// Initialize as user_scoped tier (profiles now in database)
// Falls back to hardcoded profiles if DB unavailable
const SERVER_CONFIG = {
  name: "mcp-cultural-competency-server",
  version: "1.1.0",
  tier: "user_scoped" as const,
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;

// Supabase client for database profile lookups (optional — falls back to hardcoded)
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

  // Health check endpoint (GET)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    // P4-2: Use shared rate limit config
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.cultural_competency);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.cultural_competency, corsHeaders);
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

        // Handle ping tool (no auth required)
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
                content: [{ type: "text", text: JSON.stringify(pingResult, null, 2) }],
              },
              id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // P4-1: Auth gate — require valid authenticated JWT
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

        // P2-7: Validate tool arguments before dispatch
        const validationErrors = validateForTool(name, args, VALIDATION);
        if (validationErrors && validationErrors.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        const result = await handleToolCall(name, args || {});
        const executionTimeMs = Date.now() - startTime;

        // P3-2: Success audit logging
        if (sb) {
          await logMCPAudit(sb, logger, {
            serverName: SERVER_CONFIG.name,
            toolName: name,
            requestId,
            userId: caller.userId,
            success: true,
            executionTimeMs,
            metadata: { tool: name, population: (args || {}).population },
          });
        }

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [
                { type: "text", text: JSON.stringify(result, null, 2) },
              ],
              metadata: {
                tool: name,
                executionTimeMs,
                provenance: {
                  dataSource: sb ? "database_with_fallback" : "reference_data",
                  safetyFlags: ["reference_only"],
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
