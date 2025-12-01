/**
 * Envision Login Edge Function (Step 1)
 *
 * First step of Envision two-factor authentication.
 * Validates email + password and returns a session token for PIN verification.
 *
 * Flow:
 * 1. Accept email and password (client pre-hashed with SHA-256)
 * 2. Look up super_admin_users by email
 * 3. Check rate limit (5 failures = 15 min lockout)
 * 4. Verify password against PBKDF2 hash
 * 5. Create pending session (awaiting PIN verification)
 * 6. Return session token for step 2
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyPin, generateSecureToken, isClientHashedPin } from "../_shared/crypto.ts";

// Rate limiting constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const SESSION_TTL_MINUTES = 5; // Pending session valid for 5 minutes before PIN required

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-login', req);

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
    // Extract client info for logging
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    const body = await req.json().catch(() => ({}));
    const email = (body?.email as string)?.trim()?.toLowerCase();
    const password = body?.password as string;

    // Validate inputs
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

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look up super admin by email
    const { data: superAdmin, error: lookupError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, role, password_hash, is_active')
      .eq('email', email)
      .single();

    // Generic error message to prevent email enumeration
    const genericErrorResponse = new Response(
      JSON.stringify({ error: "Invalid email or password" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    if (lookupError || !superAdmin) {
      logger.info("Envision login attempt for non-existent email", {
        email,
        clientIp
      });
      return genericErrorResponse;
    }

    // Check if account is active
    if (!superAdmin.is_active) {
      logger.security("Envision login attempt for inactive account", {
        superAdminId: superAdmin.id,
        email,
        clientIp
      });
      return genericErrorResponse;
    }

    // Check if standalone auth is configured (has password_hash)
    if (!superAdmin.password_hash) {
      logger.warn("Envision login attempt for user without standalone auth", {
        superAdminId: superAdmin.id,
        email,
        clientIp
      });

      return new Response(
        JSON.stringify({
          error: "This account uses Supabase authentication. Please use the standard login flow.",
          use_supabase_auth: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting
    const { data: lockoutData, error: lockoutError } = await supabase
      .rpc('check_envision_lockout', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'password'
      });

    if (lockoutError) {
      logger.error("Failed to check Envision lockout status", {
        superAdminId: superAdmin.id,
        error: lockoutError.message
      });
      // Continue with verification - don't block on rate limit check failure
    } else if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
      const unlockAt = new Date(lockoutData[0].unlock_at);
      const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      logger.security("Envision login blocked - user locked out", {
        superAdminId: superAdmin.id,
        clientIp,
        unlockAt: unlockAt.toISOString(),
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

    const failedCount = lockoutData?.[0]?.failed_count ?? 0;

    // Verify password
    const passwordValid = await verifyPin(password, superAdmin.password_hash);

    if (!passwordValid) {
      // Record failed attempt
      await supabase.rpc('record_envision_attempt', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'password',
        p_success: false,
        p_client_ip: clientIp,
        p_user_agent: userAgent
      }).catch((err: Error) => {
        logger.error("Failed to record Envision auth attempt", { error: err.message });
      });

      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("Envision password verification failed", {
        superAdminId: superAdmin.id,
        email,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: null,
        action: 'ENVISION_PASSWORD_FAILED',
        resource_type: 'envision_auth',
        resource_id: superAdmin.id,
        metadata: {
          email,
          client_ip: clientIp,
          failed_attempts: newFailedCount,
          remaining_attempts: remainingAttempts
        }
      }).catch(() => {});

      // Build error response with remaining attempts info
      const errorResponse: Record<string, unknown> = {
        error: "Invalid email or password"
      };

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

    // Password verified! Record successful attempt
    await supabase.rpc('record_envision_attempt', {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: 'password',
      p_success: true,
      p_client_ip: clientIp,
      p_user_agent: userAgent
    }).catch((err: Error) => {
      logger.error("Failed to record successful Envision auth attempt", { error: err.message });
    });

    // Create pending session (awaiting PIN verification)
    const sessionToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: sessionError } = await supabase
      .from('envision_sessions')
      .insert({
        super_admin_id: superAdmin.id,
        session_token: sessionToken,
        password_verified_at: new Date().toISOString(),
        pin_verified_at: null,  // NULL until PIN verified
        expires_at: expiresAt,
        client_ip: clientIp,
        user_agent: userAgent
      });

    if (sessionError) {
      logger.error("Failed to create Envision session", {
        superAdminId: superAdmin.id,
        error: sessionError.message
      });

      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("Envision password verified, awaiting PIN", {
      superAdminId: superAdmin.id,
      email,
      clientIp,
      sessionExpiresAt: expiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'ENVISION_PASSWORD_SUCCESS',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email,
        client_ip: clientIp,
        session_expires: expiresAt
      }
    }).catch(() => {});

    // Return session token for PIN verification step
    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        requires_pin: true,
        message: "Password verified. Please enter your PIN to complete login."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-login", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
