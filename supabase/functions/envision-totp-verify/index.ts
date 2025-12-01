/**
 * Envision TOTP Verify Edge Function
 *
 * Verifies TOTP code during login (step 2 of 2FA).
 * Replaces the legacy PIN verification for users with TOTP enabled.
 *
 * Flow:
 * 1. Validate session token (must have password verified)
 * 2. Get user's TOTP secret
 * 3. Verify the 6-digit code
 * 4. Complete 2FA and return full session
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyTotpCode, generateSecureToken } from "../_shared/crypto.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

// Session expires 8 hours after full 2FA
const FULL_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-totp-verify', req);

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

    // Validate session (must have password verified)
    const { data: session, error: sessionError } = await supabase
      .from('envision_sessions')
      .select('id, super_admin_id, password_verified_at, pin_verified_at, expires_at')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      logger.warn("Invalid or expired session for TOTP verify", { sessionToken: sessionToken.slice(0, 8) + '...' });
      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check password was verified
    if (!session.password_verified_at) {
      return new Response(
        JSON.stringify({ error: "Password verification required first" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already fully authenticated
    if (session.pin_verified_at) {
      return new Response(
        JSON.stringify({ error: "Already authenticated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for lockout
    const { data: lockoutCheck } = await supabase.rpc('check_envision_lockout', {
      p_super_admin_id: session.super_admin_id,
      p_attempt_type: 'totp'
    });

    if (lockoutCheck?.[0]?.is_locked) {
      const unlockAt = new Date(lockoutCheck[0].unlock_at);
      const minutesRemaining = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      return new Response(
        JSON.stringify({
          error: "Account temporarily locked",
          locked_until: lockoutCheck[0].unlock_at,
          hint: `Too many failed attempts. Try again in ${minutesRemaining} minutes.`
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get super admin with TOTP secret
    const { data: superAdmin, error: adminError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, role, permissions, totp_secret, totp_enabled')
      .eq('id', session.super_admin_id)
      .eq('is_active', true)
      .single();

    if (adminError || !superAdmin) {
      logger.error("Super admin not found for TOTP verify", { superAdminId: session.super_admin_id });
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if TOTP is enabled
    if (!superAdmin.totp_enabled || !superAdmin.totp_secret) {
      return new Response(
        JSON.stringify({
          error: "TOTP not enabled for this account",
          hint: "Use PIN verification or set up TOTP first"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the TOTP code
    const isValid = await verifyTotpCode(superAdmin.totp_secret, code);

    if (!isValid) {
      logger.warn("Invalid TOTP code during login", { superAdminId: superAdmin.id });

      // Record failed attempt (may trigger lockout)
      await supabase.rpc('record_envision_attempt', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'totp',
        p_success: false
      });

      // Check if now locked out
      const { data: newLockoutCheck } = await supabase.rpc('check_envision_lockout', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'totp'
      });

      const remainingAttempts = 5 - (newLockoutCheck?.[0]?.failed_count || 0);

      return new Response(
        JSON.stringify({
          error: "Invalid verification code",
          remaining_attempts: Math.max(0, remainingAttempts),
          hint: remainingAttempts <= 2
            ? `Warning: ${remainingAttempts} attempts remaining before lockout`
            : "Check your authenticator app for the current code"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TOTP verified! Complete 2FA
    const now = new Date();
    const newExpiry = new Date(now.getTime() + FULL_SESSION_DURATION_MS);
    const newSessionToken = generateSecureToken();

    // Update session with TOTP verification and new token
    const { error: updateError } = await supabase
      .from('envision_sessions')
      .update({
        pin_verified_at: now.toISOString(),
        session_token: newSessionToken,
        expires_at: newExpiry.toISOString()
      })
      .eq('id', session.id);

    if (updateError) {
      logger.error("Failed to complete TOTP verification", {
        superAdminId: superAdmin.id,
        error: updateError.message
      });
      return new Response(
        JSON.stringify({ error: "Failed to complete verification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record successful attempt (clears lockout)
    await supabase.rpc('record_envision_attempt', {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: 'totp',
      p_success: true
    });

    // Update last login
    await supabase
      .from('super_admin_users')
      .update({ last_login_at: now.toISOString() })
      .eq('id', superAdmin.id);

    logger.info("TOTP verification successful", {
      superAdminId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'ENVISION_LOGIN_SUCCESS_TOTP',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email: superAdmin.email,
        role: superAdmin.role,
        method: 'totp'
      }
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        session_token: newSessionToken,
        expires_at: newExpiry.toISOString(),
        user: {
          id: superAdmin.id,
          email: superAdmin.email,
          full_name: superAdmin.full_name,
          role: superAdmin.role,
          permissions: superAdmin.permissions
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-verify", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
