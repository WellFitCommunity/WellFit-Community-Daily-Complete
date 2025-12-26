/**
 * SMART on FHIR Authorization Server
 *
 * Implements OAuth2 authorization for third-party apps to access patient data.
 * Supports:
 * - Authorization code flow with PKCE
 * - Token exchange
 * - Token refresh
 * - Token revocation
 * - Dynamic client registration
 *
 * @see https://hl7.org/fhir/smart-app-launch/
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { SUPABASE_URL, SB_SECRET_KEY } from '../_shared/env.ts';

const supabase = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "");

// Token expiration times
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 30 days
const AUTH_CODE_EXPIRY = 60 * 10; // 10 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // Route based on action or HTTP method
    if (req.method === 'GET') {
      // Authorization request
      return await handleAuthorize(req, url, corsHeaders);
    }

    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const body = await req.text();
        const params = new URLSearchParams(body);
        const grantType = params.get('grant_type');

        if (grantType === 'authorization_code') {
          return await handleTokenExchange(params, corsHeaders);
        }

        if (grantType === 'refresh_token') {
          return await handleRefreshToken(params, corsHeaders);
        }
      }

      if (action === 'register') {
        return await handleDynamicRegistration(req, corsHeaders);
      }

      if (action === 'revoke') {
        return await handleRevoke(req, corsHeaders);
      }

      if (action === 'introspect') {
        return await handleIntrospect(req, corsHeaders);
      }

      if (action === 'approve') {
        return await handleApproval(req, corsHeaders);
      }
    }

    return errorResponse('invalid_request', 'Unsupported request', 400, corsHeaders);

  } catch (err: unknown) {
    const error = err as Error;
    return errorResponse('server_error', error.message, 500, corsHeaders);
  }
});

// ============================================================================
// Authorization Endpoint (GET)
// ============================================================================

async function handleAuthorize(req: Request, url: URL, corsHeaders: Record<string, string>) {
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const responseType = url.searchParams.get('response_type');
  const scope = url.searchParams.get('scope') || '';
  const state = url.searchParams.get('state');
  const codeChallenge = url.searchParams.get('code_challenge');
  const codeChallengeMethod = url.searchParams.get('code_challenge_method');
  const aud = url.searchParams.get('aud');

  // Validate required parameters
  if (!clientId || !redirectUri || responseType !== 'code') {
    return errorResponse('invalid_request', 'Missing required parameters', 400, corsHeaders);
  }

  // Look up registered app
  const { data: app, error: appError } = await supabase
    .from('smart_registered_apps')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .single();

  if (appError || !app) {
    return errorResponse('unauthorized_client', 'Unknown or inactive client', 401, corsHeaders);
  }

  // Validate redirect URI
  const allowedUris = app.redirect_uris || [];
  if (!allowedUris.includes(redirectUri)) {
    return errorResponse('invalid_request', 'Invalid redirect_uri', 400, corsHeaders);
  }

  // For public apps, PKCE is required
  if (app.client_type === 'public' && !codeChallenge) {
    return errorResponse('invalid_request', 'PKCE required for public clients', 400, corsHeaders);
  }

  // Check if user is authenticated
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    // Return HTML consent form
    return renderConsentPage(clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod, app, corsHeaders);
  }

  // User is authenticated - verify and create authorization code
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return errorResponse('access_denied', 'User not authenticated', 401, corsHeaders);
  }

  // Create authorization code
  const authCode = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY * 1000);

  await supabase.from('smart_auth_codes').insert({
    code: authCode,
    client_id: clientId,
    patient_id: user.id,
    redirect_uri: redirectUri,
    scope: scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    expires_at: expiresAt.toISOString()
  });

  // Redirect with authorization code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': redirectUrl.toString()
    }
  });
}

// ============================================================================
// Token Exchange (POST grant_type=authorization_code)
// ============================================================================

async function handleTokenExchange(params: URLSearchParams, corsHeaders: Record<string, string>) {
  const code = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const clientId = params.get('client_id');
  const codeVerifier = params.get('code_verifier');

  if (!code || !redirectUri || !clientId) {
    return errorResponse('invalid_request', 'Missing required parameters', 400, corsHeaders);
  }

  // Look up authorization code
  const { data: authCode, error: codeError } = await supabase
    .from('smart_auth_codes')
    .select('*')
    .eq('code', code)
    .single();

  if (codeError || !authCode) {
    return errorResponse('invalid_grant', 'Invalid authorization code', 400, corsHeaders);
  }

  // Validate expiration
  if (new Date(authCode.expires_at) < new Date()) {
    await supabase.from('smart_auth_codes').delete().eq('code', code);
    return errorResponse('invalid_grant', 'Authorization code expired', 400, corsHeaders);
  }

  // Validate client_id and redirect_uri match
  if (authCode.client_id !== clientId || authCode.redirect_uri !== redirectUri) {
    return errorResponse('invalid_grant', 'Parameter mismatch', 400, corsHeaders);
  }

  // Validate PKCE if code_challenge was provided
  if (authCode.code_challenge) {
    if (!codeVerifier) {
      return errorResponse('invalid_grant', 'code_verifier required', 400, corsHeaders);
    }

    const computedChallenge = await computeCodeChallenge(codeVerifier, authCode.code_challenge_method);
    if (computedChallenge !== authCode.code_challenge) {
      return errorResponse('invalid_grant', 'Invalid code_verifier', 400, corsHeaders);
    }
  }

  // Delete used authorization code
  await supabase.from('smart_auth_codes').delete().eq('code', code);

  // Generate tokens
  const accessToken = generateSecureToken(48);
  const refreshToken = generateSecureToken(64);
  const accessTokenExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY * 1000);
  const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

  // Store access token
  await supabase.from('smart_access_tokens').insert({
    access_token: accessToken,
    refresh_token: refreshToken,
    client_id: clientId,
    patient_id: authCode.patient_id,
    scopes: authCode.scope,
    expires_at: accessTokenExpiry.toISOString(),
    refresh_expires_at: refreshTokenExpiry.toISOString()
  });

  // Return token response
  return new Response(JSON.stringify({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    refresh_token: refreshToken,
    scope: authCode.scope,
    patient: authCode.patient_id  // SMART context
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    }
  });
}

// ============================================================================
// Refresh Token (POST grant_type=refresh_token)
// ============================================================================

async function handleRefreshToken(params: URLSearchParams, corsHeaders: Record<string, string>) {
  const refreshToken = params.get('refresh_token');
  const clientId = params.get('client_id');

  if (!refreshToken || !clientId) {
    return errorResponse('invalid_request', 'Missing required parameters', 400, corsHeaders);
  }

  // Look up refresh token
  const { data: tokenData, error: tokenError } = await supabase
    .from('smart_access_tokens')
    .select('*')
    .eq('refresh_token', refreshToken)
    .eq('client_id', clientId)
    .single();

  if (tokenError || !tokenData) {
    return errorResponse('invalid_grant', 'Invalid refresh token', 400, corsHeaders);
  }

  // Check refresh token expiry
  if (new Date(tokenData.refresh_expires_at) < new Date()) {
    await supabase.from('smart_access_tokens').delete().eq('refresh_token', refreshToken);
    return errorResponse('invalid_grant', 'Refresh token expired', 400, corsHeaders);
  }

  // Generate new access token
  const newAccessToken = generateSecureToken(48);
  const newAccessTokenExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY * 1000);

  // Update token record
  await supabase.from('smart_access_tokens')
    .update({
      access_token: newAccessToken,
      expires_at: newAccessTokenExpiry.toISOString()
    })
    .eq('refresh_token', refreshToken);

  return new Response(JSON.stringify({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_EXPIRY,
    refresh_token: refreshToken,
    scope: tokenData.scopes,
    patient: tokenData.patient_id
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache'
    }
  });
}

// ============================================================================
// Dynamic Client Registration
// ============================================================================

async function handleDynamicRegistration(req: Request, corsHeaders: Record<string, string>) {
  const body = await req.json();

  const {
    client_name,
    redirect_uris,
    logo_uri,
    contacts,
    scope,
    grant_types,
    token_endpoint_auth_method
  } = body;

  if (!client_name || !redirect_uris || redirect_uris.length === 0) {
    return errorResponse('invalid_client_metadata', 'client_name and redirect_uris required', 400, corsHeaders);
  }

  // Generate client credentials
  const clientId = generateSecureToken(24);
  const clientSecret = token_endpoint_auth_method !== 'none' ? generateSecureToken(48) : null;

  // Store registered app
  const { error: insertError } = await supabase.from('smart_registered_apps').insert({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: client_name,
    redirect_uris: redirect_uris,
    logo_uri: logo_uri,
    contacts: contacts,
    scope: scope || 'patient/*.read',
    grant_types: grant_types || ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: token_endpoint_auth_method || 'client_secret_basic',
    client_type: clientSecret ? 'confidential' : 'public',
    is_active: true
  });

  if (insertError) {
    return errorResponse('server_error', 'Failed to register client', 500, corsHeaders);
  }

  return new Response(JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: client_name,
    redirect_uris: redirect_uris,
    grant_types: grant_types || ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: token_endpoint_auth_method || 'client_secret_basic'
  }), {
    status: 201,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// ============================================================================
// Token Revocation
// ============================================================================

async function handleRevoke(req: Request, corsHeaders: Record<string, string>) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const token = params.get('token');

  if (!token) {
    return errorResponse('invalid_request', 'token required', 400, corsHeaders);
  }

  // Try to delete as access token or refresh token
  await supabase.from('smart_access_tokens').delete().eq('access_token', token);
  await supabase.from('smart_access_tokens').delete().eq('refresh_token', token);

  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

// ============================================================================
// Token Introspection
// ============================================================================

async function handleIntrospect(req: Request, corsHeaders: Record<string, string>) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const token = params.get('token');

  if (!token) {
    return new Response(JSON.stringify({ active: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { data: tokenData, error } = await supabase
    .from('smart_access_tokens')
    .select('*')
    .eq('access_token', token)
    .single();

  if (error || !tokenData || new Date(tokenData.expires_at) < new Date()) {
    return new Response(JSON.stringify({ active: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    active: true,
    scope: tokenData.scopes,
    client_id: tokenData.client_id,
    exp: Math.floor(new Date(tokenData.expires_at).getTime() / 1000),
    patient: tokenData.patient_id
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// User Approval (POST action=approve)
// ============================================================================

async function handleApproval(req: Request, corsHeaders: Record<string, string>) {
  const body = await req.json();
  const { client_id, patient_id, scope, redirect_uri, state, code_challenge, code_challenge_method } = body;

  if (!client_id || !patient_id || !redirect_uri) {
    return errorResponse('invalid_request', 'Missing required parameters', 400, corsHeaders);
  }

  // Create authorization code
  const authCode = generateSecureToken(32);
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY * 1000);

  await supabase.from('smart_auth_codes').insert({
    code: authCode,
    client_id: client_id,
    patient_id: patient_id,
    redirect_uri: redirect_uri,
    scope: scope,
    code_challenge: code_challenge,
    code_challenge_method: code_challenge_method,
    expires_at: expiresAt.toISOString()
  });

  // Log the authorization for patient visibility
  await supabase.from('smart_authorizations').insert({
    patient_id: patient_id,
    client_id: client_id,
    scope: scope,
    authorized_at: new Date().toISOString()
  });

  // Build redirect URL
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) redirectUrl.searchParams.set('state', state);

  return new Response(JSON.stringify({ redirect_uri: redirectUrl.toString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Consent Page Renderer
// ============================================================================

function renderConsentPage(
  clientId: string,
  redirectUri: string,
  scope: string,
  state: string | null,
  codeChallenge: string | null,
  codeChallengeMethod: string | null,
  app: any,
  corsHeaders: Record<string, string>
) {
  const scopes = scope.split(' ').filter(s => s);
  const scopeDescriptions: Record<string, string> = {
    'patient/Patient.read': 'View your basic profile information',
    'patient/AllergyIntolerance.read': 'View your allergies',
    'patient/Condition.read': 'View your health conditions',
    'patient/MedicationRequest.read': 'View your medications',
    'patient/Observation.read': 'View your vital signs and lab results',
    'patient/Immunization.read': 'View your immunization records',
    'patient/Procedure.read': 'View your procedures',
    'patient/DiagnosticReport.read': 'View your diagnostic reports',
    'patient/CarePlan.read': 'View your care plans',
    'patient/CareTeam.read': 'View your care team',
    'patient/Goal.read': 'View your health goals',
    'patient/DocumentReference.read': 'View your clinical documents',
    'patient/*.read': 'View all your health records',
    'offline_access': 'Access your data when you\'re not logged in'
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize ${app.client_name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      max-width: 480px;
      width: 100%;
      padding: 30px;
    }
    .header {
      text-align: center;
      margin-bottom: 25px;
    }
    .app-logo {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      margin-bottom: 15px;
    }
    h1 {
      font-size: 22px;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
    }
    .permissions {
      margin: 25px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .permissions h3 {
      font-size: 14px;
      color: #333;
      margin-bottom: 12px;
    }
    .permission-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      font-size: 14px;
      color: #444;
    }
    .permission-item::before {
      content: "✓";
      color: #22c55e;
      font-weight: bold;
      margin-right: 10px;
    }
    .warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 12px;
      margin: 20px 0;
      font-size: 13px;
      color: #92400e;
    }
    .buttons {
      display: flex;
      gap: 12px;
      margin-top: 25px;
    }
    button {
      flex: 1;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .btn-deny {
      background: #f3f4f6;
      color: #374151;
    }
    .btn-deny:hover {
      background: #e5e7eb;
    }
    .btn-approve {
      background: #2563eb;
      color: white;
    }
    .btn-approve:hover {
      background: #1d4ed8;
    }
    .login-required {
      text-align: center;
      padding: 40px 20px;
    }
    .login-btn {
      background: #2563eb;
      color: white;
      padding: 14px 30px;
      border-radius: 8px;
      text-decoration: none;
      display: inline-block;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${app.logo_uri ? `<img src="${app.logo_uri}" alt="${app.client_name}" class="app-logo">` : ''}
      <h1>${app.client_name}</h1>
      <p class="subtitle">wants to access your health records</p>
    </div>

    <div class="permissions">
      <h3>This app will be able to:</h3>
      ${scopes.map(s => {
        const desc = scopeDescriptions[s] || s;
        return `<div class="permission-item">${desc}</div>`;
      }).join('')}
    </div>

    <div class="warning">
      <strong>Important:</strong> Only authorize apps you trust. ${app.client_name} will have read-only access to the data listed above.
    </div>

    <div class="buttons">
      <button class="btn-deny" onclick="deny()">Deny</button>
      <button class="btn-approve" onclick="approve()">Authorize</button>
    </div>
  </div>

  <script>
    const params = {
      client_id: '${clientId}',
      redirect_uri: '${redirectUri}',
      scope: '${scope}',
      state: ${state ? `'${state}'` : 'null'},
      code_challenge: ${codeChallenge ? `'${codeChallenge}'` : 'null'},
      code_challenge_method: ${codeChallengeMethod ? `'${codeChallengeMethod}'` : 'null'}
    };

    async function approve() {
      // This would normally check if user is logged in
      // For now, redirect to login with return URL
      const loginUrl = '/login?return=' + encodeURIComponent(window.location.href);
      window.location.href = loginUrl;
    }

    function deny() {
      const redirectUri = new URL('${redirectUri}');
      redirectUri.searchParams.set('error', 'access_denied');
      redirectUri.searchParams.set('error_description', 'User denied the request');
      ${state ? `redirectUri.searchParams.set('state', '${state}');` : ''}
      window.location.href = redirectUri.toString();
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html'
    }
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateSecureToken(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function computeCodeChallenge(verifier: string, method: string | null): Promise<string> {
  if (method === 'S256') {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return verifier; // plain method
}

function errorResponse(error: string, description: string, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify({
    error,
    error_description: description
  }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}
