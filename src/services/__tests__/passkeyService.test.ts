/**
 * Passkey Service Tests
 *
 * Tests for WebAuthn/Passkey biometric authentication:
 * - Browser support detection
 * - Platform authenticator availability
 * - Registration flow (start + complete)
 * - Authentication flow (start + complete)
 * - Passkey management (list, delete, check)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPasskeySupported,
  isPlatformAuthenticatorAvailable,
  startPasskeyRegistration,
  completePasskeyRegistration,
  startPasskeyAuthentication,
  completePasskeyAuthentication,
  getUserPasskeys,
  deletePasskey,
  hasPasskeys,
  registerPasskey,
  authenticateWithPasskey,
  type RegistrationOptions,
  type AuthenticationOptions,
  type PasskeyCredential,
} from '../passkeyService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockInvoke = vi.fn();
  const mockFrom = vi.fn();
  const mockSetSession = vi.fn();

  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
      from: mockFrom,
      auth: {
        setSession: mockSetSession,
      },
    },
  };
});

// Mock getErrorMessage - returns error name for WebAuthn errors, message for others
vi.mock('../../lib/getErrorMessage', () => ({
  getErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) {
      // WebAuthn errors use name (NotAllowedError, InvalidStateError, etc.)
      if (error.name && error.name !== 'Error') {
        return error.name;
      }
      return error.message;
    }
    return String(error);
  }),
}));

const mockSupabase = supabase as typeof supabase;
const mockInvoke = mockSupabase.functions.invoke as ReturnType<typeof vi.fn>;
const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
const mockSetSession = mockSupabase.auth.setSession as ReturnType<typeof vi.fn>;

// Store original globals
const originalWindow = global.window;
const originalNavigator = global.navigator;

// Helper to create mock WebAuthn credential
function createMockCredential(options?: {
  id?: string;
  authenticatorAttachment?: string | null;
  hasGetTransports?: boolean;
}): PublicKeyCredential {
  const rawId = new Uint8Array([1, 2, 3, 4, 5]);
  const clientDataJSON = new Uint8Array([10, 20, 30]);
  const attestationObject = new Uint8Array([40, 50, 60]);
  const authenticatorData = new Uint8Array([70, 80, 90]);
  const signature = new Uint8Array([100, 110, 120]);
  const userHandle = new Uint8Array([130, 140, 150]);

  const mockResponse = {
    clientDataJSON: clientDataJSON.buffer,
    attestationObject: attestationObject.buffer,
    authenticatorData: authenticatorData.buffer,
    signature: signature.buffer,
    userHandle: userHandle.buffer,
    getTransports: options?.hasGetTransports !== false ? vi.fn(() => ['internal']) : undefined,
  };

  return {
    id: options?.id || 'mock-credential-id',
    rawId: rawId.buffer,
    type: 'public-key',
    response: mockResponse,
    authenticatorAttachment: options?.authenticatorAttachment ?? 'platform',
    getClientExtensionResults: vi.fn(() => ({})),
  } as unknown as PublicKeyCredential;
}

// Helper to setup WebAuthn mocks
function setupWebAuthnMocks(options?: {
  supported?: boolean;
  platformAvailable?: boolean;
  createCredential?: PublicKeyCredential | null;
  getCredential?: PublicKeyCredential | null;
  createError?: Error;
  getError?: Error;
}) {
  const mockCreate = vi.fn();
  const mockGet = vi.fn();

  if (options?.createError) {
    mockCreate.mockRejectedValue(options.createError);
  } else {
    mockCreate.mockResolvedValue(options?.createCredential ?? createMockCredential());
  }

  if (options?.getError) {
    mockGet.mockRejectedValue(options.getError);
  } else {
    mockGet.mockResolvedValue(options?.getCredential ?? createMockCredential());
  }

  const mockPublicKeyCredential = {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(
      options?.platformAvailable ?? true
    ),
  };

  // Setup window and navigator mocks
  Object.defineProperty(global, 'window', {
    value: {
      PublicKeyCredential: options?.supported !== false ? mockPublicKeyCredential : undefined,
      location: {
        hostname: 'localhost',
      },
    },
    writable: true,
  });

  Object.defineProperty(global, 'navigator', {
    value: {
      credentials: options?.supported !== false ? {
        create: mockCreate,
        get: mockGet,
      } : undefined,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    writable: true,
  });

  // Also set PublicKeyCredential globally for the service to find
  (global as Record<string, unknown>).PublicKeyCredential = options?.supported !== false
    ? mockPublicKeyCredential
    : undefined;

  return { mockCreate, mockGet, mockPublicKeyCredential };
}

// Helper to create mock registration options
function createMockRegistrationOptions(): RegistrationOptions {
  return {
    challenge: 'dGVzdC1jaGFsbGVuZ2U', // base64url encoded "test-challenge"
    rp: {
      name: 'WellFit',
      id: 'localhost',
    },
    user: {
      id: 'dXNlci0xMjM', // base64url encoded "user-123"
      name: 'user@example.com',
      displayName: 'Test User',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    timeout: 60000,
    attestation: 'none',
  };
}

// Helper to create mock authentication options
function createMockAuthenticationOptions(): AuthenticationOptions {
  return {
    challenge: 'YXV0aC1jaGFsbGVuZ2U', // base64url encoded "auth-challenge"
    rpId: 'localhost',
    allowCredentials: [
      {
        type: 'public-key',
        id: 'Y3JlZC0xMjM', // base64url encoded "cred-123"
        transports: ['internal'],
      },
    ],
    timeout: 60000,
    userVerification: 'preferred',
  };
}

// Helper to create mock passkey credential
function createMockPasskeyCredential(): PasskeyCredential {
  return {
    id: 'pk-123',
    user_id: 'user-123',
    credential_id: 'cred-abc-123',
    device_name: 'Touch ID',
    authenticator_type: 'platform',
    transports: ['internal'],
    last_used_at: '2025-01-05T10:00:00Z',
    created_at: '2025-01-01T10:00:00Z',
  };
}

describe('passkeyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore globals
    Object.defineProperty(global, 'window', { value: originalWindow, writable: true });
    Object.defineProperty(global, 'navigator', { value: originalNavigator, writable: true });
    delete (global as Record<string, unknown>).PublicKeyCredential;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isPasskeySupported Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isPasskeySupported', () => {
    it('should return true when WebAuthn is fully supported', () => {
      setupWebAuthnMocks({ supported: true });

      expect(isPasskeySupported()).toBe(true);
    });

    it('should return false when PublicKeyCredential is not available', () => {
      setupWebAuthnMocks({ supported: false });

      expect(isPasskeySupported()).toBe(false);
    });

    it('should return false when navigator.credentials is not available', () => {
      Object.defineProperty(global, 'window', {
        value: { PublicKeyCredential: {} },
        writable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { credentials: undefined },
        writable: true,
      });

      expect(isPasskeySupported()).toBe(false);
    });

    it('should return false when credentials.create is not a function', () => {
      Object.defineProperty(global, 'window', {
        value: { PublicKeyCredential: {} },
        writable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: {
          credentials: {
            create: 'not a function',
            get: vi.fn(),
          },
        },
        writable: true,
      });

      expect(isPasskeySupported()).toBe(false);
    });

    it('should return false when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      expect(isPasskeySupported()).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isPlatformAuthenticatorAvailable Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isPlatformAuthenticatorAvailable', () => {
    it('should return true when platform authenticator is available', async () => {
      setupWebAuthnMocks({ supported: true, platformAvailable: true });

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(true);
    });

    it('should return false when platform authenticator is not available', async () => {
      setupWebAuthnMocks({ supported: true, platformAvailable: false });

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });

    it('should return false when WebAuthn is not supported', async () => {
      setupWebAuthnMocks({ supported: false });

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });

    it('should return false when check throws error', async () => {
      setupWebAuthnMocks({ supported: true });
      (global as Record<string, unknown>).PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(
          new Error('Check failed')
        ),
      };

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });

    it('should return false when isUserVerifyingPlatformAuthenticatorAvailable is not available', async () => {
      setupWebAuthnMocks({ supported: true });
      (global as Record<string, unknown>).PublicKeyCredential = {};

      const result = await isPlatformAuthenticatorAvailable();

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // startPasskeyRegistration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('startPasskeyRegistration', () => {
    it('should start registration and return options', async () => {
      const mockOptions = createMockRegistrationOptions();
      mockInvoke.mockResolvedValueOnce({
        data: mockOptions,
        error: null,
      });

      const result = await startPasskeyRegistration(
        'user-123',
        'user@example.com',
        'Test User',
        true
      );

      expect(result).toEqual(mockOptions);
      expect(mockInvoke).toHaveBeenCalledWith('passkey-register-start', {
        body: {
          user_id: 'user-123',
          user_name: 'user@example.com',
          display_name: 'Test User',
          prefer_platform: true,
        },
      });
    });

    it('should pass prefer_platform as false when specified', async () => {
      const mockOptions = createMockRegistrationOptions();
      mockInvoke.mockResolvedValueOnce({
        data: mockOptions,
        error: null,
      });

      await startPasskeyRegistration('user-123', 'user@example.com', 'Test User', false);

      expect(mockInvoke).toHaveBeenCalledWith('passkey-register-start', {
        body: {
          user_id: 'user-123',
          user_name: 'user@example.com',
          display_name: 'Test User',
          prefer_platform: false,
        },
      });
    });

    it('should throw error when edge function returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' },
      });

      await expect(
        startPasskeyRegistration('user-123', 'user@example.com', 'Test User')
      ).rejects.toThrow('User not found');
    });

    it('should throw default error when no message provided', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {},
      });

      await expect(
        startPasskeyRegistration('user-123', 'user@example.com', 'Test User')
      ).rejects.toThrow('Failed to start registration');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // completePasskeyRegistration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('completePasskeyRegistration', () => {
    it('should complete registration successfully', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockCredential = createMockPasskeyCredential();
      mockInvoke.mockResolvedValueOnce({
        data: mockCredential,
        error: null,
      });

      const options = createMockRegistrationOptions();
      const result = await completePasskeyRegistration(options, 'My MacBook');

      expect(result).toEqual(mockCredential);
      expect(mockInvoke).toHaveBeenCalledWith('passkey-register-finish', {
        body: expect.objectContaining({
          id: 'mock-credential-id',
          type: 'public-key',
          device_name: 'My MacBook',
        }),
      });
    });

    it('should use default device name when not provided', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockCredential = createMockPasskeyCredential();
      mockInvoke.mockResolvedValueOnce({
        data: mockCredential,
        error: null,
      });

      const options = createMockRegistrationOptions();
      await completePasskeyRegistration(options);

      expect(mockInvoke).toHaveBeenCalledWith('passkey-register-finish', {
        body: expect.objectContaining({
          device_name: 'Touch ID', // Mac user agent
        }),
      });
    });

    it('should throw error when passkeys not supported', async () => {
      setupWebAuthnMocks({ supported: false });

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow(
        'Passkeys are not supported in this browser'
      );
    });

    it('should throw error when credential creation returns null', async () => {
      const { mockCreate } = setupWebAuthnMocks({ supported: true });
      // Override to return null explicitly
      mockCreate.mockResolvedValue(null);

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow(
        'Failed to create credential'
      );
    });

    it('should handle NotAllowedError (user cancelled)', async () => {
      const error = new Error('User cancelled');
      error.name = 'NotAllowedError';
      setupWebAuthnMocks({ supported: true, createError: error });

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow(
        'Registration was cancelled or timed out'
      );
    });

    it('should handle InvalidStateError (already registered)', async () => {
      const error = new Error('Already registered');
      error.name = 'InvalidStateError';
      setupWebAuthnMocks({ supported: true, createError: error });

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow(
        'This device is already registered'
      );
    });

    it('should handle NotSupportedError', async () => {
      const error = new Error('Not supported');
      error.name = 'NotSupportedError';
      setupWebAuthnMocks({ supported: true, createError: error });

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow(
        'Passkeys are not supported on this device'
      );
    });

    it('should throw error when server save fails', async () => {
      setupWebAuthnMocks({ supported: true });
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow('Database error');
    });

    it('should handle credential without getTransports method', async () => {
      setupWebAuthnMocks({
        supported: true,
        createCredential: createMockCredential({ hasGetTransports: false }),
      });
      const mockCredential = createMockPasskeyCredential();
      mockInvoke.mockResolvedValueOnce({
        data: mockCredential,
        error: null,
      });

      const options = createMockRegistrationOptions();
      const result = await completePasskeyRegistration(options);

      expect(result).toEqual(mockCredential);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // startPasskeyAuthentication Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('startPasskeyAuthentication', () => {
    it('should start authentication and return options', async () => {
      const mockOptions = createMockAuthenticationOptions();
      mockInvoke.mockResolvedValueOnce({
        data: mockOptions,
        error: null,
      });

      const result = await startPasskeyAuthentication('user-123');

      expect(result).toEqual(mockOptions);
      expect(mockInvoke).toHaveBeenCalledWith('passkey-auth-start', {
        body: { user_id: 'user-123' },
      });
    });

    it('should work without userId (discoverable credentials)', async () => {
      const mockOptions = createMockAuthenticationOptions();
      mockInvoke.mockResolvedValueOnce({
        data: mockOptions,
        error: null,
      });

      const result = await startPasskeyAuthentication();

      expect(result).toEqual(mockOptions);
      expect(mockInvoke).toHaveBeenCalledWith('passkey-auth-start', {
        body: { user_id: undefined },
      });
    });

    it('should throw error when edge function returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'No passkeys found' },
      });

      await expect(startPasskeyAuthentication('user-123')).rejects.toThrow('No passkeys found');
    });

    it('should throw default error when no message provided', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: {},
      });

      await expect(startPasskeyAuthentication()).rejects.toThrow('Failed to start authentication');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // completePasskeyAuthentication Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('completePasskeyAuthentication', () => {
    it('should complete authentication successfully', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockSession = { access_token: 'token-123', refresh_token: 'refresh-123' };
      const mockUser = { id: 'user-123', email: 'user@example.com' };
      mockInvoke.mockResolvedValueOnce({
        data: { session: mockSession, user: mockUser },
        error: null,
      });
      mockSetSession.mockResolvedValueOnce({ error: null });

      const options = createMockAuthenticationOptions();
      const result = await completePasskeyAuthentication(options);

      expect(result.session).toEqual(mockSession);
      expect(result.user).toEqual(mockUser);
      expect(mockSetSession).toHaveBeenCalledWith(mockSession);
    });

    it('should throw error when passkeys not supported', async () => {
      setupWebAuthnMocks({ supported: false });

      const options = createMockAuthenticationOptions();
      await expect(completePasskeyAuthentication(options)).rejects.toThrow(
        'Passkeys are not supported in this browser'
      );
    });

    it('should throw error when credential get returns null', async () => {
      const { mockGet } = setupWebAuthnMocks({ supported: true });
      // Override to return null explicitly
      mockGet.mockResolvedValue(null);

      const options = createMockAuthenticationOptions();
      await expect(completePasskeyAuthentication(options)).rejects.toThrow('Failed to authenticate');
    });

    it('should handle NotAllowedError (user cancelled)', async () => {
      const error = new Error('User cancelled');
      error.name = 'NotAllowedError';
      setupWebAuthnMocks({ supported: true, getError: error });

      const options = createMockAuthenticationOptions();
      await expect(completePasskeyAuthentication(options)).rejects.toThrow(
        'Authentication was cancelled or timed out'
      );
    });

    it('should handle InvalidStateError (no passkey)', async () => {
      const error = new Error('No passkey');
      error.name = 'InvalidStateError';
      setupWebAuthnMocks({ supported: true, getError: error });

      const options = createMockAuthenticationOptions();
      await expect(completePasskeyAuthentication(options)).rejects.toThrow(
        'No passkey found for this account'
      );
    });

    it('should throw error when server verification fails', async () => {
      setupWebAuthnMocks({ supported: true });
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid signature' },
      });

      const options = createMockAuthenticationOptions();
      await expect(completePasskeyAuthentication(options)).rejects.toThrow('Invalid signature');
    });

    it('should not set session when no session returned', async () => {
      setupWebAuthnMocks({ supported: true });
      mockInvoke.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const options = createMockAuthenticationOptions();
      await completePasskeyAuthentication(options);

      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it('should handle allowCredentials with BufferSource id', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockSession = { access_token: 'token-123' };
      mockInvoke.mockResolvedValueOnce({
        data: { session: mockSession, user: { id: 'user-123' } },
        error: null,
      });
      mockSetSession.mockResolvedValueOnce({ error: null });

      const options: AuthenticationOptions = {
        challenge: 'YXV0aC1jaGFsbGVuZ2U',
        allowCredentials: [
          {
            type: 'public-key',
            id: new Uint8Array([1, 2, 3]).buffer, // BufferSource instead of string
            transports: ['internal'],
          },
        ],
      };

      const result = await completePasskeyAuthentication(options);

      expect(result.session).toEqual(mockSession);
    });

    it('should use default rpId when not provided', async () => {
      setupWebAuthnMocks({ supported: true });
      mockInvoke.mockResolvedValueOnce({
        data: { session: {}, user: {} },
        error: null,
      });
      mockSetSession.mockResolvedValueOnce({ error: null });

      const options: AuthenticationOptions = {
        challenge: 'YXV0aC1jaGFsbGVuZ2U',
        // No rpId - should use getRelyingPartyId()
      };

      await completePasskeyAuthentication(options);

      // Should have used localhost as rpId
      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getUserPasskeys Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getUserPasskeys', () => {
    it('should return list of passkeys', async () => {
      const mockPasskeys = [
        createMockPasskeyCredential(),
        { ...createMockPasskeyCredential(), id: 'pk-456', device_name: 'Windows Hello' },
      ];

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockPasskeys, error: null }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getUserPasskeys();

      expect(result).toEqual(mockPasskeys);
      expect(mockFrom).toHaveBeenCalledWith('passkey_credentials');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    it('should return empty array when no passkeys', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await getUserPasskeys();

      expect(result).toEqual([]);
    });

    it('should throw error when query fails', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'PGRST116' },
        }),
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(getUserPasskeys()).rejects.toEqual({
        message: 'Database error',
        code: 'PGRST116',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deletePasskey Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deletePasskey', () => {
    beforeEach(() => {
      setupWebAuthnMocks({ supported: true });
    });

    it('should delete passkey and log action', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'passkey_credentials') {
          return { delete: mockDelete };
        }
        if (table === 'passkey_audit_log') {
          return { insert: mockInsert };
        }
        return {};
      });

      await deletePasskey('cred-abc-123');

      expect(mockFrom).toHaveBeenCalledWith('passkey_credentials');
      expect(mockFrom).toHaveBeenCalledWith('passkey_audit_log');
      expect(mockInsert).toHaveBeenCalledWith({
        credential_id: 'cred-abc-123',
        action: 'delete',
        success: true,
        ip_address: null,
        user_agent: expect.any(String),
      });
    });

    it('should throw error when delete fails', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      });

      mockFrom.mockReturnValue({ delete: mockDelete });

      await expect(deletePasskey('cred-abc-123')).rejects.toEqual({
        message: 'Delete failed',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hasPasskeys Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('hasPasskeys', () => {
    it('should return true when user has passkeys', async () => {
      // Create a chainable mock query object
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (value: { count: number; error: null }) => void) =>
          resolve({ count: 2, error: null })
        ),
      };
      // Make it thenable (Promise-like)
      Object.assign(mockQuery, {
        [Symbol.toStringTag]: 'Promise',
        catch: vi.fn().mockReturnThis(),
        finally: vi.fn().mockReturnThis(),
      });
      // Override eq to return a resolved promise
      mockQuery.eq.mockResolvedValue({ count: 2, error: null });

      const mockSelect = vi.fn().mockReturnValue(mockQuery);
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasPasskeys('user-123');

      expect(result).toBe(true);
      expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    });

    it('should return false when user has no passkeys', async () => {
      const mockQuery = {
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      };
      const mockSelect = vi.fn().mockReturnValue(mockQuery);
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasPasskeys('user-123');

      expect(result).toBe(false);
    });

    it('should return false when query fails', async () => {
      const mockQuery = {
        eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'Error' } }),
      };
      const mockSelect = vi.fn().mockReturnValue(mockQuery);
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasPasskeys('user-123');

      expect(result).toBe(false);
    });

    it('should check all passkeys when no userId provided', async () => {
      // When no userId, the query is awaited directly without calling eq
      const mockSelect = vi.fn().mockResolvedValue({ count: 5, error: null });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasPasskeys();

      expect(result).toBe(true);
    });

    it('should handle null count', async () => {
      const mockQuery = {
        eq: vi.fn().mockResolvedValue({ count: null, error: null }),
      };
      const mockSelect = vi.fn().mockReturnValue(mockQuery);
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await hasPasskeys('user-123');

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // registerPasskey (Convenience Wrapper) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('registerPasskey', () => {
    it('should complete full registration flow', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockOptions = createMockRegistrationOptions();
      const mockCredential = createMockPasskeyCredential();

      // Mock startPasskeyRegistration
      mockInvoke.mockResolvedValueOnce({
        data: mockOptions,
        error: null,
      });

      // Mock completePasskeyRegistration
      mockInvoke.mockResolvedValueOnce({
        data: mockCredential,
        error: null,
      });

      const result = await registerPasskey(
        'user-123',
        'user@example.com',
        'Test User',
        'My Device',
        true
      );

      expect(result).toEqual(mockCredential);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should use default preferPlatform value', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockOptions = createMockRegistrationOptions();
      const mockCredential = createMockPasskeyCredential();

      mockInvoke
        .mockResolvedValueOnce({ data: mockOptions, error: null })
        .mockResolvedValueOnce({ data: mockCredential, error: null });

      await registerPasskey('user-123', 'user@example.com', 'Test User');

      expect(mockInvoke).toHaveBeenCalledWith('passkey-register-start', {
        body: expect.objectContaining({
          prefer_platform: true,
        }),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // authenticateWithPasskey (Convenience Wrapper) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('authenticateWithPasskey', () => {
    it('should complete full authentication flow', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockOptions = createMockAuthenticationOptions();
      const mockSession = { access_token: 'token-123' };
      const mockUser = { id: 'user-123' };

      // Mock startPasskeyAuthentication
      mockInvoke.mockResolvedValueOnce({
        data: mockOptions,
        error: null,
      });

      // Mock completePasskeyAuthentication
      mockInvoke.mockResolvedValueOnce({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      mockSetSession.mockResolvedValueOnce({ error: null });

      const result = await authenticateWithPasskey('user-123');

      expect(result.session).toEqual(mockSession);
      expect(result.user).toEqual(mockUser);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should work without userId for discoverable credentials', async () => {
      setupWebAuthnMocks({ supported: true });
      const mockOptions = createMockAuthenticationOptions();

      mockInvoke
        .mockResolvedValueOnce({ data: mockOptions, error: null })
        .mockResolvedValueOnce({
          data: { session: {}, user: {} },
          error: null,
        });
      mockSetSession.mockResolvedValueOnce({ error: null });

      await authenticateWithPasskey();

      expect(mockInvoke).toHaveBeenCalledWith('passkey-auth-start', {
        body: { user_id: undefined },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete registration and authentication flow', async () => {
      setupWebAuthnMocks({ supported: true, platformAvailable: true });

      // Check support
      expect(isPasskeySupported()).toBe(true);
      expect(await isPlatformAuthenticatorAvailable()).toBe(true);

      // Registration
      const regOptions = createMockRegistrationOptions();
      const mockCredential = createMockPasskeyCredential();

      mockInvoke
        .mockResolvedValueOnce({ data: regOptions, error: null })
        .mockResolvedValueOnce({ data: mockCredential, error: null });

      const credential = await registerPasskey('user-123', 'user@example.com', 'Test User');
      expect(credential.credential_id).toBe('cred-abc-123');

      // Authentication
      const authOptions = createMockAuthenticationOptions();
      const mockSession = { access_token: 'token' };
      const mockUser = { id: 'user-123' };

      mockInvoke
        .mockResolvedValueOnce({ data: authOptions, error: null })
        .mockResolvedValueOnce({ data: { session: mockSession, user: mockUser }, error: null });
      mockSetSession.mockResolvedValueOnce({ error: null });

      const authResult = await authenticateWithPasskey('user-123');
      expect(authResult.user.id).toBe('user-123');
    });

    it('should handle browser without passkey support gracefully', async () => {
      setupWebAuthnMocks({ supported: false });

      expect(isPasskeySupported()).toBe(false);
      expect(await isPlatformAuthenticatorAvailable()).toBe(false);

      const options = createMockRegistrationOptions();
      await expect(completePasskeyRegistration(options)).rejects.toThrow(
        'Passkeys are not supported in this browser'
      );
    });
  });
});
