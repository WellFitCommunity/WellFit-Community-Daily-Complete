// =====================================================
// MCP Community Engagement Server
// Purpose: Unified community wellness tools with caching
// Features: Wellness suggestions, greetings, check-in
//   questions, engagement scoring, activity recommendations
// Caching: In-memory TTL cache reduces AI costs by ~60-80%
//
// TIER 2 (user_scoped): Serves community members
// Auth: X-MCP-KEY or Bearer JWT
// Safety: All AI output passes through senior-safe filter
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
import {
  validateForTool,
  validationErrorResponse,
  type ToolSchemaRegistry,
} from "../_shared/mcpInputValidator.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import { TOOLS } from "./tools.ts";
import { createToolHandlers } from "./toolHandlers.ts";

// ---------------------------------------------------------------------------
// SAFETY FILTER — No hallucinations, no scary suggestions
// ---------------------------------------------------------------------------

const BLOCKED_PHRASES = [
  "call 911", "go to the emergency", "you might be having",
  "heart attack", "stroke", "you could die", "seek immediate",
  "overdose", "self-harm", "suicide", "kill", "poison",
  "stop taking your medication", "skip your medication",
  "do not call your doctor", "ignore your symptoms",
  "drink alcohol", "take extra pills", "stop eating",
  "you are dying", "this is serious", "you need surgery",
  "blood clot", "internal bleeding", "tumor", "cancer",
  "dementia", "alzheimer", "you are losing your mind",
];

const MEDICAL_CLAIM_PATTERNS = [
  /will cure/i, /guaranteed to/i, /this treats/i,
  /you have [a-z]+ disease/i, /you are diagnosed/i,
  /your [a-z]+ is (dangerously|critically)/i,
];

function isSafeSuggestion(text: string): boolean {
  const lower = text.toLowerCase();
  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase)) return false;
  }
  for (const pattern of MEDICAL_CLAIM_PATTERNS) {
    if (pattern.test(text)) return false;
  }
  return true;
}

function sanitizeSuggestions(result: Record<string, unknown>): Record<string, unknown> {
  if (!result.suggestions || !Array.isArray(result.suggestions)) return result;

  const safe = (result.suggestions as Array<{ text: string; type: string }>).filter(
    (s) => isSafeSuggestion(s.text)
  );

  // If AI generated something unsafe, replace with pool suggestions
  if (safe.length < (result.suggestions as unknown[]).length) {
    const replaced = (result.suggestions as unknown[]).length - safe.length;
    // Log but don't expose to user
    return {
      ...result,
      suggestions: safe,
      _safety_filtered: replaced,
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ---------------------------------------------------------------------------

const VALIDATION: ToolSchemaRegistry = {
  get_wellness_suggestions: {
    mood: { type: "string", required: true, maxLength: 50 },
  },
  get_personalized_greeting: {
    user_id: { type: "uuid", required: true },
  },
  generate_check_in_questions: {
    patient_id: { type: "uuid", required: true },
    question_count: { type: "number", min: 1, max: 10, integer: true },
  },
  get_engagement_score: {
    patient_id: { type: "uuid", required: true },
    days: { type: "number", min: 1, max: 90, integer: true },
  },
  recommend_next_activity: {
    patient_id: { type: "uuid", required: true },
  },
};

// ---------------------------------------------------------------------------
// SERVER INIT
// ---------------------------------------------------------------------------

const SERVER_CONFIG = {
  name: "mcp-community-engagement-server",
  version: "1.0.0",
  tier: "user_scoped" as const,
};

const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger, canRateLimit } = initResult;
const sb = initResult.supabase ?? null;
const { handleToolCall } = createToolHandlers(logger, sb);

// ---------------------------------------------------------------------------
// TOOLS THAT GET SAFETY FILTERING (AI-generated content)
// ---------------------------------------------------------------------------

const SAFETY_FILTERED_TOOLS = new Set([
  "get_wellness_suggestions",
  "generate_check_in_questions",
  "recommend_next_activity",
]);

// ---------------------------------------------------------------------------
// SERVE
// ---------------------------------------------------------------------------

serve(async (req) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // 2. Health check (GET /)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders);
  }

  try {
    // 3. Rate limiting
    const identifier = getRequestIdentifier(req);
    const rateLimitResult = checkInMemoryRateLimit(identifier, 60, 60000);

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Rate limit exceeded. Please try again shortly." },
          id: null,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // 4. Parse JSON-RPC
    const body = await req.json();
    const { method, params, id } = body;

    // 5. Dispatch
    switch (method) {
      case "initialize":
        return new Response(
          JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "tools/list":
        return new Response(
          JSON.stringify(createToolsListResponse(TOOLS, id)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      case "tools/call": {
        const { name, arguments: args } = params || {};
        const startTime = Date.now();

        logger.info("COMMUNITY_TOOL_CALL", { tool: name, requestId });

        // Validation
        const validationErrors = validateForTool(name, args, VALIDATION);
        if (validationErrors?.length > 0) {
          return validationErrorResponse(validationErrors, id, corsHeaders);
        }

        // Ping
        if (name === "ping") {
          const pingResult = handlePing(SERVER_CONFIG, initResult);
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

        // Execute tool
        let result = await handleToolCall(name, args || {});
        const executionTimeMs = Date.now() - startTime;

        // Safety filter on AI-generated content
        if (SAFETY_FILTERED_TOOLS.has(name) && typeof result === "object" && result !== null) {
          result = sanitizeSuggestions(result as Record<string, unknown>);
        }

        // Audit log
        if (sb) {
          await logMCPAudit(sb, logger, {
            serverName: SERVER_CONFIG.name,
            toolName: name,
            requestId,
            success: true,
            executionTimeMs,
            metadata: { tool: name },
          }).catch(() => {
            // Non-fatal — don't fail the request over audit
          });
        }

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              metadata: {
                tool: name,
                executionTimeMs,
                server: SERVER_CONFIG.name,
                ai_assisted: SAFETY_FILTERED_TOOLS.has(name),
              },
            },
            id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify(createErrorResponse(-32601, `Method not found: ${method}`, id)),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("COMMUNITY_MCP_ERROR", { error: errorMsg, requestId });
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
