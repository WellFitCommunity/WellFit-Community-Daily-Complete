/**
 * Envision TOTP Verify (Supabase Auth Version)
 *
 * Verifies TOTP code for users who authenticated via Supabase.
 * This is the second factor after successful Supabase signInWithPassword.
 *
 * Flow:
 * 1. User logs in via Supabase auth (password verified)
 * 2. If TOTP enabled, they call this endpoint with access token + TOTP code
 * 3. We verify the code and return a confirmation
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyTotpCode } from "../_shared/crypto.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-totp-verify-supabase', req);

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get the authorization header (Supabase access token)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    const body = await req.json().catch(() => ({}));
    const code = body?.code as string;

    // Validate TOTP code format
    if (!code || !/^\d{6}$/.test(code.replace(/\s+/g, ''))) {
      return new Response(
        JSON.stringify({ error: "Valid 6-digit code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token to get their identity
    // Prefer SB_ANON_KEY (JWT format) which works with Supabase auth
    const supabaseUser = createClient(SUPABASE_URL, getEnv("SB_ANON_KEY", "SUPABASE_ANON_KEY", "SB_PUBLISHABLE_API_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      logger.warn("Invalid or expired access token for TOTP verify");
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Now use service role to check super_admin_users
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get super admin with TOTP secret
    const { data: superAdmin, error: adminError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, role, permissions, totp_secret, totp_enabled, is_active')
      .eq('user_id', user.id)
      .single();

    if (adminError || !superAdmin) {
      logger.error("Super admin not found for TOTP verify", { userId: user.id });
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!superAdmin.is_active) {
      return new Response(
        JSON.stringify({ error: "Account is deactivated" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if TOTP is enabled
    if (!superAdmin.totp_enabled || !superAdmin.totp_secret) {
      return new Response(
        JSON.stringify({
          error: "TOTP not enabled for this account",
          hint: "Set up TOTP first"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for lockout
    const { data: lockoutCheck } = await supabase.rpc('check_envision_lockout', {
      p_super_admin_id: superAdmin.id,
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

    // Verify the TOTP code
    const isValid = await verifyTotpCode(superAdmin.totp_secret, code);

    if (!isValid) {
      logger.warn("Invalid TOTP code during Supabase auth", { superAdminId: superAdmin.id });

      // Record failed attempt
      await supabase.rpc('record_envision_attempt', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'totp',
        p_success: false
      });

      // Check remaining attempts
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

    // TOTP verified! Record successful attempt
    await supabase.rpc('record_envision_attempt', {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: 'totp',
      p_success: true
    });

    // Update last login
    await supabase
      .from('super_admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', superAdmin.id);

    logger.info("TOTP verification successful (Supabase auth)", {
      superAdminId: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'ENVISION_LOGIN_SUCCESS_TOTP',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email: superAdmin.email,
        role: superAdmin.role,
        method: 'totp_supabase_auth'
      }
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        message: "Two-factor authentication verified",
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
    logger.error("Fatal error in envision-totp-verify-supabase", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
