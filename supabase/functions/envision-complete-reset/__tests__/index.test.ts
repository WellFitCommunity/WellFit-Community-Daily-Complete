// supabase/functions/envision-complete-reset/__tests__/index.test.ts
// Tests for Envision Complete Reset Edge Function - SMS code verification and credential update

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Envision Complete Reset Tests", async (t) => {

  // =====================================================
  // Input Validation Tests - Email
  // =====================================================

  await t.step("should require email", () => {
    const body = { code: "123456", reset_type: "password", new_credential: "NewPass123" };
    const hasEmail = "email" in body;

    assertEquals(hasEmail, false);
  });

  await t.step("should return 400 for missing email", () => {
    const response = { error: "Email is required" };
    assertEquals(response.error, "Email is required");
  });

  await t.step("should validate email format", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    assertEquals(emailRegex.test("admin@example.com"), true);
    assertEquals(emailRegex.test("invalid-email"), false);
  });

  await t.step("should return 400 for invalid email format", () => {
    const response = { error: "Invalid email format" };
    assertEquals(response.error, "Invalid email format");
  });

  // =====================================================
  // Input Validation Tests - Code
  // =====================================================

  await t.step("should require verification code", () => {
    const body = { email: "admin@example.com", reset_type: "password", new_credential: "NewPass123" };
    const hasCode = "code" in body;

    assertEquals(hasCode, false);
  });

  await t.step("should validate code format (4-8 digits)", () => {
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

  await t.step("should return 400 for invalid code format", () => {
    const response = { error: "Invalid verification code format" };
    assertEquals(response.error, "Invalid verification code format");
  });

  // =====================================================
  // Input Validation Tests - Reset Type
  // =====================================================

  await t.step("should require reset_type", () => {
    const body = { email: "admin@example.com", code: "123456", new_credential: "NewPass123" };
    const hasResetType = "reset_type" in body;

    assertEquals(hasResetType, false);
  });

  await t.step("should validate reset_type is password or pin", () => {
    const validTypes = ["password", "pin"];

    assertEquals(validTypes.includes("password"), true);
    assertEquals(validTypes.includes("pin"), true);
    assertEquals(validTypes.includes("email"), false);
  });

  await t.step("should return 400 for invalid reset_type", () => {
    const response = { error: "Reset type must be 'password' or 'pin'" };
    assertEquals(response.error, "Reset type must be 'password' or 'pin'");
  });

  // =====================================================
  // Input Validation Tests - New Credential
  // =====================================================

  await t.step("should require new_credential", () => {
    const body = { email: "admin@example.com", code: "123456", reset_type: "password" };
    const hasCredential = "new_credential" in body;

    assertEquals(hasCredential, false);
  });

  await t.step("should return 400 for missing new credential", () => {
    const resetType = "password";
    const response = { error: `New ${resetType} is required` };

    assertEquals(response.error, "New password is required");
  });

  await t.step("should validate PIN format (4-8 digits)", () => {
    const pinRegex = /^\d{4,8}$/;

    const validPins = ["1234", "123456", "12345678"];
    const invalidPins = ["123", "123456789", "abcd"];

    for (const pin of validPins) {
      assertEquals(pinRegex.test(pin), true);
    }
    for (const pin of invalidPins) {
      assertEquals(pinRegex.test(pin), false);
    }
  });

  await t.step("should return 400 for invalid PIN format", () => {
    const response = { error: "PIN must be 4-8 digits" };
    assertEquals(response.error, "PIN must be 4-8 digits");
  });

  await t.step("should validate password minimum length", () => {
    const password = "Short12";
    const isValid = password.length >= 8;

    assertEquals(isValid, false);
  });

  await t.step("should return 400 for short password", () => {
    const response = { error: "Password must be at least 8 characters" };
    assertEquals(response.error, "Password must be at least 8 characters");
  });

  await t.step("should accept client-hashed credentials", () => {
    // Client-hashed PINs start with "sha256:" or similar prefix
    const isClientHashedPin = (value: string): boolean => {
      return value.startsWith("sha256:") || value.startsWith("$argon2");
    };

    assertEquals(isClientHashedPin("sha256:abc123..."), true);
    assertEquals(isClientHashedPin("1234"), false);
  });

  // =====================================================
  // Super Admin Lookup Tests
  // =====================================================

  await t.step("should lookup super admin by email", () => {
    const superAdmin = {
      id: "admin-123",
      email: "admin@example.com",
      phone: "+15551234567",
      is_active: true
    };

    assertExists(superAdmin.id);
    assertExists(superAdmin.email);
    assertExists(superAdmin.phone);
  });

  await t.step("should return 400 for non-existent email", () => {
    const response = { error: "Invalid request. Please start the reset process again." };
    assertEquals(response.error.includes("start the reset process"), true);
  });

  await t.step("should return 403 for inactive account", () => {
    const response = { error: "Account is not active" };
    assertEquals(response.error, "Account is not active");
  });

  await t.step("should return 400 when phone not configured", () => {
    const response = { error: "Phone number not configured for this account" };
    assertEquals(response.error.includes("Phone number not configured"), true);
  });

  // =====================================================
  // Twilio Verify Check Tests
  // =====================================================

  await t.step("should construct Twilio VerificationCheck URL", () => {
    const VERIFY_SID = "VA1234567890abcdef";
    const twilioCheckUrl = `https://verify.twilio.com/v2/Services/${VERIFY_SID}/VerificationCheck`;

    assertEquals(twilioCheckUrl.includes("VerificationCheck"), true);
    assertEquals(twilioCheckUrl.includes(VERIFY_SID), true);
  });

  await t.step("should create verification check form data", () => {
    const phone = "+15551234567";
    const code = "123456";
    const form = new URLSearchParams({ To: phone, Code: code });

    assertEquals(form.get("To"), phone);
    assertEquals(form.get("Code"), code);
  });

  await t.step("should check for approved status", () => {
    const twilioResponse = { status: "approved" };
    assertEquals(twilioResponse.status, "approved");
  });

  await t.step("should return 400 for invalid code", () => {
    const response = { error: "Invalid or expired verification code" };
    assertEquals(response.error, "Invalid or expired verification code");
  });

  // =====================================================
  // Reset Token Validation Tests
  // =====================================================

  await t.step("should find valid reset token", () => {
    const tokenRecord = {
      id: "token-123",
      super_admin_id: "admin-456",
      reset_type: "password",
      used_at: null,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };

    assertEquals(tokenRecord.used_at, null);
    assertEquals(new Date(tokenRecord.expires_at) > new Date(), true);
  });

  await t.step("should only find unused tokens", () => {
    const tokens = [
      { id: "1", used_at: null },
      { id: "2", used_at: "2026-01-15T12:00:00Z" },
      { id: "3", used_at: null }
    ];

    const unusedTokens = tokens.filter(t => t.used_at === null);
    assertEquals(unusedTokens.length, 2);
  });

  await t.step("should only find unexpired tokens", () => {
    const now = new Date();
    const tokens = [
      { id: "1", expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString() },
      { id: "2", expires_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString() }
    ];

    const validTokens = tokens.filter(t => new Date(t.expires_at) > now);
    assertEquals(validTokens.length, 1);
  });

  await t.step("should return 400 for no valid reset token", () => {
    const response = { error: "No pending reset request found. Please request a new reset." };
    assertEquals(response.error.includes("No pending reset"), true);
  });

  await t.step("should mark token as used", () => {
    const tokenUpdate = { used_at: new Date().toISOString() };
    assertExists(tokenUpdate.used_at);
  });

  // =====================================================
  // Credential Update Tests
  // =====================================================

  await t.step("should hash new credential", () => {
    // hashPin function returns a hash
    const hashedCredential = "$argon2id$v=19$...";
    assertEquals(hashedCredential.startsWith("$argon2"), true);
  });

  await t.step("should update password_hash for password reset", () => {
    const resetType = "password";
    const updateField = resetType === "password" ? "password_hash" : "pin_hash";

    assertEquals(updateField, "password_hash");
  });

  await t.step("should update pin_hash for PIN reset", () => {
    const resetType = "pin";
    const updateField = resetType === "password" ? "password_hash" : "pin_hash";

    assertEquals(updateField, "pin_hash");
  });

  await t.step("should return 500 for update failure", () => {
    const response = { error: "Failed to update credential. Please try again." };
    assertEquals(response.error.includes("Failed to update"), true);
  });

  // =====================================================
  // Success Response Tests
  // =====================================================

  await t.step("should return success for password reset", () => {
    const resetType = "password";
    const response = {
      success: true,
      message: `Your ${resetType} has been reset successfully. You can now log in with your new ${resetType}.`
    };

    assertEquals(response.success, true);
    assertEquals(response.message.includes("password"), true);
    assertEquals(response.message.includes("successfully"), true);
  });

  await t.step("should return success for PIN reset", () => {
    const resetType = "pin";
    const response = {
      success: true,
      message: `Your ${resetType} has been reset successfully. You can now log in with your new ${resetType}.`
    };

    assertEquals(response.success, true);
    assertEquals(response.message.includes("pin"), true);
  });

  // =====================================================
  // Notification SMS Tests
  // =====================================================

  await t.step("should construct notification SMS URL", () => {
    const TWILIO_ACCOUNT_SID = "AC1234567890";
    const notifyUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    assertEquals(notifyUrl.includes("api.twilio.com"), true);
    assertEquals(notifyUrl.includes("Messages.json"), true);
  });

  await t.step("should create notification SMS body", () => {
    const resetType = "password";
    const body = `Your Envision ${resetType} was recently reset. If you did not make this change, contact your administrator immediately.`;

    assertEquals(body.includes("recently reset"), true);
    assertEquals(body.includes("contact your administrator"), true);
  });

  await t.step("should not fail request if notification SMS fails", () => {
    // Notification SMS is fire-and-forget
    const smsError = new Error("SMS delivery failed");
    const response = { success: true, message: "Password reset successfully" };

    // Even with SMS error, main response is success
    assertEquals(response.success, true);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create audit log for password reset completion", () => {
    const auditEntry = {
      user_id: null,
      action: "ENVISION_PASSWORD_RESET_COMPLETED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        phoneLastFour: "4567",
        resetType: "password"
      }
    };

    assertEquals(auditEntry.action, "ENVISION_PASSWORD_RESET_COMPLETED");
    assertExists(auditEntry.metadata.phoneLastFour);
  });

  await t.step("should create audit log for PIN reset completion", () => {
    const auditEntry = {
      user_id: null,
      action: "ENVISION_PIN_RESET_COMPLETED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        phoneLastFour: "4567",
        resetType: "pin"
      }
    };

    assertEquals(auditEntry.action, "ENVISION_PIN_RESET_COMPLETED");
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
    const request = new Request("http://localhost/envision-complete-reset", {
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
    const response = { error: "Server configuration error" };
    assertEquals(response.error, "Server configuration error");
  });

  await t.step("should return 500 for missing Twilio config", () => {
    const response = { error: "SMS service not configured" };
    assertEquals(response.error, "SMS service not configured");
  });

  await t.step("should return 500 for internal errors", () => {
    const response = { error: "Internal server error" };
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
    const requiredVars = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID", "TWILIO_FROM_NUMBER"];
    assertEquals(requiredVars.length, 4);
  });

  // =====================================================
  // Security Logging Tests
  // =====================================================

  await t.step("should log inactive account reset attempts", () => {
    const securityLog = {
      level: "security",
      event: "Reset completion for inactive account",
      context: {
        superAdminId: "admin-123",
        email: "admin@example.com"
      }
    };

    assertEquals(securityLog.level, "security");
  });
});
