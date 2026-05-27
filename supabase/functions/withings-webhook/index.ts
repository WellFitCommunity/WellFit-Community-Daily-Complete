// supabase/functions/withings-webhook/index.ts
// Receives real-time push notifications from the Withings Notification API.
// Withings sends POST with application/x-www-form-urlencoded body when user data changes.
// This function validates, maps vitals, and inserts into wearable_vital_signs.
//
// SECURITY (S-WH-1): All incoming POSTs MUST be signed via HMAC-SHA256
// (X-Withings-Signature header or fallback header names). Unsigned/invalid
// requests are rejected with 401 and an audit_logs entry. This prevents anyone
// on the internet from injecting fake vital signs via the public webhook URL.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("withings-webhook");

// ── Types ────────────────────────────────────────────────────────────────────

// Withings appli codes → vital types
// See: https://developer.withings.com/api-reference/#tag/notification
const APPLI_TO_VITAL: Record<number, { type: string; unit: string }> = {
  1:  { type: "weight", unit: "kg" },
  4:  { type: "blood_pressure", unit: "mmHg" },
  16: { type: "heart_rate", unit: "bpm" },
  44: { type: "oxygen_saturation", unit: "%" },
  46: { type: "heart_rate", unit: "bpm" },        // ECG HR
  51: { type: "temperature", unit: "°C" },
  54: { type: "oxygen_saturation", unit: "%" },    // SpO2 scan
};

interface WearableConnectionRow {
  id: string;
  user_id: string;
  tenant_id: string;
}

// ── Signature Verification (HMAC-SHA256) ─────────────────────────────────────

/** Compute HMAC-SHA256 over `body` with the shared secret. Returns hex digest. */
async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sigBuf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/** Constant-time string comparison (XOR-accumulate over bytes). */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/**
 * Verify the Withings webhook signature.
 * Accepts hex digest in `x-withings-signature` (preferred) or fallback header names.
 * Strips an optional `sha256=` / `hmac-sha256=` prefix.
 */
export async function verifyWithingsSignature(
  req: Request,
  rawBody: string,
  secret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rawHeader =
    req.headers.get("x-withings-signature") ??
    req.headers.get("withings-signature") ??
    req.headers.get("x-signature") ??
    req.headers.get("signature");

  if (!rawHeader) {
    return { ok: false, reason: "missing_signature_header" };
  }

  // Allow common prefix formats
  let presented = rawHeader.trim();
  if (presented.toLowerCase().startsWith("sha256=")) presented = presented.slice("sha256=".length);
  if (presented.toLowerCase().startsWith("hmac-sha256=")) presented = presented.slice("hmac-sha256=".length);

  const expected = await hmacSha256Hex(secret, rawBody);

  if (!constantTimeEqual(expected.toLowerCase(), presented.toLowerCase())) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);

  // Withings verification handshake: HEAD request returns 200
  if (req.method === "HEAD" || req.method === "GET") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Auth gate: verify HMAC-SHA256 signature BEFORE any DB write ──────────
  const notifSecret = Deno.env.get("WITHINGS_NOTIF_SECRET") ?? "";
  if (!notifSecret) {
    logger.error("Withings webhook misconfigured: WITHINGS_NOTIF_SECRET not set");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read raw body once — used for both signature verification AND form parsing.
  const rawBody = await req.text();

  const verification = await verifyWithingsSignature(req, rawBody, notifSecret);
  if (!verification.ok) {
    try {
      const admin = createAdminClient();
      await admin.from("audit_logs").insert({
        event_type: "webhook_signature_invalid",
        event_category: "SECURITY",
        actor_user_id: null,
        actor_ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        actor_user_agent: req.headers.get("user-agent"),
        operation: "VERIFY_WEBHOOK_SIGNATURE",
        resource_type: "wearable_vital_signs",
        success: false,
        error_code: "INVALID_SIGNATURE",
        error_message: verification.reason,
        metadata: {
          source: "withings_webhook",
          reason: verification.reason,
        },
      });
    } catch (auditErr: unknown) {
      const msg = auditErr instanceof Error ? auditErr.message : String(auditErr);
      logger.error("Failed to write webhook_signature_invalid audit log", { error: msg });
    }

    logger.warn("Withings webhook signature rejected", { reason: verification.reason });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Re-parse the verified body as form data
    const formData = new URLSearchParams(rawBody);
    const userid = formData.get("userid") ?? "";
    const startdate = formData.get("startdate") ?? "";
    const enddate = formData.get("enddate") ?? "";
    const appli = parseInt(formData.get("appli") ?? "0", 10);

    if (!userid || !appli) {
      return new Response(JSON.stringify({ error: "Missing userid or appli" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();

    // Look up wearable connection by Withings user ID
    const { data: connection, error: connErr } = await supabase
      .from("wearable_connections")
      .select("id, user_id, tenant_id")
      .eq("device_type", "withings")
      .eq("device_id", userid)
      .eq("status", "active")
      .limit(1)
      .single();

    if (connErr || !connection) {
      logger.warn("No active Withings connection found", { userid, appli });
      // Return 200 so Withings doesn't retry indefinitely
      return new Response("", { status: 200, headers: corsHeaders });
    }

    const conn = connection as WearableConnectionRow;
    const vitalInfo = APPLI_TO_VITAL[appli];

    if (!vitalInfo) {
      logger.info("Unsupported Withings appli code, skipping", { appli, userid });
      return new Response("", { status: 200, headers: corsHeaders });
    }

    // Convert Unix timestamps to ISO
    const measuredAt = startdate
      ? new Date(parseInt(startdate, 10) * 1000).toISOString()
      : new Date().toISOString();

    const { error: insertErr } = await supabase
      .from("wearable_vital_signs")
      .insert({
        user_id: conn.user_id,
        device_id: conn.id,
        tenant_id: conn.tenant_id,
        vital_type: vitalInfo.type,
        value: 0, // Placeholder — actual value fetched by sync job
        unit: vitalInfo.unit,
        measured_at: measuredAt,
        metadata: {
          source: "withings_webhook",
          appli_code: appli,
          withings_userid: userid,
          startdate,
          enddate,
          needs_sync: true,
        },
      });

    if (insertErr) {
      logger.error("Failed to insert Withings webhook vital", {
        error: insertErr.message,
        userid,
        appli,
      });
    } else {
      logger.info("Withings webhook processed", {
        userid,
        appli,
        vitalType: vitalInfo.type,
      });
    }

    // Withings expects 200 OK
    return new Response("", { status: 200, headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Withings webhook handler failed", { error: message });

    // Return 200 to prevent Withings from disabling the subscription
    return new Response("", { status: 200, headers: corsHeaders });
  }
});
