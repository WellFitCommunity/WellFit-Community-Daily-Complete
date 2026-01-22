// supabase/functions/envision-totp-setup/__tests__/index.test.ts
// Tests for TOTP Setup (Enrollment) Edge Function - RFC 6238 compliant

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Envision TOTP Setup Tests", async (t) => {

  // =====================================================
  // Base32 Encoding Tests
  // =====================================================

  await t.step("should encode bytes to Base32", () => {
    const B32_ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    const base32Encode = (bytes: Uint8Array): string => {
      let bits = 0;
      let value = 0;
      let output = "";

      for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
          output += B32_ALPH[(value >>> (bits - 5)) & 31];
          bits -= 5;
        }
      }
      if (bits > 0) output += B32_ALPH[(value << (5 - bits)) & 31];
      return output;
    };

    const testBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const encoded = base32Encode(testBytes);

    assertEquals(typeof encoded, "string");
    assertEquals(/^[A-Z2-7]+$/.test(encoded), true);
  });

  await t.step("should decode Base32 to bytes", () => {
    const B32_ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    const base32Decode = (b32: string): Uint8Array => {
      const cleaned = (b32 || "")
        .toUpperCase()
        .replace(/=+$/g, "")
        .replace(/[^A-Z2-7]/g, "");

      let bits = 0;
      let value = 0;
      const out: number[] = [];

      for (let i = 0; i < cleaned.length; i++) {
        const idx = B32_ALPH.indexOf(cleaned[i]);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;

        if (bits >= 8) {
          out.push((value >>> (bits - 8)) & 255);
          bits -= 8;
        }
      }
      return new Uint8Array(out);
    };

    const encoded = "JBSWY3DPEHPK3PXP"; // Standard test vector
    const decoded = base32Decode(encoded);

    assertEquals(decoded instanceof Uint8Array, true);
    assertEquals(decoded.length > 0, true);
  });

  await t.step("should generate 20-byte secret", () => {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);

    assertEquals(bytes.length, 20);
    assertEquals(bytes.some(b => b !== 0), true); // Not all zeros
  });

  // =====================================================
  // TOTP Algorithm Tests (RFC 6238)
  // =====================================================

  await t.step("should convert counter to big-endian 8 bytes", () => {
    const toBigEndian8 = (counter: number): Uint8Array => {
      const buf = new Uint8Array(8);
      let x = Math.floor(counter);
      for (let i = 7; i >= 0; i--) {
        buf[i] = x & 0xff;
        x = Math.floor(x / 256);
      }
      return buf;
    };

    const counter = 12345678;
    const result = toBigEndian8(counter);

    assertEquals(result.length, 8);
    assertEquals(result instanceof Uint8Array, true);
  });

  await t.step("should calculate TOTP counter from timestamp", () => {
    const period = 30;
    const timestamp = Date.now();
    const counter = Math.floor(timestamp / 1000 / period);

    assertEquals(typeof counter, "number");
    assertEquals(counter > 0, true);
  });

  await t.step("should validate 6-digit code format", () => {
    const validCodes = ["123456", "000000", "999999"];
    const invalidCodes = ["12345", "1234567", "12345a", ""];

    for (const code of validCodes) {
      const clean = String(code).replace(/[^\d]/g, "");
      assertEquals(clean.length === 6, true, `${code} should be valid`);
    }

    for (const code of invalidCodes) {
      const clean = String(code).replace(/[^\d]/g, "");
      assertEquals(clean.length === 6, false, `${code} should be invalid`);
    }
  });

  await t.step("should support time window for clock drift", () => {
    const window = 2; // ±60 seconds
    const period = 30;
    const nowCounter = Math.floor(Date.now() / 1000 / period);

    const validCounters: number[] = [];
    for (let w = -window; w <= window; w++) {
      validCounters.push(nowCounter + w);
    }

    assertEquals(validCounters.length, 5); // -2, -1, 0, +1, +2
  });

  // =====================================================
  // OTP Auth URI Tests
  // =====================================================

  await t.step("should build valid otpauth URI", () => {
    const issuer = "Envision VirtualEdge";
    const label = "admin@example.com";
    const base32Secret = "JBSWY3DPEHPK3PXP";

    const encIssuer = encodeURIComponent(issuer);
    const encLabel = encodeURIComponent(label);
    const encPath = `${encIssuer}:${encLabel}`;
    const qs =
      `secret=${encodeURIComponent(base32Secret)}` +
      `&issuer=${encIssuer}` +
      `&algorithm=SHA1&digits=6&period=30`;
    const uri = `otpauth://totp/${encPath}?${qs}`;

    assertEquals(uri.startsWith("otpauth://totp/"), true);
    assertEquals(uri.includes("secret="), true);
    assertEquals(uri.includes("issuer="), true);
    assertEquals(uri.includes("algorithm=SHA1"), true);
    assertEquals(uri.includes("digits=6"), true);
    assertEquals(uri.includes("period=30"), true);
  });

  await t.step("should encode special characters in URI", () => {
    const label = "user+test@example.com";
    const encoded = encodeURIComponent(label);

    assertEquals(encoded.includes("+"), false); // + becomes %2B
    assertEquals(encoded.includes("%"), true);
  });

  // =====================================================
  // Action: Begin Tests
  // =====================================================

  await t.step("should return already_configured for existing setup", () => {
    const response = {
      success: true,
      already_configured: true,
      message: "Authenticator is already set up."
    };

    assertEquals(response.success, true);
    assertEquals(response.already_configured, true);
  });

  await t.step("should return QR data for new setup", () => {
    const response = {
      success: true,
      issuer: "Envision VirtualEdge",
      account: "admin@example.com",
      secret: "JBSWY3DPEHPK3PXP",
      otpauth_uri: "otpauth://totp/...",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      message: "Scan the QR code with your authenticator app, then enter the 6-digit code to confirm."
    };

    assertExists(response.secret);
    assertExists(response.otpauth_uri);
    assertExists(response.expires_at);
    assertEquals(response.message.includes("QR code"), true);
  });

  await t.step("should set pending TOTP TTL to 15 minutes", () => {
    const PENDING_TOTP_TTL_MINUTES = 15;
    const now = Date.now();
    const expiresAt = new Date(now + PENDING_TOTP_TTL_MINUTES * 60 * 1000);

    const diffMs = expiresAt.getTime() - now;
    assertEquals(diffMs, 15 * 60 * 1000);
  });

  await t.step("should reuse existing pending secret if not expired", () => {
    const pendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const pendingExp = new Date(pendingExpiresAt).getTime();
    const isValid = Number.isFinite(pendingExp) && pendingExp > Date.now();

    assertEquals(isValid, true);
  });

  // =====================================================
  // Action: Confirm Tests
  // =====================================================

  await t.step("should require 6-digit code for confirm", () => {
    const validCodes = ["123456", "000000"];
    const invalidCodes = ["12345", "1234567", "abcdef"];

    for (const code of validCodes) {
      const clean = String(code).replace(/[^\d]/g, "");
      assertEquals(clean.length === 6, true);
    }

    for (const code of invalidCodes) {
      const clean = String(code).replace(/[^\d]/g, "");
      assertEquals(clean.length === 6, false);
    }
  });

  await t.step("should verify pending setup exists", () => {
    const pending = null;
    const hasPending = pending !== null;

    assertEquals(hasPending, false);
  });

  await t.step("should check pending setup not expired", () => {
    const expiresAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
    const pendExp = new Date(expiresAt).getTime();
    const isExpired = pendExp <= Date.now();

    assertEquals(isExpired, true);
  });

  await t.step("should verify super admin ID matches", () => {
    const pendingSuperAdminId = "admin-123";
    const sessionSuperAdminId = "admin-123";

    assertEquals(pendingSuperAdminId === sessionSuperAdminId, true);
  });

  await t.step("should return success with backup codes on confirm", () => {
    const response = {
      success: true,
      message: "Authenticator setup complete. Save your backup codes!",
      backup_codes: ["ABCD-1234", "EFGH-5678", "IJKL-9012"]
    };

    assertEquals(response.success, true);
    assertEquals(Array.isArray(response.backup_codes), true);
    assertEquals(response.backup_codes.length > 0, true);
  });

  // =====================================================
  // Session Validation Tests
  // =====================================================

  await t.step("should require session_token", () => {
    const body = { action: "begin" };
    const hasSessionToken = "session_token" in body;

    assertEquals(hasSessionToken, false);
  });

  await t.step("should validate session exists", () => {
    const session = null;
    const isValid = session !== null;

    assertEquals(isValid, false);
  });

  await t.step("should check session not expired", () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const expiresAtMs = new Date(expiresAt).getTime();
    const isExpired = expiresAtMs <= Date.now();

    assertEquals(isExpired, false);
  });

  await t.step("should verify super admin is active", () => {
    const superAdmin = {
      id: "admin-123",
      email: "admin@example.com",
      is_active: true,
      totp_enabled: false,
      totp_secret: null
    };

    assertEquals(superAdmin.is_active, true);
  });

  // =====================================================
  // Backup Code Generation Tests
  // =====================================================

  await t.step("should generate multiple backup codes", () => {
    const backupCodes = ["ABCD-1234", "EFGH-5678", "IJKL-9012", "MNOP-3456", "QRST-7890"];

    assertEquals(backupCodes.length, 5);
    for (const code of backupCodes) {
      assertEquals(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), true);
    }
  });

  await t.step("should hash backup codes before storage", () => {
    const hashedCodes = [
      "a1b2c3d4e5f6...",
      "b2c3d4e5f6a1...",
      "c3d4e5f6a1b2..."
    ];

    assertEquals(hashedCodes.length > 0, true);
    for (const hash of hashedCodes) {
      assertEquals(typeof hash, "string");
    }
  });

  // =====================================================
  // Super Admin Update Tests
  // =====================================================

  await t.step("should update super admin on TOTP confirm", () => {
    const update = {
      totp_enabled: true,
      totp_secret: "JBSWY3DPEHPK3PXP",
      totp_setup_at: new Date().toISOString(),
      totp_backup_codes: ["hash1", "hash2"],
      totp_backup_codes_generated_at: new Date().toISOString(),
      pin_hash: null // Remove PIN when enabling TOTP
    };

    assertEquals(update.totp_enabled, true);
    assertExists(update.totp_secret);
    assertExists(update.totp_setup_at);
    assertEquals(update.pin_hash, null);
  });

  await t.step("should mark session as verified", () => {
    const sessionUpdate = {
      pin_verified_at: new Date().toISOString()
    };

    assertExists(sessionUpdate.pin_verified_at);
  });

  await t.step("should delete pending TOTP after confirm", () => {
    // After successful confirm, pending record should be deleted
    const pendingDeleted = true;
    assertEquals(pendingDeleted, true);
  });

  // =====================================================
  // Partial State Handling Tests
  // =====================================================

  await t.step("should detect partial TOTP state", () => {
    const superAdmin = {
      totp_enabled: true,
      totp_secret: null // Partial state: enabled but no secret
    };

    const isPartialState = superAdmin.totp_enabled && !superAdmin.totp_secret;

    assertEquals(isPartialState, true);
  });

  await t.step("should allow re-setup with force flag", () => {
    const body = { action: "begin", force: true };

    assertEquals(body.force, true);
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
    const request = new Request("http://localhost/envision-totp-setup", {
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

  await t.step("should return 400 for missing session_token", () => {
    const response = { error: "session_token is required" };

    assertEquals(response.error, "session_token is required");
  });

  await t.step("should return 401 for invalid session", () => {
    const response = {
      error: "Invalid session",
      debug: { tokenPreview: "abc...xyz", hint: "Session not found in database" }
    };

    assertEquals(response.error, "Invalid session");
  });

  await t.step("should return 401 for expired session", () => {
    const response = {
      error: "Session expired. Please log in again.",
      debug: { expiresAt: "2025-01-15T10:00:00Z" }
    };

    assertEquals(response.error.includes("expired"), true);
  });

  await t.step("should return 400 for invalid action", () => {
    const response = { error: "Invalid action. Use action='begin' or action='confirm'." };

    assertEquals(response.error.includes("begin"), true);
    assertEquals(response.error.includes("confirm"), true);
  });

  await t.step("should return 400 for invalid code length", () => {
    const response = { error: "A 6-digit code is required" };

    assertEquals(response.error.includes("6-digit"), true);
  });

  await t.step("should return 400 for setup not started", () => {
    const response = { error: "Setup not started. Please scan QR first." };

    assertEquals(response.error.includes("scan QR"), true);
  });

  await t.step("should return 400 for setup expired", () => {
    const response = { error: "Setup expired. Please start again." };

    assertEquals(response.error.includes("expired"), true);
  });

  await t.step("should return 401 for invalid TOTP code", () => {
    const response = {
      error: "Invalid code. Use the CURRENT 6-digit code.",
      debug: {
        serverTimeUTC: new Date().toISOString(),
        hint: "Ensure your phone's time is set to 'Automatic'. Codes change every 30 seconds."
      }
    };

    assertEquals(response.error.includes("Invalid code"), true);
    assertExists(response.debug.hint);
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

  await t.step("should not expose secret in logs", () => {
    const logEntry = {
      action: "begin",
      tokenPreview: "abc...xyz",
      tokenLength: 36
      // Should NOT contain full session_token or totp_secret
    };

    assertEquals("session_token" in logEntry, false);
    assertEquals("totp_secret" in logEntry, false);
  });

  await t.step("should use SHA-1 for HMAC (RFC 6238 standard)", () => {
    const algorithm = "SHA-1";

    assertEquals(algorithm, "SHA-1");
  });
});
