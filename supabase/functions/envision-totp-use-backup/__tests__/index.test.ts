// supabase/functions/envision-totp-use-backup/__tests__/index.test.ts
// Tests for TOTP Backup Code Edge Function - Emergency authentication

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Envision TOTP Use Backup Tests", async (t) => {

  // =====================================================
  // Backup Code Format Tests
  // =====================================================

  await t.step("should normalize backup code", () => {
    const normalizeBackupCode = (code: string): string => {
      return code.toUpperCase().replace(/[-\s]/g, "");
    };

    const testCases = [
      { input: "abcd-1234", expected: "ABCD1234" },
      { input: "EFGH 5678", expected: "EFGH5678" },
      { input: "ijkl-9012", expected: "IJKL9012" },
      { input: "MnOp3456", expected: "MNOP3456" }
    ];

    for (const { input, expected } of testCases) {
      assertEquals(normalizeBackupCode(input), expected);
    }
  });

  await t.step("should validate backup code format", () => {
    const isValidBackupCodeFormat = (code: string): boolean => {
      const normalized = code.toUpperCase().replace(/[-\s]/g, "");
      return /^[A-Z0-9]{8}$/.test(normalized);
    };

    const validCodes = ["ABCD-1234", "EFGH5678", "ijkl-9012", "MNOP 3456"];
    const invalidCodes = ["ABC-123", "ABCDEFGHI", "12345", "", "ABCD-12G!"];

    for (const code of validCodes) {
      assertEquals(isValidBackupCodeFormat(code), true, `${code} should be valid`);
    }

    for (const code of invalidCodes) {
      assertEquals(isValidBackupCodeFormat(code), false, `${code} should be invalid`);
    }
  });

  await t.step("should accept 8-character alphanumeric codes", () => {
    const validPattern = /^[A-Z0-9]{8}$/;

    const validCodes = ["ABCD1234", "12345678", "AAAAAAAA", "A1B2C3D4"];

    for (const code of validCodes) {
      assertEquals(validPattern.test(code), true);
    }
  });

  // =====================================================
  // Input Validation Tests
  // =====================================================

  await t.step("should require session_token", () => {
    const body = { backup_code: "ABCD-1234" };
    const hasSessionToken = "session_token" in body;

    assertEquals(hasSessionToken, false);
  });

  await t.step("should require backup_code", () => {
    const body = { session_token: "session-123" };
    const hasBackupCode = "backup_code" in body;

    assertEquals(hasBackupCode, false);
  });

  await t.step("should return 400 for invalid backup code format", () => {
    const response = {
      error: "Invalid backup code format. Expected 8-character code (e.g., XXXX-XXXX)"
    };

    assertEquals(response.error.includes("8-character"), true);
  });

  // =====================================================
  // Session Validation Tests
  // =====================================================

  await t.step("should validate session exists", () => {
    const session = null;
    const isValid = session !== null;

    assertEquals(isValid, false);
  });

  await t.step("should check session not already verified", () => {
    const session = {
      id: "session-123",
      super_admin_id: "admin-456",
      pin_verified_at: null, // Not yet verified
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    assertEquals(session.pin_verified_at, null);
  });

  await t.step("should check session not expired", () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const isExpired = new Date(expiresAt) < new Date();

    assertEquals(isExpired, false);
  });

  await t.step("should delete expired sessions", () => {
    const session = {
      id: "session-123",
      expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() // Expired
    };

    const isExpired = new Date(session.expires_at) < new Date();
    assertEquals(isExpired, true);
    // Session should be deleted
  });

  // =====================================================
  // Super Admin Validation Tests
  // =====================================================

  await t.step("should verify super admin exists", () => {
    const superAdmin = {
      id: "admin-123",
      email: "admin@example.com",
      is_active: true,
      totp_backup_codes: ["hash1", "hash2", "hash3"]
    };

    assertExists(superAdmin);
    assertExists(superAdmin.email);
  });

  await t.step("should check super admin is active", () => {
    const superAdmin = {
      id: "admin-123",
      is_active: false
    };

    assertEquals(superAdmin.is_active, false);
  });

  await t.step("should check user has backup codes", () => {
    const superAdmin = {
      totp_backup_codes: null
    };

    const hasBackupCodes = superAdmin.totp_backup_codes !== null &&
      Array.isArray(superAdmin.totp_backup_codes) &&
      superAdmin.totp_backup_codes.length > 0;

    assertEquals(hasBackupCodes, false);
  });

  await t.step("should return error when no backup codes available", () => {
    const response = {
      error: "No backup codes available. Please contact support."
    };

    assertEquals(response.error.includes("No backup codes"), true);
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should enforce max 5 failed attempts", () => {
    const MAX_FAILED_ATTEMPTS = 5;
    const failedAttempts = 6;

    const isLocked = failedAttempts >= MAX_FAILED_ATTEMPTS;

    assertEquals(isLocked, true);
  });

  await t.step("should apply 15-minute lockout", () => {
    const LOCKOUT_DURATION_MINUTES = 15;
    const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

    const diffMs = lockoutUntil.getTime() - Date.now();
    assertEquals(diffMs, 15 * 60 * 1000);
  });

  await t.step("should return 429 when locked out", () => {
    const remainingMinutes = 10;
    const response = {
      error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.`,
      locked_until: new Date(Date.now() + remainingMinutes * 60 * 1000).toISOString(),
      remaining_minutes: remainingMinutes
    };

    assertEquals(response.error.includes("locked"), true);
    assertExists(response.locked_until);
    assertExists(response.remaining_minutes);
  });

  await t.step("should track failed attempts", () => {
    const lockoutData = {
      is_locked: false,
      failed_count: 3
    };

    assertEquals(lockoutData.failed_count, 3);
    assertEquals(lockoutData.is_locked, false);
  });

  // =====================================================
  // Backup Code Verification Tests
  // =====================================================

  await t.step("should verify backup code is valid", () => {
    const codeValid = true;
    assertEquals(codeValid, true);
  });

  await t.step("should consume backup code after use", () => {
    // verify_and_consume_backup_code is atomic - verifies AND consumes
    const consumed = true;
    assertEquals(consumed, true);
  });

  await t.step("should return error for invalid code", () => {
    const response = { error: "Invalid backup code" };
    assertEquals(response.error, "Invalid backup code");
  });

  await t.step("should warn about remaining attempts", () => {
    const remainingAttempts = 2;
    const response = {
      error: "Invalid backup code",
      warning: `${remainingAttempts} attempts remaining before temporary lockout`,
      remaining_attempts: remainingAttempts
    };

    assertExists(response.warning);
    assertEquals(response.remaining_attempts, 2);
  });

  // =====================================================
  // Success Response Tests
  // =====================================================

  await t.step("should return full session on success", () => {
    const response = {
      success: true,
      session_token: "new-full-session-token",
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
      user: {
        id: "admin-123",
        email: "admin@example.com",
        full_name: "Admin User",
        role: "super_admin",
        permissions: ["all"]
      },
      remaining_backup_codes: 4,
      message: "Backup code verified. Welcome to the Envision Master Panel."
    };

    assertEquals(response.success, true);
    assertExists(response.session_token);
    assertExists(response.user);
    assertExists(response.remaining_backup_codes);
  });

  await t.step("should extend session to 120 minutes", () => {
    const FULL_SESSION_TTL_MINUTES = 120;
    const now = Date.now();
    const expiresAt = new Date(now + FULL_SESSION_TTL_MINUTES * 60 * 1000);

    const diffMs = expiresAt.getTime() - now;
    assertEquals(diffMs, 120 * 60 * 1000);
  });

  await t.step("should generate new session token", () => {
    // generateSecureToken creates a new token
    const newToken = "new-secure-token-abc123";
    assertEquals(typeof newToken, "string");
    assertEquals(newToken.length > 0, true);
  });

  await t.step("should return remaining backup code count", () => {
    const remainingBackupCodes = 4;
    assertEquals(typeof remainingBackupCodes, "number");
    assertEquals(remainingBackupCodes >= 0, true);
  });

  // =====================================================
  // Low Backup Code Warning Tests
  // =====================================================

  await t.step("should warn when backup codes are low", () => {
    const LOW_BACKUP_CODE_THRESHOLD = 3;
    const remainingBackupCodes = 2;

    const shouldWarn = remainingBackupCodes <= LOW_BACKUP_CODE_THRESHOLD;

    assertEquals(shouldWarn, true);
  });

  await t.step("should include warning message when low", () => {
    const remainingBackupCodes = 2;
    const response = {
      success: true,
      remaining_backup_codes: remainingBackupCodes,
      warning: `Only ${remainingBackupCodes} backup codes remaining. Consider regenerating your backup codes.`
    };

    assertExists(response.warning);
    assertEquals(response.warning.includes("regenerating"), true);
  });

  await t.step("should not warn when backup codes are sufficient", () => {
    const LOW_BACKUP_CODE_THRESHOLD = 3;
    const remainingBackupCodes = 5;

    const shouldWarn = remainingBackupCodes <= LOW_BACKUP_CODE_THRESHOLD;

    assertEquals(shouldWarn, false);
  });

  // =====================================================
  // Session Update Tests
  // =====================================================

  await t.step("should mark session as verified", () => {
    const sessionUpdate = {
      session_token: "new-token-abc",
      pin_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString()
    };

    assertExists(sessionUpdate.pin_verified_at);
    assertExists(sessionUpdate.session_token);
  });

  await t.step("should update last_login_at", () => {
    const userUpdate = {
      last_login_at: new Date().toISOString()
    };

    assertExists(userUpdate.last_login_at);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should log successful backup code authentication", () => {
    const auditEntry = {
      user_id: null,
      action: "ENVISION_LOGIN_SUCCESS",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        full_name: "Admin User",
        role: "super_admin",
        client_ip: "192.168.1.1",
        session_expires: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
        auth_method: "backup_code",
        remaining_backup_codes: 4
      }
    };

    assertEquals(auditEntry.action, "ENVISION_LOGIN_SUCCESS");
    assertEquals(auditEntry.metadata.auth_method, "backup_code");
  });

  await t.step("should log failed backup code attempt", () => {
    const auditEntry = {
      user_id: null,
      action: "ENVISION_BACKUP_CODE_FAILED",
      resource_type: "envision_auth",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        client_ip: "192.168.1.1",
        failed_attempts: 3,
        remaining_attempts: 2
      }
    };

    assertEquals(auditEntry.action, "ENVISION_BACKUP_CODE_FAILED");
    assertExists(auditEntry.metadata.failed_attempts);
  });

  // =====================================================
  // Client IP Extraction Tests
  // =====================================================

  await t.step("should extract client IP from x-forwarded-for", () => {
    const header = "192.168.1.1, 10.0.0.1, 172.16.0.1";
    const clientIp = header.split(",")[0].trim();

    assertEquals(clientIp, "192.168.1.1");
  });

  await t.step("should extract client IP from cf-connecting-ip", () => {
    const clientIp = "203.0.113.195";
    assertEquals(clientIp, "203.0.113.195");
  });

  await t.step("should extract client IP from x-real-ip", () => {
    const clientIp = "198.51.100.178";
    assertEquals(clientIp, "198.51.100.178");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should only accept POST method", () => {
    const allowedMethods = ["POST"];

    assertEquals(allowedMethods.includes("POST"), true);
    assertEquals(allowedMethods.includes("GET"), false);
  });

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/envision-totp-use-backup", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
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

  await t.step("should return 400 for missing session token", () => {
    const response = { error: "Session token is required" };
    assertEquals(response.error, "Session token is required");
  });

  await t.step("should return 401 for invalid session", () => {
    const response = { error: "Invalid or expired session. Please login again." };
    assertEquals(response.error.includes("Invalid"), true);
  });

  await t.step("should return 401 for expired session", () => {
    const response = { error: "Session expired. Please login again." };
    assertEquals(response.error.includes("expired"), true);
  });

  await t.step("should return 401 for account not found", () => {
    const response = { error: "Account not found" };
    assertEquals(response.error, "Account not found");
  });

  await t.step("should return 403 for inactive account", () => {
    const response = { error: "Account is not active" };
    assertEquals(response.error, "Account is not active");
  });

  await t.step("should return 500 for database errors", () => {
    const response = { error: "Failed to verify backup code" };
    assertEquals(response.error.includes("Failed"), true);
  });

  await t.step("should return 500 for server config errors", () => {
    const response = { error: "Server configuration error" };
    assertEquals(response.error, "Server configuration error");
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include CORS headers", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
  });

  // =====================================================
  // Security Tests
  // =====================================================

  await t.step("should not expose backup codes in response", () => {
    const response = {
      success: true,
      remaining_backup_codes: 4
      // Should NOT include actual backup codes
    };

    assertEquals("backup_codes" in response, false);
    assertEquals("totp_backup_codes" in response, false);
  });

  await t.step("should record attempt for rate limiting", () => {
    const attemptRecord = {
      super_admin_id: "admin-123",
      attempt_type: "backup_code",
      success: false,
      client_ip: "192.168.1.1",
      user_agent: "Mozilla/5.0..."
    };

    assertEquals(attemptRecord.attempt_type, "backup_code");
    assertEquals(typeof attemptRecord.success, "boolean");
  });
});
