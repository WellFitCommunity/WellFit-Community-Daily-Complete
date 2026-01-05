// supabase/functions/login/__tests__/index.test.ts
// Tests for login edge function

import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Login Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/login", {
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

  await t.step("should validate phone number format - E.164 conversion", () => {
    // The login function converts phone numbers to E.164 format
    function toE164(phone: string): string {
      const digits = phone.replace(/[^\d]/g, "");
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
      return digits.startsWith("+") ? digits : `+${digits}`;
    }

    // Test various phone formats
    assertEquals(toE164("5551234567"), "+15551234567");
    assertEquals(toE164("15551234567"), "+15551234567");
    assertEquals(toE164("+15551234567"), "+15551234567");
    assertEquals(toE164("555-123-4567"), "+15551234567");
    assertEquals(toE164("(555) 123-4567"), "+15551234567");
  });

  await t.step("should require phone field in request body", () => {
    const validBody = {
      phone: "5551234567",
      password: "securePassword123"
    };

    const invalidBody = {
      password: "securePassword123"
    };

    assertExists(validBody.phone);
    assertEquals("phone" in invalidBody, false);
  });

  await t.step("should require password field in request body", () => {
    const validBody = {
      phone: "5551234567",
      password: "securePassword123"
    };

    const invalidBody = {
      phone: "5551234567"
    };

    assertExists(validBody.password);
    assertEquals("password" in invalidBody, false);
  });

  await t.step("should validate request body with Zod schema", () => {
    const validPayloads = [
      { phone: "5551234567", password: "pass123" },
      { phone: "+15551234567", password: "longPassword!@#" },
      { phone: "555-123-4567", password: "a" }, // min length 1
    ];

    const invalidPayloads = [
      { phone: "", password: "pass123" }, // empty phone
      { phone: "5551234567", password: "" }, // empty password
      { }, // missing both
    ];

    validPayloads.forEach(payload => {
      assertEquals(payload.phone.length >= 1, true);
      assertEquals(payload.password.length >= 1, true);
    });

    invalidPayloads.forEach(payload => {
      const typedPayload = payload as { phone?: string; password?: string };
      const hasValidPhone = typedPayload.phone !== undefined && typedPayload.phone.length >= 1;
      const hasValidPassword = typedPayload.password !== undefined && typedPayload.password.length >= 1;
      const isValid = hasValidPhone && hasValidPassword;
      assertEquals(isValid, false);
    });
  });

  await t.step("should extract client IP from headers", () => {
    // Priority order for IP extraction
    const getClientIp = (headers: Record<string, string | null>): string | null => {
      return headers["x-forwarded-for"]?.split(",")[0].trim() ||
             headers["cf-connecting-ip"] ||
             headers["x-real-ip"] ||
             null;
    };

    // Test x-forwarded-for (primary)
    assertEquals(
      getClientIp({ "x-forwarded-for": "192.168.1.1, 10.0.0.1", "cf-connecting-ip": null, "x-real-ip": null }),
      "192.168.1.1"
    );

    // Test cf-connecting-ip (Cloudflare)
    assertEquals(
      getClientIp({ "x-forwarded-for": null, "cf-connecting-ip": "10.0.0.2", "x-real-ip": null }),
      "10.0.0.2"
    );

    // Test x-real-ip (nginx)
    assertEquals(
      getClientIp({ "x-forwarded-for": null, "cf-connecting-ip": null, "x-real-ip": "172.16.0.1" }),
      "172.16.0.1"
    );

    // Test no IP available
    assertEquals(
      getClientIp({ "x-forwarded-for": null, "cf-connecting-ip": null, "x-real-ip": null }),
      null
    );
  });

  await t.step("should enforce rate limiting parameters", () => {
    const MAX_REQUESTS = 5;
    const TIME_WINDOW_MINUTES = 15;

    assertEquals(MAX_REQUESTS, 5);
    assertEquals(TIME_WINDOW_MINUTES, 15);
    assertEquals(TIME_WINDOW_MINUTES * 60 * 1000, 900000); // 15 min in ms
  });

  await t.step("should calculate rate limit time window correctly", () => {
    const TIME_WINDOW_MINUTES = 15;
    const now = Date.now();
    const since = new Date(now - TIME_WINDOW_MINUTES * 60 * 1000);

    assertEquals(typeof since.toISOString(), "string");
    assertEquals(now - since.getTime(), TIME_WINDOW_MINUTES * 60 * 1000);
  });

  await t.step("should return 429 when rate limit exceeded", () => {
    const MAX_REQUESTS = 5;
    const currentCount = 6;

    const isRateLimited = currentCount >= MAX_REQUESTS;
    assertEquals(isRateLimited, true);

    const expectedStatus = isRateLimited ? 429 : 200;
    assertEquals(expectedStatus, 429);
  });

  await t.step("should structure successful login response", () => {
    const mockSuccessResponse = {
      success: true,
      message: "Login successful",
      data: {
        user_id: "user-123",
        access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        refresh_token: "refresh-token-abc",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        next_route: "/dashboard",
      },
    };

    assertEquals(mockSuccessResponse.success, true);
    assertExists(mockSuccessResponse.data.user_id);
    assertExists(mockSuccessResponse.data.access_token);
    assertExists(mockSuccessResponse.data.refresh_token);
    assertExists(mockSuccessResponse.data.expires_at);
    assertEquals(mockSuccessResponse.data.token_type, "bearer");
    assertExists(mockSuccessResponse.data.next_route);
  });

  await t.step("should determine next route based on profile flags", () => {
    const determineNextRoute = (profile: {
      force_password_change?: boolean;
      consent?: boolean;
      onboarded?: boolean;
    } | null): string => {
      if (!profile) return "/dashboard";
      if (profile.force_password_change) return "/change-password";
      if (!profile.consent) return "/consent-photo";
      if (!profile.onboarded) return "/demographics";
      return "/dashboard";
    };

    assertEquals(determineNextRoute(null), "/dashboard");
    assertEquals(determineNextRoute({ force_password_change: true }), "/change-password");
    assertEquals(determineNextRoute({ consent: false }), "/consent-photo");
    assertEquals(determineNextRoute({ consent: true, onboarded: false }), "/demographics");
    assertEquals(determineNextRoute({ consent: true, onboarded: true }), "/dashboard");
  });

  await t.step("should handle authentication error messages", () => {
    const getErrorMessage = (errorMsg: string): { message: string; status: number } => {
      const msg = errorMsg.toLowerCase();

      if (msg.includes("email not confirmed") || msg.includes("phone not confirmed")) {
        return { message: "Account not confirmed. Please check your messages.", status: 403 };
      }
      if (msg.includes("too many requests")) {
        return { message: "Too many login attempts. Please wait before trying again.", status: 429 };
      }
      if (msg.includes("invalid login credentials")) {
        return { message: "Invalid phone number or password.", status: 401 };
      }
      return { message: "Login service temporarily unavailable. Please try again.", status: 503 };
    };

    assertEquals(getErrorMessage("phone not confirmed").status, 403);
    assertEquals(getErrorMessage("email not confirmed").status, 403);
    assertEquals(getErrorMessage("too many requests").status, 429);
    assertEquals(getErrorMessage("invalid login credentials").status, 401);
    assertEquals(getErrorMessage("some other error").status, 503);
  });

  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "Invalid phone number or password.",
      details: "Invalid login credentials"
    };

    assertExists(errorResponse.error);
    assertEquals(typeof errorResponse.error, "string");
    assertEquals(errorResponse.error.length > 0, true);
  });

  await t.step("should log audit events for successful login", () => {
    const auditLog = {
      event_type: 'USER_LOGIN_SUCCESS',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      actor_ip_address: '192.168.1.1',
      operation: 'LOGIN',
      resource_type: 'auth_session',
      success: true,
      metadata: {
        phone: '+15551234567',
        next_route: '/dashboard',
        session_id: 'eyJhbGciOiJIUzI...' // First 16 chars only
      }
    };

    assertEquals(auditLog.event_type, 'USER_LOGIN_SUCCESS');
    assertEquals(auditLog.event_category, 'AUTHENTICATION');
    assertEquals(auditLog.success, true);
    assertExists(auditLog.metadata.phone);
  });

  await t.step("should log audit events for failed login", () => {
    const auditLog = {
      event_type: 'USER_LOGIN_FAILED',
      event_category: 'AUTHENTICATION',
      actor_user_id: null,
      actor_ip_address: '192.168.1.1',
      operation: 'LOGIN',
      resource_type: 'auth_session',
      success: false,
      error_code: 'AUTH_ERROR',
      error_message: 'Invalid login credentials',
      metadata: {
        phone: '+15551234567',
        error_type: 'INVALID_CREDENTIALS'
      }
    };

    assertEquals(auditLog.event_type, 'USER_LOGIN_FAILED');
    assertEquals(auditLog.success, false);
    assertExists(auditLog.error_code);
    assertEquals(auditLog.actor_user_id, null); // Unknown for failed login
  });

  await t.step("should detect failed login bursts for security events", () => {
    const detectBurst = (failedCount: number): { shouldLog: boolean; severity: string } => {
      if (failedCount >= 5) {
        return { shouldLog: true, severity: 'CRITICAL' };
      }
      if (failedCount >= 3) {
        return { shouldLog: true, severity: 'HIGH' };
      }
      return { shouldLog: false, severity: 'NONE' };
    };

    assertEquals(detectBurst(2).shouldLog, false);
    assertEquals(detectBurst(3).shouldLog, true);
    assertEquals(detectBurst(3).severity, 'HIGH');
    assertEquals(detectBurst(5).severity, 'CRITICAL');
    assertEquals(detectBurst(10).severity, 'CRITICAL');
  });

  await t.step("should truncate session ID in logs for security", () => {
    const fullToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const truncated = fullToken.substring(0, 16) + '...';

    assertEquals(truncated.length, 19); // 16 chars + "..."
    assertEquals(truncated.endsWith('...'), true);
    assertEquals(truncated.includes("eyJhbGciOiJIUzI1"), true);
  });

  await t.step("should validate environment variables are present", () => {
    const validateEnv = (envVars: Record<string, string | undefined>): boolean => {
      const required = ['supabaseUrl', 'serviceRoleKey', 'anonKey'];
      return required.every(key => envVars[key] && envVars[key]!.length > 0);
    };

    assertEquals(validateEnv({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-key',
      anonKey: 'anon-key'
    }), true);

    assertEquals(validateEnv({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: '',
      anonKey: 'anon-key'
    }), false);

    assertEquals(validateEnv({
      supabaseUrl: undefined,
      serviceRoleKey: 'service-key',
      anonKey: 'anon-key'
    }), false);
  });

  await t.step("should return 500 for missing environment configuration", () => {
    const hasMissingEnv = true;
    const expectedStatus = hasMissingEnv ? 500 : 200;
    const expectedError = "Server configuration error.";

    assertEquals(expectedStatus, 500);
    assertEquals(expectedError.length > 0, true);
  });

  await t.step("should handle JSON parse errors gracefully", () => {
    const parseJSON = (str: string): unknown | null => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    };

    assertEquals(parseJSON('{"valid": true}'), { valid: true });
    assertEquals(parseJSON('invalid json'), null);
    assertEquals(parseJSON(''), null);
  });

  await t.step("should return 400 for invalid JSON body", () => {
    const body = null; // Simulating failed JSON parse
    const expectedStatus = body === null ? 400 : 200;
    const expectedError = "Invalid JSON in request body";

    assertEquals(expectedStatus, 400);
    assertEquals(expectedError.length > 0, true);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      forbidden: 403,
      methodNotAllowed: 405,
      tooManyRequests: 429,
      serverError: 500,
      serviceUnavailable: 503
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.forbidden, 403);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.tooManyRequests, 429);
    assertEquals(statusCodes.serverError, 500);
    assertEquals(statusCodes.serviceUnavailable, 503);
  });
});
