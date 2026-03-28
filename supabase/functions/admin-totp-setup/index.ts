/**
 * Admin TOTP Setup Edge Function
 *
 * Handles TOTP enrollment for WellFit admin/clinical users.
 * Unlike envision-totp-setup (which uses envision session tokens),
 * this uses Supabase JWT auth (Authorization: Bearer).
 *
 * Actions:
 * - "begin": Generate TOTP secret, store pending, return otpauth URI
 * - "confirm": Verify first code, generate backup codes, enable MFA
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const PENDING_TTL_MINUTES = 15;
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

// ─────────────────────────────────────────────────────────────
// Base32 (RFC 4648) encode/decode
// ─────────────────────────────────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (bytes: Uint8Array): string => {
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32[(value << (5 - bits)) & 31];
  return output;
};

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

// ─────────────────────────────────────────────────────────────
// TOTP (RFC 6238) using WebCrypto HMAC-SHA1
// ─────────────────────────────────────────────────────────────
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
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  return new Uint8Array(sig);
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

const buildOtpAuthUri = (issuer: string, label: string, base32Secret: string): string => {
  const encIssuer = encodeURIComponent(issuer);
  const encLabel = encodeURIComponent(label);
  return `otpauth://totp/${encIssuer}:${encLabel}?secret=${encodeURIComponent(base32Secret)}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
};

// Generate simple backup codes (8 alphanumeric chars with dash)
const generateBackupCodes = (count = 10): string[] => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += chars[bytes[j] % chars.length];
    }
    codes.push(code.slice(0, 4) + "-" + code.slice(4));
  }
  return codes;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("admin-totp-setup", req);

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
    // Extract JWT from Authorization header
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return json(corsHeaders, 401, { error: "Authorization header required" });
    }

    // Verify JWT and get user
    const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json(corsHeaders, 401, { error: "Invalid or expired token" });
    }

    const userId = user.id;
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get user profile for label
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("first_name, last_name, role")
      .eq("user_id", userId)
      .maybeSingle();

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").toLowerCase();
    const issuer = "WellFit Admin";
    const label = user.email || `user-${userId.slice(0, 8)}`;

    if (action === "begin") {
      // Check if already enrolled in mfa_enrollment
      const { data: existing } = await serviceClient
        .from("mfa_enrollment")
        .select("mfa_enabled, totp_secret")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing?.mfa_enabled && existing?.totp_secret) {
        return json(corsHeaders, 200, {
          success: true,
          already_configured: true,
          message: "Authenticator is already set up.",
        });
      }

      // Generate random 20-byte secret
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      const base32Secret = base32Encode(bytes);
      const otpauthUri = buildOtpAuthUri(issuer, label, base32Secret);
      const pendingExpiresAt = new Date(Date.now() + PENDING_TTL_MINUTES * 60 * 1000).toISOString();

      // Store pending secret in mfa_enrollment.totp_secret (with mfa_enabled still false)
      const { error: upErr } = await serviceClient
        .from("mfa_enrollment")
        .upsert({
          user_id: userId,
          role: profile?.role || "unknown",
          totp_secret: base32Secret,
          mfa_enabled: false,
          enforcement_status: "grace_period",
          grace_period_ends: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: "user_id" });

      if (upErr) {
        logger.error("Failed to store pending TOTP", { error: upErr.message });
        return json(corsHeaders, 500, { error: "Failed to start setup" });
      }

      logger.info("Admin TOTP setup begun", { userId });

      return json(corsHeaders, 200, {
        success: true,
        issuer,
        account: label,
        secret: base32Secret,
        otpauth_uri: otpauthUri,
        expires_at: pendingExpiresAt,
        message: "Scan the QR code with your authenticator app, then enter the 6-digit code.",
      });
    }

    if (action === "confirm") {
      const code = String(body?.code ?? "").replace(/[^\d]/g, "");
      if (code.length !== 6) {
        return json(corsHeaders, 400, { error: "A 6-digit code is required" });
      }

      // Rate limiting
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

      // Get pending secret from mfa_enrollment
      const { data: enrollment } = await serviceClient
        .from("mfa_enrollment")
        .select("totp_secret, mfa_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      if (!enrollment?.totp_secret) {
        return json(corsHeaders, 400, { error: "Setup not started. Please scan QR first." });
      }

      if (enrollment.mfa_enabled) {
        return json(corsHeaders, 200, { success: true, already_configured: true });
      }

      // Validate TOTP code
      const secretBytes = base32Decode(enrollment.totp_secret);
      const ok = await totpValidate(secretBytes, code, 2, 30);

      if (!ok) {
        logger.warn("Admin TOTP confirm failed: invalid code", { userId });

        // Audit log failure
        await serviceClient.from("audit_logs").insert({
          user_id: userId,
          action: "ADMIN_TOTP_SETUP_CODE_FAILED",
          resource_type: "mfa_enrollment",
          resource_id: userId,
          metadata: { client_ip: clientIp },
        });

        return json(corsHeaders, 401, {
          error: "Invalid code. Use the CURRENT 6-digit code from your authenticator app.",
          debug: {
            serverTimeUTC: new Date().toISOString(),
            hint: "Ensure your phone's time is set to 'Automatic'. Codes change every 30 seconds.",
          },
        });
      }

      // Generate backup codes
      const backupCodes = generateBackupCodes(10);

      // Hash backup codes for storage
      const hashedCodes: string[] = [];
      for (const bc of backupCodes) {
        const { data: hashed } = await serviceClient.rpc("hash_backup_code", { code: bc });
        if (hashed) hashedCodes.push(hashed as string);
      }

      // Enable MFA
      const { error: updErr } = await serviceClient
        .from("mfa_enrollment")
        .update({
          mfa_enabled: true,
          mfa_method: "totp",
          totp_backup_codes: hashedCodes,
          enrollment_date: new Date().toISOString(),
          enforcement_status: "enforced",
          last_verified: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updErr) {
        logger.error("Failed to enable MFA", { error: updErr.message });
        return json(corsHeaders, 500, { error: "Failed to enable authenticator" });
      }

      // Audit log success
      await serviceClient.from("audit_logs").insert({
        user_id: userId,
        action: "ADMIN_TOTP_SETUP_COMPLETE",
        resource_type: "mfa_enrollment",
        resource_id: userId,
        metadata: { backup_codes_generated: backupCodes.length },
      });

      logger.info("Admin TOTP setup completed", { userId, backupCodesGenerated: backupCodes.length });

      return json(corsHeaders, 200, {
        success: true,
        message: "Authenticator setup complete. Save your backup codes!",
        backup_codes: backupCodes,
      });
    }

    return json(corsHeaders, 400, { error: "Invalid action. Use action='begin' or action='confirm'." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in admin-totp-setup", { error: msg });
    return json(corsHeaders, 500, { error: "Internal server error" });
  }
});
