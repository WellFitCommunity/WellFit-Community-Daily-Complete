// supabase/functions/garmin-webhook/index.ts
// Receives real-time push notifications from Garmin Health API.
// Garmin sends POST with JSON body containing user metric notifications.
// This function validates, maps vitals, and inserts into wearable_vital_signs.

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
