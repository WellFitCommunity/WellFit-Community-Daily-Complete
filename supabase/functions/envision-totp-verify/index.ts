/**
 * Envision TOTP Verify Edge Function (Step 2 - TOTP)
 *
 * Second step of Envision two-factor authentication for TOTP users.
 * Validates TOTP code and completes the session.
 *
 * Flow:
 * 1. Accept session token (from step 1) and TOTP code
 * 2. Validate session exists and is not expired
 * 3. Check TOTP rate limit (5 failures = 15 min lockout)
 * 4. Verify TOTP code against stored secret
 * 5. Complete session (set pin_verified_at)
 * 6. Return full session with extended expiry
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { generateSecureToken, verifyTotpCode } from "../_shared/crypto.ts";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const FULL_SESSION_TTL_MINUTES = 120;

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("envision-totp-verify", req);

  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;

    const userAgent = req.headers.get("user-agent") || null;

    const body = await req.json().catch(() => ({}));
    const sessionToken = String(body?.session_token ?? "").trim();
    const codeRaw = String(body?.code ?? "");
    const code = codeRaw.replace(/\s+/g, "");

    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Session token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "Valid 6-digit code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up pending session
    const { data: session, error: sessionError } = await supabase
      .from("envision_sessions")
      .select("id, super_admin_id, pin_verified_at, expires_at")
      .eq("session_token", sessionToken)
      .is("pin_verified_at", null)
      .single();

    if (sessionError || !session) {
      logger.warn("Envision TOTP verification for invalid session", { clientIp, sessionFound: !!session });
      return new Response(JSON.stringify({ error: "Invalid or expired session. Please login again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at as string) < new Date()) {
      logger.info("Envision TOTP verification for expired session", { superAdminId: session.super_admin_id, clientIp });

      try {
        await supabase.from("envision_sessions").delete().eq("id", session.id);
      } catch {
        // ignore
      }

      return new Response(JSON.stringify({ error: "Session expired. Please login again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get super admin for TOTP verification
    const { data: superAdmin, error: adminError } = await supabase
      .from("super_admin_users")
      .select("id, email, full_name, role, totp_secret, totp_enabled, permissions, is_active")
      .eq("id", session.super_admin_id)
      .single();

    if (adminError || !superAdmin) {
      logger.error("Super admin not found for session", { sessionId: session.id, superAdminId: session.super_admin_id });
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!superAdmin.is_active) {
      logger.security("Envision TOTP verification for deactivated account", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        clientIp,
      });
      return new Response(JSON.stringify({ error: "Account is not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!superAdmin.totp_enabled || !superAdmin.totp_secret) {
      logger.warn("Envision TOTP verification for user without TOTP", { superAdminId: superAdmin.id, email: superAdmin.email });
      return new Response(
        JSON.stringify({
          error: "TOTP not configured",
          requires_totp_setup: true,
          message: "Please set up your authenticator app before logging in.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting for TOTP
    const { data: lockoutData, error: lockoutError } = await supabase.rpc("check_envision_lockout", {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: "totp",
    });

    if (lockoutError) {
      logger.error("Failed to check Envision TOTP lockout status", { superAdminId: superAdmin.id, error: lockoutError.message });
    } else if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
      const unlockAt = new Date(lockoutData[0].unlock_at);
      const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      logger.security("Envision TOTP verification blocked - user locked out", {
        superAdminId: superAdmin.id,
        clientIp,
        unlockAt: unlockAt.toISOString(),
        remainingMinutes,
      });

      return new Response(
        JSON.stringify({
          error: `Account temporarily locked. Try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""}.`,
          locked_until: unlockAt.toISOString(),
          remaining_minutes: remainingMinutes,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const failedCount = lockoutData?.[0]?.failed_count ?? 0;

    // Verify TOTP code
    const totpValid = await verifyTotpCode(superAdmin.totp_secret, code);

    if (!totpValid) {
      // Record failed attempt (NO .catch chaining)
      try {
        const { error: recErr } = await supabase.rpc("record_envision_attempt", {
          p_super_admin_id: superAdmin.id,
          p_attempt_type: "totp",
          p_success: false,
          p_client_ip: clientIp,
          p_user_agent: userAgent,
        });
        if (recErr) logger.error("Failed to record Envision TOTP attempt", { error: recErr.message });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("Failed to record Envision TOTP attempt", { error: msg });
      }

      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("Envision TOTP verification failed", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts,
      });

      // Audit log (best-effort)
      try {
        const { error: alErr } = await supabase.from("audit_logs").insert({
          user_id: null,
          action: "ENVISION_TOTP_FAILED",
          resource_type: "envision_auth",
          resource_id: superAdmin.id,
          metadata: {
            email: superAdmin.email,
            client_ip: clientIp,
            failed_attempts: newFailedCount,
            remaining_attempts: remainingAttempts,
          },
        });
        if (alErr) logger.warn("Audit log insert failed", { error: alErr.message });
      } catch {
        // ignore
      }

      const errorResponse: Record<string, unknown> = { error: "Invalid verification code" };

      if (remainingAttempts <= 2 && remainingAttempts > 0) {
        errorResponse.warning = `${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining before temporary lockout`;
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

    // Record successful attempt
    try {
      const { error: recOkErr } = await supabase.rpc("record_envision_attempt", {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: "totp",
        p_success: true,
        p_client_ip: clientIp,
        p_user_agent: userAgent,
      });
      if (recOkErr) logger.error("Failed to record successful Envision TOTP attempt", { error: recOkErr.message });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Failed to record successful Envision TOTP attempt", { error: msg });
    }

    // Generate new session token for full access
    const fullSessionToken = generateSecureToken();
    const fullExpiresAt = new Date(Date.now() + FULL_SESSION_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("envision_sessions")
      .update({
        session_token: fullSessionToken,
        pin_verified_at: new Date().toISOString(),
        expires_at: fullExpiresAt,
      })
      .eq("id", session.id);

    if (updateError) {
      logger.error("Failed to complete Envision session", { sessionId: session.id, error: updateError.message });
      return new Response(JSON.stringify({ error: "Failed to complete session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update last_login_at (best-effort)
    try {
      await supabase.from("super_admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", superAdmin.id);
    } catch {
      // ignore
    }

    // Audit log (best-effort)
    try {
      await supabase.from("audit_logs").insert({
        user_id: null,
        action: "ENVISION_LOGIN_SUCCESS",
        resource_type: "envision_auth",
        resource_id: superAdmin.id,
        metadata: {
          email: superAdmin.email,
          full_name: superAdmin.full_name,
          role: superAdmin.role,
          client_ip: clientIp,
          session_expires: fullExpiresAt,
          auth_method: "totp",
        },
      });
    } catch {
      // ignore
    }

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
          permissions: superAdmin.permissions,
        },
        message: "Two-factor authentication verified. Welcome to the Envision Master Panel.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-verify", { error: msg });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
