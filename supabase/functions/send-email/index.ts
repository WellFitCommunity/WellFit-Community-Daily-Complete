// Supabase Edge Function: send-email
// Sends emails via MailerSend — requires authentication (JWT + role OR internal secret)
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { requireUser, requireRole, requireInternal, supabaseAdmin } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

const MAILERSEND_API_KEY = Deno.env.get("MAILERSEND_API_KEY");
const MAILERSEND_FROM_EMAIL = Deno.env.get("MAILERSEND_FROM_EMAIL");
const MAILERSEND_FROM_NAME = Deno.env.get("MAILERSEND_FROM_NAME") || "WellFit Patient Handoff";

if (!MAILERSEND_API_KEY || !MAILERSEND_FROM_EMAIL) {
  throw new Error("[send-email] Missing MAILERSEND_API_KEY or MAILERSEND_FROM_EMAIL");
}

interface EmailRequest {
  to: { email: string; name: string }[];
  subject: string;
  html: string;
  priority?: 'normal' | 'high' | 'urgent';
}

// Allowed roles for sending email (admin + clinical staff)
const EMAIL_ALLOWED_ROLES = ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'];

// Rate limit: 30 emails per 10 minutes per user
const EMAIL_RATE_LIMIT = {
  maxAttempts: 30,
  windowSeconds: 600,
  keyPrefix: 'email'
};

serve(async (req) => {
  const logger = createLogger('send-email', req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // =========================================================================
  // AUTHENTICATION — Three paths (A-2 fix):
  //   1. x-internal-secret header (explicit internal calls)
  //   2. Service role key as Bearer token (supabase.functions.invoke from other edge functions)
  //   3. User JWT + role check (browser/client calls)
  // =========================================================================
  const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let callerUserId = 'system';
  let callerTenantId: string | null = null;
  let authMethod = 'unknown';

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const internalHeader = req.headers.get("x-internal-secret");

    if (internalHeader) {
      // Path 1: Internal secret (explicit server-to-server)
      try {
        requireInternal(req);
        authMethod = 'internal';
      } catch (_resp: unknown) {
        return new Response(
          JSON.stringify({ error: "Invalid internal secret" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (serviceRoleKey && bearerToken === serviceRoleKey) {
      // Path 2: Service role key (auto-passed by supabase.functions.invoke with admin client)
      authMethod = 'service_role';
    } else if (bearerToken) {
      // Path 3: User JWT + role check (browser/client calls)
      let user;
      try {
        user = await requireUser(req);
      } catch (_resp: unknown) {
        return new Response(
          JSON.stringify({ error: "Authorization required — Bearer token missing or invalid" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      callerUserId = user.id;

      try {
        await requireRole(user.id, EMAIL_ALLOWED_ROLES);
      } catch (_resp: unknown) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions — admin or clinical role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get caller's tenant for audit logging
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      callerTenantId = profile?.tenant_id ?? null;
      authMethod = 'jwt';

      // Rate limit JWT-authenticated callers (not internal/service role)
      const rateResult = await checkRateLimit(user.id, EMAIL_RATE_LIMIT);
      if (!rateResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: `Too many email requests. Try again in ${rateResult.retryAfter} seconds.`,
            retryAfter: rateResult.retryAfter
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(rateResult.retryAfter || EMAIL_RATE_LIMIT.windowSeconds)
            }
          }
        );
      }
    } else {
      // No auth provided at all
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Auth error in send-email", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  logger.info("Email request authorized", { callerUserId, authMethod, tenantId: callerTenantId });

  try {
    const { to, subject, html, priority = 'normal' }: EmailRequest = await req.json();

    // Validate inputs
    if (!to || to.length === 0 || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cap recipients per request to prevent abuse
    if (to.length > 50) {
      return new Response(
        JSON.stringify({ error: "Maximum 50 recipients per request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email via MailerSend
    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MAILERSEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: MAILERSEND_FROM_EMAIL,
          name: MAILERSEND_FROM_NAME
        },
        to: to,
        subject: subject,
        html: html,
        text: html.replace(/<[^>]*>/g, ''), // Strip HTML for text fallback
        settings: {
          track_clicks: false,
          track_opens: false
        },
        tags: [priority, 'patient-handoff']
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.error("MailerSend email send failed", {
        recipients: to.length,
        status: response.status,
        error: responseText,
        subject,
        callerUserId
      });
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: responseText
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    logger.info("Email sent successfully via MailerSend", {
      recipients: to.length,
      subject,
      priority,
      callerUserId
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${to.length} recipient(s)`,
        priority
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Fatal error in send-email", {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
      callerUserId
    });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
