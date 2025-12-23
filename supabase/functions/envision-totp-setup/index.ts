/**
 * Envision TOTP Setup Edge Function
 *
 * Handles TOTP enrollment for Envision super admins.
 * Supports two actions:
 *   - begin: Generate TOTP secret, store temporarily, return QR URI
 *   - confirm: Verify first 6-digit code, persist TOTP to super_admin_users
 *
 * Flow:
 * 1. Client calls with action='begin' -> gets otpauth URI for QR code
 * 2. User scans QR with authenticator app
 * 3. Client calls with action='confirm' + code -> TOTP is enabled
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { generateTotpSecret, generateTotpUri, verifyTotpCode, generateBackupCodes, hashBackupCode } from "../_shared/crypto.ts";

const PENDING_TOTP_TTL_MINUTES = 10;

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

/** Normalize TOTP code to digits only */
const normalizeCode = (raw: unknown): string => {
  return String(raw ?? "").replace(/[^\d]/g, "");
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
  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "begin").toLowerCase(); // "begin" | "confirm"
    const sessionToken = String(body?.session_token ?? "").trim();

    // Validate session token
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Session token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session (must have password verified, but PIN/TOTP not yet required for setup)
    const { data: session, error: sessionError } = await supabase
      .from('envision_sessions')
      .select('id, super_admin_id, password_verified_at, pin_verified_at, expires_at, session_token')
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

    const superAdminId = session.super_admin_id as string;

    // Get super admin details
    const { data: superAdmin, error: adminError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, totp_enabled, totp_secret, is_active')
      .eq('id', superAdminId)
      .single();

    if (adminError || !superAdmin) {
      logger.error("Super admin not found for TOTP setup", { superAdminId });
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!superAdmin.is_active) {
      return new Response(
        JSON.stringify({ error: "Account is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // BEGIN: Generate secret + return otpauth URI
    // ─────────────────────────────────────────────────────────────
    if (action === "begin") {
      // Check if TOTP is already enabled
      if (superAdmin.totp_enabled && superAdmin.totp_secret) {
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
      const totpUri = generateTotpUri(totpSecret, superAdmin.email, 'Envision VirtualEdge');

      // Generate backup codes
      const backupCodes = generateBackupCodes(10);

      // Delete any existing pending TOTP setup for this user
      await supabase
        .from('envision_totp_setup')
        .delete()
        .eq('super_admin_id', superAdmin.id)
        .eq('verified', false);

      // Store temp secret (expires in 10 minutes)
      const expiresAt = new Date(Date.now() + PENDING_TOTP_TTL_MINUTES * 60 * 1000).toISOString();
      const { error: insertError } = await supabase
        .from('envision_totp_setup')
        .insert({
          super_admin_id: superAdmin.id,
          temp_secret: totpSecret,
          expires_at: expiresAt,
          verified: false
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
          otpauth_uri: totpUri,
          secret: totpSecret, // For manual entry if QR scan fails
          backup_codes: backupCodes, // PLAIN TEXT - user must save these NOW
          expires_at: expiresAt,
          message: "Scan the QR code with your authenticator app, then enter the 6-digit code to confirm setup."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // CONFIRM: Verify code and persist TOTP to super_admin_users
    // ─────────────────────────────────────────────────────────────
    if (action === "confirm") {
      const code = normalizeCode(body?.code);

      if (code.length !== 6) {
        return new Response(
          JSON.stringify({ error: "A 6-digit code is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find pending TOTP setup for this user
      const { data: pending, error: pendingError } = await supabase
        .from('envision_totp_setup')
        .select('id, temp_secret, expires_at, super_admin_id')
        .eq('super_admin_id', superAdmin.id)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingError || !pending) {
        return new Response(
          JSON.stringify({ error: "No pending TOTP setup found. Please start setup again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify the TOTP code against the temp secret
      const isValid = await verifyTotpCode(pending.temp_secret, code);

      if (!isValid) {
        logger.warn("Invalid TOTP code during setup confirmation", { superAdminId: superAdmin.id });
        return new Response(
          JSON.stringify({ error: "Invalid code. Please enter the current 6-digit code from your authenticator app." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate and hash backup codes for permanent storage
      const backupCodes = generateBackupCodes(10);
      const hashedBackupCodes: string[] = [];
      for (const code of backupCodes) {
        hashedBackupCodes.push(await hashBackupCode(code));
      }

      // Persist TOTP to super_admin_users - enable TOTP, clear PIN
      const { error: updateError } = await supabase
        .from('super_admin_users')
        .update({
          totp_enabled: true,
          totp_secret: pending.temp_secret,
          totp_backup_codes: hashedBackupCodes,
          totp_setup_at: new Date().toISOString(),
          totp_backup_codes_generated_at: new Date().toISOString(),
          pin_hash: null // Remove PIN - TOTP is now the only 2FA method
        })
        .eq('id', superAdmin.id);

      if (updateError) {
        logger.error("Failed to enable TOTP on super admin", {
          superAdminId: superAdmin.id,
          error: updateError.message
        });
        return new Response(
          JSON.stringify({ error: "Failed to complete TOTP setup" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark setup as verified
      await supabase
        .from('envision_totp_setup')
        .update({ verified: true })
        .eq('id', pending.id);

      // Mark the session as 2FA complete
      await supabase
        .from('envision_sessions')
        .update({ pin_verified_at: new Date().toISOString() })
        .eq('session_token', sessionToken);

      logger.info("TOTP setup completed", {
        superAdminId: superAdmin.id,
        email: superAdmin.email
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: null,
        action: 'ENVISION_TOTP_SETUP_COMPLETED',
        resource_type: 'envision_auth',
        resource_id: superAdmin.id,
        metadata: {
          email: superAdmin.email
        }
      }).catch(() => {});

      return new Response(
        JSON.stringify({
          success: true,
          session_token: sessionToken,
          backup_codes: backupCodes, // Show backup codes one final time
          message: "Authenticator setup complete. Save your backup codes securely - they will not be shown again!"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalid action
    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'begin' or 'confirm'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-setup", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
