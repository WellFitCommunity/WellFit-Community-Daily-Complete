/**
 * Envision TOTP Use Backup Code Edge Function
 *
 * Emergency backup code authentication for users who can't access their authenticator app.
 * Backup codes are one-time use - each code is consumed after successful verification.
 *
 * Flow:
 * 1. Accept session token (from step 1) and backup code (format: XXXX-XXXX)
 * 2. Validate session exists and is not expired
 * 3. Check rate limit (5 failures = 15 min lockout)
 * 4. Verify backup code via database function (verify_and_consume_backup_code)
 * 5. Complete session (set pin_verified_at)
 * 6. Return full session with extended expiry + remaining backup codes count
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { generateSecureToken } from "../_shared/crypto.ts";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const FULL_SESSION_TTL_MINUTES = 120;
const LOW_BACKUP_CODE_THRESHOLD = 3;

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

/**
 * Normalize backup code: uppercase, remove dashes and spaces
 */
function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[-\s]/g, "");
}

/**
 * Validate backup code format (8 alphanumeric characters, with or without dash)
 */
function isValidBackupCodeFormat(code: string): boolean {
  const normalized = normalizeBackupCode(code);
  return /^[A-Z0-9]{8}$/.test(normalized);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("envision-totp-use-backup", req);

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
    const backupCodeRaw = String(body?.backup_code ?? "");

    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "Session token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidBackupCodeFormat(backupCodeRaw)) {
      return new Response(
        JSON.stringify({
          error: "Invalid backup code format. Expected 8-character code (e.g., XXXX-XXXX)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const backupCode = normalizeBackupCode(backupCodeRaw);

    // Look up pending session
    const { data: session, error: sessionError } = await supabase
      .from("envision_sessions")
      .select("id, super_admin_id, pin_verified_at, expires_at")
      .eq("session_token", sessionToken)
      .is("pin_verified_at", null)
      .single();

    if (sessionError || !session) {
      logger.warn("Backup code verification for invalid session", { clientIp, sessionFound: !!session });
      return new Response(JSON.stringify({ error: "Invalid or expired session. Please login again." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at as string) < new Date()) {
      logger.info("Backup code verification for expired session", { superAdminId: session.super_admin_id, clientIp });

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

    // Get super admin
    const { data: superAdmin, error: adminError } = await supabase
      .from("super_admin_users")
      .select("id, email, full_name, role, totp_enabled, permissions, is_active, totp_backup_codes")
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
      logger.security("Backup code verification for deactivated account", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        clientIp,
      });
      return new Response(JSON.stringify({ error: "Account is not active" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has backup codes
    const backupCodesArray = superAdmin.totp_backup_codes as string[] | null;
    if (!backupCodesArray || backupCodesArray.length === 0) {
      logger.warn("Backup code verification for user without backup codes", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
      });
      return new Response(
        JSON.stringify({
          error: "No backup codes available. Please contact support.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting for backup_code
    const { data: lockoutData, error: lockoutError } = await supabase.rpc("check_envision_lockout", {
      p_super_admin_id: superAdmin.id,
      p_attempt_type: "backup_code",
    });

    if (lockoutError) {
      logger.error("Failed to check backup code lockout status", { superAdminId: superAdmin.id, error: lockoutError.message });
    } else if (lockoutData && lockoutData.length > 0 && lockoutData[0].is_locked) {
      const unlockAt = new Date(lockoutData[0].unlock_at);
      const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

      logger.security("Backup code verification blocked - user locked out", {
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

    // Verify backup code using database function (atomic operation - verifies AND consumes)
    const { data: codeValid, error: verifyError } = await supabase.rpc("verify_and_consume_backup_code", {
      p_super_admin_id: superAdmin.id,
      p_code: backupCode,
    });

    if (verifyError) {
      logger.error("Database error verifying backup code", { superAdminId: superAdmin.id, error: verifyError.message });
      return new Response(JSON.stringify({ error: "Failed to verify backup code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!codeValid) {
      // Record failed attempt
      try {
        const { error: recErr } = await supabase.rpc("record_envision_attempt", {
          p_super_admin_id: superAdmin.id,
          p_attempt_type: "backup_code",
          p_success: false,
          p_client_ip: clientIp,
          p_user_agent: userAgent,
        });
        if (recErr) logger.error("Failed to record backup code attempt", { error: recErr.message });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("Failed to record backup code attempt", { error: msg });
      }

      const newFailedCount = failedCount + 1;
      const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - newFailedCount);

      logger.security("Backup code verification failed", {
        superAdminId: superAdmin.id,
        email: superAdmin.email,
        clientIp,
        failedAttempts: newFailedCount,
        remainingAttempts,
      });

      // Audit log (best-effort)
      try {
        await supabase.from("audit_logs").insert({
          user_id: null,
          action: "ENVISION_BACKUP_CODE_FAILED",
          resource_type: "envision_auth",
          resource_id: superAdmin.id,
          metadata: {
            email: superAdmin.email,
            client_ip: clientIp,
            failed_attempts: newFailedCount,
            remaining_attempts: remainingAttempts,
          },
        });
      } catch {
        // ignore
      }

      const errorResponse: Record<string, unknown> = { error: "Invalid backup code" };

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

    // SUCCESS! Backup code was valid and has been consumed
    // Record successful attempt
    try {
      const { error: recOkErr } = await supabase.rpc("record_envision_attempt", {
        p_super_admin_id: superAdmin.id,
        p_attempt_type: "backup_code",
        p_success: true,
        p_client_ip: clientIp,
        p_user_agent: userAgent,
      });
      if (recOkErr) logger.error("Failed to record successful backup code attempt", { error: recOkErr.message });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Failed to record successful backup code attempt", { error: msg });
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
      logger.error("Failed to complete session after backup code", { sessionId: session.id, error: updateError.message });
      return new Response(JSON.stringify({ error: "Failed to complete session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get remaining backup code count
    const { data: remainingCount, error: countError } = await supabase.rpc("get_backup_code_count", {
      p_super_admin_id: superAdmin.id,
    });

    const remainingBackupCodes = countError ? null : (remainingCount as number);

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
          auth_method: "backup_code",
          remaining_backup_codes: remainingBackupCodes,
        },
      });
    } catch {
      // ignore
    }

    logger.info("Backup code authentication successful", {
      superAdminId: superAdmin.id,
      email: superAdmin.email,
      remainingBackupCodes,
      clientIp,
    });

    // Build response
    const response: Record<string, unknown> = {
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
      remaining_backup_codes: remainingBackupCodes,
      message: "Backup code verified. Welcome to the Envision Master Panel.",
    };

    // Warn if running low on backup codes
    if (remainingBackupCodes !== null && remainingBackupCodes <= LOW_BACKUP_CODE_THRESHOLD) {
      response.warning = `Only ${remainingBackupCodes} backup code${remainingBackupCodes !== 1 ? "s" : ""} remaining. Consider regenerating your backup codes.`;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-use-backup", { error: msg });
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
