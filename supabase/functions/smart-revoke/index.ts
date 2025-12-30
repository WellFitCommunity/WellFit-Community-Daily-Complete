/**
 * SMART on FHIR Token Revocation Endpoint
 *
 * Handles OAuth2 token revocation (RFC 7009) for SMART on FHIR apps.
 * Allows apps and users to revoke access tokens and refresh tokens.
 *
 * Endpoints:
 * - POST /smart-revoke: Revoke a token (OAuth2 standard)
 * - POST /smart-revoke/authorization: Revoke entire app authorization (user-initiated)
 *
 * Compliance: 21st Century Cures Act, ONC Cures Act Final Rule
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger('smart-revoke');

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

// Hash a string using SHA-256 (for client secret)
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Revocation endpoint only accepts POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "method_not_allowed",
      error_description: "Only POST is supported",
    }), { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const isAuthorizationRevoke = url.pathname.endsWith("/authorization");

    // Parse request body
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") params[key] = value;
      }
    } else if (contentType.includes("application/json")) {
      params = await req.json();
    } else {
      return new Response(JSON.stringify({
        error: "invalid_request",
        error_description: "Content-Type must be application/x-www-form-urlencoded or application/json",
      }), { status: 400, headers: corsHeaders });
    }

    if (isAuthorizationRevoke) {
      // User-initiated authorization revocation
      // This revokes ALL tokens and the authorization itself
      const { app_id, patient_id, reason } = params;

      if (!app_id || !patient_id) {
        return new Response(JSON.stringify({
          error: "invalid_request",
          error_description: "app_id and patient_id are required",
        }), { status: 400, headers: corsHeaders });
      }

      // Revoke all tokens for this app/patient
      const { error: tokenError } = await supabase
        .from("smart_access_tokens")
        .update({
          revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_reason: reason || "User revoked authorization",
        })
        .eq("app_id", app_id)
        .eq("patient_id", patient_id)
        .eq("revoked", false);

      if (tokenError) {
        logger.error("Failed to revoke tokens", { error: tokenError.message || String(tokenError) });
      }

      // Update authorization status
      const { error: authError } = await supabase
        .from("smart_authorizations")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_reason: reason || "User revoked authorization",
        })
        .eq("app_id", app_id)
        .eq("patient_id", patient_id);

      if (authError) {
        logger.error("Failed to revoke authorization", { error: authError.message || String(authError) });
        return new Response(JSON.stringify({
          error: "server_error",
          error_description: "Failed to revoke authorization",
        }), { status: 500, headers: corsHeaders });
      }

      // Log audit event
      await supabase
        .from("smart_audit_log")
        .insert({
          event_type: "authorization_revoked",
          app_id,
          patient_id,
          details: { reason: reason || "User revoked authorization" },
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
          user_agent: req.headers.get("user-agent"),
        });

      return new Response(JSON.stringify({
        success: true,
        message: "Authorization revoked",
      }), { headers: corsHeaders });
    }

    // Standard OAuth2 token revocation (RFC 7009)
    const { token, token_type_hint, client_id, client_secret } = params;

    if (!token) {
      // Per RFC 7009, we should return 200 OK even if token is missing
      // But we'll be nice and return an error
      return new Response(JSON.stringify({
        error: "invalid_request",
        error_description: "token is required",
      }), { status: 400, headers: corsHeaders });
    }

    // Try to find the token
    let tokenRecord = null;
    let tokenType = token_type_hint;

    // Check if it's an access token
    if (!tokenType || tokenType === "access_token") {
      const { data } = await supabase
        .from("smart_access_tokens")
        .select(`
          *,
          app:smart_registered_apps(*)
        `)
        .eq("access_token", token)
        .single();

      if (data) {
        tokenRecord = data;
        tokenType = "access_token";
      }
    }

    // Check if it's a refresh token
    if (!tokenRecord && (!tokenType || tokenType === "refresh_token")) {
      const { data } = await supabase
        .from("smart_access_tokens")
        .select(`
          *,
          app:smart_registered_apps(*)
        `)
        .eq("refresh_token", token)
        .single();

      if (data) {
        tokenRecord = data;
        tokenType = "refresh_token";
      }
    }

    // If token not found, return success per RFC 7009
    // (the token is effectively revoked if it doesn't exist)
    if (!tokenRecord) {
      return new Response(JSON.stringify({
        success: true,
        message: "Token not found or already revoked",
      }), { headers: corsHeaders });
    }

    // Already revoked
    if (tokenRecord.revoked) {
      return new Response(JSON.stringify({
        success: true,
        message: "Token already revoked",
      }), { headers: corsHeaders });
    }

    const app = tokenRecord.app;

    // For confidential clients, verify credentials
    if (app.is_confidential) {
      if (!client_id || !client_secret) {
        return new Response(JSON.stringify({
          error: "invalid_client",
          error_description: "Client authentication required",
        }), { status: 401, headers: corsHeaders });
      }

      if (client_id !== app.client_id) {
        return new Response(JSON.stringify({
          error: "invalid_client",
          error_description: "client_id does not match token owner",
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

    // Revoke the token
    const { error: revokeError } = await supabase
      .from("smart_access_tokens")
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_reason: "Token revoked by client",
      })
      .eq("id", tokenRecord.id);

    if (revokeError) {
      logger.error("Failed to revoke token", { error: revokeError.message || String(revokeError) });
      return new Response(JSON.stringify({
        error: "server_error",
        error_description: "Failed to revoke token",
      }), { status: 500, headers: corsHeaders });
    }

    // Log audit event
    await supabase
      .from("smart_audit_log")
      .insert({
        event_type: "token_revoked",
        app_id: app.id,
        patient_id: tokenRecord.patient_id,
        token_id: tokenRecord.id,
        details: { token_type: tokenType },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        user_agent: req.headers.get("user-agent"),
      });

    // Per RFC 7009, return 200 OK with empty body
    return new Response(JSON.stringify({
      success: true,
    }), { headers: corsHeaders });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Revocation error", { error: message });
    return new Response(JSON.stringify({
      error: "server_error",
      error_description: message,
    }), { status: 500, headers: corsHeaders });
  }
});
