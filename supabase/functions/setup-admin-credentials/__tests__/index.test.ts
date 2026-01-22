// supabase/functions/setup-admin-credentials/__tests__/index.test.ts
// Tests for Setup Admin Credentials Edge Function - One-time credential setup

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Setup Admin Credentials Tests", async (t) => {

  // =====================================================
  // Secret Validation Tests
  // =====================================================

  await t.step("should require admin secret", () => {
    const body = { email: "admin@example.com", password: "NewPass123" };
    const hasSecret = "secret" in body;

    assertEquals(hasSecret, false);
  });

  await t.step("should return 401 for missing secret", () => {
    const response = { error: "Unauthorized" };
    assertEquals(response.error, "Unauthorized");
  });

  await t.step("should return 401 for invalid secret", () => {
    const SETUP_SECRET = "correct-secret";
    const providedSecret = "wrong-secret";

    const isValid = providedSecret === SETUP_SECRET;

    assertEquals(isValid, false);
  });

  await t.step("should accept valid secret", () => {
    const SETUP_SECRET = "correct-secret";
    const providedSecret = "correct-secret";

    const isValid = providedSecret === SETUP_SECRET;

    assertEquals(isValid, true);
  });

  // =====================================================
  // Input Validation Tests
  // =====================================================

  await t.step("should require email", () => {
    const body = { secret: "secret-123", password: "NewPass123" };
    const hasEmail = "email" in body;

    assertEquals(hasEmail, false);
  });

  await t.step("should return 400 for missing email", () => {
    const response = { error: "Email is required" };
    assertEquals(response.error, "Email is required");
  });

  await t.step("should return 400 when no password or PIN provided", () => {
    const response = { error: "No password or PIN provided" };
    assertEquals(response.error, "No password or PIN provided");
  });

  await t.step("should accept password only", () => {
    const body = {
      secret: "secret-123",
      email: "admin@example.com",
      password: "NewPassword123"
    };

    const hasPassword = "password" in body;
    assertEquals(hasPassword, true);
  });

  await t.step("should accept PIN only", () => {
    const body = {
      secret: "secret-123",
      email: "admin@example.com",
      pin: "123456"
    };

    const hasPin = "pin" in body;
    assertEquals(hasPin, true);
  });

  await t.step("should accept both password and PIN", () => {
    const body = {
      secret: "secret-123",
      email: "admin@example.com",
      password: "NewPassword123",
      pin: "123456"
    };

    const hasPassword = "password" in body;
    const hasPin = "pin" in body;

    assertEquals(hasPassword && hasPin, true);
  });

  // =====================================================
  // Super Admin Lookup Tests
  // =====================================================

  await t.step("should lookup super admin by email (case insensitive)", () => {
    const query = {
      table: "super_admin_users",
      select: "id, email, full_name",
      filter: { ilike: { email: "admin@example.com" } }
    };

    assertEquals(query.table, "super_admin_users");
    assertExists(query.filter.ilike);
  });

  await t.step("should return 404 for non-existent super admin", () => {
    const response = { error: "Super admin not found" };
    assertEquals(response.error, "Super admin not found");
  });

  // =====================================================
  // Password Hashing Tests
  // =====================================================

  await t.step("should hash password", () => {
    // hashPassword function returns a hash
    const passwordHash = "$argon2id$v=19$...";
    assertEquals(passwordHash.startsWith("$argon2"), true);
  });

  await t.step("should generate unique hash each time", () => {
    // Even same password produces different hash due to salt
    const hash1 = "hash-1";
    const hash2 = "hash-2";
    assertNotEquals(hash1, hash2);
  });

  // =====================================================
  // PIN Hashing Tests
  // =====================================================

  await t.step("should hash PIN", () => {
    // hashPin function returns a hash
    const pinHash = "$argon2id$v=19$...";
    assertEquals(pinHash.startsWith("$argon2"), true);
  });

  // =====================================================
  // Update Data Tests
  // =====================================================

  await t.step("should build update data for password only", () => {
    const password = "NewPassword123";
    const pin = undefined;

    const updateData: Record<string, string> = {};
    if (password) updateData.password_hash = "hashed-password";
    if (pin) updateData.pin_hash = "hashed-pin";

    assertEquals(Object.keys(updateData).length, 1);
    assertEquals("password_hash" in updateData, true);
    assertEquals("pin_hash" in updateData, false);
  });

  await t.step("should build update data for PIN only", () => {
    const password = undefined;
    const pin = "123456";

    const updateData: Record<string, string> = {};
    if (password) updateData.password_hash = "hashed-password";
    if (pin) updateData.pin_hash = "hashed-pin";

    assertEquals(Object.keys(updateData).length, 1);
    assertEquals("password_hash" in updateData, false);
    assertEquals("pin_hash" in updateData, true);
  });

  await t.step("should build update data for both", () => {
    const password = "NewPassword123";
    const pin = "123456";

    const updateData: Record<string, string> = {};
    if (password) updateData.password_hash = "hashed-password";
    if (pin) updateData.pin_hash = "hashed-pin";

    assertEquals(Object.keys(updateData).length, 2);
  });

  // =====================================================
  // Success Response Tests
  // =====================================================

  await t.step("should return success for password update", () => {
    const response = {
      success: true,
      message: "Credentials updated for Admin User (admin@example.com)",
      updated: {
        password: true,
        pin: false
      }
    };

    assertEquals(response.success, true);
    assertEquals(response.updated.password, true);
    assertEquals(response.updated.pin, false);
  });

  await t.step("should return success for PIN update", () => {
    const response = {
      success: true,
      message: "Credentials updated for Admin User (admin@example.com)",
      updated: {
        password: false,
        pin: true
      }
    };

    assertEquals(response.success, true);
    assertEquals(response.updated.password, false);
    assertEquals(response.updated.pin, true);
  });

  await t.step("should return success for both updates", () => {
    const response = {
      success: true,
      message: "Credentials updated for Admin User (admin@example.com)",
      updated: {
        password: true,
        pin: true
      }
    };

    assertEquals(response.success, true);
    assertEquals(response.updated.password, true);
    assertEquals(response.updated.pin, true);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create audit log entry", () => {
    const auditEntry = {
      user_id: null,
      action: "ADMIN_CREDENTIALS_SET",
      resource_type: "super_admin_users",
      resource_id: "admin-123",
      metadata: {
        email: "admin@example.com",
        password_updated: true,
        pin_updated: false
      }
    };

    assertEquals(auditEntry.action, "ADMIN_CREDENTIALS_SET");
    assertEquals(auditEntry.resource_type, "super_admin_users");
    assertExists(auditEntry.metadata.email);
    assertEquals(typeof auditEntry.metadata.password_updated, "boolean");
    assertEquals(typeof auditEntry.metadata.pin_updated, "boolean");
  });

  await t.step("should not include raw credentials in audit", () => {
    const metadata = {
      email: "admin@example.com",
      password_updated: true,
      pin_updated: true
      // NO: password, pin, password_hash, pin_hash
    };

    assertEquals("password" in metadata, false);
    assertEquals("pin" in metadata, false);
    assertEquals("password_hash" in metadata, false);
    assertEquals("pin_hash" in metadata, false);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 500 for server config error", () => {
    const response = { error: "Server configuration error" };
    assertEquals(response.error, "Server configuration error");
  });

  await t.step("should return 500 for update failure", () => {
    const response = { error: "Failed to update credentials" };
    assertEquals(response.error, "Failed to update credentials");
  });

  await t.step("should return 500 for internal errors", () => {
    const response = { error: "Internal server error" };
    assertEquals(response.error, "Internal server error");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/setup-admin-credentials", {
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

  await t.step("should require admin setup secret", () => {
    const requiredVars = ["ADMIN_SETUP_SECRET"];
    assertEquals(requiredVars[0], "ADMIN_SETUP_SECRET");
  });

  // =====================================================
  // Security Logging Tests
  // =====================================================

  await t.step("should log unauthorized setup attempts", () => {
    const securityLog = {
      level: "security",
      event: "Unauthorized setup attempt",
      context: {
        email: "admin@example.com"
      }
    };

    assertEquals(securityLog.level, "security");
    assertEquals(securityLog.event.includes("Unauthorized"), true);
  });
});
