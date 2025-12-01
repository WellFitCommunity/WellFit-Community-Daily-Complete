/**
 * Envision Request Reset Edge Function
 *
 * Initiates SMS-based password or PIN reset for Envision super admins.
 * Works for standalone auth users (not Supabase auth users).
 *
 * Flow:
 * 1. Accept email and reset_type (password or pin)
 * 2. Look up super_admin by email
 * 3. Check rate limit (max 3 reset requests per hour)
 * 4. Send SMS verification code via Twilio Verify
 * 5. Return generic success (prevents email enumeration)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

// Rate limit: Max 3 reset requests per hour
const MAX_RESET_REQUESTS_PER_HOUR = 3;

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

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
  const logger = createLogger('envision-request-reset', req);

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
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY", "SB_SECRET_KEY");
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
    const email = (body?.email as string)?.trim()?.toLowerCase();
    const resetType = body?.reset_type as string;

    // Validate email
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate reset type
    if (!resetType || !['password', 'pin'].includes(resetType)) {
      return new Response(
        JSON.stringify({ error: "Reset type must be 'password' or 'pin'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Generic success response to prevent email enumeration
    const genericSuccessResponse = new Response(
      JSON.stringify({
        success: true,
        message: "If this email is registered, a verification code has been sent to the associated phone number."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    // Look up super admin by email
    const { data: superAdmin, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, email, phone, is_active, password_hash')
      .eq('email', email)
      .single();

    if (lookupError || !superAdmin) {
      logger.info("Reset requested for non-existent Envision email", { email });
      return genericSuccessResponse;
    }

    // Check if account is active
    if (!superAdmin.is_active) {
      logger.info("Reset requested for inactive Envision account", {
        superAdminId: superAdmin.id,
        email
      });
      return genericSuccessResponse;
    }

    // Check if standalone auth (must have password_hash for password reset, or phone for any reset)
    if (!superAdmin.password_hash && resetType === 'password') {
      logger.info("Password reset requested for Supabase-auth user", {
        superAdminId: superAdmin.id,
        email
      });
      return genericSuccessResponse;
    }

    // Check if phone is configured
    if (!superAdmin.phone) {
      logger.warn("Reset requested for user without phone", {
        superAdminId: superAdmin.id,
        email
      });
      return genericSuccessResponse;
    }

    // Check rate limit: count reset requests in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('envision_reset_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('super_admin_id', superAdmin.id)
      .eq('reset_type', resetType)
      .gte('created_at', oneHourAgo);

    if (!countError && (count ?? 0) >= MAX_RESET_REQUESTS_PER_HOUR) {
      logger.warn("Envision reset rate limit exceeded", {
        superAdminId: superAdmin.id,
        email,
        resetType,
        requestsInLastHour: count
      });
      return genericSuccessResponse;
    }

    // Send SMS verification code via Twilio Verify
    const twilioUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;
    const form = new URLSearchParams({ To: superAdmin.phone, Channel: "sms" });

    logger.info("Sending Envision reset verification code", {
      superAdminId: superAdmin.id,
      phoneLastFour: superAdmin.phone.slice(-4),
      resetType
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
      logger.error("Twilio Verify failed for Envision reset", {
        superAdminId: superAdmin.id,
        status: twilioResp.status,
        error: twilioText
      });
      return genericSuccessResponse;
    }

    // Create a reset token record for tracking
    const resetToken = crypto.randomUUID();
    const tokenHash = await hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { error: insertError } = await supabase
      .from('envision_reset_tokens')
      .insert({
        super_admin_id: superAdmin.id,
        reset_type: resetType,
        phone: superAdmin.phone,
        token_hash: tokenHash,
        expires_at: expiresAt
      });

    if (insertError) {
      logger.error("Failed to create Envision reset token record", {
        superAdminId: superAdmin.id,
        error: insertError.message
      });
      return genericSuccessResponse;
    }

    // Log successful SMS send
    logger.info("Envision reset SMS sent successfully", {
      superAdminId: superAdmin.id,
      phoneLastFour: superAdmin.phone.slice(-4),
      resetType,
      verificationSid: twilioJson?.sid,
      expiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: resetType === 'password' ? 'ENVISION_PASSWORD_RESET_REQUESTED' : 'ENVISION_PIN_RESET_REQUESTED',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email,
        phoneLastFour: superAdmin.phone.slice(-4),
        resetType
      }
    }).catch(() => {});

    return genericSuccessResponse;

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-request-reset", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
