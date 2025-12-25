/**
 * Envision Verify PIN Edge Function (Step 2)
 *
 * Second step of Envision two-factor authentication.
 * Validates PIN and completes the session.
 *
 * Flow:
 * 1. Accept session token (from step 1) and PIN
 * 2. Validate session exists and is not expired
 * 3. Check PIN rate limit (5 failures = 15 min lockout)
 * 4. Verify PIN against PBKDF2 hash
 * 5. Complete session (set pin_verified_at)
 * 6. Return full session with extended expiry
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
const FULL_SESSION_TTL_MINUTES = 120; // Full session valid for 2 hours

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('envision-verify-pin', req);

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
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SERVICE_ROLE_KEY", "SB_SECRET_KEY");

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
    const sessionToken = body?.session_token as string;
    const pin = body?.pin as string;

    // Validate inputs
    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Session token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pin) {
      return new Response(
        JSON.stringify({ error: "PIN is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Look up pending session
    const { data: session, error: sessionError } = await supabase
      .from('envision_sessions')
      .select(`
        id,
        super_admin_id,
        password_verified_at,
        pin_verified_at,
        expires_at
      `)
      .eq('session_token', sessionToken)
      .is('pin_verified_at', null)  // Only get pending sessions
      .single();

    if (sessionError || !session) {
      logger.warn("Envision PIN verification for invalid session", {
        clientIp,
        sessionFound: !!session
      });

      return new Response(
        JSON.stringify({ error: "Invalid or expired session. Please login again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      logger.info("Envision PIN verification for expired session", {
        superAdminId: session.super_admin_id,
        clientIp
      });

      // Delete expired session
      await supabase
        .from('envision_sessions')
        .delete()
        .eq('id', session.id);

      return new Response(
        JSON.stringify({ error: "Session expired. Please login again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get super admin for PIN verification
    const { data: superAdmin, error: adminError } = await supabase
      .from('super_admin_users')
      .select('id, email, full_name, role, pin_hash, permissions, is_active')
      .eq('id', session.super_admin_id)
      .single();

    if (adminError || !superAdmin) {
      logger.error("Super admin not found for session", {
        sessionId: session.id,
        superAdminId: session.super_admin_id
      });

      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if account is still active
    if (!superAdmin.is_active) {
      logger.security("Envision PIN verification for deactivated account", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        clientIp
      });

      return new Response(
        JSON.stringify({ error: "Account is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if PIN is set
    if (!superAdmin.pin_hash) {
      logger.warn("Envision PIN verification for user without PIN", {
        superAdminId: superAdmin.id,
        email: superAdmin.email
      });

      return new Response(
        JSON.stringify({
          error: "PIN not configured",
          requires_pin_setup: true,
          message: "Please set up your PIN before logging in."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting for PIN
    const { data: lockoutData, error: lockoutError } = await supabase
      .rpc('check_envision_lockout', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'pin'
      });

    if (lockoutError) {
      logger.error("Failed to check Envision PIN lockout status", {
        superAdminId: superAdmin.id,
        error: lockoutError.message
      });
    } else if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
      const unlockAt = new Date(lockoutData[0].unlock_at);
      const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      logger.security("Envision PIN verification blocked - user locked out", {
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

    // Verify PIN
    const pinValid = await verifyPin(pin, superAdmin.pin_hash);

    if (!pinValid) {
      // Record failed attempt
      await supabase.rpc('record_envision_attempt', {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: 'pin',
        p_success: false,
        p_client_ip: clientIp,
        p_user_agent: userAgent
      }).catch((err: Error) => {
        logger.error("Failed to record Envision PIN attempt", { error: err.message });
      });

      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("Envision PIN verification failed", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: null,
        action: 'ENVISION_PIN_FAILED',
        resource_type: 'envision_auth',
        resource_id: superAdmin.id,
        metadata: {
          email: superAdmin.email,
          client_ip: clientIp,
          failed_attempts: newFailedCount,
          remaining_attempts: remainingAttempts
        }
      }).catch(() => {});

      // Build error response with remaining attempts info
      const errorResponse: Record<string, unknown> = {
        error: "Incorrect PIN"
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

    // PIN verified! Record successful attempt
    await supabase.rpc('record_envision_attempt', {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: 'pin',
      p_success: true,
      p_client_ip: clientIp,
      p_user_agent: userAgent
    }).catch((err: Error) => {
      logger.error("Failed to record successful Envision PIN attempt", { error: err.message });
    });

    // Generate new session token for full access
    const fullSessionToken = generateSecureToken();
    const fullExpiresAt = new Date(Date.now() + FULL_SESSION_TTL_MINUTES * 60 * 1000).toISOString();

    // Update session to completed state
    const { error: updateError } = await supabase
      .from('envision_sessions')
      .update({
        session_token: fullSessionToken,  // New token for security
        pin_verified_at: new Date().toISOString(),
        expires_at: fullExpiresAt
      })
      .eq('id', session.id);

    if (updateError) {
      logger.error("Failed to complete Envision session", {
        sessionId: session.id,
        error: updateError.message
      });

      return new Response(
        JSON.stringify({ error: "Failed to complete session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_login_at on super_admin_users
    await supabase
      .from('super_admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', superAdmin.id);

    logger.info("Envision two-factor auth completed successfully", {
      superAdminId: superAdmin.id,
      email: superAdmin.email,
      clientIp,
      sessionExpiresAt: fullExpiresAt
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'ENVISION_LOGIN_SUCCESS',
      resource_type: 'envision_auth',
      resource_id: superAdmin.id,
      metadata: {
        email: superAdmin.email,
        full_name: superAdmin.full_name,
        role: superAdmin.role,
        client_ip: clientIp,
        session_expires: fullExpiresAt
      }
    }).catch(() => {});

    // Return full session info
    return new Response(
      JSON.stringify({
        success: true,
        session_token: fullSessionToken,
        expires_at: fullExpiresAt,
        user: {
          id: superAdmin.id,
          email: superAdmin.email,
          full_name: superAdmin.full_name,
          role: superAdmin.role,
          permissions: superAdmin.permissions
        },
        message: "Login successful. Welcome to the Envision Master Panel."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-verify-pin", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
