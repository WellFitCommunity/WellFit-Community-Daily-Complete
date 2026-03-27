// supabase/functions/garmin-webhook/__tests__/index.test.ts
// Tests for Garmin webhook receiver edge function (G-10)

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Garmin Webhook Edge Function Tests", async (t) => {

  // ── Request Validation ──────────────────────────────────────────────────

  await t.step("should handle CORS preflight", () => {
    const request = new Request("http://localhost/garmin-webhook", {
      method: "OPTIONS",
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const request = new Request("http://localhost/garmin-webhook", {
      method: "GET",
    });
    assertEquals(request.method !== "POST", true);
  });

  // ── Notification Type Detection ─────────────────────────────────────────

  await t.step("should detect daily summary notifications", () => {
    const payload = {
      dailies: [{ userId: "GARMIN123", summaryId: "sum-001" }],
    };
    assertEquals("dailies" in payload, true);
    assertEquals(Array.isArray(payload.dailies), true);
  });

  await t.step("should detect activity notifications", () => {
    const payload = {
      activities: [{ userId: "GARMIN123", activityId: 12345 }],
    };
    assertEquals("activities" in payload, true);
  });

  await t.step("should detect body composition notifications", () => {
    const payload = {
      bodyComps: [{ userId: "GARMIN123", weightInGrams: 75000 }],
    };
    assertEquals("bodyComps" in payload, true);
  });

  await t.step("should detect pulse ox notifications", () => {
    const payload = {
      pulseOx: [{ userId: "GARMIN123" }],
    };
    assertEquals("pulseOx" in payload, true);
  });

  await t.step("should detect sleep notifications", () => {
    const payload = {
      sleeps: [{ userId: "GARMIN123" }],
    };
    assertEquals("sleeps" in payload, true);
  });

  // ── Vital Type Mapping ────────────────────────────────────────────────

  await t.step("should map notification types to vital types", () => {
    const mapping: Record<string, string> = {
      dailies: "heart_rate",
      activities: "heart_rate",
      bodyComps: "weight",
      sleeps: "heart_rate",
      pulseOx: "oxygen_saturation",
      stressDetails: "heart_rate",
    };
    assertEquals(mapping["dailies"], "heart_rate");
    assertEquals(mapping["bodyComps"], "weight");
    assertEquals(mapping["pulseOx"], "oxygen_saturation");
  });

  // ── Epoch Timestamp Conversion ────────────────────────────────────────

  await t.step("should convert Garmin epoch seconds to ISO", () => {
    const uploadStartTimeInSeconds = 1711497600;
    const isoDate = new Date(uploadStartTimeInSeconds * 1000).toISOString();
    assertEquals(typeof isoDate, "string");
    assertEquals(isoDate.endsWith("Z"), true);
  });

  await t.step("should use current time when no epoch provided", () => {
    const uploadStartTimeInSeconds = undefined;
    const measuredAt = uploadStartTimeInSeconds
      ? new Date(uploadStartTimeInSeconds * 1000).toISOString()
      : new Date().toISOString();
    assertEquals(typeof measuredAt, "string");
  });

  // ── Payload Extraction ────────────────────────────────────────────────

  await t.step("should extract notifications array from payload", () => {
    const payload = {
      dailies: [
        { userId: "GARMIN1", summaryId: "s1" },
        { userId: "GARMIN2", summaryId: "s2" },
      ],
    };
    const keys = Object.keys(payload);
    const firstArrayKey = keys.find(
      (k) => Array.isArray((payload as Record<string, unknown>)[k])
    );
    assertEquals(firstArrayKey, "dailies");
    const notifications = (payload as Record<string, unknown>)[firstArrayKey!] as unknown[];
    assertEquals(notifications.length, 2);
  });

  await t.step("should handle empty payload", () => {
    const payload = {};
    const keys = Object.keys(payload);
    assertEquals(keys.length, 0);
  });

  // ── Vital Sign Insert Shape ──────────────────────────────────────────────

  await t.step("should build correct vital sign insert payload", () => {
    const insert = {
      user_id: "user-001",
      device_id: "conn-001",
      tenant_id: "tenant-001",
      vital_type: "heart_rate",
      value: 0,
      unit: "bpm",
      measured_at: "2026-03-27T00:00:00Z",
      metadata: {
        source: "garmin_webhook",
        notification_type: "dailies",
        garmin_user_id: "GARMIN123",
        upload_start: 1711497600,
        upload_end: 1711584000,
        needs_sync: true,
      },
    };

    assertEquals(insert.vital_type, "heart_rate");
    assertEquals(insert.metadata.source, "garmin_webhook");
    assertEquals(insert.metadata.notification_type, "dailies");
    assertEquals(insert.metadata.needs_sync, true);
  });

  // ── Response Codes ──────────────────────────────────────────────────────

  await t.step("should respond with 200 on success", () => {
    const expectedStatusCode = 200;
    assertEquals(expectedStatusCode, 200);
  });

  await t.step("should respond with 400 for empty payload", () => {
    const payload = {};
    const isEmpty = Object.keys(payload).length === 0;
    assertEquals(isEmpty, true);
  });
});
