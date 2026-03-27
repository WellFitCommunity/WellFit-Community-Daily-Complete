/**
 * BLE Offline-to-Cloud Sync Edge Function
 *
 * Receives queued BLE vital readings from the browser's offline buffer
 * and persists them to the wearable_vital_signs table.
 *
 * The browser's bleConnectionManager queues readings (up to 500) when
 * offline or between sync intervals. This function is the cloud endpoint
 * that flushes that queue into persistent storage.
 *
 * Security: Requires authenticated user with a linked wearable_connection.
 * Tenant isolation: All inserts include tenant_id from the user's profile.
 *
 * @module ble-sync
 * @gap G-6 (system-gaps-tracker.md)
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -- Types matching src/types/ble.ts -----------------------------------------

interface BleVitalValue {
  type: string;
  value: number;
  unit: string;
}

interface BleVitalReading {
  deviceType: string;
  timestamp: string;
  values: BleVitalValue[];
  rawData?: string;
}

interface SyncRequest {
  readings: BleVitalReading[];
  connectionId?: string; // wearable_connections.id — if known
}

// Map BLE device types to wearable_vital_signs vital_type values
const DEVICE_TYPE_TO_VITAL: Record<string, Record<string, string>> = {
  blood_pressure: { systolic: "blood_pressure", diastolic: "blood_pressure", pulse: "heart_rate" },
  glucose_meter: { glucose: "blood_glucose" },
  pulse_oximeter: { spo2: "oxygen_saturation", pulse_rate: "heart_rate" },
  weight_scale: { weight: "weight" },
  thermometer: { temperature: "body_temperature" },
};

serve(async (req) => {
  const logger = createLogger("ble-sync", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // =========================================================================
    // AUTHENTICATION
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.slice(7);
    const authClient = createClient(SUPABASE_URL, SB_SECRET_KEY, {
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // PARSE & VALIDATE
    // =========================================================================
    let body: SyncRequest;
    try {
      body = await req.json();
    } catch (_parseErr: unknown) {
      return new Response(
        JSON.stringify({ error: "Invalid or empty request body — expected JSON with readings array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { readings, connectionId } = body;

    if (!Array.isArray(readings) || readings.length === 0) {
      return new Response(
        JSON.stringify({ error: "readings must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (readings.length > 500) {
      return new Response(
        JSON.stringify({ error: "Maximum 500 readings per sync batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // RESOLVE TENANT + DEVICE CONNECTION
    // =========================================================================
    const admin = createAdminClient();

    // Get user's tenant
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "User has no tenant assigned" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;

    // Resolve or find the wearable connection
    let deviceId = connectionId;
    if (!deviceId) {
      // Try to find user's connected device matching the first reading's type
      const firstDeviceType = readings[0]?.deviceType;
      const { data: connection } = await admin
        .from("wearable_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("device_type", firstDeviceType)
        .eq("connected", true)
        .maybeSingle();

      if (connection) {
        deviceId = connection.id;
      }
    }

    // If still no device connection, auto-create one per device type
    const deviceMap: Record<string, string> = {};
    const uniqueDeviceTypes = [...new Set(readings.map((r) => r.deviceType))];

    for (const dt of uniqueDeviceTypes) {
      if (deviceId && uniqueDeviceTypes.length === 1) {
        deviceMap[dt] = deviceId;
        continue;
      }

      // Check for existing connection of this type
      const { data: existing } = await admin
        .from("wearable_connections")
        .select("id")
        .eq("user_id", user.id)
        .eq("device_type", dt)
        .maybeSingle();

      if (existing) {
        deviceMap[dt] = existing.id;
      } else {
        // Auto-create connection record for this device type
        const { data: created, error: createErr } = await admin
          .from("wearable_connections")
          .insert({
            user_id: user.id,
            tenant_id: tenantId,
            device_type: dt,
            connected: true,
            last_sync: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createErr || !created) {
          logger.error("Failed to create wearable connection", { deviceType: dt, error: createErr?.message });
          continue;
        }
        deviceMap[dt] = created.id;
      }
    }

    // =========================================================================
    // MAP READINGS → wearable_vital_signs ROWS
    // =========================================================================
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const reading of readings) {
      const connId = deviceMap[reading.deviceType];
      if (!connId) {
        skipped++;
        continue;
      }

      const vitalTypeMap = DEVICE_TYPE_TO_VITAL[reading.deviceType] || {};

      for (const val of reading.values) {
        const vitalType = vitalTypeMap[val.type];
        if (!vitalType) {
          // Unknown value type — store with device type as fallback
          skipped++;
          continue;
        }

        rows.push({
          user_id: user.id,
          device_id: connId,
          tenant_id: tenantId,
          vital_type: vitalType,
          value: val.value,
          unit: val.unit,
          measured_at: reading.timestamp,
          activity_state: null,
          quality_indicator: null,
          alert_triggered: false,
          metadata: reading.rawData ? { rawData: reading.rawData, bleDeviceType: reading.deviceType, bleValueType: val.type } : { bleDeviceType: reading.deviceType, bleValueType: val.type },
        });
      }
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, skipped, error: "No valid readings to sync" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // INSERT (batch)
    // =========================================================================
    const { error: insertError } = await admin
      .from("wearable_vital_signs")
      .insert(rows);

    if (insertError) {
      logger.error("Failed to insert wearable vitals", { error: insertError.message, rowCount: rows.length });
      return new Response(
        JSON.stringify({ error: "Failed to persist readings", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_sync on connections
    for (const [_dt, connId] of Object.entries(deviceMap)) {
      await admin
        .from("wearable_connections")
        .update({ last_sync: new Date().toISOString() })
        .eq("id", connId);
    }

    logger.info("BLE sync complete", {
      userId: user.id,
      readingsReceived: readings.length,
      rowsInserted: rows.length,
      skipped,
      deviceTypes: uniqueDeviceTypes,
    });

    return new Response(
      JSON.stringify({
        synced: rows.length,
        skipped,
        deviceTypes: uniqueDeviceTypes,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("BLE sync failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
