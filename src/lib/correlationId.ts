/**
 * Correlation ID utility for request tracing
 *
 * Provides a session-scoped correlation ID and per-request IDs for
 * end-to-end request tracing across frontend and backend.
 *
 * Usage:
 * - getSessionId(): Returns stable ID for current browser session
 * - generateRequestId(): Creates new ID for each API call
 * - getCorrelationHeaders(): Returns headers to include in fetch/axios
 *
 * @module correlationId
 */

// Session ID persists for browser session (survives page navigation)
let sessionId: string | null = null;

/**
 * Get or create a session-scoped correlation ID
 * Stored in sessionStorage to persist across page navigations
 */
export function getSessionId(): string {
  if (sessionId) return sessionId;

  // Try to restore from sessionStorage
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('wf_session_id');
    if (stored) {
      sessionId = stored;
      return sessionId;
    }

    // Generate new session ID
    sessionId = `ses_${crypto.randomUUID()}`;
    sessionStorage.setItem('wf_session_id', sessionId);
  } else {
    // Server-side or non-browser environment
    sessionId = `ses_${crypto.randomUUID()}`;
  }

  return sessionId;
}

/**
 * Generate a unique request ID for a single API call
 * Format: req_{uuid}
 */
export function generateRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

/**
 * Generate a correlation ID for error tracking
 * Format: err_{timestamp}_{random}
 * Includes timestamp for easier log searching
 */
export function generateErrorCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `err_${timestamp}_${random}`;
}

/**
 * Get headers to include in API requests for correlation
 */
export function getCorrelationHeaders(): Record<string, string> {
  return {
    'X-Session-Id': getSessionId(),
    'X-Request-Id': generateRequestId(),
  };
}

/**
 * Create a fetch wrapper that automatically adds correlation headers
 */
export function correlatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const correlationHeaders = getCorrelationHeaders();

  const headers = new Headers(init?.headers);
  Object.entries(correlationHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return fetch(input, {
    ...init,
    headers,
  });
}
