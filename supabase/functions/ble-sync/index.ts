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

// -- Composite row mapping ----------------------------------------------------
// CANONICAL SHAPE (see docs/trackers/ble-vitals-enrollment-tracker.md §1.2):
// ONE row per reading, matching how DeviceService reads it back. A BP reading
// becomes a single blood_pressure row carrying {systolic,diastolic,pulse} in
// metadata — NOT three atomic rows. vital_type values must satisfy the live
// wearable_vital_signs CHECK constraint (heart_rate, blood_pressure,
// oxygen_saturation, temperature, respiratory_rate, blood_glucose, weight,
// body_temperature — widened 2026-06-30).

function valueOf(reading: BleVitalReading, type: string): number | undefined {
  return reading.values.find((v) => v.type === type)?.value;
}

function unitOf(reading: BleVitalReading, type: string, fallback: string): string {
  return reading.values.find((v) => v.type === type)?.unit ?? fallback;
}

/**
 * Compose ONE wearable_vital_signs row from a BLE reading, or null if the
 * reading is missing its required value(s).
 */
function composeRow(
  reading: BleVitalReading,
  userId: string,
  connId: string,
  tenantId: string,
): Record<string, unknown> | null {
  const base = {
    user_id: userId,
    device_id: connId,
    tenant_id: tenantId,
    measured_at: reading.timestamp,
    activity_state: null,
    quality_indicator: null,
    alert_triggered: false,
  };
  const rawData = reading.rawData ?? null;

  switch (reading.deviceType) {
    case "blood_pressure": {
      const systolic = valueOf(reading, "systolic");
      const diastolic = valueOf(reading, "diastolic");
      if (systolic === undefined || diastolic === undefined) return null;
      const pulse = valueOf(reading, "pulse_rate") ?? valueOf(reading, "pulse") ?? null;
      return {
        ...base,
        vital_type: "blood_pressure",
        value: systolic,
        unit: unitOf(reading, "systolic", "mmHg"),
        metadata: { systolic, diastolic, pulse, bleDeviceType: reading.deviceType, rawData },
      };
    }
    case "glucose_meter": {
      const glucose = valueOf(reading, "glucose");
      if (glucose === undefined) return null;
      return {
        ...base,
        vital_type: "blood_glucose",
        value: glucose,
        unit: unitOf(reading, "glucose", "mg/dL"),
        metadata: { bleDeviceType: reading.deviceType, rawData },
      };
    }
    case "pulse_oximeter": {
      const spo2 = valueOf(reading, "spo2");
      if (spo2 === undefined) return null;
      const pulseRate = valueOf(reading, "pulse_rate") ?? null;
      return {
        ...base,
        vital_type: "oxygen_saturation",
        value: spo2,
        unit: unitOf(reading, "spo2", "%"),
        metadata: { pulse_rate: pulseRate, bleDeviceType: reading.deviceType, rawData },
      };
    }
    case "weight_scale": {
      const weight = valueOf(reading, "weight");
      if (weight === undefined) return null;
      const bmi = valueOf(reading, "bmi") ?? null;
      return {
        ...base,
        vital_type: "weight",
        value: weight,
        unit: unitOf(reading, "weight", "kg"),
        metadata: { bmi, bleDeviceType: reading.deviceType, rawData },
      };
    }
    case "thermometer": {
      const temperature = valueOf(reading, "temperature");
      if (temperature === undefined) return null;
      return {
        ...base,
        vital_type: "body_temperature",
        value: temperature,
        unit: unitOf(reading, "temperature", "degC"),
        metadata: { bleDeviceType: reading.deviceType, rawData },
      };
    }
    default:
      return null;
  }
}

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

      // ONE composite row per reading (canonical shape — matches DeviceService reads).
      const row = composeRow(reading, user.id, connId, tenantId);
      if (!row) {
        skipped++;
        continue;
      }
      rows.push(row);
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
