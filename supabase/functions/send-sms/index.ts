// Supabase Edge Function: send-sms
// Sends SMS via Twilio — requires authentication (JWT + role OR internal secret)
// Deno runtime

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { requireUser, requireRole, requireInternal, supabaseAdmin } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") || "";

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  throw new Error("[send-sms] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
}

if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
  throw new Error("[send-sms] Provide TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER");
}

interface SMSRequest {
  to: string[]; // Array of phone numbers in E.164 format
  message: string;
  priority?: 'normal' | 'high' | 'urgent';
}

/**
 * Validate phone number in E.164 format
 */
function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  // E.164 format: +[country code][number] (e.g., +14155552671)
  const e164Regex = /^\+[1-9]\d{1,14}$/;

  if (!e164Regex.test(phone)) {
    return { valid: false, error: "Phone must be in E.164 format (e.g., +14155552671)" };
  }

  return { valid: true };
}

// Allowed roles for sending SMS (admin + clinical staff)
const SMS_ALLOWED_ROLES = ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'];

// Rate limit: 20 SMS per 10 minutes per user
const SMS_RATE_LIMIT = {
  maxAttempts: 20,
  windowSeconds: 600,
  keyPrefix: 'sms'
};

serve(async (req) => {
  const logger = createLogger('send-sms', req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // =========================================================================
  // AUTHENTICATION — Three paths (A-1 fix):
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
        await requireRole(user.id, SMS_ALLOWED_ROLES);
      } catch (_resp: unknown) {
        return new Response(
          JSON.stringify({ error: "Insufficient permissions — admin or clinical role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get caller's tenant for scoping
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      callerTenantId = profile?.tenant_id ?? null;
      authMethod = 'jwt';

      // Rate limit JWT-authenticated callers (not internal/service role)
      const rateResult = await checkRateLimit(user.id, SMS_RATE_LIMIT);
      if (!rateResult.allowed) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            message: `Too many SMS requests. Try again in ${rateResult.retryAfter} seconds.`,
            retryAfter: rateResult.retryAfter
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(rateResult.retryAfter || SMS_RATE_LIMIT.windowSeconds)
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
    logger.error("Auth error in send-sms", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: "Authentication failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  logger.info("SMS request authorized", { callerUserId, authMethod, tenantId: callerTenantId });

  try {
    const { to, message, priority = 'normal' }: SMSRequest = await req.json();

    // Validate inputs
    if (!to || to.length === 0 || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
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

    // Validate all phone numbers before sending
    const invalidPhones: string[] = [];
    for (const phone of to) {
      const validation = validatePhone(phone);
      if (!validation.valid) {
        invalidPhones.push(`${phone}: ${validation.error}`);
      }
    }

    if (invalidPhones.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone numbers detected",
          invalid_numbers: invalidPhones
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate message length (Twilio limit is 1600 chars for long SMS)
    if (message.length > 1600) {
      return new Response(
        JSON.stringify({ error: "Message exceeds 1600 character limit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const results = [];
    const errors = [];

    // Send SMS to each recipient
    for (const phoneNumber of to) {
      const formData = new URLSearchParams();
      formData.set("To", phoneNumber);
      formData.set("Body", message);

      if (TWILIO_MESSAGING_SERVICE_SID) {
        formData.set("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
      } else {
        formData.set("From", TWILIO_FROM_NUMBER);
      }

      try {
        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        });

        const responseText = await response.text();

        if (!response.ok) {
          logger.error("Twilio SMS send failed", {
            phone: phoneNumber,
            status: response.status,
            error: responseText,
            callerUserId
          });
          errors.push({ phone: phoneNumber, error: responseText });
        } else {
          const data = JSON.parse(responseText);
          results.push({
            phone: phoneNumber,
            sid: data.sid,
            status: data.status
          });
          logger.info("SMS sent successfully", {
            phone: phoneNumber,
            sid: data.sid,
            status: data.status,
            callerUserId
          });
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("SMS send exception", {
          phone: phoneNumber,
          error: errorMessage,
          callerUserId
        });
        errors.push({ phone: phoneNumber, error: errorMessage });
      }
    }

    // Return response
    if (errors.length === to.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send SMS to all recipients",
          errors
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `SMS sent to ${results.length} of ${to.length} recipient(s)`,
        priority,
        results,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Fatal error in send-sms", {
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
