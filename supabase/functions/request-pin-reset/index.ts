/**
 * Request PIN Reset Edge Function
 *
 * Initiates SMS-based PIN reset flow for admin/staff users.
 * Validates user identity and sends verification code via Twilio.
 *
 * Flow:
 * 1. Accept phone number
 * 2. Look up profile by phone where is_admin = true
 * 3. Check rate limit (max 3 reset requests per hour)
 * 4. Send SMS verification code via Twilio Verify
 * 5. Return generic success (prevents phone enumeration)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parsePhoneNumber, isValidPhoneNumber } from "https://esm.sh/libphonenumber-js@1.12.9?target=deno";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

// Rate limit: Max 3 reset requests per phone per hour
const MAX_RESET_REQUESTS_PER_HOUR = 3;

// Allowed country codes for phone numbers
const ALLOWED_COUNTRIES = ['US', 'CA', 'GB', 'AU'] as const;

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

/**
 * Validate phone using libphonenumber-js
 */
function validatePhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  try {
    if (!isValidPhoneNumber(phone, 'US')) {
      return { valid: false, error: "Invalid phone number format" };
    }

    const phoneNumber = parsePhoneNumber(phone, 'US');
    if (!ALLOWED_COUNTRIES.includes(phoneNumber.country as typeof ALLOWED_COUNTRIES[number])) {
      return { valid: false, error: `Phone numbers from ${phoneNumber.country} are not currently supported` };
    }

    return { valid: true, normalized: phoneNumber.number };
  } catch {
    return { valid: false, error: "Invalid phone number format" };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('request-pin-reset', req);

  // Handle CORS
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Environment variables
  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const TWILIO_ACCOUNT_SID = getEnv("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = getEnv("TWILIO_AUTH_TOKEN");
  const VERIFY_SID = getEnv("TWILIO_VERIFY_SERVICE_SID");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !VERIFY_SID) {
    logger.error("Missing Twilio environment variables", {
      hasAccountSid: !!TWILIO_ACCOUNT_SID,
      hasAuthToken: !!TWILIO_AUTH_TOKEN,
      hasVerifySid: !!VERIFY_SID
    });
    return new Response(
      JSON.stringify({ error: "SMS service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  logger.info("Twilio config loaded", {
    verifySidPrefix: VERIFY_SID.substring(0, 4),
    accountSidPrefix: TWILIO_ACCOUNT_SID.substring(0, 4)
  });

  try {
    const body = await req.json().catch(() => ({}));
    const phone = body?.phone as string | undefined;

    // Validate phone
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.valid || !phoneValidation.normalized) {
      return new Response(
        JSON.stringify({ error: phoneValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = phoneValidation.normalized;

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look up admin user by phone
    // Check profiles table for is_admin = true and matching phone
    // Phone numbers in DB may have various formats: 832-576-3448, (832) 576-3448, etc.
    const phoneDigits = normalizedPhone.replace(/\D/g, ''); // e.g., "15551234567"
    const phoneWithoutCountry = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits; // e.g., "8325763448"

    // Use database function for reliable phone matching
    // This function strips non-digits from stored phones and compares
    const { data: profiles, error: profileError } = await supabase
      .rpc('find_admin_by_phone', { phone_digits: phoneWithoutCountry });

    const profile = profiles?.[0] || null;

    logger.info("Profile search result", {
      phoneSearched: phoneWithoutCountry,
      found: !!profile,
      profileCount: profiles?.length || 0,
      error: profileError?.message
    });

    // IMPORTANT: Always return generic success to prevent phone enumeration
    const genericSuccessResponse = new Response(
      JSON.stringify({
        success: true,
        message: "If this phone is registered to an admin account, a verification code has been sent."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    if (profileError || !profile) {
      // Log for debugging but return generic success
      logger.info("PIN reset requested - profile not found", {
        phoneLastFour: normalizedPhone.slice(-4),
        searchedFormats: [normalizedPhone, phoneDigits, phoneWithoutCountry],
        error: profileError?.message
      });
      return genericSuccessResponse;
    }

    logger.info("Profile found for PIN reset", {
      userId: profile.user_id,
      phoneInDb: profile.phone?.slice(-4),
      isAdmin: profile.is_admin
    });

    // Check rate limit: count reset requests in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('staff_pin_reset_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.user_id)
      .gte('created_at', oneHourAgo);

    if (!countError && (count ?? 0) >= MAX_RESET_REQUESTS_PER_HOUR) {
      logger.warn("PIN reset rate limit exceeded", {
        userId: profile.user_id,
        phoneLastFour: normalizedPhone.slice(-4),
        requestsInLastHour: count
      });
      // Still return generic success to prevent enumeration
      return genericSuccessResponse;
    }

    // Send SMS verification code via Twilio Verify
    const twilioUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;
    const form = new URLSearchParams({ To: normalizedPhone, Channel: "sms" });

    logger.info("Sending PIN reset verification code", {
      userId: profile.user_id,
      phoneLastFour: normalizedPhone.slice(-4)
    });

    const twilioResp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const twilioText = await twilioResp.text();
    let twilioJson: Record<string, unknown> = {};
    try { twilioJson = JSON.parse(twilioText); } catch { /* ignore */ }

    if (!twilioResp.ok) {
      logger.error("Twilio Verify failed for PIN reset", {
        userId: profile.user_id,
        status: twilioResp.status,
        error: twilioText
      });
      // Still return generic success
      return genericSuccessResponse;
    }

    // Create a reset token record for tracking
    // Generate a random token that will be returned after SMS verification
    const resetToken = crypto.randomUUID();
    const tokenHash = await hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { error: insertError } = await supabase
      .from('staff_pin_reset_tokens')
      .insert({
        user_id: profile.user_id,
        phone: normalizedPhone,
        token_hash: tokenHash,
        expires_at: expiresAt
      });

    if (insertError) {
      logger.error("Failed to create reset token record", {
        userId: profile.user_id,
        error: insertError.message
      });
      // Still return generic success
      return genericSuccessResponse;
    }

    // Log successful SMS send
    logger.info("PIN reset SMS sent successfully", {
      userId: profile.user_id,
      phoneLastFour: normalizedPhone.slice(-4),
      verificationSid: twilioJson?.sid,
      expiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: profile.user_id,
      action: 'PIN_RESET_REQUESTED',
      resource_type: 'staff_pin',
      resource_id: profile.user_id,
      metadata: {
        phoneLastFour: normalizedPhone.slice(-4),
        tenantId: profile.tenant_id
      }
    }).catch(() => { /* ignore audit log failures */ });

    return genericSuccessResponse;

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in request-pin-reset", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Hash a token using SHA-256
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
