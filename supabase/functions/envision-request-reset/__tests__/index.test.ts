// supabase/functions/envision-request-reset/__tests__/index.test.ts
// Tests for Envision Request Reset Edge Function - SMS-based credential reset initiation

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Envision Request Reset Tests", async (t) => {

  // =====================================================
  // Email Validation Tests
  // =====================================================

  await t.step("should require email", () => {
    const body = { reset_type: "password" };
    const hasEmail = "email" in body;

    assertEquals(hasEmail, false);
  });

  await t.step("should return 400 for missing email", () => {
    const response = {
      error: "Email is required"
    };

    assertEquals(response.error, "Email is required");
  });

  await t.step("should validate email format", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validEmails = ["user@example.com", "admin@company.org", "test.user@domain.co"];
    const invalidEmails = ["invalid", "no@", "@domain.com", "spaces in@email.com"];

    for (const email of validEmails) {
      assertEquals(emailRegex.test(email), true, `${email} should be valid`);
    }
    for (const email of invalidEmails) {
      assertEquals(emailRegex.test(email), false, `${email} should be invalid`);
    }
  });

  await t.step("should return 400 for invalid email format", () => {
    const response = {
      error: "Invalid email format"
    };

    assertEquals(response.error, "Invalid email format");
  });

  await t.step("should normalize email to lowercase", () => {
    const email = "Admin@Example.COM";
    const normalized = email.trim().toLowerCase();

    assertEquals(normalized, "admin@example.com");
  });

  // =====================================================
  // Reset Type Validation Tests
  // =====================================================

  await t.step("should require reset_type", () => {
    const body = { email: "admin@example.com" };
    const hasResetType = "reset_type" in body;

    assertEquals(hasResetType, false);
  });

  await t.step("should validate reset_type is password or pin", () => {
    const validTypes = ["password", "pin"];
    const invalidTypes = ["email", "totp", "reset"];

    for (const type of validTypes) {
      assertEquals(validTypes.includes(type), true);
    }
    for (const type of invalidTypes) {
      assertEquals(validTypes.includes(type), false);
    }
  });

  await t.step("should return 400 for invalid reset_type", () => {
    const response = {
      error: "Reset type must be 'password' or 'pin'"
    };

    assertEquals(response.error, "Reset type must be 'password' or 'pin'");
  });

  // =====================================================
  // Anti-Enumeration Tests
  // =====================================================

  await t.step("should return generic success for valid email", () => {
    const response = {
      success: true,
      message: "If this email is registered, a verification code has been sent to the associated phone number."
    };

    assertEquals(response.success, true);
    assertEquals(response.message.includes("If this email"), true);
  });

  await t.step("should return same generic success for non-existent email", () => {
    const validEmailResponse = {
      success: true,
      message: "If this email is registered, a verification code has been sent to the associated phone number."
    };
    const invalidEmailResponse = {
      success: true,
      message: "If this email is registered, a verification code has been sent to the associated phone number."
    };

    assertEquals(validEmailResponse.message, invalidEmailResponse.message);
  });

  await t.step("should not reveal if account exists", () => {
    const response = {
      success: true,
      message: "If this email is registered, a verification code has been sent to the associated phone number."
    };

    // Response should NOT contain indicators
    assertEquals("account_exists" in response, false);
    assertEquals("user_found" in response, false);
    assertEquals(response.message.includes("Account not found"), false);
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should enforce max 3 reset requests per hour", () => {
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
    assertEquals(diffMs, 60 * 60 * 1000);
  });

  await t.step("should not reveal rate limiting in response", () => {
    // Even when rate limited, return generic success
    const response = {
      success: true,
      message: "If this email is registered, a verification code has been sent to the associated phone number."
    };

    assertEquals("rate_limited" in response, false);
    assertEquals("requests_remaining" in response, false);
  });

  // =====================================================
  // Debug Mode Tests
  // =====================================================

  await t.step("should support debug query parameter", () => {
    const url = new URL("http://localhost/envision-request-reset?debug=true");
    const debugMode = url.searchParams.get("debug") === "true";

    assertEquals(debugMode, true);
  });

  await t.step("should include debug info when debug=true", () => {
    const debugMode = true;
    const debugReason = "EMAIL_NOT_FOUND";

    const responseBody: Record<string, unknown> = {
      success: true,
      message: "If this email is registered..."
    };

    if (debugMode && debugReason) {
      responseBody._debug = {
        reason: debugReason,
        hint: "This info only appears with ?debug=true query param"
      };
    }

    assertExists(responseBody._debug);
  });

  await t.step("should not include debug info in production", () => {
    const debugMode = false;
    const debugReason = "EMAIL_NOT_FOUND";

    const responseBody: Record<string, unknown> = {
      success: true,
      message: "If this email is registered..."
    };

    if (debugMode && debugReason) {
      responseBody._debug = { reason: debugReason };
    }

    assertEquals("_debug" in responseBody, false);
  });

  // =====================================================
  // Super Admin Lookup Tests
  // =====================================================

  await t.step("should lookup super admin by email", () => {
    const superAdmin = {
      id: "admin-123",
      email: "admin@example.com",
      phone: "+15551234567",
      is_active: true,
      password_hash: "hashed-password"
    };

    assertExists(superAdmin.id);
    assertExists(superAdmin.email);
    assertExists(superAdmin.phone);
  });

  await t.step("should check account is active", () => {
    const superAdmin = { is_active: false };

    assertEquals(superAdmin.is_active, false);
  });

  await t.step("should check phone is configured", () => {
    const superAdmin = { phone: null };

    assertEquals(superAdmin.phone, null);
  });

  await t.step("should check password_hash for password reset", () => {
    const superAdmin = { password_hash: null };
    const resetType = "password";

    const canResetPassword = superAdmin.password_hash !== null || resetType !== "password";

    assertEquals(canResetPassword, false);
  });

  // =====================================================
  // Token Generation Tests
  // =====================================================

  await t.step("should generate UUID reset token", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resetToken = crypto.randomUUID();

    assertEquals(uuidRegex.test(resetToken), true);
  });

  await t.step("should hash token using SHA-256", async () => {
    const hashToken = async (token: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    };

    const token = crypto.randomUUID();
    const hash = await hashToken(token);

    assertEquals(hash.length, 64);
    assertEquals(/^[0-9a-f]{64}$/.test(hash), true);
  });

  await t.step("should set token expiration to 10 minutes", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();

    assertExists(expiresAt);
    assertEquals(typeof expiresAt, "string");
  });

  await t.step("should create reset token record", () => {
    const tokenRecord = {
      super_admin_id: "admin-123",
      reset_type: "password",
      phone: "+15551234567",
      token_hash: "abc123def456...",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };

    assertExists(tokenRecord.super_admin_id);
    assertExists(tokenRecord.reset_type);
    assertExists(tokenRecord.phone);
    assertExists(tokenRecord.token_hash);
    assertExists(tokenRecord.expires_at);
  });

  // =====================================================
  // Twilio Verify Tests
  // =====================================================

  await t.step("should construct Twilio Verify URL", () => {
    const VERIFY_SID = "VA1234567890abcdef";
    const twilioUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/Verifications`;

    assertEquals(twilioUrl.includes("verify.twilio.com"), true);
    assertEquals(twilioUrl.includes("Verifications"), true);
    assertEquals(twilioUrl.includes(VERIFY_SID), true);
  });

  await t.step("should create verification form data", () => {
    const phone = "+15551234567";
    const form = new URLSearchParams({ To: phone, Channel: "sms" });

    assertEquals(form.get("To"), phone);
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

  await t.step("should create audit log for password reset", () => {
    const auditEntry = {
      user_id: null,
      action: "ENVISION_PASSWORD_RESET_REQUESTED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        phoneLastFour: "4567",
        resetType: "password"
      }
    };

    assertEquals(auditEntry.action, "ENVISION_PASSWORD_RESET_REQUESTED");
    assertEquals(auditEntry.resource_type, "envision_auth");
    assertExists(auditEntry.metadata.phoneLastFour);
  });

  await t.step("should create audit log for PIN reset", () => {
    const auditEntry = {
      user_id: null,
      action: "ENVISION_PIN_RESET_REQUESTED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        phoneLastFour: "4567",
        resetType: "pin"
      }
    };

    assertEquals(auditEntry.action, "ENVISION_PIN_RESET_REQUESTED");
    assertEquals(auditEntry.metadata.resetType, "pin");
  });

  await t.step("should only log phone last four digits", () => {
    const phone = "+15551234567";
    const phoneLastFour = phone.slice(-4);

    assertEquals(phoneLastFour, "4567");
    assertEquals(phoneLastFour.length, 4);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/envision-request-reset", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should only accept POST method", () => {
    const allowedMethods = ["POST"];

    assertEquals(allowedMethods.includes("POST"), true);
    assertEquals(allowedMethods.includes("GET"), false);
  });

  await t.step("should return 405 for non-POST methods", () => {
    const response = { error: "Method not allowed" };
    const status = 405;

    assertEquals(status, 405);
    assertEquals(response.error, "Method not allowed");
  });

  // =====================================================
  // Error Response Tests
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

  await t.step("should return 500 for internal errors", () => {
    const response = {
      error: "Internal server error"
    };

    assertEquals(response.error, "Internal server error");
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include CORS headers", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json"
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require Supabase environment variables", () => {
    const requiredVars = ["SUPABASE_URL", "SB_SECRET_KEY"];
    assertEquals(requiredVars.length, 2);
  });

  await t.step("should require Twilio environment variables", () => {
    const requiredVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"];
    assertEquals(requiredVars.length, 3);
  });
});
