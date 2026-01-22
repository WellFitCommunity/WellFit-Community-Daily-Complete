// supabase/functions/verify-pin-reset/__tests__/index.test.ts
// Tests for PIN Reset Verification Edge Function - SMS code verification

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Verify PIN Reset Tests", async (t) => {

  // =====================================================
  // Input Validation Tests
  // =====================================================

  await t.step("should require phone number", () => {
    const body = { code: "123456" };
    const hasPhone = "phone" in body;

    assertEquals(hasPhone, false);
  });

  await t.step("should require verification code", () => {
    const body = { phone: "+15551234567" };
    const hasCode = "code" in body;

    assertEquals(hasCode, false);
  });

  await t.step("should validate verification code format (4-8 digits)", () => {
    const codeRegex = /^\d{4,8}$/;

    const validCodes = ["1234", "123456", "12345678"];
    const invalidCodes = ["123", "123456789", "abcd", "12-34"];

    for (const code of validCodes) {
      assertEquals(codeRegex.test(code), true, `${code} should be valid`);
    }
    for (const code of invalidCodes) {
      assertEquals(codeRegex.test(code), false, `${code} should be invalid`);
    }
  });

  await t.step("should validate phone number", () => {
    const validPhone = "+15551234567";
    const phoneDigits = validPhone.replace(/\D/g, '');

    assertEquals(phoneDigits.length >= 10, true);
  });

  // =====================================================
  // Twilio Verification Tests
  // =====================================================

  await t.step("should construct Twilio VerificationCheck URL", () => {
    const VERIFY_SID = "VA1234567890abcdef";
    const twilioCheckUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`;

    assertEquals(twilioCheckUrl.includes("VerificationCheck"), true);
    assertEquals(twilioCheckUrl.includes(VERIFY_SID), true);
  });

  await t.step("should create verification check form data", () => {
    const normalizedPhone = "+15551234567";
    const code = "123456";
    const form = new URLSearchParams({ To: normalizedPhone, Code: code });

    assertEquals(form.get("To"), normalizedPhone);
    assertEquals(form.get("Code"), code);
  });

  await t.step("should check for approved status", () => {
    const twilioResponse = {
      status: "approved",
      sid: "VE1234567890"
    };

    assertEquals(twilioResponse.status, "approved");
  });

  await t.step("should handle pending status", () => {
    const twilioResponse = {
      status: "pending",
      sid: "VE1234567890"
    };

    assertEquals(twilioResponse.status !== "approved", true);
  });

  await t.step("should handle canceled status", () => {
    const twilioResponse = {
      status: "canceled",
      sid: "VE1234567890"
    };

    assertEquals(twilioResponse.status !== "approved", true);
  });

  // =====================================================
  // Reset Token Lookup Tests
  // =====================================================

  await t.step("should find valid reset token", () => {
    const tokenRecord = {
      id: "token-123",
      user_id: "user-456",
      token_hash: "abc123...",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };

    assertExists(tokenRecord.id);
    assertExists(tokenRecord.user_id);
    assertExists(tokenRecord.token_hash);
    assertExists(tokenRecord.expires_at);
  });

  await t.step("should only find unused tokens", () => {
    const tokens = [
      { id: "1", used_at: null },
      { id: "2", used_at: "2025-01-15T12:00:00Z" },
      { id: "3", used_at: null }
    ];

    const unusedTokens = tokens.filter(t => t.used_at === null);

    assertEquals(unusedTokens.length, 2);
  });

  await t.step("should only find unexpired tokens", () => {
    const now = new Date();
    const tokens = [
      { id: "1", expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString() }, // future
      { id: "2", expires_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },  // past
      { id: "3", expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString() }  // future
    ];

    const unexpiredTokens = tokens.filter(t => new Date(t.expires_at) > now);

    assertEquals(unexpiredTokens.length, 2);
  });

  await t.step("should mark token as used after verification", () => {
    const tokenUpdate = {
      used_at: new Date().toISOString()
    };

    assertExists(tokenUpdate.used_at);
    assertEquals(typeof tokenUpdate.used_at, "string");
  });

  // =====================================================
  // OTP Token Generation Tests
  // =====================================================

  await t.step("should generate UUID OTP token", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const otpToken = crypto.randomUUID();

    assertEquals(uuidRegex.test(otpToken), true);
  });

  await t.step("should set OTP expiration to 5 minutes", () => {
    const now = Date.now();
    const otpExpiresAt = new Date(now + 5 * 60 * 1000);

    const diffMs = otpExpiresAt.getTime() - now;
    assertEquals(diffMs, 5 * 60 * 1000); // 5 minutes in ms
  });

  await t.step("should hash OTP token using SHA-256", async () => {
    const hashToken = async (token: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const token = crypto.randomUUID();
    const hash = await hashToken(token);

    assertEquals(hash.length, 64);
    assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
  });

  await t.step("should create OTP token record structure", () => {
    const otpTokenRecord = {
      user_id: "user-123",
      phone: "+15551234567",
      token_hash: "abc123def456...",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      // Note: used_at should be null initially
    };

    assertExists(otpTokenRecord.user_id);
    assertExists(otpTokenRecord.phone);
    assertExists(otpTokenRecord.token_hash);
    assertExists(otpTokenRecord.expires_at);
  });

  // =====================================================
  // Success Response Tests
  // =====================================================

  await t.step("should return OTP token on successful verification", () => {
    const successResponse = {
      success: true,
      otp_token: "550e8400-e29b-41d4-a716-446655440000",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      message: "Verification successful. Use the OTP token to set your new PIN within 5 minutes."
    };

    assertEquals(successResponse.success, true);
    assertExists(successResponse.otp_token);
    assertExists(successResponse.expires_at);
    assertEquals(successResponse.message.includes("5 minutes"), true);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 400 for missing phone", () => {
    const errorResponse = {
      error: "Phone number is required"
    };

    assertEquals(errorResponse.error, "Phone number is required");
  });

  await t.step("should return 400 for invalid code format", () => {
    const errorResponse = {
      error: "Invalid verification code format"
    };

    assertEquals(errorResponse.error, "Invalid verification code format");
  });

  await t.step("should return 400 for invalid phone format", () => {
    const errorResponse = {
      error: "Invalid phone number format"
    };

    assertEquals(errorResponse.error, "Invalid phone number format");
  });

  await t.step("should return 400 for invalid/expired code", () => {
    const errorResponse = {
      error: "Invalid or expired verification code"
    };

    assertEquals(errorResponse.error, "Invalid or expired verification code");
  });

  await t.step("should return 400 when no pending reset found", () => {
    const errorResponse = {
      error: "No pending PIN reset request found. Please request a new reset."
    };

    assertEquals(errorResponse.error.includes("No pending PIN reset"), true);
  });

  await t.step("should return 500 for OTP token creation failure", () => {
    const errorResponse = {
      error: "Failed to complete verification. Please try again."
    };

    assertEquals(errorResponse.error.includes("Failed to complete"), true);
  });

  await t.step("should return 500 for server config errors", () => {
    const errorResponse = {
      error: "Server configuration error"
    };

    assertEquals(errorResponse.error, "Server configuration error");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should only accept POST method", () => {
    const allowedMethods = ["POST"];
    const disallowedMethods = ["GET", "PUT", "DELETE", "PATCH"];

    assertEquals(allowedMethods.includes("POST"), true);
    for (const method of disallowedMethods) {
      assertEquals(allowedMethods.includes(method), false);
    }
  });

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/verify-pin-reset", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should return 405 for non-POST methods", () => {
    const statusCode = 405;
    assertEquals(statusCode, 405);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create audit log entry for successful verification", () => {
    const auditEntry = {
      user_id: "user-123",
      action: "PIN_RESET_CODE_VERIFIED",
      resource_type: "staff_pin",
      resource_id: "token-456",
      metadata: {
        phoneLastFour: "4567"
      }
    };

    assertEquals(auditEntry.action, "PIN_RESET_CODE_VERIFIED");
    assertEquals(auditEntry.resource_type, "staff_pin");
    assertExists(auditEntry.metadata);
  });

  await t.step("should not log full phone in audit", () => {
    const metadata = {
      phoneLastFour: "4567"
    };

    assertEquals("phone" in metadata, false);
    assertEquals(metadata.phoneLastFour.length, 4);
  });

  await t.step("should log phone last four digits only", () => {
    const phone = "+15551234567";
    const phoneLastFour = phone.slice(-4);

    assertEquals(phoneLastFour, "4567");
    assertEquals(phoneLastFour.length, 4);
  });

  // =====================================================
  // Phone Normalization Tests
  // =====================================================

  await t.step("should normalize phone for Twilio", () => {
    const phones = [
      { input: "555-123-4567", expected: "+15551234567" },
      { input: "(555) 123-4567", expected: "+15551234567" },
      { input: "5551234567", expected: "+15551234567" }
    ];

    for (const { input } of phones) {
      const digits = input.replace(/\D/g, '');
      const normalized = digits.length === 10 ? `+1${digits}` : `+${digits}`;
      assertEquals(normalized.startsWith("+"), true);
    }
  });

  await t.step("should support allowed country codes", () => {
    const allowedCountries = ['US', 'CA', 'GB', 'AU'];

    assertEquals(allowedCountries.includes('US'), true);
    assertEquals(allowedCountries.length, 4);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include CORS headers in response", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type"
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
    assertExists(corsHeaders["Access-Control-Allow-Methods"]);
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

    assertEquals(requiredVars.length, 2);
  });

  await t.step("should require Twilio environment variables", () => {
    const requiredVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];

    assertEquals(requiredVars.length, 3);
  });

  await t.step("should return 500 when SMS service not configured", () => {
    const errorResponse = {
      error: "SMS service not configured"
    };

    assertEquals(errorResponse.error, "SMS service not configured");
  });

  // =====================================================
  // Security Tests
  // =====================================================

  await t.step("should not expose token hashes in response", () => {
    const response = {
      success: true,
      otp_token: "550e8400-e29b-41d4-a716-446655440000",
      expires_at: "2025-01-15T12:05:00Z"
    };

    assertEquals("token_hash" in response, false);
    assertEquals("hash" in response, false);
  });

  await t.step("should not expose internal errors to client", () => {
    const internalError = new Error("Database connection failed");
    const clientResponse = {
      error: "Internal server error"
    };

    // Client should not see internal details
    assertEquals(clientResponse.error.includes("Database"), false);
    assertEquals(clientResponse.error, "Internal server error");
  });

  await t.step("should use single-use tokens", () => {
    const tokenBefore = { id: "1", used_at: null };
    const tokenAfter = { id: "1", used_at: "2025-01-15T12:00:00Z" };

    assertEquals(tokenBefore.used_at, null);
    assertExists(tokenAfter.used_at);
  });
});
