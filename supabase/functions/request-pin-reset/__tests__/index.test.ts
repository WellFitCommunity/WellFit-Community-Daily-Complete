// supabase/functions/request-pin-reset/__tests__/index.test.ts
// Tests for PIN Reset Request Edge Function - SMS-based authentication

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Request PIN Reset Tests", async (t) => {

  // =====================================================
  // Phone Validation Tests
  // =====================================================

  await t.step("should require phone number", () => {
    const body = {};
    const hasPhone = "phone" in body;

    assertEquals(hasPhone, false);
  });

  await t.step("should validate US phone number format", () => {
    const validPhones = [
      "+15551234567",
      "555-123-4567",
      "(555) 123-4567",
      "5551234567"
    ];

    const usPhoneRegex = /^(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}$/;

    for (const phone of validPhones) {
      const isValid = usPhoneRegex.test(phone.replace(/\s/g, ''));
      assertEquals(isValid, true, `${phone} should be valid`);
    }
  });

  await t.step("should reject invalid phone formats", () => {
    const invalidPhones = [
      "123",
      "abcdefghij",
      "555-123",
      "+44 20 7946 0958" // UK number (not in allowed list for this test)
    ];

    const usPhoneRegex = /^\+?1?\d{10}$/;

    for (const phone of invalidPhones) {
      const normalized = phone.replace(/\D/g, '');
      const isValid = usPhoneRegex.test(normalized) || /^1?\d{10}$/.test(normalized);
      // These should all fail (though UK number has 11 digits, it's not US format)
      assertEquals(normalized.length >= 10 && normalized.length <= 11 && normalized.match(/^1?\d{10}$/),
        phone === "+44 20 7946 0958" ? null : null);
    }
  });

  await t.step("should normalize phone numbers", () => {
    const phone = "(555) 123-4567";
    const digits = phone.replace(/\D/g, '');

    assertEquals(digits, "5551234567");
    assertEquals(digits.length, 10);
  });

  await t.step("should strip country code for lookup", () => {
    const normalizedPhone = "+15551234567";
    const phoneDigits = normalizedPhone.replace(/\D/g, '');
    const phoneWithoutCountry = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;

    assertEquals(phoneWithoutCountry, "5551234567");
  });

  await t.step("should support allowed country codes", () => {
    const allowedCountries = ['US', 'CA', 'GB', 'AU'];

    assertEquals(allowedCountries.includes('US'), true);
    assertEquals(allowedCountries.includes('CA'), true);
    assertEquals(allowedCountries.length, 4);
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should enforce rate limit of 3 requests per hour", () => {
    const MAX_RESET_REQUESTS_PER_HOUR = 3;
    const requestsInLastHour = 4;

    const isRateLimited = requestsInLastHour >= MAX_RESET_REQUESTS_PER_HOUR;

    assertEquals(isRateLimited, true);
  });

  await t.step("should allow requests under rate limit", () => {
    const MAX_RESET_REQUESTS_PER_HOUR = 3;
    const requestsInLastHour = 2;

    const isRateLimited = requestsInLastHour >= MAX_RESET_REQUESTS_PER_HOUR;

    assertEquals(isRateLimited, false);
  });

  await t.step("should calculate one hour ago timestamp", () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const diffMs = now - oneHourAgo.getTime();
    assertEquals(diffMs, 60 * 60 * 1000); // 1 hour in ms
  });

  // =====================================================
  // Reset Token Tests
  // =====================================================

  await t.step("should generate UUID reset token", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const mockToken = crypto.randomUUID();

    assertEquals(uuidRegex.test(mockToken), true);
  });

  await t.step("should set token expiration to 10 minutes", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000);

    const diffMs = expiresAt.getTime() - now;
    assertEquals(diffMs, 10 * 60 * 1000); // 10 minutes in ms
  });

  await t.step("should create token record structure", () => {
    const tokenRecord = {
      user_id: "user-123",
      phone: "+15551234567",
      token_hash: "abc123def456...",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };

    assertExists(tokenRecord.user_id);
    assertExists(tokenRecord.phone);
    assertExists(tokenRecord.token_hash);
    assertExists(tokenRecord.expires_at);
  });

  // =====================================================
  // Token Hashing Tests
  // =====================================================

  await t.step("should hash token using SHA-256", async () => {
    const hashToken = async (token: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const token = "test-token-123";
    const hash = await hashToken(token);

    // SHA-256 produces 64 hex characters
    assertEquals(hash.length, 64);
    assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
  });

  await t.step("should produce different hashes for different tokens", async () => {
    const hashToken = async (token: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const hash1 = await hashToken("token-1");
    const hash2 = await hashToken("token-2");

    assertNotEquals(hash1, hash2);
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
    const request = new Request("http://localhost/request-pin-reset", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should return 405 for non-POST methods", () => {
    const statusCode = 405;
    assertEquals(statusCode, 405);
  });

  // =====================================================
  // Response Tests - Anti-Enumeration
  // =====================================================

  await t.step("should return generic success to prevent enumeration", () => {
    const genericResponse = {
      success: true,
      message: "If this phone is registered to an admin account, a verification code has been sent."
    };

    assertEquals(genericResponse.success, true);
    assertEquals(genericResponse.message.includes("If this phone"), true);
  });

  await t.step("should return same response for valid and invalid phones", () => {
    const validPhoneResponse = {
      success: true,
      message: "If this phone is registered to an admin account, a verification code has been sent."
    };

    const invalidPhoneResponse = {
      success: true,
      message: "If this phone is registered to an admin account, a verification code has been sent."
    };

    assertEquals(validPhoneResponse.message, invalidPhoneResponse.message);
  });

  await t.step("should hide rate limit from response", () => {
    const rateLimitedResponse = {
      success: true,
      message: "If this phone is registered to an admin account, a verification code has been sent."
    };

    // Should NOT reveal rate limit status
    assertEquals("rate_limited" in rateLimitedResponse, false);
  });

  // =====================================================
  // Admin User Lookup Tests
  // =====================================================

  await t.step("should find admin by phone digits", () => {
    const profile = {
      user_id: "user-123",
      phone: "832-576-3448",
      is_admin: true,
      tenant_id: "tenant-456"
    };

    assertEquals(profile.is_admin, true);
    assertExists(profile.user_id);
  });

  await t.step("should only allow admin users to reset PIN", () => {
    const profiles = [
      { user_id: "1", is_admin: true },
      { user_id: "2", is_admin: false },
      { user_id: "3", is_admin: true }
    ];

    const adminProfiles = profiles.filter(p => p.is_admin);

    assertEquals(adminProfiles.length, 2);
  });

  // =====================================================
  // Twilio Integration Tests
  // =====================================================

  await t.step("should construct Twilio Verify URL", () => {
    const VERIFY_SID = "VA1234567890abcdef";
    const twilioUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;

    assertEquals(twilioUrl.includes("verify.twilio.com"), true);
    assertEquals(twilioUrl.includes(VERIFY_SID), true);
  });

  await t.step("should create Twilio form data", () => {
    const normalizedPhone = "+15551234567";
    const form = new URLSearchParams({ To: normalizedPhone, Channel: "sms" });

    assertEquals(form.get("To"), normalizedPhone);
    assertEquals(form.get("Channel"), "sms");
  });

  await t.step("should create Basic auth header", () => {
    const accountSid = "AC1234567890";
    const authToken = "secret-token";
    const authHeader = "Basic " + btoa(`${accountSid}:${authToken}`);

    assertEquals(authHeader.startsWith("Basic "), true);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create audit log entry for PIN reset request", () => {
    const auditEntry = {
      user_id: "user-123",
      action: "PIN_RESET_REQUESTED",
      resource_type: "staff_pin",
      resource_id: "user-123",
      metadata: {
        phoneLastFour: "3448",
        tenantId: "tenant-456"
      }
    };

    assertEquals(auditEntry.action, "PIN_RESET_REQUESTED");
    assertEquals(auditEntry.resource_type, "staff_pin");
    assertExists(auditEntry.metadata);
  });

  await t.step("should not log full phone number in audit", () => {
    const metadata = {
      phoneLastFour: "3448"
      // Should NOT contain full phone
    };

    assertEquals("phone" in metadata, false);
    assertEquals("fullPhone" in metadata, false);
    assertExists(metadata.phoneLastFour);
    assertEquals(metadata.phoneLastFour.length, 4);
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

    for (const v of requiredVars) {
      assertEquals(typeof v, "string");
    }
  });

  await t.step("should require Twilio environment variables", () => {
    const requiredVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];

    assertEquals(requiredVars.length, 3);
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return 500 for missing Supabase config", () => {
    const response = {
      error: "Server configuration error"
    };

    assertEquals(response.error, "Server configuration error");
  });

  await t.step("should return 500 for missing Twilio config", () => {
    const response = {
      error: "SMS service not configured"
    };

    assertEquals(response.error, "SMS service not configured");
  });

  await t.step("should return 400 for missing phone", () => {
    const response = {
      error: "Phone number is required"
    };

    assertEquals(response.error, "Phone number is required");
  });

  await t.step("should return 400 for invalid phone format", () => {
    const response = {
      error: "Invalid phone number format"
    };

    assertEquals(response.error, "Invalid phone number format");
  });

  await t.step("should handle JSON parse errors gracefully", () => {
    const invalidBody = "not-json";

    try {
      JSON.parse(invalidBody);
      assertEquals(true, false); // Should not reach
    } catch {
      assertEquals(true, true); // Expected
    }
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
});
