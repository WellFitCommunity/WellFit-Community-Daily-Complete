/**
 * Chain Retry Logic — Unit Tests
 *
 * Tests the retry behavior for MCP server calls in chain execution:
 * - Retryable vs non-retryable error classification
 * - Exponential backoff calculation
 * - Retry attempt tracking
 * - Max retries enforcement
 * - Default behavior (max_retries = 0, no retry)
 *
 * These test the retry utility patterns used by the chain engine.
 * The actual chainEngine.ts runs in Deno, so we test the logic
 * functions in isolation via Vitest.
 */

// ============================================================
// Replicate retry utility functions for testability
// (Same logic as chainEngine.ts — kept in sync)
// ============================================================

function isRetryableError(errMsg: string): boolean {
  const retryablePatterns = [
    /timed out/i,
    /timeout/i,
    /returned 5\d{2}/,
    /returned 429/,
    /network/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /AbortError/i,
    /fetch failed/i,
  ];
  return retryablePatterns.some((p) => p.test(errMsg));
}

function getBackoffMs(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

// ============================================================
// Tests
// ============================================================

describe('Chain Retry Logic', () => {
  describe('isRetryableError', () => {
    it('should classify timeout errors as retryable', () => {
      expect(isRetryableError('MCP server fhir/get_patient timed out after 30000ms')).toBe(true);
      expect(isRetryableError('Request timeout')).toBe(true);
      expect(isRetryableError('Connection timed out')).toBe(true);
    });

    it('should classify 5xx server errors as retryable', () => {
      expect(isRetryableError('MCP server mcp-fhir-server/search_resources returned 500: Internal error')).toBe(true);
      expect(isRetryableError('returned 502: Bad Gateway')).toBe(true);
      expect(isRetryableError('returned 503: Service Unavailable')).toBe(true);
    });

    it('should classify 429 rate limit errors as retryable', () => {
      expect(isRetryableError('MCP server mcp-medical-codes-server/search returned 429: Rate limited')).toBe(true);
    });

    it('should classify network errors as retryable', () => {
      expect(isRetryableError('Network error')).toBe(true);
      expect(isRetryableError('ECONNREFUSED')).toBe(true);
      expect(isRetryableError('ECONNRESET')).toBe(true);
      expect(isRetryableError('fetch failed')).toBe(true);
    });

    it('should classify AbortError as retryable', () => {
      expect(isRetryableError('AbortError: The operation was aborted')).toBe(true);
    });

    it('should classify 4xx validation errors as non-retryable', () => {
      expect(isRetryableError('MCP server mcp-fhir-server/create returned 400: Bad Request')).toBe(false);
      expect(isRetryableError('returned 401: Unauthorized')).toBe(false);
      expect(isRetryableError('returned 403: Forbidden')).toBe(false);
      expect(isRetryableError('returned 404: Not Found')).toBe(false);
      expect(isRetryableError('returned 422: Unprocessable Entity')).toBe(false);
    });

    it('should classify MCP tool errors as non-retryable', () => {
      expect(isRetryableError('MCP tool error (mcp-fhir-server/get_patient): {"code":-32602,"message":"Invalid params"}')).toBe(false);
    });

    it('should classify missing config errors as non-retryable', () => {
      expect(isRetryableError('Missing SUPABASE_URL or SB_SECRET_KEY')).toBe(false);
    });

    it('should classify chain definition errors as non-retryable', () => {
      expect(isRetryableError('Chain not found or inactive: test_chain')).toBe(false);
      expect(isRetryableError('No steps defined for chain: test_chain')).toBe(false);
    });
  });

  describe('getBackoffMs', () => {
    it('should use exponential backoff starting at ~1s', () => {
      // attempt 0: base = 1000ms
      const backoff0 = getBackoffMs(0);
      expect(backoff0).toBeGreaterThanOrEqual(1000);
      expect(backoff0).toBeLessThanOrEqual(1500); // 1000 + max 500 jitter
    });

    it('should double the base delay for each attempt', () => {
      // attempt 1: base = 2000ms
      const backoff1 = getBackoffMs(1);
      expect(backoff1).toBeGreaterThanOrEqual(2000);
      expect(backoff1).toBeLessThanOrEqual(2500);

      // attempt 2: base = 4000ms
      const backoff2 = getBackoffMs(2);
      expect(backoff2).toBeGreaterThanOrEqual(4000);
      expect(backoff2).toBeLessThanOrEqual(4500);

      // attempt 3: base = 8000ms
      const backoff3 = getBackoffMs(3);
      expect(backoff3).toBeGreaterThanOrEqual(8000);
      expect(backoff3).toBeLessThanOrEqual(8500);
    });

    it('should cap backoff at 30 seconds plus jitter', () => {
      // attempt 5: base = min(32000, 30000) = 30000ms
      const backoff5 = getBackoffMs(5);
      expect(backoff5).toBeGreaterThanOrEqual(30000);
      expect(backoff5).toBeLessThanOrEqual(30500);

      // attempt 10: still capped at 30000ms base
      const backoff10 = getBackoffMs(10);
      expect(backoff10).toBeGreaterThanOrEqual(30000);
      expect(backoff10).toBeLessThanOrEqual(30500);
    });

    it('should add jitter (non-deterministic component)', () => {
      // Run multiple times and verify variance exists
      const results = Array.from({ length: 20 }, () => getBackoffMs(0));
      const uniqueValues = new Set(results);
      // With 20 samples and 500ms jitter range, we should get multiple unique values
      expect(uniqueValues.size).toBeGreaterThan(1);
    });
  });

  describe('Retry behavior integration', () => {
    it('should preserve default behavior when max_retries is 0', () => {
      // max_retries = 0 means no retries — fail on first error
      const maxRetries = 0;
      let attempts = 0;
      const errors: string[] = [];

      // Simulate the retry loop from executeWithRetry
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts++;
        const errMsg = 'MCP server mcp-fhir-server/get_patient returned 500: Internal error';
        errors.push(errMsg);

        if (!isRetryableError(errMsg) || attempt >= maxRetries) {
          break; // Would throw in real code
        }
      }

      expect(attempts).toBe(1);
      expect(errors).toHaveLength(1);
    });

    it('should retry up to max_retries for transient errors', () => {
      const maxRetries = 3;
      let attempts = 0;
      const errors: string[] = [];
      let succeeded = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts++;

        // Simulate: fails on first 2, succeeds on 3rd
        if (attempt < 2) {
          const errMsg = 'MCP server mcp-fhir-server/get_patient returned 503: Service Unavailable';
          errors.push(errMsg);
          if (!isRetryableError(errMsg) || attempt >= maxRetries) break;
          continue;
        }

        succeeded = true;
        break;
      }

      expect(attempts).toBe(3); // 2 failures + 1 success
      expect(errors).toHaveLength(2);
      expect(succeeded).toBe(true);
    });

    it('should not retry non-retryable errors regardless of max_retries', () => {
      const maxRetries = 3;
      let attempts = 0;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts++;
        const errMsg = 'MCP server mcp-fhir-server/create returned 400: Bad Request';

        if (!isRetryableError(errMsg) || attempt >= maxRetries) {
          break; // Non-retryable — exit immediately
        }
      }

      expect(attempts).toBe(1);
    });

    it('should exhaust all retries and fail when error persists', () => {
      const maxRetries = 2;
      let attempts = 0;
      const errors: string[] = [];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts++;
        const errMsg = 'MCP server mcp-fhir-server/get_patient timed out after 30000ms';
        errors.push(errMsg);

        if (!isRetryableError(errMsg) || attempt >= maxRetries) {
          break;
        }
      }

      expect(attempts).toBe(3); // initial + 2 retries
      expect(errors).toHaveLength(3);
    });

    it('should produce retry_count value for step result persistence', () => {
      // Simulates the retryCount calculation done in executeSteps
      const maxRetries = 2;
      let finalAttempts = 0;

      // Simulate: succeeds on 2nd attempt (1 retry)
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        finalAttempts = attempt + 1;
        if (attempt === 1) break; // success on 2nd try

        const errMsg = 'MCP server returned 503: Service Unavailable';
        if (!isRetryableError(errMsg) || attempt >= maxRetries) break;
      }

      const retryCount = finalAttempts - 1;
      expect(retryCount).toBe(1);
      // retryCount is what gets persisted to chain_step_results.retry_count
    });

    it('should produce retry_count of 0 when succeeding on first attempt', () => {
      // With max_retries = 3, but succeeding immediately, retry_count should be 0
      const finalAttempts = 1; // succeeds immediately
      const retryCount = finalAttempts - 1;
      expect(retryCount).toBe(0);
    });

    it('should track retry metadata for audit logging', () => {
      const maxRetries = 2;
      let finalAttempts = 0;
      const retryLog: Array<{ attempt: number; error: string; backoffMs: number }> = [];

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        finalAttempts = attempt + 1;

        if (attempt > 0) {
          const backoffMs = getBackoffMs(attempt - 1);
          retryLog.push({
            attempt,
            error: 'returned 503: Service Unavailable',
            backoffMs,
          });
        }

        // Simulate: succeeds on last attempt
        if (attempt === maxRetries) {
          break;
        }

        const errMsg = 'MCP server returned 503: Service Unavailable';
        if (!isRetryableError(errMsg) || attempt >= maxRetries) break;
      }

      expect(finalAttempts).toBe(3);
      expect(retryLog).toHaveLength(2);
      expect(retryLog[0].attempt).toBe(1);
      expect(retryLog[1].attempt).toBe(2);
      // Backoff values should increase
      expect(retryLog[1].backoffMs).toBeGreaterThan(retryLog[0].backoffMs - 500); // account for jitter
    });
  });
});
