/**
 * SMART on FHIR Authorization Endpoint
 *
 * Implements the OAuth2 *authorization* leg of SMART App Launch:
 *  - GET  (authorization_endpoint): validate the app + request, then redirect
 *          the browser to the in-app consent screen (React /authorize route).
 *  - POST action=approve: the consent screen calls this with the patient's
 *          Supabase session token. Identity is taken from the VERIFIED JWT
 *          (never the request body), an authorization code is issued, and a
 *          durable authorization record is upserted.
 *
 * The token/refresh/introspect legs live in `smart-token`; revocation lives in
 * `smart-revoke`; registration lives in `smart-register-app`. This function no
 * longer duplicates them.
 *
 * Schema of record (verified live 2026-07-07):
 *  - smart_registered_apps: client_id (unique), status='approved' to authorize,
 *    redirect_uris[], scopes_allowed[], is_confidential, pkce_required
 *  - smart_auth_codes: app_id, patient_id, code, code_challenge[_method],
 *    redirect_uri, scopes_requested[], scopes_granted[], state, expires_at
 *  - smart_authorizations: UNIQUE(app_id, patient_id), status in
 *    (active|revoked|expired)
 *
 * @see https://hl7.org/fhir/smart-app-launch/
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { SUPABASE_URL, SB_SECRET_KEY, ALLOWED_ORIGINS } from "../_shared/env.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const logger = createLogger("smart-authorize");
const supabase = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "");

// Authorization code lifetime (SMART recommends short-lived, single-use codes)
const AUTH_CODE_EXPIRY_SECONDS = 60 * 10; // 10 minutes

/** Base URL of the patient-facing app that hosts the /authorize consent route. */
function appBaseUrl(): string {
  const explicit = (() => {
    try {
      return (globalThis as unknown as { Deno?: { env: { get(k: string): string | undefined } } })
        .Deno?.env?.get?.("APP_BASE_URL")?.trim() ?? "";
    } catch {
      return "";
    }
  })();
  return explicit || ALLOWED_ORIGINS[0] || "";
}

interface RegisteredApp {
  id: string;
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  scopes_allowed: string[];
  is_confidential: boolean;
  pkce_required: boolean;
  status: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (req.method === "GET") {
      return await handleAuthorize(url, corsHeaders);
    }

    if (req.method === "POST" && action === "approve") {
      return await handleApprove(req, corsHeaders);
    }

    return errorResponse("invalid_request", "Unsupported request", 400, corsHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("smart-authorize failed", { error: message });
    return errorResponse("server_error", "Internal error", 500, corsHeaders);
  }
});

// ============================================================================
// Helpers
// ============================================================================

/** Parse a space-delimited OAuth scope string into a clean array. */
function parseScopes(scope: string | null): string[] {
  return (scope ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Look up an app that is registered AND approved for authorization. */
async function getApprovedApp(clientId: string): Promise<RegisteredApp | null> {
  const { data, error } = await supabase
    .from("smart_registered_apps")
    .select("id, client_id, client_name, redirect_uris, scopes_allowed, is_confidential, pkce_required, status")
    .eq("client_id", clientId)
    .single();

  if (error || !data) return null;
  if (data.status !== "approved") return null;
  return data as RegisteredApp;
}

function generateSecureToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Authorization Endpoint (GET) — redirect to the in-app consent screen
// ============================================================================

async function handleAuthorize(url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const requestedScopes = parseScopes(url.searchParams.get("scope"));
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");

  if (!clientId || !redirectUri || responseType !== "code") {
    return errorResponse("invalid_request", "Missing or invalid required parameters", 400, corsHeaders);
  }

  const app = await getApprovedApp(clientId);
  if (!app) {
    return errorResponse("unauthorized_client", "Unknown or unapproved client", 401, corsHeaders);
  }

  if (!app.redirect_uris.includes(redirectUri)) {
    return errorResponse("invalid_request", "redirect_uri not registered for this client", 400, corsHeaders);
  }

  const disallowed = requestedScopes.filter((s) => !app.scopes_allowed.includes(s));
  if (disallowed.length > 0) {
    return errorResponse("invalid_scope", `Scope(s) not permitted for this client: ${disallowed.join(", ")}`, 400, corsHeaders);
  }

  if (app.pkce_required && !codeChallenge) {
    return errorResponse("invalid_request", "PKCE code_challenge is required for this client", 400, corsHeaders);
  }

  const base = appBaseUrl();
  if (!base) {
    logger.error("APP_BASE_URL / ALLOWED_ORIGINS not configured; cannot render consent");
    return errorResponse("server_error", "Consent UI is not configured", 500, corsHeaders);
  }

  // Hand the browser to the in-app consent screen. The patient authenticates
  // via the normal app session there and approves via POST action=approve.
  const consent = new URL("/authorize", base);
  consent.searchParams.set("client_id", clientId);
  consent.searchParams.set("redirect_uri", redirectUri);
  consent.searchParams.set("response_type", "code");
  consent.searchParams.set("scope", requestedScopes.join(" "));
  if (state) consent.searchParams.set("state", state);
  if (codeChallenge) consent.searchParams.set("code_challenge", codeChallenge);
  if (codeChallengeMethod) consent.searchParams.set("code_challenge_method", codeChallengeMethod);

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: consent.toString() },
  });
}

// ============================================================================
// Consent Approval (POST action=approve) — issue the authorization code
// ============================================================================

async function handleApprove(req: Request, corsHeaders: Record<string, string>): Promise<Response> {
  // Identity comes from the VERIFIED session token, never the request body.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("access_denied", "Authentication required", 401, corsHeaders);
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return errorResponse("access_denied", "Invalid session", 401, corsHeaders);
  }
  const patientId = user.id;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("invalid_request", "JSON body required", 400, corsHeaders);
  }
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  } = body as Record<string, string | undefined>;

  if (!clientId || !redirectUri) {
    return errorResponse("invalid_request", "client_id and redirect_uri are required", 400, corsHeaders);
  }

  const app = await getApprovedApp(clientId);
  if (!app) {
    return errorResponse("unauthorized_client", "Unknown or unapproved client", 401, corsHeaders);
  }
  if (!app.redirect_uris.includes(redirectUri)) {
    return errorResponse("invalid_request", "redirect_uri not registered for this client", 400, corsHeaders);
  }

  const requestedScopes = parseScopes(scope ?? null);
  const disallowed = requestedScopes.filter((s) => !app.scopes_allowed.includes(s));
  if (disallowed.length > 0) {
    return errorResponse("invalid_scope", `Scope(s) not permitted for this client: ${disallowed.join(", ")}`, 400, corsHeaders);
  }
  if (app.pkce_required && !codeChallenge) {
    return errorResponse("invalid_request", "PKCE code_challenge is required for this client", 400, corsHeaders);
  }

  const code = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_SECONDS * 1000).toISOString();

  const { error: codeError } = await supabase.from("smart_auth_codes").insert({
    code,
    app_id: app.id,
    patient_id: patientId,
    code_challenge: codeChallenge ?? null,
    code_challenge_method: codeChallengeMethod ?? null,
    redirect_uri: redirectUri,
    scopes_requested: requestedScopes,
    scopes_granted: requestedScopes,
    state: state ?? null,
    expires_at: expiresAt,
    ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
    user_agent: req.headers.get("user-agent"),
  });

  if (codeError) {
    logger.error("Failed to store authorization code", { error: codeError.message || String(codeError) });
    return errorResponse("server_error", "Failed to issue authorization code", 500, corsHeaders);
  }

  // Durable authorization record (one per app+patient) for the consent dashboard.
  const now = new Date().toISOString();
  const { error: authzError } = await supabase
    .from("smart_authorizations")
    .upsert(
      {
        app_id: app.id,
        patient_id: patientId,
        user_id: patientId,
        scopes_granted: requestedScopes,
        status: "active",
        authorized_at: now,
        updated_at: now,
      },
      { onConflict: "app_id,patient_id" },
    );

  if (authzError) {
    logger.error("Failed to upsert authorization record", { error: authzError.message || String(authzError) });
    // The code was already issued; surface a soft failure but do not block the flow.
  }

  await supabase.from("smart_audit_log").insert({
    event_type: "authorization_granted",
    app_id: app.id,
    patient_id: patientId,
    details: { scopes: requestedScopes, grant_type: "authorization_code" },
    ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
    user_agent: req.headers.get("user-agent"),
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return new Response(JSON.stringify({ redirect_uri: redirectUrl.toString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ============================================================================
// Utility
// ============================================================================

function errorResponse(
  error: string,
  description: string,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
