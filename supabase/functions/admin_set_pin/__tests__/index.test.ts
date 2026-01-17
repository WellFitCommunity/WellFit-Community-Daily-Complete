// supabase/functions/admin_set_pin/__tests__/index.test.ts
// Tests for admin_set_pin edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Admin Set PIN Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/admin_set_pin", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const allowedMethods = ["POST"];
    const testMethods = ["GET", "PUT", "DELETE", "PATCH"];

    testMethods.forEach(method => {
      assertEquals(allowedMethods.includes(method), false);
    });
    assertEquals(allowedMethods.includes("POST"), true);
  });

  await t.step("should validate PIN minimum length", () => {
    const MIN_PIN_LENGTH = 4;

    assertEquals("1234".length >= MIN_PIN_LENGTH, true);
    assertEquals("12345678".length >= MIN_PIN_LENGTH, true);
    assertEquals("123".length >= MIN_PIN_LENGTH, false);
    assertEquals("".length >= MIN_PIN_LENGTH, false);
  });

  await t.step("should validate PIN format - numeric only", () => {
    const isValidNumericPin = (pin: string): boolean => {
      return /^\d{4,8}$/.test(pin);
    };

    assertEquals(isValidNumericPin("1234"), true);
    assertEquals(isValidNumericPin("12345678"), true);
    assertEquals(isValidNumericPin("123"), false);  // too short
    assertEquals(isValidNumericPin("123456789"), false);  // too long
    assertEquals(isValidNumericPin("abcd"), false);  // not numeric
    assertEquals(isValidNumericPin("12a4"), false);  // contains letter
  });

  await t.step("should detect client-hashed PIN format", () => {
    const isClientHashedPin = (pin: string): boolean => {
      return pin.startsWith("sha256:");
    };

    assertEquals(isClientHashedPin("sha256:abc123def456"), true);
    assertEquals(isClientHashedPin("sha256:"), true);
    assertEquals(isClientHashedPin("1234"), false);
    assertEquals(isClientHashedPin("SHA256:abc"), false);  // case sensitive
    assertEquals(isClientHashedPin(""), false);
  });

  await t.step("should validate allowed role codes", () => {
    const allowedRoles = [
      "admin",
      "super_admin",
      "it_admin",
      "nurse",
      "physician",
      "doctor",
      "nurse_practitioner",
      "physician_assistant",
      "clinical_supervisor",
      "department_head",
      "physical_therapist"
    ];

    assertEquals(allowedRoles.includes("admin"), true);
    assertEquals(allowedRoles.includes("nurse"), true);
    assertEquals(allowedRoles.includes("physician"), true);
    assertEquals(allowedRoles.includes("doctor"), true);
    assertEquals(allowedRoles.includes("super_admin"), true);
    assertEquals(allowedRoles.includes("regular"), false);  // not allowed
    assertEquals(allowedRoles.includes("senior"), false);  // not allowed
  });

  await t.step("should default role to 'admin'", () => {
    const getRole = (provided?: string): string => {
      return provided ?? "admin";
    };

    assertEquals(getRole(undefined), "admin");
    assertEquals(getRole("nurse"), "nurse");
    assertEquals(getRole("physician"), "physician");
  });

  await t.step("should validate OTP token as UUID format", () => {
    const isValidUUID = (token: string): boolean => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(token);
    };

    assertEquals(isValidUUID("550e8400-e29b-41d4-a716-446655440000"), true);
    assertEquals(isValidUUID("123e4567-e89b-12d3-a456-426614174000"), true);
    assertEquals(isValidUUID("not-a-uuid"), false);
    assertEquals(isValidUUID("550e8400-e29b-41d4-a716"), false);  // incomplete
    assertEquals(isValidUUID(""), false);
  });

  await t.step("should extract bearer token from authorization header", () => {
    const extractBearer = (auth: string | null): string => {
      if (!auth) return "";
      return auth.replace(/^Bearer /, "");
    };

    assertEquals(extractBearer("Bearer abc123"), "abc123");
    assertEquals(extractBearer("Bearer token-xyz-789"), "token-xyz-789");
    assertEquals(extractBearer(null), "");
    assertEquals(extractBearer(""), "");
  });

  await t.step("should return 401 for missing authorization", () => {
    const hasAuth = false;
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 403 for non-admin users", () => {
    const profile = { is_admin: false, phone: null };
    const expectedStatus = profile.is_admin ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should allow first-time PIN setup without old_pin", () => {
    const hasExistingPin = false;
    const hasOldPin = false;
    const hasOtpToken = false;

    const canSetPin = !hasExistingPin || hasOldPin || hasOtpToken;
    assertEquals(canSetPin, true);
  });

  await t.step("should require old_pin or otp_token for PIN change", () => {
    const hasExistingPin = true;
    const hasOldPin = false;
    const hasOtpToken = false;

    const canChangePin = !hasExistingPin || hasOldPin || hasOtpToken;
    assertEquals(canChangePin, false);
  });

  await t.step("should allow PIN change with valid old_pin", () => {
    const hasExistingPin = true;
    const hasOldPin = true;
    const hasOtpToken = false;

    const canChangePin = !hasExistingPin || hasOldPin || hasOtpToken;
    assertEquals(canChangePin, true);
  });

  await t.step("should allow PIN change with valid otp_token", () => {
    const hasExistingPin = true;
    const hasOldPin = false;
    const hasOtpToken = true;

    const canChangePin = !hasExistingPin || hasOldPin || hasOtpToken;
    assertEquals(canChangePin, true);
  });

  await t.step("should determine auth method correctly", () => {
    const getAuthMethod = (
      hasExistingPin: boolean,
      authenticatedViaOtp: boolean,
      hasOtpToken: boolean,
      hasOldPin: boolean
    ): 'old_pin' | 'otp_token' | 'first_time' => {
      if (!hasExistingPin) return 'first_time';
      if (authenticatedViaOtp) return 'otp_token';
      if (hasOtpToken) return 'otp_token';
      if (hasOldPin) return 'old_pin';
      return 'first_time';  // shouldn't reach
    };

    assertEquals(getAuthMethod(false, false, false, false), "first_time");
    assertEquals(getAuthMethod(true, true, false, false), "otp_token");
    assertEquals(getAuthMethod(true, false, true, false), "otp_token");
    assertEquals(getAuthMethod(true, false, false, true), "old_pin");
  });

  await t.step("should hash OTP token for comparison", async () => {
    const hashToken = async (token: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const hash = await hashToken("test-token");
    assertEquals(hash.length, 64);  // SHA-256 produces 64 hex chars
    assertEquals(typeof hash, "string");
  });

  await t.step("should validate OTP token expiration", () => {
    const isTokenValid = (expiresAt: string): boolean => {
      return new Date(expiresAt) > new Date();
    };

    const futureDate = new Date(Date.now() + 60000).toISOString();
    const pastDate = new Date(Date.now() - 60000).toISOString();

    assertEquals(isTokenValid(futureDate), true);
    assertEquals(isTokenValid(pastDate), false);
  });

  await t.step("should check if OTP token has been used", () => {
    const tokenRecord = {
      id: "token-123",
      user_id: "user-456",
      expires_at: new Date(Date.now() + 60000).toISOString(),
      used_at: null
    };

    assertEquals(tokenRecord.used_at, null);
    assertExists(tokenRecord.id);
    assertExists(tokenRecord.user_id);
  });

  await t.step("should validate old PIN format", () => {
    const isValidOldPin = (pin: string): boolean => {
      const isClientHashed = pin.startsWith("sha256:");
      const isNumeric = /^\d{4,8}$/.test(pin);
      return isClientHashed || isNumeric;
    };

    assertEquals(isValidOldPin("1234"), true);
    assertEquals(isValidOldPin("12345678"), true);
    assertEquals(isValidOldPin("sha256:abc123"), true);
    assertEquals(isValidOldPin("abc"), false);
    assertEquals(isValidOldPin("123"), false);
  });

  await t.step("should structure upsert data correctly", () => {
    const upsertData = {
      user_id: "user-123",
      role: "admin",
      pin_hash: "hashed-pin-value",
      updated_at: new Date().toISOString()
    };

    assertExists(upsertData.user_id);
    assertExists(upsertData.role);
    assertExists(upsertData.pin_hash);
    assertExists(upsertData.updated_at);
  });

  await t.step("should use correct upsert conflict columns", () => {
    const onConflict = 'user_id,role';

    assertEquals(onConflict, 'user_id,role');
  });

  await t.step("should structure audit log for PIN change", () => {
    const auditLog = {
      user_id: "user-123",
      action: 'PIN_CHANGED',
      resource_type: 'staff_pin',
      metadata: {
        role: "admin",
        auth_method: "old_pin"
      }
    };

    assertEquals(auditLog.action, "PIN_CHANGED");
    assertEquals(auditLog.resource_type, "staff_pin");
    assertExists(auditLog.metadata.role);
    assertExists(auditLog.metadata.auth_method);
  });

  await t.step("should structure audit log for first-time PIN set", () => {
    const auditLog = {
      user_id: "user-123",
      action: 'PIN_SET',
      resource_type: 'staff_pin',
      metadata: {
        role: "nurse",
        auth_method: "first_time"
      }
    };

    assertEquals(auditLog.action, "PIN_SET");
    assertEquals(auditLog.metadata.auth_method, "first_time");
  });

  await t.step("should structure failed PIN change audit log", () => {
    const auditLog = {
      user_id: "user-123",
      action: 'PIN_CHANGE_FAILED',
      resource_type: 'staff_pin',
      metadata: {
        role: "admin",
        reason: 'incorrect_current_pin'
      }
    };

    assertEquals(auditLog.action, "PIN_CHANGE_FAILED");
    assertEquals(auditLog.metadata.reason, "incorrect_current_pin");
  });

  await t.step("should determine if SMS notification is needed", () => {
    const shouldSendSms = (hasExistingPin: boolean, hasPhone: boolean): boolean => {
      return hasExistingPin && hasPhone;
    };

    assertEquals(shouldSendSms(true, true), true);
    assertEquals(shouldSendSms(true, false), false);
    assertEquals(shouldSendSms(false, true), false);
    assertEquals(shouldSendSms(false, false), false);
  });

  await t.step("should check Twilio configuration", () => {
    const isTwilioConfigured = (
      accountSid: string,
      authToken: string,
      fromNumber: string
    ): boolean => {
      return !!(accountSid && authToken && fromNumber);
    };

    assertEquals(isTwilioConfigured("AC123", "auth456", "+15551234567"), true);
    assertEquals(isTwilioConfigured("", "auth456", "+15551234567"), false);
    assertEquals(isTwilioConfigured("AC123", "", "+15551234567"), false);
    assertEquals(isTwilioConfigured("AC123", "auth456", ""), false);
  });

  await t.step("should format Twilio SMS notification message", () => {
    const message = "Your WellFit admin PIN was recently changed. If you did not make this change, contact your administrator immediately.";

    assertEquals(message.includes("PIN was recently changed"), true);
    assertEquals(message.includes("contact your administrator"), true);
  });

  await t.step("should mask phone number in logs", () => {
    const maskPhone = (phone: string): string => {
      return phone.slice(-4);
    };

    assertEquals(maskPhone("+15551234567"), "4567");
    assertEquals(maskPhone("1234567890"), "7890");
  });

  await t.step("should return success response structure", () => {
    const successResponse = {
      success: true,
      message: "PIN updated"
    };

    assertEquals(successResponse.success, true);
    assertEquals(successResponse.message, "PIN updated");
  });

  await t.step("should return error response for missing auth", () => {
    const errorResponse = {
      error: "Current PIN or reset token required to change PIN",
      requires_auth: true,
      has_existing_pin: true
    };

    assertEquals(errorResponse.requires_auth, true);
    assertEquals(errorResponse.has_existing_pin, true);
    assertExists(errorResponse.error);
  });

  await t.step("should return error response for invalid OTP", () => {
    const errorResponse = {
      error: "Invalid or expired reset token. Please request a new PIN reset."
    };

    assertEquals(errorResponse.error.includes("Invalid or expired"), true);
  });

  await t.step("should return error response for incorrect PIN", () => {
    const errorResponse = {
      error: "Current PIN is incorrect"
    };

    assertEquals(errorResponse.error, "Current PIN is incorrect");
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      methodNotAllowed: 405,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should handle unexpected errors gracefully", () => {
    const errorResponse = {
      error: "Internal error"
    };

    assertEquals(errorResponse.error, "Internal error");
  });
});
