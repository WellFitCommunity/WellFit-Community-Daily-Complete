/**
 * Envision TOTP Setup (Enrollment) - NO NPM PACKAGES
 *
 * - action="begin": generate secret (or reuse existing pending), store pending, return otpauth:// URI + secret
 * - action="confirm": verify 6-digit code, persist totp_secret, enable totp, mark session verified
 *
 * No SMS. No email. No notifications. Codes are generated on the user's phone after QR scan.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const PENDING_TOTP_TTL_MINUTES = 15;

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
// Base32 (RFC 4648) encode/decode (no padding used in secrets)
// ─────────────────────────────────────────────────────────────
const B32_ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32Encode = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPH[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (b32: string): Uint8Array => {
  const cleaned = (b32 || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = B32_ALPH.indexOf(cleaned[i]);
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
// TOTP (RFC 6238) using WebCrypto (HMAC-SHA1), 6 digits, 30 sec
// window=1 allows +/- 30 seconds drift
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
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msg);
  return new Uint8Array(sig);
};

const hotp = async (secretBytes: Uint8Array, counter: number): Promise<string> => {
  const msg = toBigEndian8(counter);
  const mac = await hmacSha1(secretBytes, msg);
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
  window = 1,
  period = 30
): Promise<boolean> => {
  const clean = String(token || "").replace(/[^\d]/g, "");
  if (clean.length !== 6) return false;

  const nowCounter = Math.floor(Date.now() / 1000 / period);

  for (let w = -window; w <= window; w++) {
    const code = await hotp(secretBytes, nowCounter + w);
    if (code === clean) return true;
  }
  return false;
};

// ─────────────────────────────────────────────────────────────
// URI builder
// ─────────────────────────────────────────────────────────────
const buildOtpAuthUri = (issuer: string, label: string, base32Secret: string): string => {
  const encIssuer = encodeURIComponent(issuer);
  const encLabel = encodeURIComponent(label);
  const encPath = `${encIssuer}:${encLabel}`;
  const qs =
    `secret=${encodeURIComponent(base32Secret)}` +
    `&issuer=${encIssuer}` +
    `&algorithm=SHA1&digits=6&period=30`;
  return `otpauth://totp/${encPath}?${qs}`;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("envision-totp-setup", req);

  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return json(corsHeaders, 405, { error: "Method not allowed" });
  }

  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL", "SB_PROJECT_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return json(corsHeaders, 500, { error: "Server configuration error" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").toLowerCase();
    const sessionToken = String(body?.session_token ?? "").trim();

    if (!sessionToken) return json(corsHeaders, 400, { error: "session_token is required" });

    // Validate session exists and not expired
    const { data: sessionRow, error: sessionErr } = await supabase
      .from("envision_sessions")
      .select("super_admin_id, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (sessionErr || !sessionRow) return json(corsHeaders, 401, { error: "Invalid session" });

    const expiresAtMs = new Date(sessionRow.expires_at as string).getTime();
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return json(corsHeaders, 401, { error: "Session expired. Please log in again." });
    }

    const superAdminId = String(sessionRow.super_admin_id);

    // Load super admin
    const { data: superAdmin, error: saErr } = await supabase
      .from("super_admin_users")
      .select("id, email, is_active, totp_enabled, totp_secret, pin_hash")
      .eq("id", superAdminId)
      .maybeSingle();

    if (saErr || !superAdmin || !superAdmin.is_active) return json(corsHeaders, 401, { error: "Unauthorized" });

    const issuer = "Envision VirtualEdge";
    const label = String(superAdmin.email || "admin").toLowerCase();

    if (action === "begin") {
      // If already configured, don't generate new QR
      if (superAdmin.totp_enabled && superAdmin.totp_secret) {
        return json(corsHeaders, 200, {
          success: true,
          already_configured: true,
          message: "Authenticator is already set up.",
        });
      }

      // Idempotent behavior: if a pending secret already exists for this session and isn't expired, reuse it.
      const { data: existingPending } = await supabase
        .from("envision_totp_pending")
        .select("totp_secret, expires_at")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (existingPending?.totp_secret && existingPending?.expires_at) {
        const pendingExp = new Date(existingPending.expires_at as string).getTime();
        if (Number.isFinite(pendingExp) && pendingExp > Date.now()) {
          const base32Secret = String(existingPending.totp_secret);
          const otpauthUri = buildOtpAuthUri(issuer, label, base32Secret);
          return json(corsHeaders, 200, {
            success: true,
            issuer,
            account: label,
            secret: base32Secret,
            otpauth_uri: otpauthUri,
            expires_at: existingPending.expires_at,
            message: "Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.",
          });
        }
      }

      // Generate random secret (20 bytes)
      const bytes = new Uint8Array(20);
      crypto.getRandomValues(bytes);
      const base32Secret = base32Encode(bytes);

      const otpauthUri = buildOtpAuthUri(issuer, label, base32Secret);
      const pendingExpiresAt = new Date(Date.now() + PENDING_TOTP_TTL_MINUTES * 60 * 1000).toISOString();

      const { error: upErr } = await supabase
        .from("envision_totp_pending")
        .upsert({
          session_token: sessionToken,
          super_admin_id: superAdminId,
          totp_secret: base32Secret,
          expires_at: pendingExpiresAt,
        });

      if (upErr) {
        logger.error("Failed to store pending TOTP secret", { error: upErr.message });
        return json(corsHeaders, 500, { error: "Failed to start authenticator setup" });
      }

      return json(corsHeaders, 200, {
        success: true,
        issuer,
        account: label,
        secret: base32Secret,
        otpauth_uri: otpauthUri,
        expires_at: pendingExpiresAt,
        message: "Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.",
      });
    }

    if (action === "confirm") {
      const token = String(body?.code ?? "").replace(/[^\d]/g, "");
      if (token.length !== 6) return json(corsHeaders, 400, { error: "A 6-digit code is required" });

      const { data: pending, error: pendErr } = await supabase
        .from("envision_totp_pending")
        .select("totp_secret, expires_at, super_admin_id")
        .eq("session_token", sessionToken)
        .maybeSingle();

      if (pendErr || !pending) return json(corsHeaders, 400, { error: "Setup not started. Please scan QR first." });

      const pendExp = new Date(pending.expires_at as string).getTime();
      if (!Number.isFinite(pendExp) || pendExp <= Date.now()) {
        await supabase.from("envision_totp_pending").delete().eq("session_token", sessionToken);
        return json(corsHeaders, 400, { error: "Setup expired. Please start again." });
      }

      if (String(pending.super_admin_id) !== superAdminId) return json(corsHeaders, 401, { error: "Unauthorized" });

      const secretBytes = base32Decode(String(pending.totp_secret));
      const ok = await totpValidate(secretBytes, token, 1, 30);

      if (!ok) return json(corsHeaders, 401, { error: "Invalid code. Use the CURRENT 6-digit code." });

      // Persist: enable totp, store secret, and remove PIN so the system stops asking for PIN
      const { error: updErr } = await supabase
        .from("super_admin_users")
        .update({
          totp_enabled: true,
          totp_secret: String(pending.totp_secret),
          pin_hash: null,
        })
        .eq("id", superAdminId);

      if (updErr) {
        logger.error("Failed to enable TOTP on super admin", { error: updErr.message });
        return json(corsHeaders, 500, { error: "Failed to enable authenticator" });
      }

      // Mark session verified (re-using pin_verified_at as "2FA complete")
      await supabase
        .from("envision_sessions")
        .update({ pin_verified_at: new Date().toISOString() })
        .eq("session_token", sessionToken);

      await supabase.from("envision_totp_pending").delete().eq("session_token", sessionToken);

      return json(corsHeaders, 200, { success: true, message: "Authenticator setup complete." });
    }

    return json(corsHeaders, 400, { error: "Invalid action. Use action='begin' or action='confirm'." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in envision-totp-setup", { error: msg });
    return json(corsHeaders, 500, { error: "Internal server error" });
  }
});
