/**
 * WellFit Admin Login Edge Function
 *
 * Server-side authentication for WellFit admin users.
 * Uses password_hash from super_admin_users table, independent of Supabase JWT auth.
 *
 * Flow:
 * 1. Accept email and password
 * 2. Look up user in super_admin_users by email
 * 3. Check rate limiting (5 failures = 15 min lockout)
 * 4. Verify password against PBKDF2 hash
 * 5. Create pending session (awaiting PIN verification)
 * 6. Return session token for PIN verification step
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyPin, generateSecureToken } from "../_shared/crypto.ts";

// Rate limiting constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const SESSION_TTL_MINUTES = 30; // Admin session valid for 30 minutes

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('wellfit-admin-login', req);

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
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    const body = await req.json().catch(() => ({}));
    const email = (body?.email as string)?.trim()?.toLowerCase();
    const password = body?.password as string;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look up admin by email in super_admin_users
    const { data: adminUser, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, user_id, email, full_name, role, password_hash, pin_hash, is_active, permissions')
      .ilike('email', email)
      .single();

    const genericErrorResponse = new Response(
      JSON.stringify({ error: "Invalid email or password" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    if (lookupError || !adminUser) {
      logger.info("WellFit admin login attempt for non-existent email", { email, clientIp });
      return genericErrorResponse;
    }

    if (!adminUser.is_active) {
      logger.security("WellFit admin login attempt for inactive account", {
        adminId: adminUser.id,
        email,
        clientIp
      });
      return genericErrorResponse;
    }

    if (!adminUser.password_hash) {
      logger.warn("WellFit admin login attempt for user without password", {
        adminId: adminUser.id,
        email,
        clientIp
      });
      return new Response(
        JSON.stringify({
          error: "Password not configured. Please contact support.",
          needs_password_setup: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting using RPC (if available)
    let failedCount = 0;
    try {
      const { data: lockoutData } = await supabase
        .rpc('check_wellfit_admin_lockout', { p_admin_id: adminUser.id });

      if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
        const unlockAt = new Date(lockoutData[0].unlock_at);
        const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

        logger.security("WellFit admin login blocked - locked out", {
          adminId: adminUser.id,
          clientIp,
          remainingMinutes
        });

        return new Response(
          JSON.stringify({
            error: `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`,
            locked_until: unlockAt.toISOString(),
            remaining_minutes: remainingMinutes
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      failedCount = lockoutData?.[0]?.failed_count ?? 0;
    } catch {
      // Rate limit RPC not available, continue without it
    }

    // Verify password
    const passwordValid = await verifyPin(password, adminUser.password_hash);

    if (!passwordValid) {
      // Record failed attempt
      try {
        await supabase.rpc('record_wellfit_admin_attempt', {
          p_admin_id: adminUser.id,
          p_success: false,
          p_client_ip: clientIp,
          p_user_agent: userAgent
        });
      } catch {
        // RPC not available
      }

      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("WellFit admin password verification failed", {
        adminId: adminUser.id,
        email,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: adminUser.user_id,
        action: 'WELLFIT_ADMIN_PASSWORD_FAILED',
        resource_type: 'wellfit_auth',
        resource_id: adminUser.id,
        metadata: { email, client_ip: clientIp, failed_attempts: newFailedCount }
      }).catch(() => {});

      const errorResponse: Record<string, unknown> = { error: "Invalid email or password" };
      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        errorResponse.warning = `${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before temporary lockout`;
        errorResponse.remaining_attempts = remainingAttempts;
      } else if (remainingAttempts === 0) {
        errorResponse.error = `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed attempts`;
        errorResponse.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
      }

      return new Response(
        JSON.stringify(errorResponse),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password verified! Record success
    try {
      await supabase.rpc('record_wellfit_admin_attempt', {
        p_admin_id: adminUser.id,
        p_success: true,
        p_client_ip: clientIp,
        p_user_agent: userAgent
      });
    } catch {
      // RPC not available
    }

    // Create admin session
    const sessionToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();

    // Store in admin_sessions table
    const { error: sessionError } = await supabase
      .from('admin_sessions')
      .insert({
        user_id: adminUser.user_id,
        role: adminUser.role,
        admin_token: sessionToken,
        expires_at: expiresAt
      });

    if (sessionError) {
      logger.error("Failed to create admin session", {
        adminId: adminUser.id,
        error: sessionError.message
      });
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("WellFit admin password verified, session created", {
      adminId: adminUser.id,
      email,
      clientIp,
      sessionExpiresAt: expiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: adminUser.user_id,
      action: 'WELLFIT_ADMIN_LOGIN_SUCCESS',
      resource_type: 'wellfit_auth',
      resource_id: adminUser.id,
      metadata: { email, client_ip: clientIp, session_expires: expiresAt }
    }).catch(() => {});

    // Check if PIN verification is required
    const pinConfigured = Boolean(adminUser.pin_hash);

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        user: {
          id: adminUser.id,
          user_id: adminUser.user_id,
          email: adminUser.email,
          full_name: adminUser.full_name,
          role: adminUser.role,
          permissions: adminUser.permissions
        },
        requires_pin: pinConfigured,
        message: pinConfigured
          ? "Password verified. Please enter your PIN."
          : "Login successful."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in wellfit-admin-login", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
