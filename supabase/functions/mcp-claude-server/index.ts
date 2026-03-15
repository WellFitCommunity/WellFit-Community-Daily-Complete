// =====================================================
// Self-hosted MCP Server for Claude operations
// Consolidates Claude integration + Claude-in-Claude triage
// Adds prompt caching for 30-40% cost reduction
// Uses existing audit logging and de-identification
//
// TIER 3 (admin): Requires service role key for audit logging
// Auth: Supabase apikey + service role key + admin role verification
//
// Tools:
//   Generic: analyze-text, generate-suggestion, summarize, ping
//   Triage:  evaluate-escalation-conflict, consolidate-alerts,
//            calibrate-confidence, synthesize-handoff-narrative
//
// Tracker: docs/trackers/claude-in-claude-triage-tracker.md
// Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
// =====================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.1";
import { checkMCPRateLimit, checkPersistentRateLimit, getRequestIdentifier, getCallerRateLimitId, createRateLimitResponse, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";
import {
  initMCPServer,
  createInitializeResponse,
  createToolsListResponse,
  handleHealthCheck,
  checkBodySize,
  buildProvenance,
  MCP_BODY_LIMIT_BYTES,
  handlePing,
  type MCPInitResult
} from "../_shared/mcpServerBase.ts";
import {
  verifyAdminAccess,
  getRequestId,
  createForbiddenResponse,
  createUnauthorizedResponse,
  CallerIdentity
} from "../_shared/mcpAuthGate.ts";
import { extractCallerIdentity } from "../_shared/mcpIdentity.ts";
import { logMCPAudit } from "../_shared/mcpAudit.ts";
import { calculateModelCost } from "../_shared/models.ts";

// Tool registry and triage dispatcher
import { ALL_TOOLS, isTriageTool } from "./tools.ts";
import { dispatchTriageTool } from "./triageTools.ts";

// Server configuration
const SERVER_CONFIG = {
  name: "mcp-claude-server",
  version: "2.0.0",
  tier: "admin" as const
};

// Initialize with tiered approach - Tier 3 requires service role
const initResult: MCPInitResult = initMCPServer(SERVER_CONFIG);
const { logger } = initResult;

// Tier 3 requires service role - fail fast if not available
if (!initResult.supabase) {
  throw new Error(`MCP Claude server requires service role key: ${initResult.error}`);
}

// Non-null after guard
const sb = initResult.supabase;

// Anthropic API key for Claude operations
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
if (!ANTHROPIC_API_KEY) throw new Error("Missing Anthropic API key");

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// De-identification for generic tools (triage tools handle their own via triageTools.ts)
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{1,5}\s+[A-Za-z0-9'.\- ]+\b/g, (m) => (m.length > 6 ? "[ADDRESS]" : m))
    .replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

function deepDeidentify(obj: unknown): unknown {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepDeidentify);
  if (typeof obj === "string") return redact(obj);
  if (typeof obj === "object") {
    const strip = new Set([
      "patient_name","first_name","last_name","middle_name",
      "dob","date_of_birth","ssn","email","phone","address",
      "address_line1","address_line2","city","state","zip",
      "mrn","member_id","insurance_id","subscriber_name",
      "patient_id","person_id","user_id","uid"
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (strip.has(k)) continue;
      out[k] = deepDeidentify(v);
    }
    return out;
  }
  return obj;
}

// Audit logging (uses existing table)
async function logMCPRequest(params: {
  userId?: string;
  tool: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
}) {
  try {
    await sb.from("claude_usage_logs").insert({
      user_id: params.userId,
      request_id: crypto.randomUUID(),
      request_type: `mcp_${params.tool}`,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      cost: params.cost,
      response_time_ms: params.responseTimeMs,
      success: params.success,
      error_message: params.errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err: unknown) {
    logger.error("Audit log insert failed", {
      errorMessage: err instanceof Error ? err.message : String(err)
    });
  }
}

// ============================================================================
// Generic tool handler (analyze-text, generate-suggestion, summarize)
// ============================================================================

function buildGenericPrompt(
  toolName: string,
  sanitizedArgs: Record<string, unknown>
): string {
  switch (toolName) {
    case "analyze-text":
      return `${String(sanitizedArgs.prompt || '')}\n\nText to analyze:\n${String(sanitizedArgs.text || '')}`;
    case "generate-suggestion":
      return `Task: ${String(sanitizedArgs.task || '')}\n\nContext: ${JSON.stringify(sanitizedArgs.context, null, 2)}`;
    case "summarize":
      return `Summarize the following content in ${Number(sanitizedArgs.maxLength) || 500} words or less:\n\n${String(sanitizedArgs.content || '')}`;
    default:
      throw new Error(`Unknown generic tool: ${toolName}`);
  }
}

// ============================================================================
// MCP Request Handler
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const requestId = getRequestId(req);

  // Health check endpoint (GET request)
  if (req.method === "GET") {
    return handleHealthCheck(req, SERVER_CONFIG, initResult, corsHeaders, [
      { name: "anthropic", ready: !!ANTHROPIC_API_KEY }
    ]);
  }

  // Body size limit (512KB for AI text operations)
  const bodySizeResponse = checkBodySize(req, MCP_BODY_LIMIT_BYTES, corsHeaders);
  if (bodySizeResponse) return bodySizeResponse;

  // Strict rate limiting for expensive AI calls
  const identifier = getRequestIdentifier(req);
  const rateLimitResult = checkMCPRateLimit(identifier, MCP_RATE_LIMITS.claude);
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, MCP_RATE_LIMITS.claude, corsHeaders);
  }

  try {
    const { method, params, id } = await req.json();

    // MCP Protocol: Initialize (no auth required - discovery)
    if (method === "initialize") {
      return new Response(JSON.stringify(createInitializeResponse(SERVER_CONFIG, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: List tools (auth required on Tier 3)
    if (method === "tools/list") {
      const caller = await extractCallerIdentity(req, { serverName: SERVER_CONFIG.name, logger });
      if (!caller) {
        return createUnauthorizedResponse(
          "Authentication required for tool discovery on admin servers",
          requestId, corsHeaders
        );
      }
      return new Response(JSON.stringify(createToolsListResponse(ALL_TOOLS, id)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // MCP Protocol: Call tool
    if (method === "tools/call") {
      const { name: toolName, arguments: toolArgs } = params;
      const startTime = Date.now();

      // AUTH GATE: Verify caller has admin access for AI operations
      const authResult = await verifyAdminAccess(req, {
        serverName: SERVER_CONFIG.name,
        toolName,
        logger,
        requiredScope: "mcp:claude"
      });

      if (!authResult.authorized) {
        logger.security("CLAUDE_ACCESS_DENIED", {
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

      // Persistent identity-based rate limiting (cross-instance)
      const identityRateResult = await checkPersistentRateLimit(
        sb, getCallerRateLimitId(caller), MCP_RATE_LIMITS.claude
      );
      if (!identityRateResult.allowed) {
        return createRateLimitResponse(identityRateResult, MCP_RATE_LIMITS.claude, corsHeaders);
      }

      if (!ALL_TOOLS[toolName as keyof typeof ALL_TOOLS]) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      // Handle ping tool
      if (toolName === "ping") {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(handlePing(SERVER_CONFIG, initResult), null, 2) }],
            metadata: { tool: toolName, responseTimeMs: Date.now() - startTime }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ============================================================
      // TRIAGE TOOLS: Claude-in-Claude meta-reasoning
      // Uses structured JSON output + clinical grounding + decision chain
      // ============================================================
      if (isTriageTool(toolName)) {
        // De-identify triage input (preserves patient_id for routing but strips PHI)
        const sanitizedArgs = deepDeidentify(toolArgs) as Record<string, unknown>;

        const triageResult = await dispatchTriageTool(
          toolName,
          sanitizedArgs,
          anthropic,
          logger
        );

        const responseTimeMs = Date.now() - startTime;
        const cost = calculateModelCost(triageResult.model, triageResult.inputTokens, triageResult.outputTokens);

        // Audit log
        await logMCPRequest({
          userId: caller.userId,
          tool: toolName,
          model: triageResult.model,
          inputTokens: triageResult.inputTokens,
          outputTokens: triageResult.outputTokens,
          cost,
          responseTimeMs,
          success: true
        });
        await logMCPAudit(sb, logger, {
          serverName: "mcp-claude-server",
          toolName,
          userId: caller.userId,
          tenantId: caller.tenantId,
          authMethod: "jwt",
          executionTimeMs: responseTimeMs,
          success: true,
          metadata: {
            model: triageResult.model,
            inputTokens: triageResult.inputTokens,
            outputTokens: triageResult.outputTokens,
            cost,
            triageTool: true
          }
        });

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify(triageResult.output) }],
            metadata: {
              inputTokens: triageResult.inputTokens,
              outputTokens: triageResult.outputTokens,
              cost,
              responseTimeMs,
              model: triageResult.model,
              requestId,
              caller: { userId: caller.userId, role: caller.role },
              provenance: buildProvenance('ai_generated', {
                confidenceScore: undefined,
                safetyFlags: ['ai_generated', 'requires_clinical_review', 'meta_triage']
              })
            }
          },
          id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ============================================================
      // GENERIC TOOLS: analyze-text, generate-suggestion, summarize
      // ============================================================
      const sanitizedArgs = deepDeidentify(toolArgs) as Record<string, unknown>;
      const model = (toolArgs.model as string) || "claude-sonnet-4-5-20250929";
      const userPrompt = buildGenericPrompt(toolName, sanitizedArgs);

      // Call Claude with prompt caching
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: userPrompt }],
        system: [
          {
            type: "text",
            text: "You are a helpful AI assistant. Always provide clear, accurate responses.",
            cache_control: { type: "ephemeral" }
          }
        ]
      });

      const responseTimeMs = Date.now() - startTime;
      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cost = calculateModelCost(model, inputTokens, outputTokens);

      // Audit log
      await logMCPRequest({
        userId: caller.userId,
        tool: toolName,
        model,
        inputTokens,
        outputTokens,
        cost,
        responseTimeMs,
        success: true
      });
      await logMCPAudit(sb, logger, {
        serverName: "mcp-claude-server",
        toolName,
        userId: caller.userId,
        tenantId: caller.tenantId,
        authMethod: "jwt",
        executionTimeMs: responseTimeMs,
        success: true,
        metadata: { model, inputTokens, outputTokens, cost }
      });

      const content = response.content[0];
      const result = content.type === "text" ? content.text : "";

      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: result }],
          metadata: {
            inputTokens,
            outputTokens,
            cost,
            responseTimeMs,
            model,
            requestId,
            caller: { userId: caller.userId, role: caller.role },
            provenance: buildProvenance('ai_generated', {
              confidenceScore: undefined,
              safetyFlags: ['ai_generated', 'requires_clinical_review']
            })
          }
        },
        id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Unknown method
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32601, message: `Method not found: ${method}`, data: { requestId } },
      id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Claude server error", { requestId, errorMessage: error.message });

    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32603, message: error.message, data: { requestId } },
      id: null
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
