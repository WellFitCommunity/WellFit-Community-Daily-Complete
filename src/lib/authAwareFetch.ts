// src/lib/authAwareFetch.ts
// Intercepts Supabase fetch calls to handle auth failures at the transport layer
// This prevents error cascades when refresh tokens are invalid

import { auditLogger } from '../services/auditLogger';

// Storage key pattern for Supabase auth tokens
const SUPABASE_AUTH_KEY_PATTERN = /^sb-.*$/;

/**
 * Clears all Supabase auth tokens from storage and redirects to login.
 * Called when we detect an unrecoverable auth failure.
 *
 * Note: We use localStorage for session persistence (survives navigation).
 * Server-side JWT expiry handles session timeout.
 */
function handleAuthFailure(reason: string): void {
  auditLogger.auth('LOGOUT', true, { reason, source: 'authAwareFetch' });

  // Clear all Supabase auth tokens from localStorage (primary storage)
  const localKeysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) {
      localKeysToRemove.push(key);
    }
  }
  localKeysToRemove.forEach(key => localStorage.removeItem(key));

  // Also clear any legacy sessionStorage keys (from previous HIPAA config)
  const sessionKeysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) {
      sessionKeysToRemove.push(key);
    }
  }
  sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

  // Redirect to login if not already there
  const currentPath = window.location.pathname;
  if (currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/') {
    window.location.href = '/login';
  }
}

// Track if we've already triggered auth failure handling to prevent multiple redirects
let authFailureHandled = false;

/**
 * Creates an auth-aware fetch wrapper for Supabase.
 * Intercepts 400/401 responses that indicate invalid refresh tokens
 * and handles them cleanly before errors cascade.
 */
export function createAuthAwareFetch(): typeof fetch {
  const originalFetch = fetch.bind(globalThis);

  return async function authAwareFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    // Get URL before fetch for error handling
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const isSupabaseCall = url.includes('.supabase.co') || url.includes('.supabase.com');

    let response: Response;
    try {
      response = await originalFetch(input, init);
    } catch (networkError) {
      // Network errors (ERR_ADDRESS_UNREACHABLE, etc.) - just rethrow
      // These are connectivity issues, not auth issues
      throw networkError;
    }

    // Only process Supabase calls for auth error detection
    if (!isSupabaseCall) {
      return response;
    }

    // Endpoint classification
    const isAuthEndpoint = url.includes('/auth/v1/token');
    const isRestEndpoint = url.includes('/rest/v1/');
    const isFunctionsEndpoint = url.includes('/functions/v1/');

    const status = response.status;
    const isUnauthorized = status === 401;
    const isBadRequest = status === 400;

    const method = (init?.method || 'GET').toUpperCase();

    // ============================================================
    // AUTH TOKEN ENDPOINT 400: INVALID REFRESH TOKEN -> LOG OUT
    // ============================================================
    // This is the clean/authoritative signal that the refresh token is busted.
    if (isAuthEndpoint && isBadRequest && !authFailureHandled) {
      const clonedResponse = response.clone();
      try {
        const body = await clonedResponse.json();
        const errorMessage = body?.error_description || body?.message || body?.error || '';

        // Check for specific refresh token errors
        if (
          errorMessage.includes('Invalid Refresh Token') ||
          errorMessage.includes('Refresh Token Not Found') ||
          errorMessage.includes('Token has expired') ||
          errorMessage.includes('Invalid token')
        ) {
          authFailureHandled = true;
          handleAuthFailure(`refresh_token_invalid: ${errorMessage}`);
        }
      } catch {
        // If we can't parse the body, check status alone for auth endpoint
        authFailureHandled = true;
        handleAuthFailure('refresh_token_error_unparseable');
      }
    }

    // ============================================================
    // 401 HANDLING: DO NOT AUTO-LOGOUT ON EDGE FUNCTIONS
    // ============================================================
    // Edge Functions can legitimately return 401 for app-level authorization
    // (e.g., missing session_token, already-configured flow, custom gates, etc.)
    // Those must be handled by the calling feature/page, not by transport.
    if (!isAuthEndpoint && isUnauthorized && !authFailureHandled) {
      if (isFunctionsEndpoint) {
        // Record for diagnostics but do NOT destroy the user's session here.
        auditLogger.security('EDGE_FUNCTION_401', 'low', {
          source: 'authAwareFetch',
          url,
          method,
          status,
          note: '401 from /functions/v1/ is not treated as global auth failure',
        });

        return response;
      }

      const clonedResponse = response.clone();
      try {
        const body = await clonedResponse.json();
        const rawMessage = (body?.message || body?.error || '') as string;
        const errorMessage = rawMessage.toLowerCase();

        // Tightened: only trigger logout on strong “JWT is invalid/expired” signals
        // Avoid nuking sessions on generic "Unauthorized" that could be an RLS gate, etc.
        const isStrongJwtSignal =
          errorMessage.includes('invalid jwt') ||
          errorMessage.includes('jwt expired') ||
          errorMessage.includes('expired jwt') ||
          errorMessage.includes('signature') ||
          errorMessage.includes('token is expired') ||
          errorMessage.includes('invalid token') ||
          errorMessage.includes('bad jwt');

        if (isStrongJwtSignal) {
          authFailureHandled = true;
          handleAuthFailure(`jwt_invalid: ${rawMessage || 'unknown'}`);
        }
      } catch {
        // Unparseable 401: only treat as auth failure if it's NOT functions
        // and we have no JSON body to inspect.
        authFailureHandled = true;
        handleAuthFailure('unauthorized_unparseable');
      }
    }

    // ==========================================
    // REST 400/406: LOG (DON'T LOG OUT)
    // ==========================================
    // These are schema/payload/.single() issues, NOT auth failures.
    // We log them for debugging but do NOT trigger logout.
    if (isRestEndpoint && (status === 400 || status === 406)) {
      const clonedResponse = response.clone();
      let parsed: Record<string, unknown> | null = null;

      try {
        parsed = await clonedResponse.json();
      } catch {
        // non-json response; ignore
      }

      // Extract PostgREST error fields when present
      const msg = (parsed?.message || parsed?.error || null) as string | null;
      const details = (parsed?.details || null) as string | null;
      const hint = (parsed?.hint || null) as string | null;
      const code = (parsed?.code || parsed?.error_code || null) as string | null;

      // Attempt to safely describe payload without storing sensitive PHI values
      let payloadKeys: string[] | null = null;
      try {
        if (init?.body && typeof init.body === 'string') {
          const maybeJson = JSON.parse(init.body) as
            | Record<string, unknown>
            | Record<string, unknown>[];
          if (maybeJson && typeof maybeJson === 'object') {
            payloadKeys = Array.isArray(maybeJson)
              ? Object.keys(maybeJson[0] || {})
              : Object.keys(maybeJson);
          }
        }
      } catch {
        // ignore parse errors
      }

      // Log the REST error for debugging - this is NOT a logout trigger
      auditLogger.security('REST_PAYLOAD_ERROR', 'low', {
        source: 'authAwareFetch',
        url,
        method,
        status,
        message: msg,
        details,
        hint,
        code,
        payloadKeys,
      });
    }

    return response;
  };
}

/**
 * Reset the auth failure flag - call this after successful login
 */
export function resetAuthFailureFlag(): void {
  authFailureHandled = false;
}
