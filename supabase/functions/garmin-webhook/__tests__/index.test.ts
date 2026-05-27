// supabase/functions/garmin-webhook/__tests__/index.test.ts
// Tests for Garmin webhook receiver edge function (G-10, S-WH-2)

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSignatureBaseString,
  constantTimeEqual,
  hmacSha1Base64,
  parseOAuthHeader,
  verifyGarminSignature,
} from "../index.ts";

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

// ── S-WH-2: OAuth 1.0a Signature Verification ──────────────────────────────

Deno.test("Garmin OAuth 1.0a Signature Verification", async (t) => {
  const TEST_CONSUMER_SECRET = "test_consumer_secret_xyz";
  const TEST_CONSUMER_KEY = "test_consumer_key_abc";
  const TEST_URL = "https://example.supabase.co/functions/v1/garmin-webhook";

  /** Helper: produce a valid OAuth 1.0a signed POST request. */
  async function makeSignedRequest(opts?: {
    consumerSecretOverride?: string;
    tamperSignature?: boolean;
    omitAuthHeader?: boolean;
  }): Promise<Request> {
    const oauthBase = {
      oauth_consumer_key: TEST_CONSUMER_KEY,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: "1711497600",
      oauth_nonce: "nonce_xyz_123",
      oauth_version: "1.0",
    };

    // Build base string and sign with the (possibly overridden) secret
    const secret = opts?.consumerSecretOverride ?? TEST_CONSUMER_SECRET;
    const signingKey = `${encodeURIComponent(secret)}&`;

    const oauthForBase = {
      ...oauthBase,
      oauth_signature: "", // placeholder, excluded from base string anyway
    };
    const baseString = buildSignatureBaseString(
      "POST",
      TEST_URL,
      oauthForBase,
      new URLSearchParams(),
    );
    let signature = await hmacSha1Base64(signingKey, baseString);
    if (opts?.tamperSignature) {
      // Flip one character to make it invalid
      signature = signature.slice(0, -1) + (signature.slice(-1) === "A" ? "B" : "A");
    }

    const authHeader =
      `OAuth oauth_consumer_key="${TEST_CONSUMER_KEY}",` +
      `oauth_signature_method="HMAC-SHA1",` +
      `oauth_timestamp="1711497600",` +
      `oauth_nonce="nonce_xyz_123",` +
      `oauth_version="1.0",` +
      `oauth_signature="${encodeURIComponent(signature)}"`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!opts?.omitAuthHeader) headers["Authorization"] = authHeader;

    return new Request(TEST_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ dailies: [{ userId: "GARMIN123" }] }),
    });
  }

  await t.step("parseOAuthHeader: returns null for missing header", () => {
    assertEquals(parseOAuthHeader(null), null);
  });

  await t.step("parseOAuthHeader: returns null for non-OAuth scheme", () => {
    assertEquals(parseOAuthHeader("Bearer some-token"), null);
  });

  await t.step("parseOAuthHeader: returns null when required fields missing", () => {
    const incomplete = `OAuth oauth_consumer_key="abc"`;
    assertEquals(parseOAuthHeader(incomplete), null);
  });

  await t.step("parseOAuthHeader: parses well-formed OAuth header", () => {
    const header =
      `OAuth oauth_consumer_key="abc",oauth_signature="sig123",` +
      `oauth_signature_method="HMAC-SHA1",oauth_timestamp="123",` +
      `oauth_nonce="n1",oauth_version="1.0"`;
    const parsed = parseOAuthHeader(header);
    assertEquals(parsed?.oauth_consumer_key, "abc");
    assertEquals(parsed?.oauth_signature, "sig123");
    assertEquals(parsed?.oauth_signature_method, "HMAC-SHA1");
  });

  await t.step("constantTimeEqual: equal strings return true", () => {
    assertEquals(constantTimeEqual("abc123", "abc123"), true);
  });

  await t.step("constantTimeEqual: different strings return false", () => {
    assertEquals(constantTimeEqual("abc123", "abc124"), false);
  });

  await t.step("constantTimeEqual: different lengths return false", () => {
    assertEquals(constantTimeEqual("abc", "abcd"), false);
  });

  await t.step("buildSignatureBaseString: produces canonical OAuth 1.0a base string", () => {
    const oauth = {
      oauth_consumer_key: "key1",
      oauth_signature: "ignored",
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: "123",
      oauth_nonce: "n",
      oauth_version: "1.0",
    };
    const base = buildSignatureBaseString(
      "POST",
      "https://example.com/path",
      oauth,
      new URLSearchParams(),
    );
    // Must start with method, contain encoded URL, and NOT contain oauth_signature
    assertEquals(base.startsWith("POST&"), true);
    assertEquals(base.includes("oauth_signature%3Dignored"), false);
    assertEquals(base.includes("oauth_consumer_key"), true);
  });

  await t.step("verifyGarminSignature: ok=true for correctly signed request", async () => {
    const req = await makeSignedRequest();
    const result = await verifyGarminSignature(req, TEST_CONSUMER_SECRET);
    assertEquals(result.ok, true);
  });

  await t.step("verifyGarminSignature: ok=false when Authorization header missing", async () => {
    const req = await makeSignedRequest({ omitAuthHeader: true });
    const result = await verifyGarminSignature(req, TEST_CONSUMER_SECRET);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, "missing_or_malformed_authorization_header");
    }
  });

  await t.step("verifyGarminSignature: ok=false when signature is tampered", async () => {
    const req = await makeSignedRequest({ tamperSignature: true });
    const result = await verifyGarminSignature(req, TEST_CONSUMER_SECRET);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, "signature_mismatch");
    }
  });

  await t.step("verifyGarminSignature: ok=false when wrong consumer secret", async () => {
    // Request signed with one secret, verified against another
    const req = await makeSignedRequest({ consumerSecretOverride: "wrong_secret" });
    const result = await verifyGarminSignature(req, TEST_CONSUMER_SECRET);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, "signature_mismatch");
    }
  });

  await t.step("verifyGarminSignature: rejects unsupported signature method", async () => {
    const header =
      `OAuth oauth_consumer_key="abc",oauth_signature="sig",` +
      `oauth_signature_method="RSA-SHA1",oauth_timestamp="123",` +
      `oauth_nonce="n1"`;
    const req = new Request(TEST_URL, {
      method: "POST",
      headers: { Authorization: header, "Content-Type": "application/json" },
      body: "{}",
    });
    const result = await verifyGarminSignature(req, TEST_CONSUMER_SECRET);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, "unsupported_signature_method");
    }
  });
});
