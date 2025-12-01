/**
 * Envision Complete Reset Edge Function
 *
 * Completes SMS-based password or PIN reset for Envision super admins.
 * Verifies SMS code and sets new password/PIN.
 *
 * Flow:
 * 1. Accept email, SMS code, reset_type, and new credential
 * 2. Verify code via Twilio Verify Check API
 * 3. Find valid (unused, unexpired) reset token
 * 4. Hash and store new password/PIN
 * 5. Send notification SMS
 * 6. Return success
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { hashPin, isClientHashedPin } from "../_shared/crypto.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-complete-reset', req);

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
  const TWILIO_FROM_NUMBER = getEnv("TWILIO_FROM_NUMBER");

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
    const code = body?.code as string;
    const resetType = body?.reset_type as string;
    const newCredential = body?.new_credential as string;

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

    // Validate code
    if (!code || !/^\d{4,8}$/.test(code)) {
      return new Response(
        JSON.stringify({ error: "Invalid verification code format" }),
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

    // Validate new credential
    if (!newCredential) {
      return new Response(
        JSON.stringify({ error: `New ${resetType} is required` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate credential format (unless client-hashed)
    if (!isClientHashedPin(newCredential)) {
      if (resetType === 'pin' && !/^\d{4,8}$/.test(newCredential)) {
        return new Response(
          JSON.stringify({ error: "PIN must be 4-8 digits" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (resetType === 'password' && newCredential.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look up super admin by email
    const { data: superAdmin, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, email, phone, is_active')
      .eq('email', email)
      .single();

    if (lookupError || !superAdmin) {
      logger.warn("Reset completion for non-existent email", { email });
      return new Response(
        JSON.stringify({ error: "Invalid request. Please start the reset process again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if account is active
    if (!superAdmin.is_active) {
      logger.security("Reset completion for inactive account", {
        superAdminId: superAdmin.id,
        email
      });
      return new Response(
        JSON.stringify({ error: "Account is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check phone is configured
    if (!superAdmin.phone) {
      logger.warn("Reset completion for user without phone", {
        superAdminId: superAdmin.id,
        email
      });
      return new Response(
        JSON.stringify({ error: "Phone number not configured for this account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify SMS code via Twilio Verify Check API
    const twilioCheckUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`;
    const form = new URLSearchParams({ To: superAdmin.phone, Code: code });

    logger.info("Verifying Envision reset code", {
      superAdminId: superAdmin.id,
      phoneLastFour: superAdmin.phone.slice(-4),
      resetType
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
      logger.warn("Envision reset code verification failed", {
        superAdminId: superAdmin.id,
        phoneLastFour: superAdmin.phone.slice(-4),
        twilioStatus: twilioJson.status,
        httpStatus: twilioResp.status
      });

      return new Response(
        JSON.stringify({ error: "Invalid or expired verification code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find valid (unused, unexpired) reset token for this user/type
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('envision_reset_tokens')
      .select('id')
      .eq('super_admin_id', superAdmin.id)
      .eq('reset_type', resetType)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenError || !tokenRecord) {
      logger.warn("No valid reset token found after code verification", {
        superAdminId: superAdmin.id,
        resetType,
        error: tokenError?.message
      });

      return new Response(
        JSON.stringify({ error: "No pending reset request found. Please request a new reset." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await supabase
      .from('envision_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Hash the new credential
    const hashedCredential = await hashPin(newCredential);

    // Update super_admin_users with new credential
    const updateField = resetType === 'password' ? 'password_hash' : 'pin_hash';
    const { error: updateError } = await supabase
      .from('super_admin_users')
      .update({ [updateField]: hashedCredential })
      .eq('id', superAdmin.id);

    if (updateError) {
      logger.error("Failed to update Envision credential", {
        superAdminId: superAdmin.id,
        resetType,
        error: updateError.message
      });

      return new Response(
        JSON.stringify({ error: "Failed to update credential. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Envision credential reset successfully", {
      superAdminId: superAdmin.id,
      email,
      resetType
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: resetType === 'password' ? 'ENVISION_PASSWORD_RESET_COMPLETED' : 'ENVISION_PIN_RESET_COMPLETED',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email,
        phoneLastFour: superAdmin.phone.slice(-4),
        resetType
      }
    }).catch(() => {});

    // Send notification SMS
    if (TWILIO_FROM_NUMBER) {
      try {
        const notifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const notifyForm = new URLSearchParams({
          To: superAdmin.phone,
          From: TWILIO_FROM_NUMBER,
          Body: `Your Envision ${resetType} was recently reset. If you did not make this change, contact your administrator immediately.`
        });

        await fetch(notifyUrl, {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: notifyForm.toString(),
        });

        logger.info("Envision reset notification SMS sent", {
          superAdminId: superAdmin.id,
          phoneLastFour: superAdmin.phone.slice(-4)
        });
      } catch (smsErr) {
        logger.warn("Failed to send reset notification SMS", {
          error: smsErr instanceof Error ? smsErr.message : String(smsErr)
        });
        // Don't fail the request for notification failure
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Your ${resetType} has been reset successfully. You can now log in with your new ${resetType}.`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-complete-reset", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
