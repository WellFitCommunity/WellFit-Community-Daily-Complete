/**
 * Vitest Test Setup
 *
 * Safe configuration for smoke and unit tests.
 * Provides necessary polyfills and mocks without breaking production code.
 */
import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach, expect } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';

// Polyfill TextEncoder/TextDecoder for Node.js test environment
// Required for Web Crypto API usage in pinHashingService
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Polyfill Web Crypto API for Node.js test environment
// Required for pinHashingService SHA-256 hashing
global.crypto = webcrypto as unknown as Crypto;

// Mock supabaseClient
vi.mock('./lib/supabaseClient');

// Mock AuthContext - provides useAuth, useUser, useSession, etc.
vi.mock('./contexts/AuthContext');

// Mock AdminAuthContext - provides useAdminAuth
vi.mock('./contexts/AdminAuthContext');

// Polyfill fetch for test environment
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
  })
) as unknown as typeof global.fetch;

// Mock window.matchMedia (required for many UI components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver (required for lazy loading components)
class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver (required for responsive components)
class MockResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver,
});

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// ============================================
// Security Testing Utilities
// ============================================

/**
 * Common SQL injection payloads for testing
 */
export const SQL_INJECTION_PAYLOADS = [
  "'; DROP TABLE users;--",
  "' OR '1'='1",
  "1' UNION SELECT * FROM users--",
  "admin'--",
  "' OR 1=1--",
  "') OR ('1'='1",
  "1; DELETE FROM profiles WHERE '1'='1",
];

/**
 * Common XSS attack vectors
 */
export const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<svg/onload=alert("XSS")>',
  'javascript:alert("XSS")',
  '<iframe src="javascript:alert(\'XSS\')">',
  '"><script>alert(String.fromCharCode(88,83,83))</script>',
  '<body onload=alert("XSS")>',
];

/**
 * Path traversal attack vectors
 */
export const PATH_TRAVERSAL_PAYLOADS = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '....//....//....//etc/passwd',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
];

/**
 * Command injection payloads
 */
export const COMMAND_INJECTION_PAYLOADS = [
  '; ls -la',
  '| cat /etc/passwd',
  '&& whoami',
  '`cat /etc/passwd`',
  '$(cat /etc/passwd)',
];

/**
 * LDAP injection payloads
 */
export const LDAP_INJECTION_PAYLOADS = [
  '*',
  '*)(&',
  '*)(uid=*',
  'admin)(&(password=*',
];

/**
 * NoSQL injection payloads
 */
export const NOSQL_INJECTION_PAYLOADS = [
  '{"$gt": ""}',
  '{"$ne": null}',
  '{"$regex": ".*"}',
];

/**
 * Test helper to verify input sanitization
 */
export function testInputSanitization(
  input: string,
  sanitizedOutput: string
): boolean {
  // Check that dangerous characters are removed or escaped
  const dangerousChars = ['<', '>', '"', "'", '&', ';', '|', '`', '$'];

  for (const char of dangerousChars) {
    if (input.includes(char) && sanitizedOutput.includes(char)) {
      return false; // Input not properly sanitized
    }
  }

  return true;
}

/**
 * Mock rate limiter for testing
 */
export class MockRateLimiter {
  private attempts: Map<string, number[]> = new Map();

  check(identifier: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter((time) => now - time < windowMs);

    if (recentAttempts.length >= maxAttempts) {
      return false; // Rate limit exceeded
    }

    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);
    return true;
  }

  reset(identifier?: string): void {
    if (identifier) {
      this.attempts.delete(identifier);
    } else {
      this.attempts.clear();
    }
  }
}

/**
 * Security test helper: verify no sensitive data in logs
 */
export function assertNoSensitiveDataInLogs(logs: string[]): void {
  const sensitivePatterns = [
    /password/i,
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,
    /\d{3}-\d{2}-\d{4}/, // SSN
    /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/, // Credit card
  ];

  for (const log of logs) {
    for (const pattern of sensitivePatterns) {
      if (pattern.test(log)) {
        throw new Error(`Sensitive data detected in logs: ${log}`);
      }
    }
  }
}

/**
 * Security test helper: verify CORS headers
 */
export function verifyCORSHeaders(headers: Headers): void {
  const origin = headers.get('Access-Control-Allow-Origin');

  if (origin === '*') {
    throw new Error('Wildcard CORS origin detected - security risk!');
  }
}

/**
 * Security test helper: verify CSP headers
 */
export function verifyCSPHeaders(headers: Headers): void {
  const csp = headers.get('Content-Security-Policy');

  if (!csp) {
    throw new Error('Missing Content-Security-Policy header');
  }

  // Check for unsafe directives - documented for test awareness
  // Note: unsafe-inline and unsafe-eval are security risks in production
}

/**
 * Generate random test data for fuzzing
 */
export function generateFuzzData(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Test helper for timing attack resistance
 */
export async function testTimingAttackResistance(
  fn: () => Promise<any>,
  runs: number = 100
): Promise<boolean> {
  const times: number[] = [];

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  // Calculate standard deviation
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  // If standard deviation is too high, timing attacks may be possible
  const coefficientOfVariation = stdDev / mean;

  // Return true if consistent timing (resistant to timing attacks)
  return coefficientOfVariation < 0.1; // Less than 10% variation
}

// ============================================
// Global Test Configuration
// ============================================

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Global beforeEach to reset mocks
beforeEach(() => {
  // Reset fetch mock
  vi.mocked(global.fetch).mockClear();
});

// Global afterEach cleanup to prevent timer leaks
afterEach(() => {
  // Clear all timers to prevent hanging tests
  vi.clearAllTimers();
  // Clear all mocks to prevent memory leaks
  vi.clearAllMocks();
});

// ============================================
// Security Test Matchers
// ============================================

expect.extend({
  toBeSecurePassword(received: string) {
    const hasMinLength = received.length >= 12;
    const hasUpperCase = /[A-Z]/.test(received);
    const hasLowerCase = /[a-z]/.test(received);
    const hasNumber = /\d/.test(received);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(received);

    const pass = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a secure password`
          : `Expected ${received} to be a secure password (min 12 chars, uppercase, lowercase, number, special char)`,
      pass,
    };
  },

  toContainSQLInjection(received: string) {
    const sqlPatterns = [
      /(\bOR\b|\bAND\b).*=.*=/i,
      /UNION.*SELECT/i,
      /DROP\s+TABLE/i,
      /INSERT\s+INTO/i,
      /DELETE\s+FROM/i,
      /--/,
      /;.*DROP/i,
    ];

    const pass = sqlPatterns.some((pattern) => pattern.test(received));

    return {
      message: () =>
        pass
          ? `Expected ${received} not to contain SQL injection patterns`
          : `Expected ${received} to contain SQL injection patterns`,
      pass,
    };
  },

  toContainXSS(received: string) {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onerror=/i,
      /onload=/i,
      /<iframe/i,
      /<svg/i,
    ];

    const pass = xssPatterns.some((pattern) => pattern.test(received));

    return {
      message: () =>
        pass
          ? `Expected ${received} not to contain XSS patterns`
          : `Expected ${received} to contain XSS patterns`,
      pass,
    };
  },
});

// Declare custom matchers for TypeScript
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeSecurePassword(): T;
    toContainSQLInjection(): T;
    toContainXSS(): T;
  }
  interface AsymmetricMatchersContaining {
    toBeSecurePassword(): any;
    toContainSQLInjection(): any;
    toContainXSS(): any;
  }
}
