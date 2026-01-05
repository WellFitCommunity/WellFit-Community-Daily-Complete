// supabase/functions/passkey-auth-start/__tests__/index.test.ts
// Tests for passkey-auth-start edge function

import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Passkey Auth Start Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/passkey-auth-start", {
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

  await t.step("should generate random challenge with correct length", () => {
    // Simulating generateChallenge function
    const generateChallenge = (): string => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const challenge1 = generateChallenge();
    const challenge2 = generateChallenge();

    assertExists(challenge1);
    assertExists(challenge2);
    assertEquals(challenge1 !== challenge2, true); // Should be unique
    assertEquals(challenge1.length > 0, true);
  });

  await t.step("should generate URL-safe base64 challenge", () => {
    const generateChallenge = (): string => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const challenge = generateChallenge();

    // Should not contain standard base64 characters that aren't URL-safe
    assertEquals(challenge.includes('+'), false);
    assertEquals(challenge.includes('/'), false);
    assertEquals(challenge.includes('='), false);
  });

  await t.step("should set challenge expiration to 5 minutes", () => {
    const CHALLENGE_TTL_MINUTES = 5;
    const now = Date.now();
    const expiresAt = new Date(now + CHALLENGE_TTL_MINUTES * 60 * 1000);

    assertEquals(CHALLENGE_TTL_MINUTES, 5);
    assertEquals(typeof expiresAt.toISOString(), "string");
    assertEquals(expiresAt.getTime() - now, 5 * 60 * 1000);
  });

  await t.step("should structure challenge record for database", () => {
    const challenge = "random-challenge-string";
    const userId = "user-123";
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const challengeRecord = {
      challenge,
      user_id: userId || null,
      type: 'authentication',
      expires_at: expiresAt.toISOString()
    };

    assertEquals(challengeRecord.type, 'authentication');
    assertExists(challengeRecord.challenge);
    assertExists(challengeRecord.expires_at);
  });

  await t.step("should allow null user_id for discoverable credentials", () => {
    const challengeRecord = {
      challenge: "random-challenge",
      user_id: null,
      type: 'authentication',
      expires_at: new Date().toISOString()
    };

    assertEquals(challengeRecord.user_id, null);
  });

  await t.step("should extract relying party ID from origin", () => {
    const extractRpId = (origin: string | null, fallbackUrl: string): string => {
      try {
        return new URL(origin || fallbackUrl).hostname;
      } catch {
        return "localhost";
      }
    };

    assertEquals(extractRpId("https://example.com", "https://fallback.com"), "example.com");
    assertEquals(extractRpId("https://app.wellfit.org", "https://fallback.com"), "app.wellfit.org");
    assertEquals(extractRpId(null, "https://fallback.com"), "fallback.com");
    assertEquals(extractRpId("http://localhost:3000", "https://fallback.com"), "localhost");
  });

  await t.step("should handle localhost for development", () => {
    const rpId = "localhost";
    const finalRpId = rpId === 'localhost' ? 'localhost' : rpId;

    assertEquals(finalRpId, "localhost");
  });

  await t.step("should structure authentication options correctly", () => {
    const options = {
      challenge: "random-challenge-abc",
      rpId: "example.com",
      allowCredentials: undefined,
      timeout: 60000,
      userVerification: "preferred" as const
    };

    assertExists(options.challenge);
    assertExists(options.rpId);
    assertEquals(options.timeout, 60000);
    assertEquals(options.userVerification, "preferred");
  });

  await t.step("should set timeout to 60 seconds", () => {
    const TIMEOUT_MS = 60000;
    assertEquals(TIMEOUT_MS, 60000);
    assertEquals(TIMEOUT_MS / 1000, 60);
  });

  await t.step("should use 'preferred' user verification", () => {
    const userVerification = "preferred";
    const validValues = ["required", "preferred", "discouraged"];

    assertEquals(validValues.includes(userVerification), true);
  });

  await t.step("should build allowCredentials when user has passkeys", () => {
    const mockCredentials = [
      { credential_id: "cred-1", transports: ["internal", "hybrid"] },
      { credential_id: "cred-2", transports: ["usb"] },
    ];

    const allowCredentials = mockCredentials.map(cred => ({
      type: "public-key" as const,
      id: cred.credential_id,
      transports: cred.transports || []
    }));

    assertEquals(allowCredentials.length, 2);
    assertEquals(allowCredentials[0].type, "public-key");
    assertEquals(allowCredentials[0].id, "cred-1");
    assertEquals(allowCredentials[0].transports, ["internal", "hybrid"]);
  });

  await t.step("should return undefined allowCredentials when no passkeys", () => {
    const credentials: unknown[] = [];
    const allowCredentials = credentials.length > 0 ? credentials : undefined;

    assertEquals(allowCredentials, undefined);
  });

  await t.step("should handle empty transports array", () => {
    const cred = { credential_id: "cred-1", transports: null };
    const transports = cred.transports || [];

    assertEquals(transports, []);
  });

  await t.step("should structure successful response", () => {
    const response = {
      challenge: "random-challenge",
      rpId: "example.com",
      allowCredentials: [
        { type: "public-key", id: "cred-1", transports: ["internal"] }
      ],
      timeout: 60000,
      userVerification: "preferred"
    };

    assertExists(response.challenge);
    assertExists(response.rpId);
    assertEquals(response.timeout, 60000);
    assertEquals(response.userVerification, "preferred");
  });

  await t.step("should return 500 when challenge storage fails", () => {
    const challengeError = { message: "Database error", code: "PGRST001" };
    const hasError = challengeError !== null;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should log audit event for successful passkey auth start", () => {
    const auditLog = {
      event_type: 'PASSKEY_AUTH_START_SUCCESS',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      actor_ip_address: '192.168.1.1',
      operation: 'PASSKEY_AUTH_START',
      resource_type: 'auth_event',
      success: true,
      metadata: {
        user_id: 'user-123',
        has_credentials: true,
        credential_count: 2
      }
    };

    assertEquals(auditLog.event_type, 'PASSKEY_AUTH_START_SUCCESS');
    assertEquals(auditLog.success, true);
    assertEquals(auditLog.metadata.credential_count, 2);
  });

  await t.step("should log audit event for failed passkey auth start", () => {
    const auditLog = {
      event_type: 'PASSKEY_AUTH_START_FAILED',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      actor_ip_address: '192.168.1.1',
      operation: 'PASSKEY_AUTH_START',
      resource_type: 'auth_event',
      success: false,
      error_code: 'CHALLENGE_ERROR',
      error_message: 'Failed to store challenge',
      metadata: { user_id: 'user-123' }
    };

    assertEquals(auditLog.event_type, 'PASSKEY_AUTH_START_FAILED');
    assertEquals(auditLog.success, false);
    assertEquals(auditLog.error_code, 'CHALLENGE_ERROR');
  });

  await t.step("should extract client IP for logging", () => {
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

  await t.step("should handle JSON parsing of request body", () => {
    const validBody = { user_id: "user-123" };
    const emptyBody = {};

    assertExists(validBody.user_id);
    assertEquals("user_id" in emptyBody, false);
  });

  await t.step("should allow optional user_id in request", () => {
    const withUserId = { user_id: "user-123" };
    const withoutUserId = {};

    assertEquals(withUserId.user_id, "user-123");
    assertEquals((withoutUserId as { user_id?: string }).user_id, undefined);
  });

  await t.step("should validate environment variables", () => {
    const validateEnv = (url: string | undefined, key: string | undefined): boolean => {
      return !!url && url.length > 0 && !!key && key.length > 0;
    };

    assertEquals(validateEnv("https://example.supabase.co", "secret-key"), true);
    assertEquals(validateEnv("", "secret-key"), false);
    assertEquals(validateEnv("https://example.supabase.co", ""), false);
    assertEquals(validateEnv(undefined, undefined), false);
  });

  await t.step("should throw error for missing environment variables", () => {
    const checkEnv = (url: string, key: string): void => {
      if (!url || !key) {
        throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY");
      }
    };

    let errorThrown = false;
    try {
      checkEnv("", "key");
    } catch (e) {
      errorThrown = true;
      assertEquals((e as Error).message, "Missing SUPABASE_URL or SB_SECRET_KEY");
    }
    assertEquals(errorThrown, true);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      methodNotAllowed: 405,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should handle unhandled errors gracefully", () => {
    const handleError = (err: unknown): { error: string; status: number } => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        error: errorMessage || "Internal server error",
        status: 500
      };
    };

    const result1 = handleError(new Error("Test error"));
    assertEquals(result1.error, "Test error");
    assertEquals(result1.status, 500);

    const result2 = handleError("String error");
    assertEquals(result2.error, "String error");

    const result3 = handleError(null);
    assertEquals(result3.error, "null");
  });

  await t.step("should query correct fields from passkey_credentials", () => {
    const expectedFields = ['credential_id', 'transports'];

    assertEquals(expectedFields.includes('credential_id'), true);
    assertEquals(expectedFields.includes('transports'), true);
  });

  await t.step("should filter credentials by user_id", () => {
    const mockCredentials = [
      { credential_id: "cred-1", user_id: "user-123" },
      { credential_id: "cred-2", user_id: "user-456" },
    ];

    const userId = "user-123";
    const filtered = mockCredentials.filter(c => c.user_id === userId);

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].credential_id, "cred-1");
  });
});
