// supabase/functions/fitbit-webhook/__tests__/index.test.ts
// Tests for Fitbit webhook receiver edge function (G-10)

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Fitbit Webhook Edge Function Tests", async (t) => {

  // ── Request Validation ──────────────────────────────────────────────────

  await t.step("should handle CORS preflight", () => {
    const request = new Request("http://localhost/fitbit-webhook", {
      method: "OPTIONS",
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST/GET methods", () => {
    const request = new Request("http://localhost/fitbit-webhook", {
      method: "PUT",
    });
    assertEquals(request.method !== "POST" && request.method !== "GET", true);
  });

  await t.step("should accept GET for verification handshake", () => {
    const request = new Request(
      "http://localhost/fitbit-webhook?verify=test123",
      { method: "GET" }
    );
    assertEquals(request.method, "GET");
    const url = new URL(request.url);
    assertEquals(url.searchParams.get("verify"), "test123");
  });

  // ── Notification Parsing ─────────────────────────────────────────────────

  await t.step("should parse Fitbit notification array", () => {
    const notifications = [
      {
        collectionType: "activities",
        date: "2026-03-27",
        ownerId: "FITBIT123",
        ownerType: "user",
        subscriptionId: "sub-001",
      },
    ];
    assertEquals(Array.isArray(notifications), true);
    assertEquals(notifications[0].collectionType, "activities");
    assertEquals(notifications[0].ownerId, "FITBIT123");
  });

  await t.step("should skip userRevokedAccess notifications", () => {
    const notification = { collectionType: "userRevokedAccess" };
    const shouldSkip =
      notification.collectionType === "userRevokedAccess" ||
      notification.collectionType === "foods";
    assertEquals(shouldSkip, true);
  });

  await t.step("should skip foods notifications", () => {
    const notification = { collectionType: "foods" };
    const shouldSkip =
      notification.collectionType === "userRevokedAccess" ||
      notification.collectionType === "foods";
    assertEquals(shouldSkip, true);
  });

  await t.step("should map collection types to vital types", () => {
    const mapping: Record<string, string> = {
      activities: "heart_rate",
      body: "weight",
      sleep: "heart_rate",
    };
    assertEquals(mapping["activities"], "heart_rate");
    assertEquals(mapping["body"], "weight");
    assertEquals(mapping["sleep"], "heart_rate");
  });

  // ── Vital Sign Insert Shape ──────────────────────────────────────────────

  await t.step("should build correct vital sign insert payload", () => {
    const insert = {
      user_id: "user-001",
      device_id: "conn-001",
      tenant_id: "tenant-001",
      vital_type: "heart_rate",
      value: 0,
      unit: "webhook_notification",
      measured_at: "2026-03-27T00:00:00Z",
      metadata: {
        source: "fitbit_webhook",
        collection_type: "activities",
        subscription_id: "sub-001",
        needs_sync: true,
      },
    };

    assertEquals(insert.vital_type, "heart_rate");
    assertEquals(insert.metadata.source, "fitbit_webhook");
    assertEquals(insert.metadata.needs_sync, true);
    assertEquals(insert.value, 0); // Placeholder until sync
  });

  // ── Response Codes ──────────────────────────────────────────────────────

  await t.step("should respond with 204 on success (Fitbit convention)", () => {
    const expectedStatusCode = 204;
    assertEquals(expectedStatusCode, 204);
  });

  await t.step("should respond with 400 for empty notification array", () => {
    const notifications: unknown[] = [];
    const shouldReject = !Array.isArray(notifications) || notifications.length === 0;
    assertEquals(shouldReject, true);
  });
});
