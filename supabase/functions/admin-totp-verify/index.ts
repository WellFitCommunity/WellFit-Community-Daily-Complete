/**
 * Admin TOTP Verify Edge Function
 *
 * Verifies TOTP code during admin login for WellFit admin/clinical users.
 * Uses Supabase JWT auth (Authorization: Bearer).
 *
 * On success: returns verified flag + logs to audit_logs.
 * Rate limiting: 5 failures = 15 min lockout.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

const json = (corsHeaders: HeadersInit, status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── Base32 decode ───
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Decode = (b32: string): Uint8Array => {
  const cleaned = (b32 || "").toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = B32.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

// ─── TOTP (RFC 6238) ───
const toBigEndian8 = (counter: number): Uint8Array => {
  const buf = new Uint8Array(8);
  let x = Math.floor(counter);
  for (let i = 7; i >= 0; i--) {
    buf[i] = x & 0xff;
    x = Math.floor(x / 256);
  }
  return buf;
};

const hmacSha1 = async (keyBytes: Uint8Array, msg: Uint8Array): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
};

const hotp = async (secretBytes: Uint8Array, counter: number): Promise<string> => {
  const mac = await hmacSha1(secretBytes, toBigEndian8(counter));
  const offset = mac[mac.length - 1] & 0x0f;
  const binCode =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return (binCode % 1_000_000).toString().padStart(6, "0");
};

const totpValidate = async (
  secretBytes: Uint8Array,
  token: string,
  window = 2,
  period = 30
): Promise<boolean> => {
  const clean = String(token || "").replace(/[^\d]/g, "");
  if (clean.length !== 6) return false;
  const nowCounter = Math.floor(Date.now() / 1000 / period);
  for (let w = -window; w <= window; w++) {
    if ((await hotp(secretBytes, nowCounter + w)) === clean) return true;
  }
  return false;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("admin-totp-verify", req);

  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: corsHeaders } = corsFromRequest(req);
  if (req.method !== "POST") return json(corsHeaders, 405, { error: "Method not allowed" });

  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL", "SB_PROJECT_URL");
  const SERVICE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = getEnv("SB_PUBLISHABLE_API_KEY", "SB_ANON_KEY", "SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    logger.error("Missing Supabase environment variables");
    return json(corsHeaders, 500, { error: "Server configuration error" });
  }

  try {
    // Extract JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(corsHeaders, 401, { error: "Authorization header required" });

    // Verify JWT and get user
    const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json(corsHeaders, 401, { error: "Invalid or expired token" });

    const userId = user.id;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").replace(/[^\d]/g, "");

    if (code.length !== 6) {
      return json(corsHeaders, 400, { error: "A 6-digit code is required" });
    }

    // Rate limiting: check recent failures
    const lockoutSince = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const { count: failCount } = await serviceClient
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", "ADMIN_TOTP_VERIFY_FAILED")
      .gte("created_at", lockoutSince);

    if ((failCount ?? 0) >= MAX_FAILED_ATTEMPTS) {
      logger.security("Admin TOTP verify blocked - too many failures", { userId, clientIp });
      return json(corsHeaders, 429, {
        error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
      });
    }

    // Get TOTP secret from mfa_enrollment
    const { data: enrollment } = await serviceClient
      .from("mfa_enrollment")
      .select("totp_secret, mfa_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!enrollment?.totp_secret || !enrollment?.mfa_enabled) {
      return json(corsHeaders, 400, { error: "MFA is not configured. Please set up your authenticator first." });
    }

    // Validate TOTP code
    const secretBytes = base32Decode(enrollment.totp_secret);
    const ok = await totpValidate(secretBytes, code, 2, 30);

    if (!ok) {
      // Record failure
      await serviceClient.from("audit_logs").insert({
        user_id: userId,
        action: "ADMIN_TOTP_VERIFY_FAILED",
        resource_type: "mfa_enrollment",
        resource_id: userId,
        metadata: { client_ip: clientIp },
      });

      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - ((failCount ?? 0) + 1));
      logger.warn("Admin TOTP verify failed", { userId, remaining });

      return json(corsHeaders, 401, {
        error: "Invalid code. Please try again.",
        remaining_attempts: remaining,
      });
    }

    // Success — update last_verified and log
    await serviceClient
      .from("mfa_enrollment")
      .update({ last_verified: new Date().toISOString() })
      .eq("user_id", userId);

    await serviceClient.rpc("log_mfa_verification", {
      p_user_id: userId,
      p_success: true,
      p_method: "totp",
    });

    logger.info("Admin TOTP verify success", { userId });

    return json(corsHeaders, 200, {
      success: true,
      verified: true,
      user_id: userId,
      message: "MFA verification successful.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in admin-totp-verify", { error: msg });
    return json(corsHeaders, 500, { error: "Internal server error" });
  }
});
