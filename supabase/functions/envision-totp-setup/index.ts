/**
 * Envision TOTP Setup Edge Function
 *
 * Initiates TOTP setup for an Envision super admin.
 * Requires valid session token from password verification.
 *
 * Flow:
 * 1. Validate session token
 * 2. Generate new TOTP secret
 * 3. Store temp secret in envision_totp_setup table
 * 4. Return secret + QR code URI for authenticator app
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { generateTotpSecret, generateTotpUri, generateBackupCodes, hashBackupCode } from "../_shared/crypto.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-totp-setup', req);

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

    // Validate session token
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Session token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate session (must have password verified, but PIN/TOTP not yet required for setup)
    const { data: session, error: sessionError } = await supabase
      .from('envision_sessions')
      .select('id, super_admin_id, password_verified_at, pin_verified_at, expires_at')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      logger.warn("Invalid or expired session for TOTP setup", { sessionToken: sessionToken.slice(0, 8) + '...' });
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if password was verified
    if (!session.password_verified_at) {
      return new Response(
        JSON.stringify({ error: "Password verification required before TOTP setup" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get super admin details
    const { data: superAdmin, error: adminError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, totp_enabled')
      .eq('id', session.super_admin_id)
      .eq('is_active', true)
      .single();

    if (adminError || !superAdmin) {
      logger.error("Super admin not found for TOTP setup", { superAdminId: session.super_admin_id });
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if TOTP is already enabled
    if (superAdmin.totp_enabled) {
      return new Response(
        JSON.stringify({
          error: "TOTP is already enabled",
          hint: "To reset TOTP, disable it first or use a backup code"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate new TOTP secret
    const totpSecret = generateTotpSecret();
    const totpUri = generateTotpUri(totpSecret, superAdmin.email, 'Envision Portal');

    // Generate backup codes
    const backupCodes = generateBackupCodes(10);

    // Hash backup codes for storage
    const hashedBackupCodes: string[] = [];
    for (const code of backupCodes) {
      hashedBackupCodes.push(await hashBackupCode(code));
    }

    // Delete any existing pending TOTP setup for this user
    await supabase
      .from('envision_totp_setup')
      .delete()
      .eq('super_admin_id', superAdmin.id)
      .eq('verified', false);

    // Store temp secret (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from('envision_totp_setup')
      .insert({
        super_admin_id: superAdmin.id,
        temp_secret: totpSecret,
        expires_at: expiresAt
      });

    if (insertError) {
      logger.error("Failed to create TOTP setup record", {
        superAdminId: superAdmin.id,
        error: insertError.message
      });
      return new Response(
        JSON.stringify({ error: "Failed to initiate TOTP setup" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store hashed backup codes (they'll be moved to super_admin_users after TOTP is verified)
    // For now, we include them in the response so the user can save them

    logger.info("TOTP setup initiated", {
      superAdminId: superAdmin.id,
      email: superAdmin.email,
      expiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'ENVISION_TOTP_SETUP_INITIATED',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email: superAdmin.email,
        expiresAt
      }
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        totp_uri: totpUri,
        secret: totpSecret, // For manual entry if QR scan fails
        backup_codes: backupCodes, // PLAIN TEXT - user must save these NOW
        expires_at: expiresAt,
        message: "Scan the QR code with your authenticator app, then enter the 6-digit code to complete setup. SAVE YOUR BACKUP CODES - they will not be shown again!"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-setup", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
