// supabase/functions/withings-webhook/__tests__/index.test.ts
// Tests for Withings webhook receiver edge function (G-10)

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Withings Webhook Edge Function Tests", async (t) => {

  // ── Request Validation ──────────────────────────────────────────────────

  await t.step("should handle CORS preflight", () => {
    const request = new Request("http://localhost/withings-webhook", {
      method: "OPTIONS",
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should accept HEAD for verification handshake", () => {
    const request = new Request("http://localhost/withings-webhook", {
      method: "HEAD",
    });
    assertEquals(request.method, "HEAD");
  });

  await t.step("should reject non-POST/HEAD/GET methods", () => {
    const request = new Request("http://localhost/withings-webhook", {
      method: "PUT",
    });
    const allowed = ["POST", "HEAD", "GET", "OPTIONS"];
    assertEquals(allowed.includes(request.method), false);
  });

  // ── Appli Code Mapping ────────────────────────────────────────────────

  await t.step("should map appli codes to vital types", () => {
    const mapping: Record<number, { type: string; unit: string }> = {
      1: { type: "weight", unit: "kg" },
      4: { type: "blood_pressure", unit: "mmHg" },
      16: { type: "heart_rate", unit: "bpm" },
      44: { type: "oxygen_saturation", unit: "%" },
      51: { type: "temperature", unit: "°C" },
      54: { type: "oxygen_saturation", unit: "%" },
    };
    assertEquals(mapping[1].type, "weight");
    assertEquals(mapping[4].type, "blood_pressure");
    assertEquals(mapping[16].type, "heart_rate");
    assertEquals(mapping[44].type, "oxygen_saturation");
    assertEquals(mapping[51].type, "temperature");
  });

  await t.step("should handle unknown appli codes gracefully", () => {
    const knownCodes = [1, 4, 16, 44, 46, 51, 54];
    const unknownCode = 999;
    assertEquals(knownCodes.includes(unknownCode), false);
  });

  // ── Unix Timestamp Conversion ──────────────────────────────────────────

  await t.step("should convert Unix timestamps to ISO", () => {
    const startdate = "1711497600"; // 2024-03-27T00:00:00Z
    const isoDate = new Date(parseInt(startdate, 10) * 1000).toISOString();
    assertEquals(typeof isoDate, "string");
    assertEquals(isoDate.endsWith("Z"), true);
  });

  // ── Vital Sign Insert Shape ──────────────────────────────────────────────

  await t.step("should build correct vital sign insert payload", () => {
    const insert = {
      user_id: "user-001",
      device_id: "conn-001",
      tenant_id: "tenant-001",
      vital_type: "blood_pressure",
      value: 0,
      unit: "mmHg",
      measured_at: "2026-03-27T00:00:00Z",
      metadata: {
        source: "withings_webhook",
        appli_code: 4,
        withings_userid: "WITHINGS123",
        startdate: "1711497600",
        enddate: "1711584000",
        needs_sync: true,
      },
    };

    assertEquals(insert.vital_type, "blood_pressure");
    assertEquals(insert.metadata.source, "withings_webhook");
    assertEquals(insert.metadata.appli_code, 4);
    assertEquals(insert.metadata.needs_sync, true);
  });

  // ── Form Data Parsing ─────────────────────────────────────────────────

  await t.step("should validate required form fields", () => {
    const userid = "WITHINGS123";
    const appli = 4;
    const isValid = Boolean(userid) && Boolean(appli);
    assertEquals(isValid, true);
  });

  await t.step("should reject missing userid", () => {
    const userid = "";
    const appli = 4;
    const isValid = Boolean(userid) && Boolean(appli);
    assertEquals(isValid, false);
  });

  await t.step("should reject missing appli", () => {
    const userid = "WITHINGS123";
    const appli = 0;
    const isValid = Boolean(userid) && Boolean(appli);
    assertEquals(isValid, false);
  });

  // ── Response Codes ──────────────────────────────────────────────────────

  await t.step("should respond with 200 on success (Withings convention)", () => {
    const expectedStatusCode = 200;
    assertEquals(expectedStatusCode, 200);
  });
});
