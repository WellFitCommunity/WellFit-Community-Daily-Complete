/**
 * Envision TOTP Verify Setup Edge Function
 *
 * Completes TOTP setup by verifying the first code.
 * Moves temp secret to permanent storage and enables TOTP.
 *
 * Flow:
 * 1. Validate session token
 * 2. Get pending TOTP setup
 * 3. Verify the 6-digit code
 * 4. Move secret to super_admin_users
 * 5. Store hashed backup codes
 * 6. Enable TOTP
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyTotpCode, generateBackupCodes, hashBackupCode } from "../_shared/crypto.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-totp-verify-setup', req);

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sessionToken = body?.session_token as string;
    const code = body?.code as string;

    // Validate inputs
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Session token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!code || !/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
      return new Response(
        JSON.stringify({ error: "Valid 6-digit code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from('envision_sessions')
      .select('id, super_admin_id, password_verified_at, expires_at')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      logger.warn("Invalid or expired session for TOTP verify-setup", { sessionToken: sessionToken.slice(0, 8) + '...' });
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending TOTP setup
    const { data: totpSetup, error: setupError } = await supabase
      .from('envision_totp_setup')
      .select('id, temp_secret, expires_at')
      .eq('super_admin_id', session.super_admin_id)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (setupError || !totpSetup) {
      logger.warn("No pending TOTP setup found", { superAdminId: session.super_admin_id });
      return new Response(
        JSON.stringify({
          error: "No pending TOTP setup found",
          hint: "Start TOTP setup first by calling envision-totp-setup"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the TOTP code
    const isValid = await verifyTotpCode(totpSetup.temp_secret, code);

    if (!isValid) {
      logger.warn("Invalid TOTP code during setup", { superAdminId: session.super_admin_id });

      // Record failed attempt
      await supabase.from('envision_auth_attempts').insert({
        super_admin_id: session.super_admin_id,
        attempt_type: 'totp',
        success: false
      }).catch(() => {});

      return new Response(
        JSON.stringify({
          error: "Invalid verification code",
          hint: "Make sure your authenticator app shows the current code and try again"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate fresh backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedBackupCodes: string[] = [];
    for (const bcCode of backupCodes) {
      hashedBackupCodes.push(await hashBackupCode(bcCode));
    }

    // Move secret to super_admin_users and enable TOTP
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('super_admin_users')
      .update({
        totp_secret: totpSetup.temp_secret,
        totp_enabled: true,
        totp_backup_codes: hashedBackupCodes,
        totp_setup_at: now,
        totp_backup_codes_generated_at: now
      })
      .eq('id', session.super_admin_id);

    if (updateError) {
      logger.error("Failed to enable TOTP", {
        superAdminId: session.super_admin_id,
        error: updateError.message
      });
      return new Response(
        JSON.stringify({ error: "Failed to complete TOTP setup" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark TOTP setup as verified
    await supabase
      .from('envision_totp_setup')
      .update({ verified: true })
      .eq('id', totpSetup.id);

    // Update session to mark TOTP as verified (completing 2FA)
    await supabase
      .from('envision_sessions')
      .update({ pin_verified_at: now }) // Reusing pin_verified_at for TOTP completion
      .eq('id', session.id);

    // Record successful attempt
    await supabase.from('envision_auth_attempts').insert({
      super_admin_id: session.super_admin_id,
      attempt_type: 'totp',
      success: true
    }).catch(() => {});

    logger.info("TOTP setup completed", {
      superAdminId: session.super_admin_id,
      backupCodesGenerated: 10
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'ENVISION_TOTP_ENABLED',
      resource_type: 'envision_auth',
      resource_id: session.super_admin_id,
      metadata: {
        backupCodesGenerated: 10
      }
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        message: "TOTP has been enabled for your account!",
        backup_codes: backupCodes, // PLAIN TEXT - user must save these NOW
        backup_codes_warning: "SAVE THESE BACKUP CODES NOW! They will not be shown again. Each code can only be used once."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-verify-setup", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
