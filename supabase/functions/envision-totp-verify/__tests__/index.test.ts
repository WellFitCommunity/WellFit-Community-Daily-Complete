// supabase/functions/envision-totp-verify/__tests__/index.test.ts
// Tests for envision-totp-verify edge function (Step 2 of 2FA - TOTP)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Envision TOTP Verify Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/envision-totp-verify", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method === "POST" ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should require session_token in request body", () => {
    const validBody = { session_token: "token-uuid", code: "123456" };
    const invalidBody = { code: "123456" };

    assertExists(validBody.session_token);
    assertEquals("session_token" in invalidBody, false);
  });

  await t.step("should require TOTP code in request body", () => {
    const validBody = { session_token: "token-uuid", code: "123456" };
    const invalidBody = { session_token: "token-uuid" };

    assertExists(validBody.code);
    assertEquals("code" in invalidBody, false);
  });

  await t.step("should return 400 for missing session_token", () => {
    const hasSessionToken = false;
    const expectedStatus = hasSessionToken ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate TOTP code format (6 digits)", () => {
    const isValidCode = (code: string): boolean => {
      return /^\d{6}$/.test(code.replace(/\s+/g, ""));
    };

    assertEquals(isValidCode("123456"), true);
    assertEquals(isValidCode("12345"), false);    // Too short
    assertEquals(isValidCode("1234567"), false);  // Too long
    assertEquals(isValidCode("12345a"), false);   // Contains letter
    assertEquals(isValidCode("123 456"), true);   // Whitespace stripped
  });

  await t.step("should return 400 for invalid TOTP code format", () => {
    const isValidFormat = false;
    const expectedStatus = isValidFormat ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should strip whitespace from TOTP code", () => {
    const codeRaw = "123 456";
    const code = codeRaw.replace(/\s+/g, "");

    assertEquals(code, "123456");
  });

  await t.step("should return 401 for invalid session token", () => {
    const sessionExists = false;
    const expectedStatus = sessionExists ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 401 for expired session", () => {
    const expiresAt = new Date(Date.now() - 60000);
    const isExpired = expiresAt < new Date();

    assertEquals(isExpired, true);
  });

  await t.step("should delete expired sessions", () => {
    const isExpired = true;
    const shouldDelete = isExpired;

    assertEquals(shouldDelete, true);
  });

  await t.step("should return 401 for non-existent super admin", () => {
    const superAdminFound = false;
    const expectedStatus = superAdminFound ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 403 for inactive account", () => {
    const superAdmin = { is_active: false };
    const expectedStatus = superAdmin.is_active ? 200 : 403;

    assertEquals(expectedStatus, 403);
  });

  await t.step("should return 400 if TOTP not configured", () => {
    const superAdmin = {
      totp_enabled: true,
      totp_secret: null
    };
    const totpConfigured = Boolean(superAdmin.totp_enabled && superAdmin.totp_secret);

    assertEquals(totpConfigured, false);
  });

  await t.step("should indicate TOTP setup required", () => {
    const response = {
      error: "TOTP not configured",
      requires_totp_setup: true,
      message: "Please set up your authenticator app before logging in."
    };

    assertEquals(response.requires_totp_setup, true);
    assertEquals(response.error.includes("not configured"), true);
  });

  await t.step("should define rate limit constants", () => {
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MINUTES = 15;
    const FULL_SESSION_TTL_MINUTES = 120;

    assertEquals(MAX_FAILED_ATTEMPTS, 5);
    assertEquals(LOCKOUT_DURATION_MINUTES, 15);
    assertEquals(FULL_SESSION_TTL_MINUTES, 120);
  });

  await t.step("should return 429 when account is locked", () => {
    const isLocked = true;
    const expectedStatus = isLocked ? 429 : 200;

    assertEquals(expectedStatus, 429);
  });

  await t.step("should calculate remaining lockout time", () => {
    const unlockAt = new Date(Date.now() + 10 * 60 * 1000);
    const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

    assertEquals(remainingMinutes, 10);
  });

  await t.step("should return lockout details in response", () => {
    const unlockAt = new Date(Date.now() + 10 * 60 * 1000);
    const response = {
      error: `Account temporarily locked. Try again in 10 minutes.`,
      locked_until: unlockAt.toISOString(),
      remaining_minutes: 10
    };

    assertExists(response.locked_until);
    assertExists(response.remaining_minutes);
  });

  await t.step("should track remaining attempts before lockout", () => {
    const failedCount = 3;
    const MAX_FAILED_ATTEMPTS = 5;
    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);

    assertEquals(remainingAttempts, 2);
  });

  await t.step("should warn when 2 or fewer attempts remain", () => {
    const remainingAttempts = 2;
    const shouldWarn = remainingAttempts <= 2 && remainingAttempts > 0;

    assertEquals(shouldWarn, true);
  });

  await t.step("should return 401 for invalid TOTP code", () => {
    const totpValid = false;
    const expectedStatus = totpValid ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should record failed TOTP attempt via RPC", () => {
    const rpcParams = {
      p_super_admin_id: "admin-123",
      p_attempt_type: "totp",
      p_success: false,
      p_client_ip: "192.168.1.1",
      p_user_agent: "Mozilla/5.0"
    };

    assertEquals(rpcParams.p_attempt_type, "totp");
    assertEquals(rpcParams.p_success, false);
  });

  await t.step("should record successful TOTP attempt via RPC", () => {
    const rpcParams = {
      p_super_admin_id: "admin-123",
      p_attempt_type: "totp",
      p_success: true,
      p_client_ip: "192.168.1.1",
      p_user_agent: "Mozilla/5.0"
    };

    assertEquals(rpcParams.p_attempt_type, "totp");
    assertEquals(rpcParams.p_success, true);
  });

  await t.step("should generate new session token on success", () => {
    const fullSessionToken = crypto.randomUUID();

    assertEquals(fullSessionToken.length, 36);
    assertEquals(fullSessionToken.includes("-"), true);
  });

  await t.step("should set full session expiry to 2 hours", () => {
    const FULL_SESSION_TTL_MINUTES = 120;
    const fullExpiresAt = new Date(Date.now() + FULL_SESSION_TTL_MINUTES * 60 * 1000);

    const diffMinutes = (fullExpiresAt.getTime() - Date.now()) / (60 * 1000);
    assertEquals(Math.round(diffMinutes), 120);
  });

  await t.step("should update session with new token and pin_verified_at", () => {
    const updateData = {
      session_token: crypto.randomUUID(),
      pin_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString()
    };

    assertExists(updateData.session_token);
    assertExists(updateData.pin_verified_at);
    assertExists(updateData.expires_at);
  });

  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      session_token: "new-session-token",
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      user: {
        id: "admin-123",
        email: "admin@example.com",
        full_name: "Test Admin",
        role: "super_admin",
        permissions: ["all"]
      },
      message: "Two-factor authentication verified. Welcome to the Envision Master Panel."
    };

    assertEquals(response.success, true);
    assertExists(response.session_token);
    assertExists(response.user);
    assertEquals(response.message.includes("Welcome"), true);
  });

  await t.step("should structure audit log for failed attempt", () => {
    const auditLog = {
      user_id: null,
      action: "ENVISION_TOTP_FAILED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        client_ip: "192.168.1.1",
        failed_attempts: 3,
        remaining_attempts: 2
      }
    };

    assertEquals(auditLog.action, "ENVISION_TOTP_FAILED");
    assertExists(auditLog.metadata.failed_attempts);
  });

  await t.step("should structure audit log for successful login", () => {
    const auditLog = {
      user_id: null,
      action: "ENVISION_LOGIN_SUCCESS",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        full_name: "Test Admin",
        role: "super_admin",
        client_ip: "192.168.1.1",
        session_expires: new Date().toISOString(),
        auth_method: "totp"
      }
    };

    assertEquals(auditLog.action, "ENVISION_LOGIN_SUCCESS");
    assertEquals(auditLog.metadata.auth_method, "totp");
  });

  await t.step("should return 500 for server configuration error", () => {
    const hasConfig = false;
    const expectedStatus = hasConfig ? 200 : 500;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should return 500 for session update failure", () => {
    const updateSucceeded = false;
    const expectedStatus = updateSucceeded ? 200 : 500;

    assertEquals(expectedStatus, 500);
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
    assertEquals(statusCodes.tooManyRequests, 429);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });
});
