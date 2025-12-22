/**
 * Verify PIN Reset Edge Function
 *
 * Validates SMS verification code and issues OTP token for PIN reset.
 * This is step 2 of the SMS-based PIN reset flow.
 *
 * Flow:
 * 1. Accept phone number and SMS code
 * 2. Verify code via Twilio Verify Check API
 * 3. Find valid (unused, unexpired) reset token for this phone
 * 4. Return OTP token that can be used with admin_set_pin
 * 5. Mark token as used (single use)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { parsePhoneNumber, isValidPhoneNumber } from "https://esm.sh/libphonenumber-js@1.12.9?target=deno";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

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

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('verify-pin-reset', req);

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
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
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
    logger.error("Missing Twilio environment variables");
    return new Response(
      JSON.stringify({ error: "SMS service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phone = body?.phone as string | undefined;
    const code = body?.code as string | undefined;

    // Validate phone
    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate code
    if (!code || !/^\d{4,8}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "Invalid verification code format" }),
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

    // Verify SMS code via Twilio Verify Check API
    const twilioCheckUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`;
    const form = new URLSearchParams({ To: normalizedPhone, Code: code });

    logger.info("Verifying PIN reset code", {
      phoneLastFour: normalizedPhone.slice(-4)
    });

    const twilioResp = await fetch(twilioCheckUrl, {
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

    // Check if verification was successful
    if (!twilioResp.ok || twilioJson.status !== "approved") {
      logger.warn("PIN reset code verification failed", {
        phoneLastFour: normalizedPhone.slice(-4),
        twilioStatus: twilioJson.status,
        httpStatus: twilioResp.status
      });

      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Find valid (unused, unexpired) reset token for this phone
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('staff_pin_reset_tokens')
      .select('id, user_id, token_hash, expires_at')
      .eq('phone', normalizedPhone)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenRecord) {
      logger.warn("No valid reset token found after code verification", {
        phoneLastFour: normalizedPhone.slice(-4),
        error: tokenError?.message
      });

      return new Response(
        JSON.stringify({ error: "No pending PIN reset request found. Please request a new reset." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    const { error: updateError } = await supabase
      .from('staff_pin_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    if (updateError) {
      logger.error("Failed to mark reset token as used", {
        tokenId: tokenRecord.id,
        error: updateError.message
      });
      // Continue anyway - token will expire naturally
    }

    // Generate OTP token for use with admin_set_pin
    // This token proves the user verified via SMS and can set a new PIN
    const otpToken = crypto.randomUUID();
    const otpTokenHash = await hashToken(otpToken);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Store the OTP token
    const { error: otpInsertError } = await supabase
      .from('staff_pin_reset_tokens')
      .insert({
        user_id: tokenRecord.user_id,
        phone: normalizedPhone,
        token_hash: otpTokenHash,
        expires_at: otpExpiresAt
        // Note: used_at is null, will be set when PIN is actually changed
      });

    if (otpInsertError) {
      logger.error("Failed to create OTP token", {
        userId: tokenRecord.user_id,
        error: otpInsertError.message
      });

      return new Response(
        JSON.stringify({ error: "Failed to complete verification. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log successful verification
    logger.info("PIN reset code verified successfully", {
      userId: tokenRecord.user_id,
      phoneLastFour: normalizedPhone.slice(-4),
      otpExpiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: tokenRecord.user_id,
      action: 'PIN_RESET_CODE_VERIFIED',
      resource_type: 'staff_pin',
      resource_id: tokenRecord.id,
      metadata: {
        phoneLastFour: normalizedPhone.slice(-4)
      }
    }).catch(() => { /* ignore audit log failures */ });

    // Return the OTP token to the client
    // This token should be passed to admin_set_pin to authorize the PIN change
    return new Response(
      JSON.stringify({
        success: true,
        otp_token: otpToken,
        expires_at: otpExpiresAt,
        message: "Verification successful. Use the OTP token to set your new PIN within 5 minutes."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in verify-pin-reset", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
