// src/lib/authAwareFetch.ts
// Intercepts Supabase fetch calls to handle auth failures at the transport layer
// This prevents error cascades when refresh tokens are invalid

import { auditLogger } from '../services/auditLogger';

// Storage key pattern for Supabase auth tokens
const SUPABASE_AUTH_KEY_PATTERN = /^sb-.*-auth-token$/;

/**
 * Clears all Supabase auth tokens from storage and redirects to login.
 * Called when we detect an unrecoverable auth failure.
 */
function handleAuthFailure(reason: string): void {
  auditLogger.auth('LOGOUT', true, { reason, source: 'authAwareFetch' });

  // Clear all Supabase auth tokens from localStorage
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && SUPABASE_AUTH_KEY_PATTERN.test(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // Also clear legacy keys
  localStorage.removeItem('supabase.auth.token');
  sessionStorage.removeItem('supabase.auth.token');

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
    const response = await originalFetch(input, init);

    // Only check auth endpoints and API calls to Supabase
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isSupabaseCall = url.includes('.supabase.co') || url.includes('.supabase.com');

    if (!isSupabaseCall) {
      return response;
    }

    // Check for auth failures - 400 on token endpoint or 401 on any endpoint
    const isAuthEndpoint = url.includes('/auth/v1/token');
    const isUnauthorized = response.status === 401;
    const isBadRequest = response.status === 400;

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
        const errorMessage = body?.message || body?.error || '';

        // JWT expired or invalid
        if (
          errorMessage.includes('JWT') ||
          errorMessage.includes('token') ||
          errorMessage.includes('unauthorized')
        ) {
          authFailureHandled = true;
          handleAuthFailure(`jwt_invalid: ${errorMessage}`);
        }
      } catch {
        // Unparseable 401 - still an auth failure
        authFailureHandled = true;
        handleAuthFailure('unauthorized_unparseable');
      }
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
