/**
 * SMART on FHIR Token Endpoint
 *
 * Handles OAuth2 token requests for SMART on FHIR apps.
 * Supports:
 * - Authorization code exchange (grant_type=authorization_code)
 * - Token refresh (grant_type=refresh_token)
 * - PKCE validation for public clients
 *
 * Compliance: 21st Century Cures Act, ONC Cures Act Final Rule
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

// Get environment variables
function getEnv(name: string, ...fallbacks: string[]): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value?.trim()) return value.trim();
  }
  return "";
}

const supabaseUrl = getEnv("SB_URL", "SUPABASE_URL");
const supabaseServiceKey = getEnv("SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SB_SECRET_KEY");

// Token expiration times
const ACCESS_TOKEN_TTL = 3600; // 1 hour in seconds
const REFRESH_TOKEN_TTL = 86400 * 30; // 30 days in seconds

// Generate secure random token
function generateToken(prefix: string): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return prefix + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Hash a string using SHA-256 (for PKCE and secrets)
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Base64URL decode (for PKCE verifier)
function base64UrlDecode(input: string): Uint8Array {
  // Convert base64url to base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4) base64 += "=";
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

// Verify PKCE code_verifier against code_challenge
async function verifyPKCE(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Base64URL encode the hash
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return base64url === codeChallenge;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Token endpoint only accepts POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "method_not_allowed",
      error_description: "Token endpoint only accepts POST",
    }), { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data (OAuth2 spec requires form-urlencoded)
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") params[key] = value;
      }
    } else if (contentType.includes("application/json")) {
      // Some clients send JSON (non-standard but common)
      params = await req.json();
    } else {
      return new Response(JSON.stringify({
        error: "invalid_request",
        error_description: "Content-Type must be application/x-www-form-urlencoded or application/json",
      }), { status: 400, headers: corsHeaders });
    }

    const grantType = params.grant_type;

    if (grantType === "authorization_code") {
      // Exchange authorization code for tokens
      const { code, redirect_uri, client_id, client_secret, code_verifier } = params;

      if (!code) {
        return new Response(JSON.stringify({
          error: "invalid_request",
          error_description: "code is required",
        }), { status: 400, headers: corsHeaders });
      }

      // Look up the authorization code
      const { data: authCode, error: codeError } = await supabase
        .from("smart_auth_codes")
        .select(`
          *,
          app:smart_registered_apps(*)
        `)
        .eq("code", code)
        .single();

      if (codeError || !authCode) {
        return new Response(JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid or expired authorization code",
        }), { status: 400, headers: corsHeaders });
      }

      // Check if code is already used
      if (authCode.used) {
        return new Response(JSON.stringify({
          error: "invalid_grant",
          error_description: "Authorization code has already been used",
        }), { status: 400, headers: corsHeaders });
      }

      // Check expiration
      if (new Date(authCode.expires_at) < new Date()) {
        return new Response(JSON.stringify({
          error: "invalid_grant",
          error_description: "Authorization code has expired",
        }), { status: 400, headers: corsHeaders });
      }

      // Validate redirect_uri matches
      if (redirect_uri && redirect_uri !== authCode.redirect_uri) {
        return new Response(JSON.stringify({
          error: "invalid_request",
          error_description: "redirect_uri does not match",
        }), { status: 400, headers: corsHeaders });
      }

      const app = authCode.app;

      // Validate client authentication
      if (app.is_confidential) {
        // Confidential clients must authenticate
        if (!client_secret) {
          return new Response(JSON.stringify({
            error: "invalid_client",
            error_description: "client_secret is required for confidential clients",
          }), { status: 401, headers: corsHeaders });
        }

        const secretHash = await sha256(client_secret);
        if (secretHash !== app.client_secret_hash) {
          return new Response(JSON.stringify({
            error: "invalid_client",
            error_description: "Invalid client credentials",
          }), { status: 401, headers: corsHeaders });
        }
      }

      // Validate PKCE if code_challenge was provided
      if (authCode.code_challenge) {
        if (!code_verifier) {
          return new Response(JSON.stringify({
            error: "invalid_request",
            error_description: "code_verifier is required",
          }), { status: 400, headers: corsHeaders });
        }

        const pkceValid = await verifyPKCE(code_verifier, authCode.code_challenge);
        if (!pkceValid) {
          return new Response(JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid code_verifier",
          }), { status: 400, headers: corsHeaders });
        }
      }

      // Mark code as used
      await supabase
        .from("smart_auth_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", authCode.id);

      // Generate tokens
      const accessToken = generateToken("eat_");
      const refreshToken = authCode.scopes_granted.includes("offline_access")
        ? generateToken("ert_")
        : null;

      const now = new Date();
      const accessExpires = new Date(now.getTime() + ACCESS_TOKEN_TTL * 1000);
      const refreshExpires = refreshToken
        ? new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000)
        : null;

      // Get or create authorization record
      const { data: authRecord } = await supabase
        .from("smart_authorizations")
        .select("id")
        .eq("app_id", app.id)
        .eq("patient_id", authCode.patient_id)
        .single();

      // Store tokens
      const { error: tokenError } = await supabase
        .from("smart_access_tokens")
        .insert({
          access_token: accessToken,
          refresh_token: refreshToken,
          app_id: app.id,
          patient_id: authCode.patient_id,
          authorization_id: authRecord?.id,
          scopes: authCode.scopes_granted,
          access_token_expires_at: accessExpires.toISOString(),
          refresh_token_expires_at: refreshExpires?.toISOString(),
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

      if (tokenError) {
        console.error("Failed to store tokens:", tokenError);
        return new Response(JSON.stringify({
          error: "server_error",
          error_description: "Failed to issue tokens",
        }), { status: 500, headers: corsHeaders });
      }

      // Log audit event
      await supabase
        .from("smart_audit_log")
        .insert({
          event_type: "token_issued",
          app_id: app.id,
          patient_id: authCode.patient_id,
          details: { scopes: authCode.scopes_granted, grant_type: "authorization_code" },
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

      // Build response
      const response: Record<string, unknown> = {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL,
        scope: authCode.scopes_granted.join(" "),
        patient: authCode.patient_id, // SMART on FHIR patient context
      };

      if (refreshToken) {
        response.refresh_token = refreshToken;
      }

      return new Response(JSON.stringify(response), { headers: corsHeaders });
    }

    if (grantType === "refresh_token") {
      // Refresh access token
      const { refresh_token, client_id, client_secret } = params;

      if (!refresh_token) {
        return new Response(JSON.stringify({
          error: "invalid_request",
          error_description: "refresh_token is required",
        }), { status: 400, headers: corsHeaders });
      }

      // Look up the refresh token
      const { data: tokenRecord, error: tokenError } = await supabase
        .from("smart_access_tokens")
        .select(`
          *,
          app:smart_registered_apps(*)
        `)
        .eq("refresh_token", refresh_token)
        .eq("revoked", false)
        .single();

      if (tokenError || !tokenRecord) {
        return new Response(JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid refresh token",
        }), { status: 400, headers: corsHeaders });
      }

      // Check refresh token expiration
      if (tokenRecord.refresh_token_expires_at && new Date(tokenRecord.refresh_token_expires_at) < new Date()) {
        return new Response(JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token has expired",
        }), { status: 400, headers: corsHeaders });
      }

      const app = tokenRecord.app;

      // Validate client authentication for confidential clients
      if (app.is_confidential) {
        if (!client_secret) {
          return new Response(JSON.stringify({
            error: "invalid_client",
            error_description: "client_secret is required",
          }), { status: 401, headers: corsHeaders });
        }

        const secretHash = await sha256(client_secret);
        if (secretHash !== app.client_secret_hash) {
          return new Response(JSON.stringify({
            error: "invalid_client",
            error_description: "Invalid client credentials",
          }), { status: 401, headers: corsHeaders });
        }
      }

      // Generate new access token
      const newAccessToken = generateToken("eat_");
      const now = new Date();
      const accessExpires = new Date(now.getTime() + ACCESS_TOKEN_TTL * 1000);

      // Update token record with new access token
      await supabase
        .from("smart_access_tokens")
        .update({
          access_token: newAccessToken,
          access_token_expires_at: accessExpires.toISOString(),
          last_used_at: now.toISOString(),
          use_count: (tokenRecord.use_count || 0) + 1,
        })
        .eq("id", tokenRecord.id);

      // Log audit event
      await supabase
        .from("smart_audit_log")
        .insert({
          event_type: "token_refreshed",
          app_id: app.id,
          patient_id: tokenRecord.patient_id,
          token_id: tokenRecord.id,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

      return new Response(JSON.stringify({
        access_token: newAccessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL,
        scope: tokenRecord.scopes.join(" "),
        patient: tokenRecord.patient_id,
      }), { headers: corsHeaders });
    }

    // Unsupported grant type
    return new Response(JSON.stringify({
      error: "unsupported_grant_type",
      error_description: "Only authorization_code and refresh_token are supported",
    }), { status: 400, headers: corsHeaders });

  } catch (err: unknown) {
    console.error("Token error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({
      error: "server_error",
      error_description: message,
    }), { status: 500, headers: corsHeaders });
  }
});
