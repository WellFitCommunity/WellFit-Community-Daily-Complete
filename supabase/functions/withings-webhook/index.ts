// supabase/functions/withings-webhook/index.ts
// Receives real-time push notifications from the Withings Notification API.
// Withings sends POST with application/x-www-form-urlencoded body when user data changes.
// This function validates, maps vitals, and inserts into wearable_vital_signs.

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

  try {
    // Withings sends application/x-www-form-urlencoded
    const formData = await req.formData();
    const userid = formData.get("userid")?.toString() || "";
    const startdate = formData.get("startdate")?.toString() || "";
    const enddate = formData.get("enddate")?.toString() || "";
    const appli = parseInt(formData.get("appli")?.toString() || "0", 10);

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
