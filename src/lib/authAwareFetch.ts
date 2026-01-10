// src/lib/authAwareFetch.ts
// Intercepts Supabase fetch calls to handle auth failures at the transport layer
// This prevents error cascades when refresh tokens are invalid

import { auditLogger } from '../services/auditLogger';

// Storage key pattern for Supabase auth tokens
const SUPABASE_AUTH_KEY_PATTERN = /^sb-.*$/;

// REST endpoints that can spam failures - skip audit logging for these to prevent loops
const REALTIME_SUBSCRIPTION_REGISTRY_PATH = '/rest/v1/realtime_subscription_registry';
const AUDIT_LOGS_PATH = '/rest/v1/audit_logs';

// Endpoints where we should NOT trigger audit logging (prevents infinite loops)
const SKIP_AUDIT_LOGGING_PATHS = [AUDIT_LOGS_PATH, REALTIME_SUBSCRIPTION_REGISTRY_PATH];

// Throttle repeated log entries so we get signal instead of a log storm
const FAILURE_LOG_COOLDOWN_MS = 2000;

// Track last time we logged a given failure key (method + url)
const lastFailureLogAtByKey = new Map<string, number>();

/**
 * Clears all Supabase auth tokens from storage and redirects to login.
 * Called when we detect an unrecoverable auth failure.
 *
 * Note: We use localStorage for session persistence (survives navigation).
 * Server-side JWT expiry handles session timeout.
 */
function handleAuthFailure(reason: string): void {
  // Check if we're still in cooldown from a recent auth failure
  const now = Date.now();
  if (authFailureHandled && now - authFailureTimestamp < AUTH_FAILURE_COOLDOWN) {
    auditLogger.debug('AUTH_FAILURE_COOLDOWN', { reason, timeSinceLastMs: now - authFailureTimestamp });
    return;
  }

  authFailureHandled = true;
  authFailureTimestamp = now;
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
// Timestamp of when auth failure was last handled to allow re-handling after a delay
let authFailureTimestamp = 0;
// Minimum time (ms) before we can handle another auth failure (prevents rapid-fire handling)
const AUTH_FAILURE_COOLDOWN = 2000;

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
    const isAuthTokenEndpoint = url.includes('/auth/v1/token');
    const isAuthUserEndpoint = url.includes('/auth/v1/user'); // informational; do not auto-logout here
    const isRestEndpoint = url.includes('/rest/v1/');
    const isFunctionsEndpoint = url.includes('/functions/v1/');

    // CRITICAL: Skip audit logging for endpoints that could cause infinite loops
    // If audit_logs itself fails, we don't want to try logging that failure to audit_logs
    const shouldSkipAuditLogging = SKIP_AUDIT_LOGGING_PATHS.some(path => url.includes(path));

    // Helper to conditionally log - prevents infinite loops
    const safeAuditLog = (eventType: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata: Record<string, unknown>) => {
      if (!shouldSkipAuditLogging) {
        auditLogger.security(eventType, severity, metadata).catch(() => {
          // Swallow - logging failure should never cascade
        });
      }
    };

    const status = response.status;
    const isUnauthorized = status === 401;
    const isBadRequest = status === 400;

    const method = (init?.method || 'GET').toUpperCase();

    // ============================================================
    // AUTH TOKEN ENDPOINT 400: INVALID REFRESH TOKEN -> LOG OUT
    // ============================================================
    // This is the clean/authoritative signal that the refresh token is busted.
    // Check cooldown: don't process if we recently handled an auth failure
    const now = Date.now();
    const inCooldown = authFailureHandled && (now - authFailureTimestamp < AUTH_FAILURE_COOLDOWN);

    if (isAuthTokenEndpoint && isBadRequest && !inCooldown) {
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
          handleAuthFailure(`refresh_token_invalid: ${errorMessage}`);
        }
      } catch {
        // If we can't parse the body, check status alone for auth token endpoint
        handleAuthFailure('refresh_token_error_unparseable');
      }
    }

    // ============================================================
    // 401 HANDLING: CAUTIOUS + NON-DESTRUCTIVE
    // ============================================================
    // We ONLY trigger logout on strong JWT invalid/expired signals.
    // We do NOT logout on generic 401s (RLS gates, policy gates, app gates).
    if (!isAuthTokenEndpoint && isUnauthorized && !inCooldown) {
      // Edge Functions can legitimately return 401 for app-level authorization.
      // Do NOT destroy the user's session here.
      if (isFunctionsEndpoint) {
        safeAuditLog('EDGE_FUNCTION_401', 'low', {
          source: 'authAwareFetch',
          url,
          method,
          status,
          note: '401 from /functions/v1/ is not treated as global auth failure',
        });
        return response;
      }

      // /auth/v1/user can return non-actionable 401/403 depending on how it's called.
      // Never nuke session based on that endpoint alone.
      if (isAuthUserEndpoint) {
        safeAuditLog('AUTH_USER_ENDPOINT_UNAUTHORIZED', 'low', {
          source: 'authAwareFetch',
          url,
          method,
          status,
          note: 'Auth user endpoint unauthorized/forbidden - not treated as global auth failure',
        });
        return response;
      }

      const clonedResponse = response.clone();
      try {
        const body = await clonedResponse.json();
        const rawMessage = (body?.message || body?.error || '') as string;
        const errorMessage = rawMessage.toLowerCase();

        // Only trigger logout on strong "JWT is invalid/expired" signals
        const isStrongJwtSignal =
          errorMessage.includes('invalid jwt') ||
          errorMessage.includes('jwt expired') ||
          errorMessage.includes('expired jwt') ||
          errorMessage.includes('signature') ||
          errorMessage.includes('token is expired') ||
          errorMessage.includes('invalid token') ||
          errorMessage.includes('bad jwt');

        if (isStrongJwtSignal) {
          handleAuthFailure(`jwt_invalid: ${rawMessage || 'unknown'}`);
        } else {
          // Log for diagnostics, but do NOT logout
          safeAuditLog('SUPABASE_401_NON_STRONG_SIGNAL', 'low', {
            source: 'authAwareFetch',
            url,
            method,
            status,
            message: rawMessage || null,
            note: isRestEndpoint
              ? 'REST 401 (likely RLS/auth missing) - not treated as global auth failure'
              : '401 without strong JWT signal - not treated as global auth failure',
          });
        }
      } catch {
        // CRITICAL CHANGE:
        // Do NOT logout on unparseable 401. This was nuking sessions during legitimate gates.
        safeAuditLog('SUPABASE_401_UNPARSEABLE', 'low', {
          source: 'authAwareFetch',
          url,
          method,
          status,
          note: '401 body unparseable - not treated as global auth failure',
        });
      }
    }

    // ============================================================
    // REALTIME SUBSCRIPTION REGISTRY PATCH FAILURES: LOG + THROTTLE
    // ============================================================
    // This endpoint is currently spamming PATCH failures. We capture the status
    // and PostgREST error details (when available) WITHOUT logging out.
    if (
      isRestEndpoint &&
      method === 'PATCH' &&
      url.includes(REALTIME_SUBSCRIPTION_REGISTRY_PATH) &&
      !response.ok
    ) {
      const failureKey = `${method}:${url}`;
      const lastAt = lastFailureLogAtByKey.get(failureKey) || 0;

      if (now - lastAt >= FAILURE_LOG_COOLDOWN_MS) {
        lastFailureLogAtByKey.set(failureKey, now);

        const clonedResponse = response.clone();
        let parsed: Record<string, unknown> | null = null;

        try {
          parsed = await clonedResponse.json();
        } catch {
          // non-json response; ignore
        }

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

        safeAuditLog('REALTIME_REGISTRY_PATCH_FAILED', 'low', {
          source: 'authAwareFetch',
          url,
          method,
          status,
          ok: response.ok,
          message: msg,
          details,
          hint,
          code,
          payloadKeys,
          note: 'PATCH to realtime_subscription_registry failed (likely RLS/policy/schema). Capture response details here.',
        });
      }

      return response;
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

      safeAuditLog('REST_PAYLOAD_ERROR', 'low', {
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
