// Supabase Edge Function: send-slack-notification
// Server-side Slack webhook proxy — keeps webhook URL out of browser bundle
// Accepts notification payloads from authenticated callers and forwards to Slack
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { requireUser, requireRole } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL");
const logger = createLogger("send-slack-notification");

// Allowed roles for sending Slack notifications
const SLACK_ALLOWED_ROLES = ["admin", "super_admin", "physician", "nurse", "case_manager"];

// Rate limit: 30 Slack messages per 10 minutes per user
const SLACK_RATE_LIMIT = {
  maxAttempts: 30,
  windowSeconds: 600,
  keyPrefix: "slack",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: corsHeaders } = corsFromRequest(req);

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  // Validate webhook is configured server-side
  if (!SLACK_WEBHOOK_URL) {
    logger.warn("Slack webhook not configured — SLACK_WEBHOOK_URL not set", {});
    return new Response(
      JSON.stringify({ error: "Slack not configured on this server" }),
      { status: 503, headers: jsonHeaders }
    );
  }

  // Authentication: JWT + role check
  let callerUserId = "unknown";
  try {
    const user = await requireUser(req);
    callerUserId = user.id;
    await requireRole(user.id, SLACK_ALLOWED_ROLES);
  } catch (_resp: unknown) {
    // Also accept service role key for internal calls
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!serviceRoleKey || bearerToken !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Authorization required — admin or clinical role needed" }),
        { status: 403, headers: jsonHeaders }
      );
    }
    callerUserId = "service_role";
  }

  // Rate limit (skip for service role)
  if (callerUserId !== "service_role") {
    const rateResult = await checkRateLimit(callerUserId, SLACK_RATE_LIMIT);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: rateResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...jsonHeaders,
            "Retry-After": String(rateResult.retryAfter || SLACK_RATE_LIMIT.windowSeconds),
          },
        }
      );
    }
  }

  // Parse and forward the Slack payload
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_err: unknown) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Validate minimum payload structure
  if (!payload.attachments && !payload.text && !payload.blocks) {
    return new Response(
      JSON.stringify({ error: "Payload must include at least one of: text, attachments, blocks" }),
      { status: 400, headers: jsonHeaders }
    );
  }

  // Forward to Slack webhook with retries
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (slackResponse.ok) {
        logger.info("Slack notification sent", {
          callerUserId,
          channel: payload.channel ?? "default",
        });
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: jsonHeaders }
        );
      }

      if (slackResponse.status === 429) {
        const retryAfter = parseInt(slackResponse.headers.get("Retry-After") || "5", 10);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
      }

      const errorText = await slackResponse.text();
      logger.error("Slack webhook error", {
        status: slackResponse.status,
        error: errorText,
        callerUserId,
      });
      return new Response(
        JSON.stringify({ error: `Slack error: ${slackResponse.status}`, details: errorText }),
        { status: slackResponse.status, headers: jsonHeaders }
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }
      logger.error("Slack send failed after retries", { error: errorMessage, callerUserId });
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 502, headers: jsonHeaders }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: "Max retries exceeded" }),
    { status: 502, headers: jsonHeaders }
  );
});
