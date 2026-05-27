// supabase/functions/fitbit-webhook/index.ts
// Receives real-time push notifications from Fitbit Subscription API.
// Fitbit sends a POST with a JSON array of notifications when user data changes.
// This function validates the request, maps vitals, and inserts into wearable_vital_signs.
//
// SECURITY (S-WH-3 sister-bug sweep): The notification POST path now verifies
// the X-Fitbit-Signature header (HMAC-SHA1 of body, base64, key=FITBIT_CLIENT_SECRET)
// per https://dev.fitbit.com/build/reference/web-api/subscription/#subscription-security.
// Unsigned/invalid notifications are rejected with 401 and audit-logged.
//
// NOTE: The OAuth action path (`{action: 'token_exchange'|...}`) is intentionally
// NOT signature-verified — it is a client-initiated server-side proxy, not a Fitbit
// callback. It still lacks Bearer-token authentication of the calling user, which
// is a separate audit finding (FB-OAUTH-1 in the follow-up tracker).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("fitbit-webhook");

// Fitbit OAuth credentials (server-side only — never expose to browser)
const FITBIT_CLIENT_ID = Deno.env.get("FITBIT_CLIENT_ID") || "";
const FITBIT_CLIENT_SECRET = Deno.env.get("FITBIT_CLIENT_SECRET") || "";
const FITBIT_AUTH_BASE = "https://api.fitbit.com/oauth2";

// ── Types ────────────────────────────────────────────────────────────────────

interface OAuthActionRequest {
  action: 'token_exchange' | 'refresh_token' | 'revoke_token';
  code?: string;
  client_id?: string;
  redirect_uri?: string;
  refresh_token?: string;
  access_token?: string;
}

interface FitbitNotification {
  collectionType: string; // 'activities', 'body', 'foods', 'sleep', 'userRevokedAccess'
  date: string;           // YYYY-MM-DD
  ownerId: string;        // Fitbit user ID
  ownerType: string;      // 'user'
  subscriptionId: string;
}

interface WearableConnectionRow {
  id: string;
  user_id: string;
  tenant_id: string;
}

// ── Fitbit Verification (GET handshake) ──────────────────────────────────────

/**
 * Fitbit requires a verification endpoint: GET returns the verification code.
 * Set FITBIT_SUBSCRIBER_VERIFICATION_CODE in Supabase secrets.
 */
function handleVerification(req: Request, corsHeaders: Record<string, string>): Response {
  const url = new URL(req.url);
  const verify = url.searchParams.get("verify");
  const expectedCode = Deno.env.get("FITBIT_SUBSCRIBER_VERIFICATION_CODE") || "";

  if (verify && verify === expectedCode) {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  return new Response("", { status: 404, headers: corsHeaders });
}

// ── Signature Verification (HMAC-SHA1, base64, X-Fitbit-Signature) ───────────

/** Compute HMAC-SHA1 over `body` with secret. Returns base64-encoded digest. */
async function hmacSha1Base64(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const bytes = new Uint8Array(sigBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Constant-time string comparison. */
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
 * Verify the X-Fitbit-Signature header on a notification POST.
 * Fitbit signs with HMAC-SHA1 of the raw body using the client secret.
 */
export async function verifyFitbitSignature(
  req: Request,
  rawBody: string,
  clientSecret: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const presented = req.headers.get("x-fitbit-signature");
  if (!presented) {
    return { ok: false, reason: "missing_signature_header" };
  }
  const expected = await hmacSha1Base64(clientSecret, rawBody);
  if (!constantTimeEqual(expected, presented.trim())) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

// ── Vital Mapping ────────────────────────────────────────────────────────────

const COLLECTION_TO_VITAL_TYPE: Record<string, string> = {
  activities: "heart_rate",
  body: "weight",
  sleep: "heart_rate",
};

// ── OAuth Token Operations (A-7 fix: server-side only) ─────────────────────

async function handleOAuthAction(
  action: OAuthActionRequest,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET) {
    return new Response(
      JSON.stringify({ error: "Fitbit OAuth not configured on server" }),
      { status: 503, headers: jsonHeaders }
    );
  }

  const authHeader = "Basic " + btoa(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`);

  switch (action.action) {
    case "token_exchange": {
      if (!action.code) {
        return new Response(
          JSON.stringify({ error: "Authorization code required" }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const response = await fetch(`${FITBIT_AUTH_BASE}/token`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: action.client_id || FITBIT_CLIENT_ID,
          code: action.code,
          grant_type: "authorization_code",
          redirect_uri: action.redirect_uri || "",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("Fitbit token exchange failed", { status: response.status, error });
        return new Response(
          JSON.stringify({ error: "Token exchange failed", details: error }),
          { status: response.status, headers: jsonHeaders }
        );
      }

      const data = await response.json();
      logger.info("Fitbit token exchange successful", { userId: data.user_id });
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    case "refresh_token": {
      if (!action.refresh_token) {
        return new Response(
          JSON.stringify({ error: "Refresh token required" }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const response = await fetch(`${FITBIT_AUTH_BASE}/token`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: action.refresh_token,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("Fitbit token refresh failed", { status: response.status, error });
        return new Response(
          JSON.stringify({ error: "Token refresh failed", details: error }),
          { status: response.status, headers: jsonHeaders }
        );
      }

      const data = await response.json();
      logger.info("Fitbit token refreshed", { userId: data.user_id });
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    case "revoke_token": {
      if (!action.access_token) {
        return new Response(
          JSON.stringify({ error: "Access token required" }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const response = await fetch(`${FITBIT_AUTH_BASE}/revoke`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token: action.access_token }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error("Fitbit token revocation failed", { status: response.status, error });
        return new Response(
          JSON.stringify({ error: "Token revocation failed", details: error }),
          { status: response.status, headers: jsonHeaders }
        );
      }

      logger.info("Fitbit token revoked");
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action.action}` }),
        { status: 400, headers: jsonHeaders }
      );
  }
}

// ── Main Handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const { headers: corsHeaders } = corsFromRequest(req);

  // Fitbit verification handshake (GET)
  if (req.method === "GET") {
    return handleVerification(req, corsHeaders);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read raw body once — used for both signature verification AND parsing.
  const rawBody = await req.text();

  // Try to parse to determine which path we're on
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── OAuth action path (client-initiated proxy; NOT a Fitbit callback) ───
  // Signature verification does NOT apply here. Bearer-token auth for the
  // calling user is tracked separately as FB-OAUTH-1.
  if (body && typeof body === "object" && "action" in (body as Record<string, unknown>)) {
    return handleOAuthAction(body as OAuthActionRequest, corsHeaders);
  }

  // ── Notification path: verify X-Fitbit-Signature BEFORE any DB write ────
  if (!FITBIT_CLIENT_SECRET) {
    logger.error("Fitbit webhook misconfigured: FITBIT_CLIENT_SECRET not set");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const verification = await verifyFitbitSignature(req, rawBody, FITBIT_CLIENT_SECRET);
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
          source: "fitbit_webhook",
          reason: verification.reason,
        },
      });
    } catch (auditErr: unknown) {
      const msg = auditErr instanceof Error ? auditErr.message : String(auditErr);
      logger.error("Failed to write webhook_signature_invalid audit log", { error: msg });
    }

    logger.warn("Fitbit webhook signature rejected", { reason: verification.reason });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Now safe to treat as a notification array
    const notifications = (Array.isArray(body) ? body : [body]) as FitbitNotification[];

    if (notifications.length === 0) {
      return new Response(JSON.stringify({ error: "Empty notification array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createAdminClient();
    let processed = 0;
    let skipped = 0;

    for (const notification of notifications) {
      // Skip non-health notifications
      if (notification.collectionType === "userRevokedAccess" || notification.collectionType === "foods") {
        skipped++;
        continue;
      }

      // Look up the wearable connection by Fitbit user ID
      const { data: connection, error: connErr } = await supabase
        .from("wearable_connections")
        .select("id, user_id, tenant_id")
        .eq("device_type", "fitbit")
        .eq("device_id", notification.ownerId)
        .eq("status", "active")
        .limit(1)
        .single();

      if (connErr || !connection) {
        logger.warn("No active Fitbit connection found", {
          ownerId: notification.ownerId,
          collectionType: notification.collectionType,
        });
        skipped++;
        continue;
      }

      const conn = connection as WearableConnectionRow;
      const vitalType = COLLECTION_TO_VITAL_TYPE[notification.collectionType] || "heart_rate";

      // Insert a webhook receipt record into wearable_vital_signs
      // The actual vital values will be fetched by the sync job using the Fitbit API
      const { error: insertErr } = await supabase
        .from("wearable_vital_signs")
        .insert({
          user_id: conn.user_id,
          device_id: conn.id,
          tenant_id: conn.tenant_id,
          vital_type: vitalType,
          value: 0, // Placeholder — actual value fetched by sync job
          unit: "webhook_notification",
          measured_at: `${notification.date}T00:00:00Z`,
          metadata: {
            source: "fitbit_webhook",
            collection_type: notification.collectionType,
            subscription_id: notification.subscriptionId,
            needs_sync: true,
          },
        });

      if (insertErr) {
        logger.error("Failed to insert Fitbit webhook vital", {
          error: insertErr.message,
          ownerId: notification.ownerId,
        });
        skipped++;
      } else {
        processed++;
      }
    }

    logger.info("Fitbit webhook processed", {
      total: notifications.length,
      processed,
      skipped,
    });

    // Fitbit expects 204 No Content for successful receipt
    return new Response("", { status: 204, headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Fitbit webhook handler failed", { error: message });

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
