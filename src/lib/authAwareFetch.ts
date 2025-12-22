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
 * HIPAA: We use sessionStorage (not localStorage) for auth tokens.
 * This ensures tokens are cleared when browser closes.
 */
function handleAuthFailure(reason: string): void {
  auditLogger.auth('LOGOUT', true, { reason, source: 'authAwareFetch' });

  // Clear all Supabase auth tokens from sessionStorage (HIPAA-compliant storage)
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));

  // Also clear any legacy localStorage keys (from before HIPAA fix)
  const localKeysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) {
      localKeysToRemove.push(key);
    }
  }
  localKeysToRemove.forEach(key => localStorage.removeItem(key));

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
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
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

    // Check for auth failures - 400 on token endpoint or 401 on any endpoint
    const isAuthEndpoint = url.includes('/auth/v1/token');
    const isRestEndpoint = url.includes('/rest/v1/');
    const status = response.status;
    const isUnauthorized = status === 401;
    const isBadRequest = status === 400;
    const method = (init?.method || 'GET').toUpperCase();

    if (isAuthEndpoint && isBadRequest && !authFailureHandled) {
      // Clone response to read body without consuming it
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
        if (isAuthEndpoint && isBadRequest) {
          authFailureHandled = true;
          handleAuthFailure('refresh_token_error_unparseable');
        }
      }
    }

    // Also handle 401 on API calls - means token is completely invalid
    if (!isAuthEndpoint && isUnauthorized && !authFailureHandled) {
      const clonedResponse = response.clone();
      try {
        const body = await clonedResponse.json();
        const errorMessage = (body?.message || body?.error || '').toLowerCase();

        // JWT expired or invalid (case-insensitive check)
        if (
          errorMessage.includes('jwt') ||
          errorMessage.includes('token') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('invalid') ||
          errorMessage.includes('expired')
        ) {
          authFailureHandled = true;
          handleAuthFailure(`jwt_invalid: ${body?.message || body?.error || 'unknown'}`);
        }
      } catch {
        // Unparseable 401 - still an auth failure
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
          const maybeJson = JSON.parse(init.body) as Record<string, unknown> | Record<string, unknown>[];
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
      // Using security() method with 'low' severity for schema/payload errors
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
