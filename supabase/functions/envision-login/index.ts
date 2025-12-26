/**
 * Envision Login Edge Function (Step 1)
 *
 * First step of Envision two-factor authentication.
 * Validates email + password and returns a session token for PIN verification.
 *
 * Flow:
 * 1. Accept email and password
 * 2. Look up super_admin_users by email
 * 3. Check rate limit (5 failures = 15 min lockout)
 * 4. Verify password: Try standalone hash first, then Supabase Auth as fallback
 * 5. Create pending session (awaiting PIN verification)
 * 6. Return session token for step 2
 *
 * IMPORTANT: Super admins can use their WellFit/Supabase Auth credentials.
 * The function will try standalone password_hash first, then fall back to
 * Supabase Auth if standalone verification fails.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { verifyPin, generateSecureToken, hashPassword } from "../_shared/crypto.ts";

// Rate limiting constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const SESSION_TTL_MINUTES = 30; // Pending session valid for 30 minutes (allows time for TOTP setup)

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("envision-login", req);
  logger.info("ENVISION_LOGIN_TATTOO_v25", { now: new Date().toISOString() });


  // Handle CORS
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Environment variables
  // IMPORTANT: support modern naming too
  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL", "SB_PROJECT_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv(
    "SB_SECRET_KEY",
    "SB_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  );
  const SUPABASE_ANON_KEY = getEnv("SB_ANON_KEY", "SUPABASE_ANON_KEY", "SB_PUBLISHABLE_API_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Extract client info for logging
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    const body = await req.json().catch(() => ({}));
    const email = (body?.email as string)?.trim()?.toLowerCase();
    const password = body?.password as string;

    // Validate inputs
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password) {
      return new Response(JSON.stringify({ error: "Password is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up super admin by email (case-insensitive)
    const { data: superAdmin, error: lookupError } = await supabase
      .from("super_admin_users")
      .select(
        "id, email, full_name, role, password_hash, pin_hash, is_active, totp_enabled, totp_secret"
      )
      .ilike("email", email)
      .single();

    // Generic error message to prevent email enumeration
    const genericErrorResponse = new Response(JSON.stringify({ error: "Invalid email or password" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (lookupError || !superAdmin) {
      logger.info("Envision login attempt for non-existent email", { email, clientIp });
      return genericErrorResponse;
    }

    // Check if account is active
    if (!superAdmin.is_active) {
      logger.security("Envision login attempt for inactive account", {
        superAdminId: superAdmin.id,
        email,
        clientIp,
      });
      return genericErrorResponse;
    }

    // Check rate limiting
    const { data: lockoutData, error: lockoutError } = await supabase.rpc("check_envision_lockout", {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: "password",
    });

    if (lockoutError) {
      logger.error("Failed to check Envision lockout status", {
        superAdminId: superAdmin.id,
        error: lockoutError.message,
      });
      // Continue with verification - don't block on rate limit check failure
    } else if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
      const unlockAt = new Date(lockoutData[0].unlock_at);
      const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      logger.security("Envision login blocked - user locked out", {
        superAdminId: superAdmin.id,
        clientIp,
        unlockAt: unlockAt.toISOString(),
        remainingMinutes,
      });

      return new Response(
        JSON.stringify({
          error: `Account temporarily locked. Try again in ${remainingMinutes} minute${
            remainingMinutes !== 1 ? "s" : ""
          }.`,
          locked_until: unlockAt.toISOString(),
          remaining_minutes: remainingMinutes,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const failedCount = (lockoutData as any)?.[0]?.failed_count ?? 0;

    // ═══════════════════════════════════════════════════════════════
    // PASSWORD VERIFICATION - Try standalone hash first, then Supabase Auth
    // ═══════════════════════════════════════════════════════════════
    let passwordValid = false;
    let authMethod: "standalone" | "supabase" = "standalone";

    // Method 1: Try standalone password_hash if configured
    if (superAdmin.password_hash) {
      passwordValid = await verifyPin(password, superAdmin.password_hash);
      if (passwordValid) {
        logger.info("Envision password verified via standalone hash", {
          superAdminId: superAdmin.id,
          email,
        });
      }
    }

    // Method 2: Fall back to database-side bcrypt verification
    if (!passwordValid) {
      try {
        const { data: verifyResult, error: verifyError } = await supabase.rpc("verify_user_password", {
          user_email: email,
          input_password: password,
        });

        if (!verifyError && verifyResult === true) {
          passwordValid = true;
          authMethod = "supabase";

          logger.info("Envision password verified via PostgreSQL pgcrypto", {
            superAdminId: superAdmin.id,
            email,
          });

          // Sync password: Update standalone password_hash for future logins
          try {
            const newHash = await hashPassword(password);
            await supabase.from("super_admin_users").update({ password_hash: newHash }).eq("id", superAdmin.id);
            logger.info("Synced Supabase Auth password to standalone hash", { superAdminId: superAdmin.id });
          } catch (syncErr: unknown) {
            const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
            logger.warn("Failed to sync password hash", { error: syncMsg });
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("PostgreSQL password verification failed", { error: msg });
      }
    }

    if (!passwordValid) {
      // Record failed attempt (fire and forget - don't let RPC errors block login flow)
      try {
        const { error: recErr } = await supabase.rpc("record_envision_attempt", {
          p_super_admin_id: superAdmin.id,
          p_attempt_type: "password",
          p_success: false,
          p_client_ip: clientIp,
          p_user_agent: userAgent,
        });
        if (recErr) logger.error("Failed to record Envision auth attempt", { error: recErr.message });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Failed to record Envision auth attempt", { error: msg });
      }

      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("Envision password verification failed", {
        superAdminId: superAdmin.id,
        email,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts,
      });

      // Audit log (fire and forget)
      try {
        const { error: alErr } = await supabase.from("audit_logs").insert({
          user_id: null,
          action: "ENVISION_PASSWORD_FAILED",
          resource_type: "envision_auth",
          resource_id: superAdmin.id,
          metadata: {
            email,
            client_ip: clientIp,
            failed_attempts: newFailedCount,
            remaining_attempts: remainingAttempts,
          },
        });
        if (alErr) {
          // ignore but visible if you want later
          logger.warn("Audit log insert failed", { error: alErr.message });
        }
      } catch {
        /* ignore */
      }

      // Build error response with remaining attempts info
      const errorResponse: Record<string, unknown> = {
        error: "Invalid email or password",
      };

      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        errorResponse.warning = `${remainingAttempts} attempt${
          remainingAttempts !== 1 ? "s" : ""
        } remaining before temporary lockout`;
        errorResponse.remaining_attempts = remainingAttempts;
      } else if (remainingAttempts === 0) {
        errorResponse.error = `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed attempts`;
        errorResponse.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Password verified! Record successful attempt
    try {
      const { error: recOkErr } = await supabase.rpc("record_envision_attempt", {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: "password",
        p_success: true,
        p_client_ip: clientIp,
        p_user_agent: userAgent,
      });
      if (recOkErr) {
        logger.error("Failed to record successful Envision auth attempt", { error: recOkErr.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to record successful Envision auth attempt", { error: msg });
    }

    logger.info("Envision password verification successful", {
      superAdminId: superAdmin.id,
      email,
      authMethod,
    });

    // Create pending session (awaiting PIN verification)
    const sessionToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: sessionError } = await supabase.from("envision_sessions").insert({
      super_admin_id: superAdmin.id,
      session_token: sessionToken,
      password_verified_at: new Date().toISOString(),
      pin_verified_at: null, // NULL until PIN verified
      expires_at: expiresAt,
      client_ip: clientIp,
      user_agent: userAgent,
    });

    if (sessionError) {
      logger.error("Failed to create Envision session", {
        superAdminId: superAdmin.id,
        error: sessionError.message,
      });

      return new Response(JSON.stringify({ error: "Failed to create session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logger.info("Envision password verified, awaiting PIN", {
      superAdminId: superAdmin.id,
      email,
      clientIp,
      sessionExpiresAt: expiresAt,
    });

    // Audit log
    try {
      const { error: alOkErr } = await supabase.from("audit_logs").insert({
        user_id: null,
        action: "ENVISION_PASSWORD_SUCCESS",
        resource_type: "envision_auth",
        resource_id: superAdmin.id,
        metadata: {
          email,
          client_ip: clientIp,
          session_expires: expiresAt,
          auth_method: authMethod,
        },
      });
      if (alOkErr) logger.warn("Audit log insert failed", { error: alOkErr.message });
    } catch {
      /* ignore */
    }

    // Determine 2FA method
    const totpEnabled = Boolean(superAdmin.totp_enabled && superAdmin.totp_secret);
    const pinConfigured = Boolean(superAdmin.pin_hash);
    const needs2FASetup = !totpEnabled && !pinConfigured;

    // Return session token for 2FA verification step
    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        expires_at: expiresAt,
        // 2FA method indicators
        totp_enabled: totpEnabled,
        pin_configured: pinConfigured,
        requires_2fa_setup: needs2FASetup,
        // Legacy field for backwards compatibility
        requires_pin: !totpEnabled && pinConfigured,
        message: totpEnabled
          ? "Password verified. Please enter your authenticator code."
          : pinConfigured
          ? "Password verified. Please enter your PIN to complete login."
          : "Password verified. Please set up two-factor authentication.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    logger.error("Fatal error in envision-login", { error: msg, stack });
    return new Response(JSON.stringify({ error: "Internal server error", debug: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
