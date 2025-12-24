/**
 * Tests for authAwareFetch - Transport layer auth/error interceptor
 *
 * These tests verify:
 * 1. Auth failures (401s, token refresh 400s) trigger logout
 * 2. REST 400/406 errors are logged but DON'T trigger logout
 * 3. Non-Supabase calls pass through unchanged
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthAwareFetch, resetAuthFailureFlag } from '../authAwareFetch';
import { auditLogger } from '../../services/auditLogger';

// Mock the audit logger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    auth: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock window.location
const mockLocation = {
  pathname: '/dashboard',
  href: '/dashboard',
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock sessionStorage (matches localStorage mock structure for iteration)
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() { return Object.keys(store).length; },
  };
})();

Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

describe('authAwareFetch', () => {
  let originalFetch: typeof fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    resetAuthFailureFlag();
    localStorageMock.clear();
    sessionStorageMock.clear();
    mockLocation.pathname = '/dashboard';
    mockLocation.href = '/dashboard';

    // Save original fetch and create mock
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('non-Supabase calls', () => {
    it('should pass through non-Supabase calls unchanged', async () => {
      const mockResponse = new Response(JSON.stringify({ data: 'test' }), { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      const response = await authFetch('https://api.example.com/data');

      expect(response).toBe(mockResponse);
      expect(auditLogger.auth).not.toHaveBeenCalled();
      expect(auditLogger.security).not.toHaveBeenCalled();
    });
  });

  describe('auth token refresh failures (400 on /auth/v1/token)', () => {
    it('should trigger logout on "Invalid Refresh Token" error', async () => {
      const errorBody = { error_description: 'Invalid Refresh Token: Token has been revoked' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/auth/v1/token');

      expect(auditLogger.auth).toHaveBeenCalledWith('LOGOUT', true, expect.objectContaining({
        reason: expect.stringContaining('refresh_token_invalid'),
        source: 'authAwareFetch',
      }));
    });

    it('should trigger logout on "Refresh Token Not Found" error', async () => {
      const errorBody = { message: 'Refresh Token Not Found' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/auth/v1/token');

      expect(auditLogger.auth).toHaveBeenCalledWith('LOGOUT', true, expect.objectContaining({
        reason: expect.stringContaining('refresh_token_invalid'),
      }));
    });

    it('should trigger logout on "Token has expired" error', async () => {
      const errorBody = { error: 'Token has expired' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/auth/v1/token');

      expect(auditLogger.auth).toHaveBeenCalledWith('LOGOUT', true, expect.objectContaining({
        reason: expect.stringContaining('refresh_token_invalid'),
      }));
    });

    it('should NOT trigger logout on non-token-related 400 on auth endpoint', async () => {
      const errorBody = { message: 'Email already registered' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/auth/v1/token');

      // Should not trigger logout since error doesn't match token patterns
      expect(auditLogger.auth).not.toHaveBeenCalled();
    });
  });

  describe('401 on API calls', () => {
    it('should trigger logout on JWT-related 401 errors', async () => {
      const errorBody = { message: 'JWT expired' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');

      expect(auditLogger.auth).toHaveBeenCalledWith('LOGOUT', true, expect.objectContaining({
        reason: expect.stringContaining('jwt_invalid'),
      }));
    });

    it('should trigger logout on "invalid jwt" 401 errors', async () => {
      // Only strong JWT signals trigger logout (not generic "unauthorized")
      const errorBody = { error: 'invalid jwt: signature verification failed' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');

      expect(auditLogger.auth).toHaveBeenCalledWith('LOGOUT', true, expect.objectContaining({
        reason: expect.stringContaining('jwt_invalid'),
      }));
    });

    it('should NOT trigger logout on generic "Unauthorized" from edge functions', async () => {
      // Edge functions can return 401 for app-level authorization (not JWT issues)
      // These should NOT trigger global logout - they're handled by the calling feature
      const errorBody = { error: 'Unauthorized' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      resetAuthFailureFlag();
      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/verify-admin-pin');

      // Should log as security event, NOT trigger auth logout
      expect(auditLogger.security).toHaveBeenCalledWith('EDGE_FUNCTION_401', 'low', expect.objectContaining({
        note: '401 from /functions/v1/ is not treated as global auth failure',
      }));
      expect(auditLogger.auth).not.toHaveBeenCalled();
    });
  });

  describe('REST 400/406 errors (schema/payload issues)', () => {
    it('should log 400 errors on REST endpoints but NOT trigger logout', async () => {
      const errorBody = {
        message: 'invalid input syntax for type uuid: "not-a-uuid"',
        details: 'Could not parse UUID',
        hint: 'Check the user_id format',
        code: 'PGRST102',
      };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch(
        'https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles?on_conflict=user_id',
        { method: 'POST', body: JSON.stringify({ user_id: 'not-a-uuid', first_name: 'Test' }) }
      );

      // Should log via security (low severity) NOT auth
      expect(auditLogger.security).toHaveBeenCalledWith(
        'REST_PAYLOAD_ERROR',
        'low',
        expect.objectContaining({
          source: 'authAwareFetch',
          url: expect.stringContaining('/rest/v1/profiles'),
          method: 'POST',
          status: 400,
          message: errorBody.message,
          details: errorBody.details,
          hint: errorBody.hint,
          code: errorBody.code,
          payloadKeys: ['user_id', 'first_name'],
        })
      );

      // Should NOT trigger logout
      expect(auditLogger.auth).not.toHaveBeenCalledWith('LOGOUT', expect.anything(), expect.anything());
    });

    it('should log 406 errors on REST endpoints (single() issues)', async () => {
      const errorBody = {
        message: 'JSON object requested, multiple (or no) rows returned',
        code: 'PGRST116',
      };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 406 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/senior_health?user_id=eq.123');

      expect(auditLogger.security).toHaveBeenCalledWith(
        'REST_PAYLOAD_ERROR',
        'low',
        expect.objectContaining({
          status: 406,
          message: errorBody.message,
          code: errorBody.code,
        })
      );

      // Should NOT trigger logout
      expect(auditLogger.auth).not.toHaveBeenCalledWith('LOGOUT', expect.anything(), expect.anything());
    });

    it('should extract payload keys safely without PHI values', async () => {
      const errorBody = { message: 'column "invalid_col" does not exist' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const sensitivePayload = {
        user_id: 'uuid-123',
        first_name: 'John',  // PHI - name
        ssn: '123-45-6789',  // PHI - SSN
        medical_record: 'sensitive data',  // PHI
      };

      const authFetch = createAuthAwareFetch();
      await authFetch(
        'https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles',
        { method: 'POST', body: JSON.stringify(sensitivePayload) }
      );

      // Should only log keys, NOT values
      expect(auditLogger.security).toHaveBeenCalledWith(
        'REST_PAYLOAD_ERROR',
        'low',
        expect.objectContaining({
          payloadKeys: ['user_id', 'first_name', 'ssn', 'medical_record'],
          // Values should NOT be present in the log
        })
      );

      // Verify PHI values are not in the logged metadata
      const callArgs = vi.mocked(auditLogger.security).mock.calls[0];
      const metadata = callArgs[2];
      expect(JSON.stringify(metadata)).not.toContain('John');
      expect(JSON.stringify(metadata)).not.toContain('123-45-6789');
      expect(JSON.stringify(metadata)).not.toContain('sensitive data');
    });

    it('should handle array payloads (bulk upsert)', async () => {
      const errorBody = { message: 'duplicate key value' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 400 });
      mockFetch.mockResolvedValue(mockResponse);

      const arrayPayload = [
        { user_id: '1', first_name: 'Test1' },
        { user_id: '2', first_name: 'Test2' },
      ];

      const authFetch = createAuthAwareFetch();
      await authFetch(
        'https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles',
        { method: 'POST', body: JSON.stringify(arrayPayload) }
      );

      expect(auditLogger.security).toHaveBeenCalledWith(
        'REST_PAYLOAD_ERROR',
        'low',
        expect.objectContaining({
          payloadKeys: ['user_id', 'first_name'],
        })
      );
    });
  });

  describe('auth failure flag', () => {
    it('should only trigger logout once per session', async () => {
      const errorBody = { message: 'JWT expired' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();

      // First call should trigger logout
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');
      expect(auditLogger.auth).toHaveBeenCalledTimes(1);

      // Second call should NOT trigger logout again
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/another');
      expect(auditLogger.auth).toHaveBeenCalledTimes(1);
    });

    it('should reset flag properly', async () => {
      const errorBody = { message: 'JWT expired' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();

      // First call triggers logout
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');
      expect(auditLogger.auth).toHaveBeenCalledTimes(1);

      // Reset the flag (simulating new login)
      resetAuthFailureFlag();

      // Now it should trigger again
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');
      expect(auditLogger.auth).toHaveBeenCalledTimes(2);
    });
  });

  describe('network errors', () => {
    it('should rethrow network errors without processing', async () => {
      const networkError = new Error('ERR_ADDRESS_UNREACHABLE');
      mockFetch.mockRejectedValue(networkError);

      const authFetch = createAuthAwareFetch();

      await expect(
        authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles')
      ).rejects.toThrow('ERR_ADDRESS_UNREACHABLE');

      expect(auditLogger.auth).not.toHaveBeenCalled();
      expect(auditLogger.security).not.toHaveBeenCalled();
    });
  });

  describe('successful responses', () => {
    it('should pass through successful Supabase responses unchanged', async () => {
      const mockResponse = new Response(JSON.stringify({ id: '123', name: 'Test' }), { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      const response = await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');

      expect(response.status).toBe(200);
      expect(auditLogger.auth).not.toHaveBeenCalled();
      expect(auditLogger.security).not.toHaveBeenCalled();
    });

    it('should pass through 201 Created responses unchanged', async () => {
      const mockResponse = new Response(JSON.stringify({ id: '123' }), { status: 201 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      const response = await authFetch(
        'https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles',
        { method: 'POST', body: JSON.stringify({ name: 'Test' }) }
      );

      expect(response.status).toBe(201);
      expect(auditLogger.auth).not.toHaveBeenCalled();
      expect(auditLogger.security).not.toHaveBeenCalled();
    });
  });

  describe('redirect behavior', () => {
    it('should not redirect if already on login page', async () => {
      // Reset the auth failure flag first
      resetAuthFailureFlag();
      mockLocation.pathname = '/login';
      mockLocation.href = '/login';

      const errorBody = { message: 'JWT expired' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');

      // Should log but not redirect - href should remain /login
      expect(auditLogger.auth).toHaveBeenCalled();
      expect(mockLocation.href).toBe('/login'); // Should stay on login
    });

    it('should not redirect if on register page', async () => {
      // Reset the auth failure flag first
      resetAuthFailureFlag();
      mockLocation.pathname = '/register';
      mockLocation.href = '/register';

      const errorBody = { message: 'JWT expired' };
      const mockResponse = new Response(JSON.stringify(errorBody), { status: 401 });
      mockFetch.mockResolvedValue(mockResponse);

      const authFetch = createAuthAwareFetch();
      await authFetch('https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/profiles');

      expect(mockLocation.href).toBe('/register');
    });
  });
});
