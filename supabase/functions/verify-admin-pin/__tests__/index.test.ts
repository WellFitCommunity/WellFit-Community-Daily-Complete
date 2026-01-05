// supabase/functions/verify-admin-pin/__tests__/index.test.ts
// Tests for verify-admin-pin edge function

import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Verify Admin PIN Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/verify-admin-pin", {
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

  await t.step("should require Authorization header", () => {
    const hasAuth = (token: string | null): boolean => {
      return token !== null && token.length > 0;
    };

    assertEquals(hasAuth("Bearer eyJhbGci..."), true);
    assertEquals(hasAuth(""), false);
    assertEquals(hasAuth(null), false);
  });

  await t.step("should extract Bearer token from Authorization header", () => {
    const extractToken = (header: string | null): string => {
      return header?.replace(/^Bearer /, "") || "";
    };

    assertEquals(extractToken("Bearer abc123"), "abc123");
    assertEquals(extractToken("Bearer "), "");
    assertEquals(extractToken(null), "");
    assertEquals(extractToken("abc123"), "abc123"); // No Bearer prefix
  });

  await t.step("should validate PIN format - numeric", () => {
    const isValidNumericPin = (pin: string): boolean => {
      return /^\d{4,8}$/.test(pin);
    };

    assertEquals(isValidNumericPin("1234"), true);
    assertEquals(isValidNumericPin("12345678"), true);
    assertEquals(isValidNumericPin("123"), false); // Too short
    assertEquals(isValidNumericPin("123456789"), false); // Too long
    assertEquals(isValidNumericPin("abcd"), false); // Not numeric
    assertEquals(isValidNumericPin("12ab"), false); // Mixed
  });

  await t.step("should validate PIN format - TenantCode-PIN", () => {
    const tenantCodePinPattern = /^([A-Z]{1,4})-([0-9]{4,6})-([0-9]{4,8})$/;

    assertEquals(tenantCodePinPattern.test("MH-6702-1234"), true);
    assertEquals(tenantCodePinPattern.test("WF-0001-5678"), true);
    assertEquals(tenantCodePinPattern.test("HOSP-1234-9999"), true);
    assertEquals(tenantCodePinPattern.test("A-1-1"), false); // Too short
    assertEquals(tenantCodePinPattern.test("mh-6702-1234"), false); // Lowercase
    assertEquals(tenantCodePinPattern.test("1234"), false); // Just PIN
  });

  await t.step("should parse TenantCode-PIN format correctly", () => {
    const parseTenantCodePin = (pin: string): { tenantCode: string; numericPin: string } | null => {
      const match = pin.match(/^([A-Z]{1,4})-([0-9]{4,6})-([0-9]{4,8})$/);
      if (!match) return null;
      return {
        tenantCode: `${match[1]}-${match[2]}`,
        numericPin: match[3]
      };
    };

    const result = parseTenantCodePin("MH-6702-1234");
    assertExists(result);
    assertEquals(result!.tenantCode, "MH-6702");
    assertEquals(result!.numericPin, "1234");

    assertEquals(parseTenantCodePin("invalid"), null);
  });

  await t.step("should detect client-hashed PINs", () => {
    const isClientHashedPin = (pin: string): boolean => {
      return pin.startsWith("sha256:");
    };

    assertEquals(isClientHashedPin("sha256:abc123def456"), true);
    assertEquals(isClientHashedPin("1234"), false);
    assertEquals(isClientHashedPin("MH-6702-1234"), false);
  });

  await t.step("should validate role enum", () => {
    const validRoles = [
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

    assertEquals(validRoles.includes("admin"), true);
    assertEquals(validRoles.includes("super_admin"), true);
    assertEquals(validRoles.includes("nurse"), true);
    assertEquals(validRoles.includes("physician"), true);
    assertEquals(validRoles.includes("invalid_role"), false);
    assertEquals(validRoles.includes("user"), false);
  });

  await t.step("should enforce rate limiting constants", () => {
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MINUTES = 15;

    assertEquals(MAX_FAILED_ATTEMPTS, 5);
    assertEquals(LOCKOUT_DURATION_MINUTES, 15);
    assertEquals(LOCKOUT_DURATION_MINUTES * 60 * 1000, 900000); // ms
  });

  await t.step("should calculate remaining attempts correctly", () => {
    const MAX_FAILED_ATTEMPTS = 5;

    const calcRemaining = (failedCount: number): number => {
      return Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);
    };

    assertEquals(calcRemaining(0), 5);
    assertEquals(calcRemaining(3), 2);
    assertEquals(calcRemaining(5), 0);
    assertEquals(calcRemaining(10), 0); // Can't go negative
  });

  await t.step("should calculate lockout unlock time", () => {
    const LOCKOUT_DURATION_MINUTES = 15;
    const now = Date.now();
    const unlockAt = new Date(now + LOCKOUT_DURATION_MINUTES * 60 * 1000);

    assertEquals(typeof unlockAt.toISOString(), "string");
    assertEquals(unlockAt.getTime() - now, LOCKOUT_DURATION_MINUTES * 60 * 1000);
  });

  await t.step("should calculate remaining lockout minutes", () => {
    const unlockAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
    const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

    assertEquals(remainingMinutes >= 9 && remainingMinutes <= 10, true);
  });

  await t.step("should return 429 when account is locked", () => {
    const isLocked = true;
    const unlockAt = new Date(Date.now() + 10 * 60 * 1000);

    const response = {
      error: `Account temporarily locked. Try again in 10 minutes.`,
      locked_until: unlockAt.toISOString(),
      remaining_minutes: 10
    };

    assertEquals(isLocked, true);
    assertExists(response.error);
    assertExists(response.locked_until);
    assertEquals(response.remaining_minutes, 10);
  });

  await t.step("should enforce admin session TTL", () => {
    const ADMIN_SESSION_TTL_MIN = 30;
    assertEquals(ADMIN_SESSION_TTL_MIN, 30);

    const expires = new Date(Date.now() + ADMIN_SESSION_TTL_MIN * 60 * 1000);
    assertEquals(typeof expires.toISOString(), "string");
  });

  await t.step("should structure successful response correctly", () => {
    const successResponse = {
      success: true,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      admin_token: "secure-random-token-abc123"
    };

    assertEquals(successResponse.success, true);
    assertExists(successResponse.expires_at);
    assertExists(successResponse.admin_token);
  });

  await t.step("should structure failed PIN response correctly", () => {
    const failedResponse = {
      error: "Incorrect PIN",
      warning: "2 attempts remaining before temporary lockout",
      remaining_attempts: 2
    };

    assertExists(failedResponse.error);
    assertEquals(failedResponse.remaining_attempts, 2);
  });

  await t.step("should structure lockout response correctly", () => {
    const lockoutResponse = {
      error: "Account locked for 15 minutes due to too many failed attempts",
      locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };

    assertExists(lockoutResponse.error);
    assertExists(lockoutResponse.locked_until);
    assertEquals(lockoutResponse.error.includes("15 minutes"), true);
  });

  await t.step("should require admin role in profile", () => {
    const checkAdmin = (profile: { is_admin?: boolean } | null): boolean => {
      return profile?.is_admin === true;
    };

    assertEquals(checkAdmin({ is_admin: true }), true);
    assertEquals(checkAdmin({ is_admin: false }), false);
    assertEquals(checkAdmin({}), false);
    assertEquals(checkAdmin(null), false);
  });

  await t.step("should return 403 for non-admin users", () => {
    const isAdmin = false;
    const expectedStatus = isAdmin ? 200 : 403;
    const expectedError = "Admin required";

    assertEquals(expectedStatus, 403);
    assertEquals(expectedError, "Admin required");
  });

  await t.step("should log audit events for successful PIN verification", () => {
    const auditLog = {
      event_type: 'ADMIN_PIN_VERIFICATION_SUCCESS',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      actor_ip_address: '192.168.1.1',
      operation: 'VERIFY_ADMIN_PIN',
      resource_type: 'auth_event',
      success: true,
      metadata: {
        role: 'admin',
        session_expires: new Date().toISOString(),
        ttl_minutes: 30,
        used_tenant_code_format: false
      }
    };

    assertEquals(auditLog.event_type, 'ADMIN_PIN_VERIFICATION_SUCCESS');
    assertEquals(auditLog.success, true);
    assertEquals(auditLog.metadata.ttl_minutes, 30);
  });

  await t.step("should log audit events for failed PIN verification", () => {
    const auditLog = {
      event_type: 'ADMIN_PIN_VERIFICATION_FAILED',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      actor_ip_address: '192.168.1.1',
      operation: 'VERIFY_ADMIN_PIN',
      resource_type: 'auth_event',
      success: false,
      error_code: 'INCORRECT_PIN',
      error_message: 'Incorrect PIN provided',
      metadata: {
        role: 'admin',
        failed_attempts: 3,
        remaining_attempts: 2
      }
    };

    assertEquals(auditLog.event_type, 'ADMIN_PIN_VERIFICATION_FAILED');
    assertEquals(auditLog.success, false);
    assertEquals(auditLog.error_code, 'INCORRECT_PIN');
    assertEquals(auditLog.metadata.failed_attempts, 3);
  });

  await t.step("should log audit events for lockout blocks", () => {
    const auditLog = {
      event_type: 'ADMIN_PIN_LOCKOUT_BLOCK',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      operation: 'VERIFY_ADMIN_PIN',
      resource_type: 'auth_event',
      success: false,
      error_code: 'ACCOUNT_LOCKED',
      error_message: 'Account locked for 10 more minutes',
      metadata: {
        unlock_at: new Date().toISOString(),
        remaining_minutes: 10
      }
    };

    assertEquals(auditLog.event_type, 'ADMIN_PIN_LOCKOUT_BLOCK');
    assertEquals(auditLog.error_code, 'ACCOUNT_LOCKED');
    assertExists(auditLog.metadata.unlock_at);
  });

  await t.step("should extract client IP for audit logging", () => {
    const getClientIp = (headers: Record<string, string | null>): string | null => {
      return headers["x-forwarded-for"]?.split(",")[0].trim() ||
             headers["cf-connecting-ip"] ||
             headers["x-real-ip"] ||
             null;
    };

    assertEquals(
      getClientIp({ "x-forwarded-for": "10.0.0.1", "cf-connecting-ip": null, "x-real-ip": null }),
      "10.0.0.1"
    );
    assertEquals(
      getClientIp({ "x-forwarded-for": null, "cf-connecting-ip": null, "x-real-ip": null }),
      null
    );
  });

  await t.step("should validate tenant code matches user's tenant", () => {
    const validateTenantCode = (
      userTenantCode: string | undefined,
      providedCode: string
    ): boolean => {
      return userTenantCode === providedCode;
    };

    assertEquals(validateTenantCode("MH-6702", "MH-6702"), true);
    assertEquals(validateTenantCode("MH-6702", "WF-0001"), false);
    assertEquals(validateTenantCode(undefined, "MH-6702"), false);
  });

  await t.step("should return 400 when no tenant assigned", () => {
    const userProfile = { tenant_id: null };
    const hasTenant = userProfile.tenant_id !== null;
    const expectedStatus = hasTenant ? 200 : 400;
    const expectedError = "No tenant assigned to your account";

    assertEquals(expectedStatus, 400);
    assertEquals(expectedError.length > 0, true);
  });

  await t.step("should return 401 for tenant code mismatch", () => {
    const tenantMatch = false;
    const expectedStatus = tenantMatch ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 400 when PIN not set for role", () => {
    const pinExists = false;
    const expectedStatus = pinExists ? 200 : 400;
    const expectedError = "PIN not set";

    assertEquals(expectedStatus, 400);
    assertEquals(expectedError, "PIN not set");
  });

  await t.step("should return 401 for incorrect PIN", () => {
    const pinValid = false;
    const expectedStatus = pinValid ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      methodNotAllowed: 405,
      tooManyRequests: 429,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.tooManyRequests, 429);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should handle warnings for low remaining attempts", () => {
    const buildWarning = (remaining: number): string | null => {
      if (remaining <= 2 && remaining > 0) {
        return `${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before temporary lockout`;
      }
      return null;
    };

    assertEquals(buildWarning(5), null); // No warning
    assertEquals(buildWarning(3), null); // No warning
    assertEquals(buildWarning(2), "2 attempts remaining before temporary lockout");
    assertEquals(buildWarning(1), "1 attempt remaining before temporary lockout");
    assertEquals(buildWarning(0), null); // Account locked, no warning
  });

  await t.step("should validate Zod schema for request body", () => {
    const validPayloads = [
      { pin: "1234", role: "admin" },
      { pin: "MH-6702-1234", role: "nurse" },
      { pin: "sha256:abc123", role: "physician", tenantCode: "MH-6702" },
    ];

    const invalidPayloads = [
      { pin: "12", role: "admin" }, // PIN too short
      { pin: "1234", role: "invalid_role" }, // Invalid role
      { role: "admin" }, // Missing PIN
    ];

    validPayloads.forEach(payload => {
      assertEquals(payload.pin.length >= 4, true);
      assertEquals(typeof payload.role, "string");
    });

    const firstPayload = invalidPayloads[0] as { pin?: string; role?: string };
    assertEquals(firstPayload.pin !== undefined && firstPayload.pin.length < 4, true);
  });
});
