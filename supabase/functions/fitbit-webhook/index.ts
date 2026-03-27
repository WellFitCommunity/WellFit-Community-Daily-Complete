// supabase/functions/fitbit-webhook/index.ts
// Receives real-time push notifications from Fitbit Subscription API.
// Fitbit sends a POST with a JSON array of notifications when user data changes.
// This function validates the request, maps vitals, and inserts into wearable_vital_signs.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("fitbit-webhook");

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Fitbit Verification ──────────────────────────────────────────────────────

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

// ── Vital Mapping ────────────────────────────────────────────────────────────

const COLLECTION_TO_VITAL_TYPE: Record<string, string> = {
  activities: "heart_rate",
  body: "weight",
  sleep: "heart_rate",
};

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

  try {
    const notifications = (await req.json()) as FitbitNotification[];

    if (!Array.isArray(notifications) || notifications.length === 0) {
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
