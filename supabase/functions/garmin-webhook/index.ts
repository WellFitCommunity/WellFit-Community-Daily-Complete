// supabase/functions/garmin-webhook/index.ts
// Receives real-time push notifications from Garmin Health API.
// Garmin sends POST with JSON body containing user metric notifications.
// This function validates, maps vitals, and inserts into wearable_vital_signs.
//
// SECURITY (S-WH-2): All incoming POSTs MUST be signed via Garmin OAuth 1.0a
// HMAC-SHA1 (Authorization header). Unsigned/invalid requests are rejected
// with 401 and an audit_logs entry. This prevents anyone on the internet
// from injecting fake vital signs via the public webhook URL.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("garmin-webhook");

// ── Types ────────────────────────────────────────────────────────────────────

interface GarminPushNotification {
  userId?: string;
  userAccessToken?: string;
  uploadStartTimeInSeconds?: number;
  uploadEndTimeInSeconds?: number;
  callbackURL?: string;
}

// Garmin notification types (each is a separate POST endpoint category)
interface GarminDailySummary extends GarminPushNotification {
  summaryId?: string;
}

interface GarminActivitySummary extends GarminPushNotification {
  activityId?: number;
  activityType?: string;
}

interface GarminBodyComposition extends GarminPushNotification {
  weightInGrams?: number;
  bmi?: number;
}

// Union type for all notification kinds
type GarminNotificationPayload =
  | { dailies: GarminDailySummary[] }
  | { activities: GarminActivitySummary[] }
  | { bodyComps: GarminBodyComposition[] }
  | { epochs: GarminPushNotification[] }
  | { sleeps: GarminPushNotification[] }
  | { pulseOx: GarminPushNotification[] }
  | { stressDetails: GarminPushNotification[] }
  | { userMetrics: GarminPushNotification[] }
  | { moveIQ: GarminPushNotification[] };

interface WearableConnectionRow {
  id: string;
  user_id: string;
  tenant_id: string;
}

interface OAuthParams {
  oauth_consumer_key: string;
  oauth_signature: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version?: string;
  oauth_token?: string;
}

// ── OAuth 1.0a Signature Verification (Garmin Health API) ────────────────────
//
// Garmin signs every push notification with OAuth 1.0a HMAC-SHA1. The signature
// is sent in the `Authorization: OAuth ...` header. To verify, we:
//   1. Parse the OAuth params from the Authorization header
//   2. Rebuild the signature base string: METHOD&URL&SORTED_PARAMS
//   3. Compute HMAC-SHA1 with key = CONSUMER_SECRET&  (trailing & for unspecified token)
//   4. Compare in constant time against oauth_signature
//
// Reference: https://oauth.net/core/1.0a/#signing_process

/** RFC 3986 percent-encoding (stricter than encodeURIComponent). */
function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Parse `Authorization: OAuth key="value", key2="value2"` into a map. */
export function parseOAuthHeader(header: string | null): OAuthParams | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("oauth ")) return null;

  const rest = trimmed.slice(6); // strip "OAuth "
  const params: Record<string, string> = {};
  // Split on commas that are not inside quotes; the header format is well-defined.
  const parts = rest.split(",");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (key) params[key] = decodeURIComponent(value);
  }

  // Minimum required fields for OAuth 1.0a verification
  if (
    !params.oauth_consumer_key ||
    !params.oauth_signature ||
    !params.oauth_signature_method ||
    !params.oauth_timestamp ||
    !params.oauth_nonce
  ) {
    return null;
  }

  return {
    oauth_consumer_key: params.oauth_consumer_key,
    oauth_signature: params.oauth_signature,
    oauth_signature_method: params.oauth_signature_method,
    oauth_timestamp: params.oauth_timestamp,
    oauth_nonce: params.oauth_nonce,
    oauth_version: params.oauth_version,
    oauth_token: params.oauth_token,
  };
}

/**
 * Build the OAuth 1.0a signature base string per RFC 5849 §3.4.1.
 * Format: METHOD & encoded_url & encoded_sorted_params
 * Excludes the oauth_signature parameter itself.
 */
export function buildSignatureBaseString(
  method: string,
  url: string,
  oauthParams: OAuthParams,
  queryParams: URLSearchParams,
): string {
  // 1. Normalize URL: scheme + host + path, no query, no fragment
  const parsed = new URL(url);
  // Garmin posts to https://; force the scheme for canonical form
  const scheme = parsed.protocol.replace(":", "");
  const host = parsed.host.toLowerCase();
  const path = parsed.pathname;
  const baseUrl = `${scheme}://${host}${path}`;

  // 2. Collect parameters: OAuth params (minus signature) + query string params
  const params: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(oauthParams)) {
    if (k === "oauth_signature") continue;
    if (v !== undefined) params.push([k, v]);
  }
  for (const [k, v] of queryParams.entries()) {
    params.push([k, v]);
  }

  // 3. Percent-encode each key+value, then sort lexicographically by encoded key,
  //    then by encoded value as tiebreaker.
  const encoded = params
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as [string, string])
    .sort((a, b) => {
      if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
      return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
    });

  // 4. Join as k=v pairs separated by &
  const paramString = encoded.map(([k, v]) => `${k}=${v}`).join("&");

  // 5. Final base string
  return `${method.toUpperCase()}&${percentEncode(baseUrl)}&${percentEncode(paramString)}`;
}

/** Compute HMAC-SHA1 over `baseString` with key `consumerSecret&[tokenSecret]`. */
export async function hmacSha1Base64(
  signingKey: string,
  baseString: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(baseString));
  const bytes = new Uint8Array(sigBuf);
  // Base64 encode
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Constant-time string comparison (XOR-accumulate over bytes). */
export function constantTimeEqual(a: string, b: string): boolean {
  // Always walk the longer of the two strings to avoid length-based leaks.
  // If lengths differ, result is forced != 0 regardless.
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
 * Verify the Garmin OAuth 1.0a signature on an incoming webhook request.
 * Returns { ok: true } if valid, otherwise { ok: false, reason } for audit.
 */
export async function verifyGarminSignature(
  req: Request,
  consumerSecret: string,
): Promise<{ ok: true; oauth: OAuthParams } | { ok: false; reason: string; oauth?: OAuthParams }> {
  const authHeader = req.headers.get("Authorization");
  const oauth = parseOAuthHeader(authHeader);
  if (!oauth) {
    return { ok: false, reason: "missing_or_malformed_authorization_header" };
  }

  if (oauth.oauth_signature_method !== "HMAC-SHA1") {
    return { ok: false, reason: "unsupported_signature_method", oauth };
  }

  // Garmin webhooks include their oauth_token (user access token) in many flows.
  // The signing key is `consumerSecret&tokenSecret`. We don't store per-user
  // token secrets server-side for Health API push, so we use the unspecified-token
  // form: `consumerSecret&` (trailing ampersand). This matches the documented
  // Garmin Health API "ping/push notification" signing convention.
  const tokenSecret = ""; // unspecified-token form
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  const url = req.url;
  const parsedUrl = new URL(url);
  const queryParams = parsedUrl.searchParams;

  const baseString = buildSignatureBaseString(req.method, url, oauth, queryParams);
  const expected = await hmacSha1Base64(signingKey, baseString);

  if (!constantTimeEqual(expected, oauth.oauth_signature)) {
    return { ok: false, reason: "signature_mismatch", oauth };
  }

  return { ok: true, oauth };
}

// ── Vital Type Mapping ───────────────────────────────────────────────────────

function getVitalTypeFromPayload(payload: Record<string, unknown>): { type: string; unit: string } {
  if ("dailies" in payload) return { type: "heart_rate", unit: "bpm" };
  if ("activities" in payload) return { type: "heart_rate", unit: "bpm" };
  if ("bodyComps" in payload) return { type: "weight", unit: "g" };
  if ("sleeps" in payload) return { type: "heart_rate", unit: "bpm" };
  if ("pulseOx" in payload) return { type: "oxygen_saturation", unit: "%" };
  if ("stressDetails" in payload) return { type: "heart_rate", unit: "bpm" };
  if ("epochs" in payload) return { type: "heart_rate", unit: "bpm" };
  if ("userMetrics" in payload) return { type: "heart_rate", unit: "bpm" };
  return { type: "heart_rate", unit: "bpm" };
}

function getNotificationsFromPayload(payload: Record<string, unknown>): GarminPushNotification[] {
  const keys = Object.keys(payload);
  for (const key of keys) {
    const val = payload[key];
    if (Array.isArray(val)) {
      return val as GarminPushNotification[];
    }
  }
  return [];
}

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Auth gate: verify Garmin OAuth 1.0a signature BEFORE any DB write ─────
  const consumerSecret = (globalThis as unknown as {
    Deno?: { env: { get: (k: string) => string | undefined } };
  }).Deno?.env?.get?.("GARMIN_CONSUMER_SECRET") ?? "";

  if (!consumerSecret) {
    logger.error("Garmin webhook misconfigured: GARMIN_CONSUMER_SECRET not set");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const verification = await verifyGarminSignature(req, consumerSecret);
  if (!verification.ok) {
    // Log rejected attempt for security audit. Best-effort — never block the
    // 401 response on logging failure.
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
          source: "garmin_webhook",
          reason: verification.reason,
          oauth_consumer_key: verification.oauth?.oauth_consumer_key ?? null,
          oauth_timestamp: verification.oauth?.oauth_timestamp ?? null,
        },
      });
    } catch (auditErr: unknown) {
      const msg = auditErr instanceof Error ? auditErr.message : String(auditErr);
      logger.error("Failed to write webhook_signature_invalid audit log", { error: msg });
    }

    logger.warn("Garmin webhook signature rejected", { reason: verification.reason });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;

    if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0) {
      return new Response(JSON.stringify({ error: "Empty payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifications = getNotificationsFromPayload(payload);
    if (notifications.length === 0) {
      logger.info("Garmin webhook: no notifications in payload", {
        keys: Object.keys(payload),
      });
      return new Response("", { status: 200, headers: corsHeaders });
    }

    const supabase = createAdminClient();
    const vitalInfo = getVitalTypeFromPayload(payload);
    const notificationType = Object.keys(payload)[0] || "unknown";
    let processed = 0;
    let skipped = 0;

    for (const notification of notifications) {
      const garminUserId = notification.userAccessToken || notification.userId || "";

      if (!garminUserId) {
        skipped++;
        continue;
      }

      // Look up wearable connection by Garmin user token or ID
      const { data: connection, error: connErr } = await supabase
        .from("wearable_connections")
        .select("id, user_id, tenant_id")
        .eq("device_type", "garmin")
        .eq("device_id", garminUserId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (connErr || !connection) {
        logger.warn("No active Garmin connection found", { garminUserId, type: notificationType });
        skipped++;
        continue;
      }

      const conn = connection as WearableConnectionRow;

      // Convert Garmin epoch to ISO timestamp
      const measuredAt = notification.uploadStartTimeInSeconds
        ? new Date(notification.uploadStartTimeInSeconds * 1000).toISOString()
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
            source: "garmin_webhook",
            notification_type: notificationType,
            garmin_user_id: garminUserId,
            upload_start: notification.uploadStartTimeInSeconds,
            upload_end: notification.uploadEndTimeInSeconds,
            needs_sync: true,
          },
        });

      if (insertErr) {
        logger.error("Failed to insert Garmin webhook vital", {
          error: insertErr.message,
          garminUserId,
        });
        skipped++;
      } else {
        processed++;
      }
    }

    logger.info("Garmin webhook processed", {
      type: notificationType,
      total: notifications.length,
      processed,
      skipped,
    });

    // Garmin expects 200 OK
    return new Response("", { status: 200, headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Garmin webhook handler failed", { error: message });

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
