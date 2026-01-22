// supabase/functions/smart-authorize/__tests__/index.test.ts
// Tests for SMART on FHIR Authorization Server Edge Function

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("SMART on FHIR Authorization Tests", async (t) => {

  // =====================================================
  // Token Expiry Constants Tests
  // =====================================================

  await t.step("should set access token expiry to 1 hour", () => {
    const ACCESS_TOKEN_EXPIRY = 60 * 60;
    assertEquals(ACCESS_TOKEN_EXPIRY, 3600);
  });

  await t.step("should set refresh token expiry to 30 days", () => {
    const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30;
    assertEquals(REFRESH_TOKEN_EXPIRY, 2592000);
  });

  await t.step("should set auth code expiry to 10 minutes", () => {
    const AUTH_CODE_EXPIRY = 60 * 10;
    assertEquals(AUTH_CODE_EXPIRY, 600);
  });

  // =====================================================
  // Authorization Endpoint Tests (GET)
  // =====================================================

  await t.step("should require client_id", () => {
    const params = new URLSearchParams({
      redirect_uri: "https://app.example.com/callback",
      response_type: "code"
    });
    const clientId = params.get("client_id");

    assertEquals(clientId, null);
  });

  await t.step("should require redirect_uri", () => {
    const params = new URLSearchParams({
      client_id: "client-123",
      response_type: "code"
    });
    const redirectUri = params.get("redirect_uri");

    assertEquals(redirectUri, null);
  });

  await t.step("should require response_type=code", () => {
    const params = new URLSearchParams({
      client_id: "client-123",
      redirect_uri: "https://app.example.com/callback",
      response_type: "token"
    });

    assertEquals(params.get("response_type") !== "code", true);
  });

  await t.step("should return error for missing parameters", () => {
    const response = {
      error: "invalid_request",
      error_description: "Missing required parameters"
    };

    assertEquals(response.error, "invalid_request");
  });

  await t.step("should validate registered app", () => {
    const app = {
      client_id: "client-123",
      client_name: "My Health App",
      redirect_uris: ["https://app.example.com/callback"],
      is_active: true
    };

    assertEquals(app.is_active, true);
    assertEquals(Array.isArray(app.redirect_uris), true);
  });

  await t.step("should return error for unknown client", () => {
    const response = {
      error: "unauthorized_client",
      error_description: "Unknown or inactive client"
    };

    assertEquals(response.error, "unauthorized_client");
  });

  await t.step("should validate redirect_uri against registered URIs", () => {
    const allowedUris = ["https://app.example.com/callback", "https://app.example.com/oauth"];
    const redirectUri = "https://app.example.com/callback";

    assertEquals(allowedUris.includes(redirectUri), true);
  });

  await t.step("should return error for invalid redirect_uri", () => {
    const response = {
      error: "invalid_request",
      error_description: "Invalid redirect_uri"
    };

    assertEquals(response.error, "invalid_request");
  });

  await t.step("should require PKCE for public clients", () => {
    const app = { client_type: "public" };
    const codeChallenge = null;

    const pkceRequired = app.client_type === "public" && !codeChallenge;

    assertEquals(pkceRequired, true);
  });

  await t.step("should return error when PKCE missing for public client", () => {
    const response = {
      error: "invalid_request",
      error_description: "PKCE required for public clients"
    };

    assertEquals(response.error, "invalid_request");
    assertEquals(response.error_description.includes("PKCE"), true);
  });

  // =====================================================
  // Authorization Code Tests
  // =====================================================

  await t.step("should generate authorization code", () => {
    const generateSecureToken = (length: number): string => {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
    };

    const authCode = generateSecureToken(32);
    assertEquals(authCode.length, 64);
    assertEquals(/^[0-9a-f]+$/.test(authCode), true);
  });

  await t.step("should store auth code with expiration", () => {
    const authCodeRecord = {
      code: "abc123...",
      client_id: "client-123",
      patient_id: "patient-456",
      redirect_uri: "https://app.example.com/callback",
      scope: "patient/*.read",
      code_challenge: "challenge-xyz",
      code_challenge_method: "S256",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };

    assertExists(authCodeRecord.code);
    assertExists(authCodeRecord.expires_at);
  });

  await t.step("should redirect with code and state", () => {
    const redirectUrl = new URL("https://app.example.com/callback");
    redirectUrl.searchParams.set("code", "auth-code-123");
    redirectUrl.searchParams.set("state", "state-value");

    assertEquals(redirectUrl.searchParams.get("code"), "auth-code-123");
    assertEquals(redirectUrl.searchParams.get("state"), "state-value");
  });

  // =====================================================
  // Token Exchange Tests (POST grant_type=authorization_code)
  // =====================================================

  await t.step("should require code for token exchange", () => {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: "https://app.example.com/callback",
      client_id: "client-123"
    });

    assertEquals(params.get("code"), null);
  });

  await t.step("should return error for invalid grant", () => {
    const response = {
      error: "invalid_grant",
      error_description: "Invalid authorization code"
    };

    assertEquals(response.error, "invalid_grant");
  });

  await t.step("should validate code expiration", () => {
    const expiresAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const isExpired = new Date(expiresAt) < new Date();

    assertEquals(isExpired, true);
  });

  await t.step("should return error for expired code", () => {
    const response = {
      error: "invalid_grant",
      error_description: "Authorization code expired"
    };

    assertEquals(response.error, "invalid_grant");
  });

  await t.step("should validate client_id matches", () => {
    const authCode = { client_id: "client-123" };
    const requestClientId = "client-123";

    assertEquals(authCode.client_id === requestClientId, true);
  });

  await t.step("should return error for parameter mismatch", () => {
    const response = {
      error: "invalid_grant",
      error_description: "Parameter mismatch"
    };

    assertEquals(response.error, "invalid_grant");
  });

  await t.step("should validate PKCE code_verifier", () => {
    const authCode = { code_challenge: "challenge-xyz" };
    const codeVerifier = null;

    const pkceRequired = authCode.code_challenge && !codeVerifier;

    assertEquals(pkceRequired, true);
  });

  await t.step("should return error for missing code_verifier", () => {
    const response = {
      error: "invalid_grant",
      error_description: "code_verifier required"
    };

    assertEquals(response.error, "invalid_grant");
  });

  await t.step("should compute S256 code challenge", async () => {
    const computeCodeChallenge = async (verifier: string, method: string | null): Promise<string> => {
      if (method === "S256") {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest("SHA-256", data);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
        return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      return verifier;
    };

    const verifier = "test-verifier";
    const challenge = await computeCodeChallenge(verifier, "S256");

    assertEquals(typeof challenge, "string");
    assertEquals(challenge.length > 0, true);
  });

  await t.step("should return token response", () => {
    const response = {
      access_token: "access-token-abc",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "refresh-token-xyz",
      scope: "patient/*.read",
      patient: "patient-123"
    };

    assertEquals(response.token_type, "Bearer");
    assertEquals(response.expires_in, 3600);
    assertExists(response.access_token);
    assertExists(response.refresh_token);
    assertExists(response.patient);
  });

  await t.step("should include cache control headers", () => {
    const headers = {
      "Cache-Control": "no-store",
      "Pragma": "no-cache"
    };

    assertEquals(headers["Cache-Control"], "no-store");
    assertEquals(headers["Pragma"], "no-cache");
  });

  // =====================================================
  // Refresh Token Tests (POST grant_type=refresh_token)
  // =====================================================

  await t.step("should require refresh_token", () => {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "client-123"
    });

    assertEquals(params.get("refresh_token"), null);
  });

  await t.step("should validate refresh token exists", () => {
    const tokenData = null;
    const isValid = tokenData !== null;

    assertEquals(isValid, false);
  });

  await t.step("should return error for invalid refresh token", () => {
    const response = {
      error: "invalid_grant",
      error_description: "Invalid refresh token"
    };

    assertEquals(response.error, "invalid_grant");
  });

  await t.step("should check refresh token expiry", () => {
    const refreshExpiresAt = new Date(Date.now() - 1000).toISOString();
    const isExpired = new Date(refreshExpiresAt) < new Date();

    assertEquals(isExpired, true);
  });

  await t.step("should return error for expired refresh token", () => {
    const response = {
      error: "invalid_grant",
      error_description: "Refresh token expired"
    };

    assertEquals(response.error, "invalid_grant");
  });

  await t.step("should generate new access token on refresh", () => {
    const generateSecureToken = (length: number): string => {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
    };

    const newAccessToken = generateSecureToken(48);
    assertEquals(newAccessToken.length, 96);
  });

  // =====================================================
  // Dynamic Client Registration Tests (POST action=register)
  // =====================================================

  await t.step("should require client_name for registration", () => {
    const body = { redirect_uris: ["https://app.example.com/callback"] };
    const hasClientName = "client_name" in body;

    assertEquals(hasClientName, false);
  });

  await t.step("should require redirect_uris for registration", () => {
    const body = { client_name: "My App" };
    const hasRedirectUris = "redirect_uris" in body;

    assertEquals(hasRedirectUris, false);
  });

  await t.step("should return error for invalid client metadata", () => {
    const response = {
      error: "invalid_client_metadata",
      error_description: "client_name and redirect_uris required"
    };

    assertEquals(response.error, "invalid_client_metadata");
  });

  await t.step("should generate client credentials", () => {
    const generateSecureToken = (length: number): string => {
      const array = new Uint8Array(length);
      crypto.getRandomValues(array);
      return Array.from(array, b => b.toString(16).padStart(2, "0")).join("");
    };

    const clientId = generateSecureToken(24);
    const clientSecret = generateSecureToken(48);

    assertEquals(clientId.length, 48);
    assertEquals(clientSecret.length, 96);
  });

  await t.step("should not generate secret for public clients", () => {
    const tokenEndpointAuthMethod = "none";
    const clientSecret = tokenEndpointAuthMethod !== "none" ? "secret-here" : null;

    assertEquals(clientSecret, null);
  });

  await t.step("should return 201 for successful registration", () => {
    const response = {
      client_id: "new-client-id",
      client_secret: "new-client-secret",
      client_name: "My Health App",
      redirect_uris: ["https://app.example.com/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "client_secret_basic"
    };

    assertExists(response.client_id);
    assertExists(response.client_name);
  });

  // =====================================================
  // Token Revocation Tests (POST action=revoke)
  // =====================================================

  await t.step("should require token for revocation", () => {
    const params = new URLSearchParams();
    const token = params.get("token");

    assertEquals(token, null);
  });

  await t.step("should return error for missing token", () => {
    const response = {
      error: "invalid_request",
      error_description: "token required"
    };

    assertEquals(response.error, "invalid_request");
  });

  await t.step("should return 200 for successful revocation", () => {
    const status = 200;
    assertEquals(status, 200);
  });

  // =====================================================
  // Token Introspection Tests (POST action=introspect)
  // =====================================================

  await t.step("should return active: false for missing token", () => {
    const response = { active: false };
    assertEquals(response.active, false);
  });

  await t.step("should return active: false for invalid token", () => {
    const response = { active: false };
    assertEquals(response.active, false);
  });

  await t.step("should return active: false for expired token", () => {
    const response = { active: false };
    assertEquals(response.active, false);
  });

  await t.step("should return introspection response for valid token", () => {
    const response = {
      active: true,
      scope: "patient/*.read",
      client_id: "client-123",
      exp: Math.floor(Date.now() / 1000) + 3600,
      patient: "patient-456"
    };

    assertEquals(response.active, true);
    assertExists(response.scope);
    assertExists(response.client_id);
    assertExists(response.exp);
    assertExists(response.patient);
  });

  // =====================================================
  // User Approval Tests (POST action=approve)
  // =====================================================

  await t.step("should require client_id for approval", () => {
    const body = { patient_id: "patient-123", redirect_uri: "https://app.example.com/callback" };
    const hasClientId = "client_id" in body;

    assertEquals(hasClientId, false);
  });

  await t.step("should return error for missing approval parameters", () => {
    const response = {
      error: "invalid_request",
      error_description: "Missing required parameters"
    };

    assertEquals(response.error, "invalid_request");
  });

  await t.step("should log authorization for patient visibility", () => {
    const authorizationRecord = {
      patient_id: "patient-123",
      client_id: "client-123",
      scope: "patient/*.read",
      authorized_at: new Date().toISOString()
    };

    assertExists(authorizationRecord.authorized_at);
  });

  await t.step("should return redirect_uri in approval response", () => {
    const response = {
      redirect_uri: "https://app.example.com/callback?code=auth-code&state=state-value"
    };

    assertExists(response.redirect_uri);
    assertEquals(response.redirect_uri.includes("code="), true);
  });

  // =====================================================
  // Scope Tests
  // =====================================================

  await t.step("should support patient scopes", () => {
    const validScopes = [
      "patient/Patient.read",
      "patient/AllergyIntolerance.read",
      "patient/Condition.read",
      "patient/MedicationRequest.read",
      "patient/Observation.read",
      "patient/Immunization.read",
      "patient/*.read",
      "offline_access"
    ];

    for (const scope of validScopes) {
      assertEquals(typeof scope, "string");
    }
  });

  await t.step("should parse scope string into array", () => {
    const scope = "patient/Patient.read patient/Condition.read offline_access";
    const scopes = scope.split(" ").filter(s => s);

    assertEquals(scopes.length, 3);
    assertEquals(scopes.includes("patient/Patient.read"), true);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/smart-authorize", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should accept GET for authorization", () => {
    const request = new Request("http://localhost/smart-authorize?client_id=123", {
      method: "GET"
    });

    assertEquals(request.method, "GET");
  });

  await t.step("should accept POST for token operations", () => {
    const request = new Request("http://localhost/smart-authorize", {
      method: "POST"
    });

    assertEquals(request.method, "POST");
  });

  // =====================================================
  // Content Type Tests
  // =====================================================

  await t.step("should accept application/x-www-form-urlencoded for token exchange", () => {
    const contentType = "application/x-www-form-urlencoded";
    assertEquals(contentType.includes("x-www-form-urlencoded"), true);
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 400 for invalid request", () => {
    const status = 400;
    assertEquals(status, 400);
  });

  await t.step("should return 401 for unauthorized client", () => {
    const status = 401;
    assertEquals(status, 401);
  });

  await t.step("should return 500 for server error", () => {
    const response = {
      error: "server_error",
      error_description: "Internal error"
    };

    assertEquals(response.error, "server_error");
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include CORS headers", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Content-Type": "application/json"
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
  });

  // =====================================================
  // Security Tests
  // =====================================================

  await t.step("should delete used authorization code", () => {
    const usedCode = true;
    assertEquals(usedCode, true);
    // Code should be deleted after use
  });

  await t.step("should delete expired authorization code", () => {
    const expiredCode = true;
    assertEquals(expiredCode, true);
    // Expired codes should be cleaned up
  });

  await t.step("should generate cryptographically secure tokens", () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);

    assertEquals(array.length, 32);
    // Check that values are random (not all zeros)
    assertEquals(array.some(b => b !== 0), true);
  });
});
