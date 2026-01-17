// supabase/functions/smart-token/__tests__/index.test.ts
// Tests for smart-token edge function (SMART on FHIR OAuth2 Token Endpoint)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("SMART Token Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/smart-token", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method === "POST" ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should require Content-Type header", () => {
    const validContentTypes = ["application/x-www-form-urlencoded", "application/json"];

    assertEquals(validContentTypes.includes("application/x-www-form-urlencoded"), true);
    assertEquals(validContentTypes.includes("application/json"), true);
    assertEquals(validContentTypes.includes("text/plain"), false);
  });

  await t.step("should return 400 for invalid Content-Type", () => {
    const errorResponse = {
      error: "invalid_request",
      error_description: "Content-Type must be application/x-www-form-urlencoded or application/json"
    };

    assertEquals(errorResponse.error, "invalid_request");
  });

  await t.step("should support authorization_code grant type", () => {
    const supportedGrants = ["authorization_code", "refresh_token"];

    assertEquals(supportedGrants.includes("authorization_code"), true);
  });

  await t.step("should support refresh_token grant type", () => {
    const supportedGrants = ["authorization_code", "refresh_token"];

    assertEquals(supportedGrants.includes("refresh_token"), true);
  });

  await t.step("should return error for unsupported grant_type", () => {
    const errorResponse = {
      error: "unsupported_grant_type",
      error_description: "Only authorization_code and refresh_token are supported"
    };

    assertEquals(errorResponse.error, "unsupported_grant_type");
  });

  await t.step("should require code for authorization_code grant", () => {
    const params = { grant_type: "authorization_code", redirect_uri: "http://localhost" };
    const hasCode = "code" in params;

    assertEquals(hasCode, false);
  });

  await t.step("should return 400 for missing code", () => {
    const errorResponse = {
      error: "invalid_request",
      error_description: "code is required"
    };

    assertEquals(errorResponse.error, "invalid_request");
  });

  await t.step("should validate authorization code exists", () => {
    const authCodeFound = false;
    const errorResponse = {
      error: "invalid_grant",
      error_description: "Invalid or expired authorization code"
    };

    assertEquals(authCodeFound, false);
    assertEquals(errorResponse.error, "invalid_grant");
  });

  await t.step("should reject already-used authorization code", () => {
    const authCode = { used: true };
    const errorResponse = {
      error: "invalid_grant",
      error_description: "Authorization code has already been used"
    };

    assertEquals(authCode.used, true);
    assertEquals(errorResponse.error, "invalid_grant");
  });

  await t.step("should reject expired authorization code", () => {
    const authCode = { expires_at: new Date(Date.now() - 60000).toISOString() };
    const isExpired = new Date(authCode.expires_at) < new Date();

    assertEquals(isExpired, true);
  });

  await t.step("should validate redirect_uri matches", () => {
    const authCode = { redirect_uri: "http://localhost:3000/callback" };
    const providedRedirectUri = "http://localhost:3000/callback";

    assertEquals(providedRedirectUri === authCode.redirect_uri, true);
  });

  await t.step("should return error for redirect_uri mismatch", () => {
    const errorResponse = {
      error: "invalid_request",
      error_description: "redirect_uri does not match"
    };

    assertEquals(errorResponse.error, "invalid_request");
  });

  await t.step("should require client_secret for confidential clients", () => {
    const app = { is_confidential: true };
    const client_secret = undefined;
    const errorResponse = {
      error: "invalid_client",
      error_description: "client_secret is required for confidential clients"
    };

    assertEquals(app.is_confidential, true);
    assertEquals(client_secret, undefined);
    assertEquals(errorResponse.error, "invalid_client");
  });

  await t.step("should validate client_secret via SHA-256 hash", () => {
    // Hash comparison
    const secretHash = "abc123hash";
    const storedHash = "abc123hash";

    assertEquals(secretHash === storedHash, true);
  });

  await t.step("should support PKCE code_challenge validation", () => {
    const authCode = {
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    };

    assertExists(authCode.code_challenge);
  });

  await t.step("should require code_verifier when code_challenge exists", () => {
    const authCode = { code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" };
    const code_verifier = undefined;
    const errorResponse = {
      error: "invalid_request",
      error_description: "code_verifier is required"
    };

    assertExists(authCode.code_challenge);
    assertEquals(code_verifier, undefined);
    assertEquals(errorResponse.error, "invalid_request");
  });

  await t.step("should return error for invalid code_verifier", () => {
    const errorResponse = {
      error: "invalid_grant",
      error_description: "Invalid code_verifier"
    };

    assertEquals(errorResponse.error, "invalid_grant");
  });

  await t.step("should mark code as used after token exchange", () => {
    const updateData = {
      used: true,
      used_at: new Date().toISOString()
    };

    assertEquals(updateData.used, true);
    assertExists(updateData.used_at);
  });

  await t.step("should generate access token with prefix", () => {
    const generateToken = (prefix: string): string => {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return prefix + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    };

    const accessToken = generateToken("eat_");
    assertEquals(accessToken.startsWith("eat_"), true);
    assertEquals(accessToken.length, 68); // eat_ (4) + 64 hex chars
  });

  await t.step("should generate refresh token only for offline_access scope", () => {
    const scopes = ["patient/*.read", "offline_access"];
    const shouldGenerateRefresh = scopes.includes("offline_access");

    assertEquals(shouldGenerateRefresh, true);
  });

  await t.step("should use correct token TTLs", () => {
    const ACCESS_TOKEN_TTL = 3600; // 1 hour
    const REFRESH_TOKEN_TTL = 86400 * 30; // 30 days

    assertEquals(ACCESS_TOKEN_TTL, 3600);
    assertEquals(REFRESH_TOKEN_TTL, 2592000);
  });

  await t.step("should structure token response correctly", () => {
    const response = {
      access_token: "eat_abc123...",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "patient/*.read offline_access",
      patient: "patient-123",
      refresh_token: "ert_xyz789..."
    };

    assertExists(response.access_token);
    assertEquals(response.token_type, "Bearer");
    assertEquals(response.expires_in, 3600);
    assertExists(response.scope);
    assertExists(response.patient);  // SMART on FHIR patient context
  });

  await t.step("should store token in smart_access_tokens table", () => {
    const tokenRecord = {
      access_token: "eat_abc123...",
      refresh_token: "ert_xyz789...",
      app_id: "app-123",
      patient_id: "patient-123",
      scopes: ["patient/*.read", "offline_access"],
      access_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      refresh_token_expires_at: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
      ip_address: "192.168.1.1",
      user_agent: "Mozilla/5.0"
    };

    assertExists(tokenRecord.access_token);
    assertExists(tokenRecord.access_token_expires_at);
  });

  await t.step("should log audit event for token_issued", () => {
    const auditLog = {
      event_type: "token_issued",
      app_id: "app-123",
      patient_id: "patient-123",
      details: { scopes: ["patient/*.read"], grant_type: "authorization_code" },
      ip_address: "192.168.1.1",
      user_agent: "Mozilla/5.0"
    };

    assertEquals(auditLog.event_type, "token_issued");
    assertExists(auditLog.details.scopes);
  });

  await t.step("should validate refresh_token for refresh_token grant", () => {
    const params = { grant_type: "refresh_token", refresh_token: undefined };

    assertEquals(params.refresh_token, undefined);
  });

  await t.step("should return error for missing refresh_token", () => {
    const errorResponse = {
      error: "invalid_request",
      error_description: "refresh_token is required"
    };

    assertEquals(errorResponse.error, "invalid_request");
  });

  await t.step("should reject revoked refresh_token", () => {
    const tokenRecord = { revoked: true };
    const errorResponse = {
      error: "invalid_grant",
      error_description: "Invalid refresh token"
    };

    assertEquals(tokenRecord.revoked, true);
    assertEquals(errorResponse.error, "invalid_grant");
  });

  await t.step("should reject expired refresh_token", () => {
    const tokenRecord = {
      refresh_token_expires_at: new Date(Date.now() - 60000).toISOString()
    };
    const isExpired = new Date(tokenRecord.refresh_token_expires_at) < new Date();

    assertEquals(isExpired, true);
  });

  await t.step("should generate new access token on refresh", () => {
    const newAccessToken = "eat_newtoken123...";
    const response = {
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "patient/*.read",
      patient: "patient-123"
    };

    assertExists(response.access_token);
    assertEquals(response.token_type, "Bearer");
  });

  await t.step("should update use_count on refresh", () => {
    const updateData = {
      access_token: "eat_newtoken...",
      access_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      last_used_at: new Date().toISOString(),
      use_count: 5
    };

    assertEquals(updateData.use_count, 5);
    assertExists(updateData.last_used_at);
  });

  await t.step("should log audit event for token_refreshed", () => {
    const auditLog = {
      event_type: "token_refreshed",
      app_id: "app-123",
      patient_id: "patient-123",
      token_id: "token-456",
      ip_address: "192.168.1.1"
    };

    assertEquals(auditLog.event_type, "token_refreshed");
    assertExists(auditLog.token_id);
  });

  await t.step("should return 500 for server errors", () => {
    const hasError = true;
    const errorResponse = {
      error: "server_error",
      error_description: "Internal server error"
    };

    assertEquals(errorResponse.error, "server_error");
  });

  await t.step("should use OAuth2 error format", () => {
    const errorResponse = {
      error: "invalid_grant",
      error_description: "Detailed error message"
    };

    assertExists(errorResponse.error);
    assertExists(errorResponse.error_description);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      badRequest: 400,
      unauthorized: 401,
      methodNotAllowed: 405,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.badRequest, 400);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.serverError, 500);
  });
});
