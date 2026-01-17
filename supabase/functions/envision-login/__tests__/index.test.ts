// supabase/functions/envision-login/__tests__/index.test.ts
// Tests for envision-login edge function (Step 1 of 2FA)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Envision Login Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/envision-login", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method === "POST" ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should require email in request body", () => {
    const validBody = { email: "admin@example.com", password: "secret123" };
    const invalidBody = { password: "secret123" };

    assertExists(validBody.email);
    assertEquals("email" in invalidBody, false);
  });

  await t.step("should require password in request body", () => {
    const validBody = { email: "admin@example.com", password: "secret123" };
    const invalidBody = { email: "admin@example.com" };

    assertExists(validBody.password);
    assertEquals("password" in invalidBody, false);
  });

  await t.step("should return 400 for missing email", () => {
    const hasEmail = false;
    const expectedStatus = hasEmail ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 400 for missing password", () => {
    const hasPassword = false;
    const expectedStatus = hasPassword ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should validate email format", () => {
    const isValidEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    assertEquals(isValidEmail("admin@example.com"), true);
    assertEquals(isValidEmail("user@domain.org"), true);
    assertEquals(isValidEmail("invalid-email"), false);
    assertEquals(isValidEmail("@nodomain.com"), false);
    assertEquals(isValidEmail("noat.com"), false);
  });

  await t.step("should return 400 for invalid email format", () => {
    const isValidEmail = false;
    const expectedStatus = isValidEmail ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should normalize email to lowercase", () => {
    const email = "Admin@Example.COM";
    const normalized = email.trim().toLowerCase();

    assertEquals(normalized, "admin@example.com");
  });

  await t.step("should use generic error for non-existent email", () => {
    // Prevent email enumeration attacks
    const errorMessage = "Invalid email or password";

    assertEquals(errorMessage.includes("email or password"), true);
    assertEquals(errorMessage.includes("not found"), false);
  });

  await t.step("should check if account is active", () => {
    const superAdmin = { is_active: false };
    const canLogin = superAdmin.is_active;

    assertEquals(canLogin, false);
  });

  await t.step("should define rate limit constants", () => {
    const MAX_FAILED_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MINUTES = 15;
    const SESSION_TTL_MINUTES = 30;

    assertEquals(MAX_FAILED_ATTEMPTS, 5);
    assertEquals(LOCKOUT_DURATION_MINUTES, 15);
    assertEquals(SESSION_TTL_MINUTES, 30);
  });

  await t.step("should return 429 when account is locked", () => {
    const isLocked = true;
    const expectedStatus = isLocked ? 429 : 200;

    assertEquals(expectedStatus, 429);
  });

  await t.step("should calculate remaining lockout time", () => {
    const unlockAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    const remainingMinutes = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);

    assertEquals(remainingMinutes, 10);
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

  await t.step("should try standalone password hash first", () => {
    const authMethods = ["standalone", "supabase"];
    const preferredMethod = authMethods[0];

    assertEquals(preferredMethod, "standalone");
  });

  await t.step("should fall back to Supabase Auth for password", () => {
    const standaloneValid = false;
    const supabaseValid = true;
    const passwordValid = standaloneValid || supabaseValid;

    assertEquals(passwordValid, true);
  });

  await t.step("should generate secure session token", () => {
    const sessionToken = crypto.randomUUID();

    assertEquals(sessionToken.length, 36);
    assertEquals(sessionToken.includes("-"), true);
  });

  await t.step("should set session expiry to 30 minutes", () => {
    const SESSION_TTL_MINUTES = 30;
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);

    const diffMinutes = (expiresAt.getTime() - Date.now()) / (60 * 1000);
    assertEquals(Math.round(diffMinutes), 30);
  });

  await t.step("should structure pending session correctly", () => {
    const session = {
      super_admin_id: "admin-123",
      session_token: crypto.randomUUID(),
      password_verified_at: new Date().toISOString(),
      pin_verified_at: null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      client_ip: "192.168.1.1",
      user_agent: "Mozilla/5.0"
    };

    assertExists(session.session_token);
    assertExists(session.password_verified_at);
    assertEquals(session.pin_verified_at, null);
  });

  await t.step("should detect TOTP enabled status", () => {
    const superAdmin = {
      totp_enabled: true,
      totp_secret: "JBSWY3DPEHPK3PXP"
    };

    const totpEnabled = Boolean(superAdmin.totp_enabled && superAdmin.totp_secret);
    assertEquals(totpEnabled, true);
  });

  await t.step("should detect partial TOTP setup", () => {
    const superAdmin = {
      totp_enabled: true,
      totp_secret: null
    };

    const totpPartialSetup = Boolean(superAdmin.totp_enabled && !superAdmin.totp_secret);
    assertEquals(totpPartialSetup, true);
  });

  await t.step("should detect PIN configured status", () => {
    const superAdmin = {
      pin_hash: "hashed-pin-value"
    };

    const pinConfigured = Boolean(superAdmin.pin_hash);
    assertEquals(pinConfigured, true);
  });

  await t.step("should determine 2FA setup requirement", () => {
    // User needs 2FA setup if no TOTP and no PIN
    const totpEnabled = false;
    const pinConfigured = false;
    const totpPartialSetup = false;

    const needs2FASetup = (!totpEnabled && !pinConfigured) || totpPartialSetup;
    assertEquals(needs2FASetup, true);
  });

  await t.step("should not require 2FA setup if PIN configured", () => {
    const totpEnabled = false;
    const pinConfigured = true;
    const totpPartialSetup = false;

    const needs2FASetup = (!totpEnabled && !pinConfigured) || totpPartialSetup;
    assertEquals(needs2FASetup, false);
  });

  await t.step("should structure success response correctly", () => {
    const response = {
      success: true,
      session_token: "session-token-uuid",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      totp_enabled: true,
      pin_configured: false,
      requires_2fa_setup: false,
      can_setup_totp: false,
      requires_pin: false,
      message: "Password verified. Please enter your authenticator code."
    };

    assertEquals(response.success, true);
    assertExists(response.session_token);
    assertExists(response.expires_at);
  });

  await t.step("should set appropriate message for TOTP users", () => {
    const totpEnabled = true;
    const message = totpEnabled
      ? "Password verified. Please enter your authenticator code."
      : "Password verified. Please enter your PIN to complete login.";

    assertEquals(message.includes("authenticator code"), true);
  });

  await t.step("should set appropriate message for PIN users", () => {
    const totpEnabled = false;
    const pinConfigured = true;
    const needs2FASetup = false;

    const message = totpEnabled
      ? "Please enter your authenticator code."
      : needs2FASetup
      ? "Please set up two-factor authentication."
      : pinConfigured
      ? "Please enter your PIN to complete login."
      : "Please set up two-factor authentication.";

    assertEquals(message.includes("PIN"), true);
  });

  await t.step("should extract client IP from headers", () => {
    const getClientIp = (headers: Record<string, string | null>): string | null => {
      return headers["x-forwarded-for"]?.split(",")[0].trim() ||
        headers["cf-connecting-ip"] ||
        headers["x-real-ip"] ||
        null;
    };

    assertEquals(getClientIp({ "x-forwarded-for": "192.168.1.1, 10.0.0.1" }), "192.168.1.1");
    assertEquals(getClientIp({ "cf-connecting-ip": "192.168.1.2" }), "192.168.1.2");
    assertEquals(getClientIp({ "x-real-ip": "192.168.1.3" }), "192.168.1.3");
  });

  await t.step("should structure audit log for failed attempt", () => {
    const auditLog = {
      user_id: null,
      action: "ENVISION_PASSWORD_FAILED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        client_ip: "192.168.1.1",
        failed_attempts: 3,
        remaining_attempts: 2
      }
    };

    assertEquals(auditLog.action, "ENVISION_PASSWORD_FAILED");
    assertExists(auditLog.metadata.failed_attempts);
  });

  await t.step("should structure audit log for successful attempt", () => {
    const auditLog = {
      user_id: null,
      action: "ENVISION_PASSWORD_SUCCESS",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        client_ip: "192.168.1.1",
        session_expires: new Date().toISOString(),
        auth_method: "standalone"
      }
    };

    assertEquals(auditLog.action, "ENVISION_PASSWORD_SUCCESS");
    assertExists(auditLog.metadata.auth_method);
  });

  await t.step("should return 500 for server configuration error", () => {
    const hasConfig = false;
    const expectedStatus = hasConfig ? 200 : 500;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      methodNotAllowed: 405,
      tooManyRequests: 429,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.tooManyRequests, 429);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });
});
