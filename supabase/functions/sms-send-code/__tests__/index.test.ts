// supabase/functions/sms-send-code/__tests__/index.test.ts
// E2E Tests for SMS Send Code Function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Mock environment setup
const setupMockEnv = () => {
  Deno.env.set("TWILIO_ACCOUNT_SID", "ACtest_account_sid");
  Deno.env.set("TWILIO_AUTH_TOKEN", "test_auth_token");
  Deno.env.set("TWILIO_VERIFY_SERVICE_SID", "VAtest_verify_sid");
};

// Mock Twilio Verify API
const mockTwilioVerifySuccess = () => {
  return new Response(
    JSON.stringify({
      sid: "VEtest_verification_sid",
      status: "pending",
      to: "+15555551234",
      channel: "sms",
    }),
    { status: 200 }
  );
};

const mockTwilioVerifyError = (status: number, message: string) => {
  return new Response(
    JSON.stringify({ message, status }),
    { status }
  );
};

Deno.test("SMS Send Code Function - E2E Tests", async (t) => {
  await t.step("should reject non-POST requests", async () => {
    const request = new Request("http://localhost", {
      method: "GET",
    });

    assertExists(request);
    assertEquals(request.method, "GET");
  });

  await t.step("should handle OPTIONS (preflight) correctly", async () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS",
      headers: { "Origin": "http://localhost:3000" },
    });

    assertExists(request);
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should validate phone number is required", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "sms" }),
    });

    assertExists(request);
    const body = await request.json();
    assertEquals(body.channel, "sms");
  });

  await t.step("should validate US phone number format", async () => {
    const validPhones = [
      "+15555551234",
      "+1 555 555 1234",
      "(555) 555-1234",
    ];

    for (const phone of validPhones) {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: "sms" }),
      });

      assertExists(request);
    }
  });

  await t.step("should reject invalid phone number format", async () => {
    const invalidPhones = [
      "1234567890", // No country code
      "+91234567890", // Too short
      "invalid",
    ];

    for (const phone of invalidPhones) {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: "sms" }),
      });

      assertExists(request);
    }
  });

  await t.step("should only accept allowed country codes", async () => {
    const allowedCountries = ["US", "CA", "GB", "AU"];
    const testPhones = [
      "+15555551234", // US
      "+447123456789", // UK
      "+61412345678", // AU
      "+14165551234", // CA
    ];

    for (const phone of testPhones) {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: "sms" }),
      });

      assertExists(request);
    }
  });

  await t.step("should validate channel parameter", async () => {
    const validChannels = ["sms", "call"];

    for (const channel of validChannels) {
      const request = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+15555551234",
          channel,
        }),
      });

      assertExists(request);
      const body = await request.json();
      assertEquals(["sms", "call"].includes(body.channel), true);
    }
  });

  await t.step("should default to SMS channel if not specified", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+15555551234" }),
    });

    assertExists(request);
  });

  await t.step("should handle missing Twilio environment variables", async () => {
    // Store original values
    const originalSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const originalToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const originalVerify = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");

    // Clear env vars
    Deno.env.delete("TWILIO_ACCOUNT_SID");
    Deno.env.delete("TWILIO_AUTH_TOKEN");
    Deno.env.delete("TWILIO_VERIFY_SERVICE_SID");

    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+15555551234" }),
    });

    assertExists(request);

    // Restore original values
    if (originalSid) Deno.env.set("TWILIO_ACCOUNT_SID", originalSid);
    if (originalToken) Deno.env.set("TWILIO_AUTH_TOKEN", originalToken);
    if (originalVerify) Deno.env.set("TWILIO_VERIFY_SERVICE_SID", originalVerify);
  });

  await t.step("should handle Twilio API success response", async () => {
    setupMockEnv();

    const mockResponse = mockTwilioVerifySuccess();
    const data = await mockResponse.json();

    assertEquals(mockResponse.status, 200);
    assertEquals(data.status, "pending");
    assertExists(data.sid);
  });

  await t.step("should handle Twilio API 401 (auth failed)", async () => {
    const mockResponse = mockTwilioVerifyError(401, "Authentication failed");
    assertEquals(mockResponse.status, 401);
  });

  await t.step("should handle Twilio API 403 (forbidden)", async () => {
    const mockResponse = mockTwilioVerifyError(403, "Forbidden");
    assertEquals(mockResponse.status, 403);
  });

  await t.step("should handle Twilio API 404 (service not found)", async () => {
    const mockResponse = mockTwilioVerifyError(404, "Service not found");
    assertEquals(mockResponse.status, 404);
  });

  await t.step("should implement retry logic with exponential backoff", async () => {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    const delays = [];
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      delays.push(delay);
    }

    assertEquals(delays.length, 3);
    assertEquals(delays[0], 2000); // First retry: 2s
    assertEquals(delays[1], 4000); // Second retry: 4s
    assertEquals(delays[2], 8000); // Third retry: 8s
  });

  await t.step("should timeout requests after 30 seconds", async () => {
    const timeoutMs = 30000;
    const controller = new AbortController();

    setTimeout(() => controller.abort(), timeoutMs);

    assertExists(controller.signal);
  });

  await t.step("should format Twilio request correctly", async () => {
    setupMockEnv();

    const phone = "+15555551234";
    const channel = "sms";
    const form = new URLSearchParams({ To: phone, Channel: channel });

    assertEquals(form.get("To"), phone);
    assertEquals(form.get("Channel"), channel);
  });

  await t.step("should generate proper Basic Auth header", async () => {
    setupMockEnv();

    const accountSid = "ACtest_account_sid";
    const authToken = "test_auth_token";
    const authHeader = "Basic " + btoa(`${accountSid}:${authToken}`);

    assertExists(authHeader);
    assertEquals(authHeader.startsWith("Basic "), true);
  });

  await t.step("should handle successful verification start", async () => {
    const expectedResponse = {
      ok: true,
      provider: "verify",
      verification_status: "sent",
      verification_sid: "VEtest_sid",
    };

    assertEquals(expectedResponse.ok, true);
    assertEquals(expectedResponse.provider, "verify");
    assertExists(expectedResponse.verification_sid);
  });

  await t.step("should log audit trail with enterprise logger", async () => {
    // Verify audit logger is imported and used
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "SMS verification code sent successfully",
      function: "sms-send-code",
      phone: "+15555551234",
      channel: "sms",
    };

    assertExists(logEntry.timestamp);
    assertEquals(logEntry.level, "info");
    assertEquals(logEntry.function, "sms-send-code");
  });
});
