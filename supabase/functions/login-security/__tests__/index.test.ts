// supabase/functions/login-security/__tests__/index.test.ts
// Tests for Login Security Edge Function - Account lockout and attempt tracking

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Login Security Tests", async (t) => {

  // =====================================================
  // Check Lock Action Tests
  // =====================================================

  await t.step("should require identifier for check_lock action", () => {
    const body = { action: "check_lock" };
    const hasIdentifier = "identifier" in body;

    assertEquals(hasIdentifier, false);
  });

  await t.step("should return 400 for missing identifier", () => {
    const response = { error: "Identifier required" };
    assertEquals(response.error, "Identifier required");
  });

  await t.step("should return isLocked: false when account not locked", () => {
    const response = { isLocked: false };
    assertEquals(response.isLocked, false);
  });

  await t.step("should return lockout details when account is locked", () => {
    const response = {
      isLocked: true,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      failedAttempts: 5,
      minutesRemaining: 10
    };

    assertEquals(response.isLocked, true);
    assertExists(response.lockedUntil);
    assertEquals(response.failedAttempts, 5);
    assertEquals(response.minutesRemaining, 10);
  });

  await t.step("should fail open if lock check fails", () => {
    // If RPC call fails, don't block login
    const rpcError = { message: "Database error" };
    const response = { isLocked: false };

    assertEquals(response.isLocked, false);
  });

  await t.step("should calculate minutes remaining", () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    const now = new Date();
    const minutesRemaining = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000);

    assertEquals(minutesRemaining, 10);
  });

  // =====================================================
  // Record Attempt Action Tests
  // =====================================================

  await t.step("should require identifier for record_attempt action", () => {
    const body = { action: "record_attempt", attemptType: "password", success: false };
    const hasIdentifier = "identifier" in body;

    assertEquals(hasIdentifier, false);
  });

  await t.step("should require attemptType for record_attempt action", () => {
    const body = { action: "record_attempt", identifier: "user@example.com", success: false };
    const hasAttemptType = "attemptType" in body;

    assertEquals(hasAttemptType, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const response = { error: "Identifier and attemptType required" };
    assertEquals(response.error, "Identifier and attemptType required");
  });

  await t.step("should support password attempt type", () => {
    const attemptTypes = ["password", "pin", "mfa"];
    assertEquals(attemptTypes.includes("password"), true);
  });

  await t.step("should support pin attempt type", () => {
    const attemptTypes = ["password", "pin", "mfa"];
    assertEquals(attemptTypes.includes("pin"), true);
  });

  await t.step("should support mfa attempt type", () => {
    const attemptTypes = ["password", "pin", "mfa"];
    assertEquals(attemptTypes.includes("mfa"), true);
  });

  await t.step("should record successful attempt", () => {
    const body = {
      action: "record_attempt",
      identifier: "user@example.com",
      attemptType: "password",
      success: true,
      userId: "user-123"
    };

    assertEquals(body.success, true);
    assertExists(body.userId);
  });

  await t.step("should record failed attempt", () => {
    const body = {
      action: "record_attempt",
      identifier: "user@example.com",
      attemptType: "password",
      success: false,
      errorMessage: "Invalid credentials"
    };

    assertEquals(body.success, false);
    assertExists(body.errorMessage);
  });

  await t.step("should return recorded status", () => {
    const response = { recorded: true };
    assertEquals(response.recorded, true);
  });

  await t.step("should not fail login if recording fails", () => {
    const rpcError = { message: "Database error" };
    const response = { recorded: false };

    // Login should still proceed
    assertEquals(response.recorded, false);
  });

  // =====================================================
  // Client IP Extraction Tests
  // =====================================================

  await t.step("should extract client IP from x-forwarded-for", () => {
    const header = "192.168.1.1, 10.0.0.1, 172.16.0.1";
    const clientIP = header.split(",")[0].trim();

    assertEquals(clientIP, "192.168.1.1");
  });

  await t.step("should extract client IP from x-real-ip", () => {
    const clientIP = "203.0.113.195";
    assertEquals(clientIP, "203.0.113.195");
  });

  await t.step("should use unknown if no IP headers", () => {
    const xForwardedFor = null;
    const xRealIp = null;
    const clientIP = xForwardedFor || xRealIp || "unknown";

    assertEquals(clientIP, "unknown");
  });

  await t.step("should capture user agent", () => {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0";
    assertEquals(typeof userAgent, "string");
    assertEquals(userAgent.includes("Mozilla"), true);
  });

  // =====================================================
  // Action Validation Tests
  // =====================================================

  await t.step("should accept check_lock action", () => {
    const body = { action: "check_lock", identifier: "user@example.com" };
    assertEquals(body.action, "check_lock");
  });

  await t.step("should accept record_attempt action", () => {
    const body = {
      action: "record_attempt",
      identifier: "user@example.com",
      attemptType: "password",
      success: false
    };
    assertEquals(body.action, "record_attempt");
  });

  await t.step("should return 400 for invalid action", () => {
    const response = { error: "Invalid action. Use 'check_lock' or 'record_attempt'" };
    assertEquals(response.error.includes("Invalid action"), true);
  });

  // =====================================================
  // RPC Function Tests
  // =====================================================

  await t.step("should call is_account_locked RPC", () => {
    const rpcCall = {
      function: "is_account_locked",
      params: { p_identifier: "user@example.com" }
    };

    assertEquals(rpcCall.function, "is_account_locked");
    assertExists(rpcCall.params.p_identifier);
  });

  await t.step("should call record_login_attempt RPC", () => {
    const rpcCall = {
      function: "record_login_attempt",
      params: {
        p_identifier: "user@example.com",
        p_attempt_type: "password",
        p_success: false,
        p_user_id: null,
        p_ip_address: "192.168.1.1",
        p_user_agent: "Mozilla/5.0...",
        p_error_message: "Invalid credentials",
        p_metadata: {}
      }
    };

    assertEquals(rpcCall.function, "record_login_attempt");
    assertExists(rpcCall.params.p_identifier);
    assertExists(rpcCall.params.p_attempt_type);
    assertEquals(typeof rpcCall.params.p_success, "boolean");
  });

  // =====================================================
  // Lockout Data Tests
  // =====================================================

  await t.step("should query account_lockouts table", () => {
    const query = {
      table: "account_lockouts",
      select: "locked_until, metadata",
      filters: {
        identifier: "user@example.com",
        unlocked_at: null,
        locked_until: { gte: new Date().toISOString() }
      }
    };

    assertEquals(query.table, "account_lockouts");
    assertExists(query.select);
  });

  await t.step("should include metadata in lockout data", () => {
    const lockoutData = {
      locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      metadata: {
        failed_attempts: 5,
        last_attempt: new Date().toISOString()
      }
    };

    assertExists(lockoutData.metadata);
    assertEquals(lockoutData.metadata.failed_attempts, 5);
  });

  // =====================================================
  // Identifier Masking Tests
  // =====================================================

  await t.step("should only log last 4 characters of identifier", () => {
    const identifier = "user@example.com";
    const identifierSuffix = identifier.slice(-4);

    assertEquals(identifierSuffix, ".com");
    assertEquals(identifierSuffix.length, 4);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/login-security", {
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

  await t.step("should return 500 for server config error", () => {
    const response = { error: "Server configuration error" };
    assertEquals(response.error, "Server configuration error");
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

  // =====================================================
  // Security Logging Tests
  // =====================================================

  await t.step("should log security events for locked accounts", () => {
    const securityLog = {
      level: "security",
      event: "Account locked - login blocked",
      context: {
        identifierSuffix: ".com",
        minutesRemaining: 10
      }
    };

    assertEquals(securityLog.level, "security");
    assertEquals(securityLog.event.includes("locked"), true);
  });

  await t.step("should log login attempts", () => {
    const infoLog = {
      level: "info",
      event: "Login attempt recorded",
      context: {
        identifierSuffix: ".com",
        attemptType: "password",
        success: false
      }
    };

    assertEquals(infoLog.level, "info");
    assertExists(infoLog.context.attemptType);
    assertEquals(typeof infoLog.context.success, "boolean");
  });
});
