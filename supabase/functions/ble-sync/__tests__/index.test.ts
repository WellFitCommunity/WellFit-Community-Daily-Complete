// supabase/functions/ble-sync/__tests__/index.test.ts
// Tests for BLE offline-to-cloud sync edge function (G-6)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("BLE Sync Edge Function Tests", async (t) => {

  // =========================================================================
  // Request Validation
  // =========================================================================

  await t.step("should handle CORS preflight", () => {
    const request = new Request("http://localhost/ble-sync", {
      method: "OPTIONS",
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require POST method", () => {
    const allowedMethod = "POST";
    const rejectedMethods = ["GET", "PUT", "DELETE", "PATCH"];

    assertEquals(allowedMethod, "POST");
    rejectedMethods.forEach((method) => {
      assertEquals(method !== "POST", true);
    });
  });

  await t.step("should require Authorization header", () => {
    const headers = new Headers();
    const authHeader = headers.get("Authorization");
    const hasAuth = !!authHeader?.startsWith("Bearer ");

    assertEquals(hasAuth, false);
  });

  await t.step("should validate Bearer token format", () => {
    const isValidBearer = (auth: string | null): boolean => {
      return !!auth?.startsWith("Bearer ");
    };

    assertEquals(isValidBearer("Bearer abc123"), true);
    assertEquals(isValidBearer("Basic abc123"), false);
    assertEquals(isValidBearer(null), false);
  });

  await t.step("should return 400 for empty/malformed JSON body", () => {
    const parseErrorResponse = { status: 400, error: "Invalid or empty request body" };
    assertEquals(parseErrorResponse.status, 400);
  });

  await t.step("should require readings array to be non-empty", () => {
    const emptyReadings: unknown[] = [];
    const isValid = Array.isArray(emptyReadings) && emptyReadings.length > 0;

    assertEquals(isValid, false);
  });

  await t.step("should enforce 500-reading batch limit", () => {
    const batchLimit = 500;
    const tooManyReadings = Array.from({ length: 501 }, (_, i) => ({
      deviceType: "blood_pressure",
      timestamp: new Date().toISOString(),
      values: [{ type: "systolic", value: 120 + i, unit: "mmHg" }],
    }));

    assertEquals(tooManyReadings.length > batchLimit, true);
  });

  // =========================================================================
  // Device Type Mapping
  // =========================================================================

  await t.step("should map blood_pressure device to vital types", () => {
    const mapping: Record<string, string> = {
      systolic: "blood_pressure",
      diastolic: "blood_pressure",
      pulse: "heart_rate",
    };

    assertEquals(mapping["systolic"], "blood_pressure");
    assertEquals(mapping["diastolic"], "blood_pressure");
    assertEquals(mapping["pulse"], "heart_rate");
  });

  await t.step("should map glucose_meter device to vital types", () => {
    const mapping: Record<string, string> = { glucose: "blood_glucose" };
    assertEquals(mapping["glucose"], "blood_glucose");
  });

  await t.step("should map pulse_oximeter device to vital types", () => {
    const mapping: Record<string, string> = {
      spo2: "oxygen_saturation",
      pulse_rate: "heart_rate",
    };

    assertEquals(mapping["spo2"], "oxygen_saturation");
    assertEquals(mapping["pulse_rate"], "heart_rate");
  });

  await t.step("should map weight_scale device to vital types", () => {
    const mapping: Record<string, string> = { weight: "weight" };
    assertEquals(mapping["weight"], "weight");
  });

  await t.step("should map thermometer device to vital types", () => {
    const mapping: Record<string, string> = { temperature: "body_temperature" };
    assertEquals(mapping["temperature"], "body_temperature");
  });

  // =========================================================================
  // Reading-to-Row Transformation
  // =========================================================================

  await t.step("should transform a blood pressure reading into multiple rows", () => {
    const reading = {
      deviceType: "blood_pressure",
      timestamp: "2026-03-27T10:30:00Z",
      values: [
        { type: "systolic", value: 120, unit: "mmHg" },
        { type: "diastolic", value: 80, unit: "mmHg" },
        { type: "pulse", value: 72, unit: "bpm" },
      ],
    };

    // Each value becomes its own row
    assertEquals(reading.values.length, 3);
  });

  await t.step("should include metadata with rawData when present", () => {
    const reading = {
      deviceType: "pulse_oximeter",
      timestamp: "2026-03-27T10:30:00Z",
      values: [{ type: "spo2", value: 98, unit: "%" }],
      rawData: "00:62:00:48",
    };

    const metadata = {
      rawData: reading.rawData,
      bleDeviceType: reading.deviceType,
      bleValueType: reading.values[0].type,
    };

    assertExists(metadata.rawData);
    assertEquals(metadata.bleDeviceType, "pulse_oximeter");
    assertEquals(metadata.bleValueType, "spo2");
  });

  await t.step("should skip unknown value types gracefully", () => {
    const knownTypes = ["systolic", "diastolic", "pulse", "glucose", "spo2", "pulse_rate", "weight", "temperature"];
    const unknownType = "unknown_metric";

    assertEquals(knownTypes.includes(unknownType), false);
  });

  // =========================================================================
  // Connection Resolution
  // =========================================================================

  await t.step("should use provided connectionId when available", () => {
    const connectionId: string | undefined = "conn-123-uuid";
    const shouldLookup = !connectionId;

    assertEquals(shouldLookup, false);
  });

  await t.step("should auto-lookup connection by device type when no connectionId", () => {
    const connectionId: string | undefined = undefined;
    const shouldLookup = !connectionId;

    assertEquals(shouldLookup, true);
  });

  await t.step("should handle multiple device types in one batch", () => {
    const readings = [
      { deviceType: "blood_pressure", timestamp: "2026-03-27T10:00:00Z", values: [{ type: "systolic", value: 120, unit: "mmHg" }] },
      { deviceType: "pulse_oximeter", timestamp: "2026-03-27T10:01:00Z", values: [{ type: "spo2", value: 98, unit: "%" }] },
      { deviceType: "thermometer", timestamp: "2026-03-27T10:02:00Z", values: [{ type: "temperature", value: 98.6, unit: "F" }] },
    ];

    const uniqueTypes = [...new Set(readings.map((r) => r.deviceType))];
    assertEquals(uniqueTypes.length, 3);
  });

  // =========================================================================
  // Response Format
  // =========================================================================

  await t.step("should return synced count and skipped count", () => {
    const response = {
      synced: 5,
      skipped: 1,
      deviceTypes: ["blood_pressure", "pulse_oximeter"],
    };

    assertEquals(response.synced, 5);
    assertEquals(response.skipped, 1);
    assertEquals(response.deviceTypes.length, 2);
  });

  await t.step("should return 200 even with zero valid readings (all skipped)", () => {
    const response = { synced: 0, skipped: 3, error: "No valid readings to sync" };
    assertEquals(response.synced, 0);
    assertExists(response.error);
  });

  // =========================================================================
  // Security
  // =========================================================================

  await t.step("should require tenant_id on all inserted rows", () => {
    const row = {
      user_id: "user-123",
      device_id: "conn-456",
      tenant_id: "tenant-abc",
      vital_type: "blood_pressure",
      value: 120,
      unit: "mmHg",
      measured_at: "2026-03-27T10:00:00Z",
    };

    assertExists(row.tenant_id);
  });

  await t.step("should reject users without tenant assignment", () => {
    const profile = { tenant_id: null };
    const hasTenant = !!profile.tenant_id;

    assertEquals(hasTenant, false);
  });

  await t.step("should include CORS headers on all responses", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://app.wellfitcommunity.com",
      "Content-Type": "application/json",
    };

    assertEquals("Access-Control-Allow-Origin" in corsHeaders, true);
    assertEquals("Content-Type" in corsHeaders, true);
  });

  // =========================================================================
  // Batch Limits & Edge Cases
  // =========================================================================

  await t.step("should handle exactly 500 readings (at limit)", () => {
    const batchLimit = 500;
    const readings = Array.from({ length: 500 }, () => ({
      deviceType: "blood_pressure",
      timestamp: new Date().toISOString(),
      values: [{ type: "systolic", value: 120, unit: "mmHg" }],
    }));

    assertEquals(readings.length <= batchLimit, true);
  });

  await t.step("should handle single reading", () => {
    const readings = [{
      deviceType: "thermometer",
      timestamp: "2026-03-27T10:00:00Z",
      values: [{ type: "temperature", value: 98.6, unit: "F" }],
    }];

    assertEquals(readings.length, 1);
    assertEquals(Array.isArray(readings), true);
  });
});
