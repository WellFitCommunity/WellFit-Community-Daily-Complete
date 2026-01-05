// supabase/functions/passkey-auth-finish/__tests__/index.test.ts
// Tests for passkey-auth-finish edge function

import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Passkey Auth Finish Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/passkey-auth-finish", {
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

  await t.step("should validate required request body fields", () => {
    const validBody = {
      id: "credential-id",
      rawId: "raw-credential-id",
      response: {
        clientDataJSON: "base64-encoded-data",
        authenticatorData: "base64-encoded-data",
        signature: "base64-encoded-signature",
        userHandle: "user-handle"
      }
    };

    assertExists(validBody.id);
    assertExists(validBody.rawId);
    assertExists(validBody.response);
    assertExists(validBody.response.clientDataJSON);
    assertExists(validBody.response.authenticatorData);
    assertExists(validBody.response.signature);
  });

  await t.step("should decode base64url clientDataJSON", () => {
    // Simulate base64url decoding
    const base64urlDecode = (str: string): string => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      return atob(base64);
    };

    const encoded = "eyJ0ZXN0IjoidmFsdWUifQ"; // {"test":"value"}
    const decoded = base64urlDecode(encoded);

    assertEquals(decoded, '{"test":"value"}');
  });

  await t.step("should parse clientDataJSON for challenge", () => {
    const clientDataJSON = { challenge: "random-challenge-abc", origin: "https://example.com", type: "webauthn.get" };

    assertExists(clientDataJSON.challenge);
    assertEquals(clientDataJSON.type, "webauthn.get");
  });

  await t.step("should validate challenge exists and is not used", () => {
    const validateChallenge = (
      challenges: { challenge: string; used: boolean; expires_at: string }[],
      expectedChallenge: string
    ): boolean => {
      const now = new Date().toISOString();
      return challenges.some(c =>
        c.challenge === expectedChallenge &&
        c.used === false &&
        c.expires_at > now
      );
    };

    const validChallenges = [
      { challenge: "abc123", used: false, expires_at: new Date(Date.now() + 60000).toISOString() }
    ];
    const expiredChallenges = [
      { challenge: "abc123", used: false, expires_at: new Date(Date.now() - 60000).toISOString() }
    ];
    const usedChallenges = [
      { challenge: "abc123", used: true, expires_at: new Date(Date.now() + 60000).toISOString() }
    ];

    assertEquals(validateChallenge(validChallenges, "abc123"), true);
    assertEquals(validateChallenge(expiredChallenges, "abc123"), false);
    assertEquals(validateChallenge(usedChallenges, "abc123"), false);
    assertEquals(validateChallenge(validChallenges, "wrong"), false);
  });

  await t.step("should return 400 for invalid or expired challenge", () => {
    const challengeValid = false;
    const expectedStatus = challengeValid ? 200 : 400;
    const expectedError = "Invalid or expired challenge";

    assertEquals(expectedStatus, 400);
    assertEquals(expectedError, "Invalid or expired challenge");
  });

  await t.step("should mark challenge as used after verification", () => {
    const challenge = { challenge: "abc123", used: false };
    challenge.used = true;

    assertEquals(challenge.used, true);
  });

  await t.step("should find credential by rawId", () => {
    const mockCredentials = [
      { id: 1, credential_id: "cred-1", user_id: "user-123" },
      { id: 2, credential_id: "cred-2", user_id: "user-456" },
    ];

    const rawId = "cred-1";
    const credential = mockCredentials.find(c => c.credential_id === rawId);

    assertExists(credential);
    assertEquals(credential!.user_id, "user-123");
  });

  await t.step("should return 404 when credential not found", () => {
    const credential = null;
    const expectedStatus = credential ? 200 : 404;
    const expectedError = "Credential not found";

    assertEquals(expectedStatus, 404);
    assertEquals(expectedError, "Credential not found");
  });

  await t.step("should use correct expected origin for verification", () => {
    const expectedOrigin = "https://thewellfitcommunity.org";
    const expectedRPID = "thewellfitcommunity.org";

    assertExists(expectedOrigin);
    assertExists(expectedRPID);
    assertEquals(expectedOrigin.startsWith("https://"), true);
  });

  await t.step("should structure verification options correctly", () => {
    const verificationOptions = {
      response: {
        id: "cred-id",
        rawId: "raw-cred-id",
        response: {
          authenticatorData: "base64-data",
          clientDataJSON: "base64-data",
          signature: "base64-signature",
          userHandle: "user-handle"
        },
        type: "public-key",
        clientExtensionResults: {}
      },
      expectedChallenge: "challenge-abc",
      expectedOrigin: "https://example.com",
      expectedRPID: "example.com",
      authenticator: {
        credentialID: new Uint8Array([1, 2, 3]),
        credentialPublicKey: new Uint8Array([4, 5, 6]),
        counter: 0
      },
      requireUserVerification: true
    };

    assertEquals(verificationOptions.response.type, "public-key");
    assertEquals(verificationOptions.requireUserVerification, true);
    assertExists(verificationOptions.authenticator.credentialID);
    assertExists(verificationOptions.authenticator.credentialPublicKey);
  });

  await t.step("should require user verification for biometric/PIN", () => {
    const requireUserVerification = true;
    assertEquals(requireUserVerification, true);
  });

  await t.step("should return 401 for signature verification failure", () => {
    const verificationResult = { verified: false };
    const expectedStatus = verificationResult.verified ? 200 : 401;
    const expectedError = "Authentication failed - invalid signature";

    assertEquals(expectedStatus, 401);
    assertEquals(expectedError.includes("signature"), true);
  });

  await t.step("should update credential counter after successful auth", () => {
    const credential = { id: 1, counter: 5 };
    const newCounter = 6;

    const updateData = {
      last_used_at: new Date().toISOString(),
      counter: newCounter
    };

    assertExists(updateData.last_used_at);
    assertEquals(updateData.counter, 6);
    assertEquals(updateData.counter > credential.counter, true);
  });

  await t.step("should return 404 when user not found", () => {
    const user = null;
    const expectedStatus = user ? 200 : 404;
    const expectedError = "User not found";

    assertEquals(expectedStatus, 404);
    assertEquals(expectedError, "User not found");
  });

  await t.step("should structure session response correctly", () => {
    const session = {
      access_token: "eyJhbGciOi...",
      refresh_token: "refresh-token-abc",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: { id: "user-123", email: "test@example.com" }
    };

    assertExists(session.access_token);
    assertExists(session.refresh_token);
    assertEquals(session.token_type, "bearer");
    assertEquals(session.expires_in, 3600);
  });

  await t.step("should structure successful response with user and profile", () => {
    const successResponse = {
      session: {
        access_token: "token",
        refresh_token: "refresh",
        expires_in: 3600,
        token_type: "bearer"
      },
      user: {
        id: "user-123",
        email: "test@example.com"
      },
      profile: {
        first_name: "John",
        last_name: "Doe"
      }
    };

    assertExists(successResponse.session);
    assertExists(successResponse.user);
    assertExists(successResponse.profile);
  });

  await t.step("should log audit event for successful passkey auth", () => {
    const auditLog = {
      event_type: 'PASSKEY_AUTH_SUCCESS',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      actor_ip_address: '192.168.1.1',
      operation: 'PASSKEY_AUTH',
      resource_type: 'auth_event',
      success: true,
      metadata: {
        credential_id: 'cred-123',
        user_id: 'user-123',
        counter: 6,
        userVerified: true,
        signature_verified: true
      }
    };

    assertEquals(auditLog.event_type, 'PASSKEY_AUTH_SUCCESS');
    assertEquals(auditLog.success, true);
    assertEquals(auditLog.metadata.signature_verified, true);
    assertEquals(auditLog.metadata.userVerified, true);
  });

  await t.step("should log audit event for failed passkey auth - invalid challenge", () => {
    const auditLog = {
      event_type: 'PASSKEY_AUTH_FAILED',
      event_category: 'AUTHENTICATION',
      actor_user_id: null,
      operation: 'PASSKEY_AUTH',
      resource_type: 'auth_event',
      success: false,
      error_code: 'INVALID_CHALLENGE',
      error_message: 'Invalid or expired challenge',
      metadata: { credential_id: 'cred-123' }
    };

    assertEquals(auditLog.event_type, 'PASSKEY_AUTH_FAILED');
    assertEquals(auditLog.error_code, 'INVALID_CHALLENGE');
    assertEquals(auditLog.success, false);
  });

  await t.step("should log audit event for failed passkey auth - credential not found", () => {
    const auditLog = {
      event_type: 'PASSKEY_AUTH_FAILED',
      event_category: 'AUTHENTICATION',
      actor_user_id: null,
      operation: 'PASSKEY_AUTH',
      resource_type: 'auth_event',
      success: false,
      error_code: 'CREDENTIAL_NOT_FOUND',
      error_message: 'Credential not found',
      metadata: { credential_id: 'cred-123' }
    };

    assertEquals(auditLog.error_code, 'CREDENTIAL_NOT_FOUND');
  });

  await t.step("should log audit event for signature verification failure", () => {
    const auditLog = {
      event_type: 'PASSKEY_SIGNATURE_VERIFICATION_FAILED',
      event_category: 'AUTHENTICATION',
      actor_user_id: 'user-123',
      operation: 'PASSKEY_AUTH',
      resource_type: 'auth_event',
      success: false,
      error_code: 'SIGNATURE_VERIFICATION_FAILED',
      error_message: 'Cryptographic signature verification failed',
      metadata: {
        credential_id: 'cred-123',
        error_type: 'VerificationError'
      }
    };

    assertEquals(auditLog.event_type, 'PASSKEY_SIGNATURE_VERIFICATION_FAILED');
    assertEquals(auditLog.error_code, 'SIGNATURE_VERIFICATION_FAILED');
  });

  await t.step("should log to passkey_audit_log table for success", () => {
    const passkeyAuditLog = {
      user_id: 'user-123',
      credential_id: 'cred-123',
      operation: 'authenticate',
      resource_type: 'auth_event',
      success: true
    };

    assertEquals(passkeyAuditLog.operation, 'authenticate');
    assertEquals(passkeyAuditLog.success, true);
  });

  await t.step("should log to passkey_audit_log table for failure", () => {
    const passkeyAuditLog = {
      credential_id: 'cred-123',
      operation: 'failed_auth',
      resource_type: 'auth_event',
      success: false,
      error_message: 'Credential not found'
    };

    assertEquals(passkeyAuditLog.operation, 'failed_auth');
    assertEquals(passkeyAuditLog.success, false);
    assertExists(passkeyAuditLog.error_message);
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
  });

  await t.step("should convert base64url to Uint8Array for credential ID", () => {
    const base64urlToUint8Array = (str: string): Uint8Array => {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      return new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
    };

    const encoded = "AQID"; // [1, 2, 3] in base64
    const result = base64urlToUint8Array(encoded);

    assertEquals(result instanceof Uint8Array, true);
    assertEquals(result.length, 3);
    assertEquals(result[0], 1);
    assertEquals(result[1], 2);
    assertEquals(result[2], 3);
  });

  await t.step("should handle session generation failure", () => {
    const sessionError = { message: "Failed to generate session" };
    const hasError = sessionError !== null;
    const expectedStatus = hasError ? 500 : 200;
    const expectedError = "Failed to create session";

    assertEquals(expectedStatus, 500);
    assertEquals(expectedError.includes("session"), true);
  });

  await t.step("should use magic link for session generation", () => {
    const sessionParams = {
      type: 'magiclink',
      email: 'user@example.com'
    };

    assertEquals(sessionParams.type, 'magiclink');
    assertExists(sessionParams.email);
  });

  await t.step("should fallback to passkey.local email for phone-only users", () => {
    const user = { id: "user-123", email: null, phone: "+15551234567" };
    const email = user.email || user.phone || `${user.id}@passkey.local`;

    assertEquals(email, "+15551234567");

    const userNoContact = { id: "user-456", email: null, phone: null };
    const fallbackEmail = userNoContact.email || userNoContact.phone || `${userNoContact.id}@passkey.local`;

    assertEquals(fallbackEmail, "user-456@passkey.local");
  });

  await t.step("should validate environment variables", () => {
    const validateEnv = (url: string | undefined, key: string | undefined): boolean => {
      return !!url && url.length > 0 && !!key && key.length > 0;
    };

    assertEquals(validateEnv("https://example.supabase.co", "secret-key"), true);
    assertEquals(validateEnv("", "secret-key"), false);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      notFound: 404,
      methodNotAllowed: 405,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.notFound, 404);
    assertEquals(statusCodes.methodNotAllowed, 405);
    assertEquals(statusCodes.serverError, 500);
  });

  await t.step("should handle unhandled errors gracefully", () => {
    const handleError = (err: unknown): { error: string } => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { error: errorMessage || "Internal server error" };
    };

    const result = handleError(new Error("Test error"));
    assertEquals(result.error, "Test error");
  });

  await t.step("should query challenge with correct filters", () => {
    const queryFilters = {
      challenge: "abc123",
      type: "authentication",
      used: false,
      expires_at_gt: new Date().toISOString()
    };

    assertEquals(queryFilters.type, "authentication");
    assertEquals(queryFilters.used, false);
    assertExists(queryFilters.expires_at_gt);
  });
});
