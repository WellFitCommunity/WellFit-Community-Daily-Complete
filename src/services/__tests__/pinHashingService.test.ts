/**
 * PIN Hashing Service Tests
 *
 * Tests for HIPAA § 164.312(a)(2)(iv) compliant PIN hashing:
 * - Client-side SHA-256 pre-hashing for secure transmission
 * - PIN format validation
 * - Tenant code parsing
 * - Edge function integration for storage hashing
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hashPinForTransmission,
  prepareAdminPinForVerification,
  hashPinForStorage,
  isClientHashedPin,
  hashPasswordForTransmission,
} from '../pinHashingService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockInvoke = vi.fn();

  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

const mockSupabase = supabase as typeof supabase;
const mockInvoke = mockSupabase.functions.invoke as ReturnType<typeof vi.fn>;

// Mock Web Crypto API
const mockDigest = vi.fn();
const originalCrypto = global.crypto;

beforeEach(() => {
  vi.clearAllMocks();

  // Setup Web Crypto mock
  // Create a predictable hash result for testing
  const mockHashBuffer = new ArrayBuffer(32); // SHA-256 produces 32 bytes
  const mockHashArray = new Uint8Array(mockHashBuffer);
  // Fill with predictable values (0-31)
  for (let i = 0; i < 32; i++) {
    mockHashArray[i] = i;
  }

  mockDigest.mockResolvedValue(mockHashBuffer);

  // Mock crypto.subtle
  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        digest: mockDigest,
      },
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  // Restore original crypto
  Object.defineProperty(global, 'crypto', {
    value: originalCrypto,
    writable: true,
    configurable: true,
  });
});

// Expected hash output for the mock (bytes 0-31 as hex)
const EXPECTED_MOCK_HASH = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const EXPECTED_PREFIXED_HASH = `sha256:${EXPECTED_MOCK_HASH}`;

describe('pinHashingService', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // hashPinForTransmission Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('hashPinForTransmission', () => {
    it('should hash a valid 4-digit PIN', async () => {
      const result = await hashPinForTransmission('1234');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
      expect(mockDigest).toHaveBeenCalled();
      expect(mockDigest.mock.calls[0][0]).toBe('SHA-256');
    });

    it('should hash a valid 6-digit PIN', async () => {
      const result = await hashPinForTransmission('123456');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
      expect(mockDigest).toHaveBeenCalled();
    });

    it('should hash a valid 8-digit PIN', async () => {
      const result = await hashPinForTransmission('12345678');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
      expect(mockDigest).toHaveBeenCalled();
    });

    it('should include domain separator in hash input', async () => {
      await hashPinForTransmission('1234');

      // Verify the input to digest includes domain separator
      const callArg = mockDigest.mock.calls[0][1] as Uint8Array;
      const decoder = new TextDecoder();
      const inputString = decoder.decode(callArg);

      expect(inputString).toBe('wellfit-admin-pin-v1:1234');
    });

    it('should reject PIN with less than 4 digits', async () => {
      await expect(hashPinForTransmission('123')).rejects.toThrow('PIN must be 4-8 digits');
    });

    it('should reject PIN with more than 8 digits', async () => {
      await expect(hashPinForTransmission('123456789')).rejects.toThrow('PIN must be 4-8 digits');
    });

    it('should reject PIN with non-numeric characters', async () => {
      await expect(hashPinForTransmission('12ab')).rejects.toThrow('PIN must be 4-8 digits');
    });

    it('should reject PIN with letters', async () => {
      await expect(hashPinForTransmission('abcd')).rejects.toThrow('PIN must be 4-8 digits');
    });

    it('should reject PIN with special characters', async () => {
      await expect(hashPinForTransmission('12-34')).rejects.toThrow('PIN must be 4-8 digits');
    });

    it('should reject empty PIN', async () => {
      await expect(hashPinForTransmission('')).rejects.toThrow('PIN must be 4-8 digits');
    });

    it('should produce consistent hash for same input', async () => {
      const result1 = await hashPinForTransmission('1234');
      const result2 = await hashPinForTransmission('1234');

      expect(result1).toBe(result2);
    });

    it('should return hash with sha256: prefix', async () => {
      const result = await hashPinForTransmission('1234');

      expect(result.startsWith('sha256:')).toBe(true);
    });

    it('should return 71 character hash string', async () => {
      const result = await hashPinForTransmission('1234');

      // 'sha256:' (7 chars) + 64 hex chars = 71
      expect(result.length).toBe(71);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // prepareAdminPinForVerification Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('prepareAdminPinForVerification', () => {
    describe('Simple PIN format', () => {
      it('should hash a simple 4-digit PIN', async () => {
        const result = await prepareAdminPinForVerification('1234');

        expect(result.hashedPin).toBe(EXPECTED_PREFIXED_HASH);
        expect(result.tenantCode).toBeNull();
        expect(result.format).toBe('pin_only');
      });

      it('should hash a simple 6-digit PIN', async () => {
        const result = await prepareAdminPinForVerification('123456');

        expect(result.hashedPin).toBe(EXPECTED_PREFIXED_HASH);
        expect(result.tenantCode).toBeNull();
        expect(result.format).toBe('pin_only');
      });

      it('should hash a simple 8-digit PIN', async () => {
        const result = await prepareAdminPinForVerification('12345678');

        expect(result.hashedPin).toBe(EXPECTED_PREFIXED_HASH);
        expect(result.tenantCode).toBeNull();
        expect(result.format).toBe('pin_only');
      });

      it('should reject invalid simple PIN format', async () => {
        await expect(prepareAdminPinForVerification('123')).rejects.toThrow(
          'PIN must be 4-8 digits or TENANTCODE-PIN format'
        );
      });

      it('should reject PIN with letters in simple format', async () => {
        await expect(prepareAdminPinForVerification('abcd')).rejects.toThrow(
          'PIN must be 4-8 digits or TENANTCODE-PIN format'
        );
      });
    });

    describe('TenantCode-PIN format', () => {
      it('should parse MH-6702-1234 format correctly', async () => {
        const result = await prepareAdminPinForVerification('MH-6702-1234');

        expect(result.hashedPin).toBe(EXPECTED_PREFIXED_HASH);
        expect(result.tenantCode).toBe('MH-6702');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should parse WF-0001-5678 format correctly', async () => {
        const result = await prepareAdminPinForVerification('WF-0001-5678');

        expect(result.tenantCode).toBe('WF-0001');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should parse single letter tenant prefix', async () => {
        const result = await prepareAdminPinForVerification('A-1234-5678');

        expect(result.tenantCode).toBe('A-1234');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should parse 4-letter tenant prefix', async () => {
        const result = await prepareAdminPinForVerification('ABCD-1234-5678');

        expect(result.tenantCode).toBe('ABCD-1234');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should parse 6-digit tenant number', async () => {
        const result = await prepareAdminPinForVerification('MH-123456-1234');

        expect(result.tenantCode).toBe('MH-123456');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should parse 8-digit PIN in tenant format', async () => {
        const result = await prepareAdminPinForVerification('MH-6702-12345678');

        expect(result.hashedPin).toBe(EXPECTED_PREFIXED_HASH);
        expect(result.tenantCode).toBe('MH-6702');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should hash only the PIN portion, not tenant code', async () => {
        await prepareAdminPinForVerification('MH-6702-9999');

        // Verify the hash input is just the PIN with domain separator
        const callArg = mockDigest.mock.calls[0][1] as Uint8Array;
        const decoder = new TextDecoder();
        const inputString = decoder.decode(callArg);

        expect(inputString).toBe('wellfit-admin-pin-v1:9999');
      });
    });

    describe('Edge cases', () => {
      it('should handle minimum valid tenant code format', async () => {
        const result = await prepareAdminPinForVerification('A-1234-1234');

        expect(result.tenantCode).toBe('A-1234');
        expect(result.format).toBe('tenant_code_pin');
      });

      it('should handle maximum valid format', async () => {
        const result = await prepareAdminPinForVerification('ABCD-123456-12345678');

        expect(result.tenantCode).toBe('ABCD-123456');
        expect(result.hashedPin).toBe(EXPECTED_PREFIXED_HASH);
      });

      it('should reject lowercase tenant prefix', async () => {
        // Lowercase letters don't match the pattern
        await expect(prepareAdminPinForVerification('mh-6702-1234')).rejects.toThrow(
          'PIN must be 4-8 digits or TENANTCODE-PIN format'
        );
      });

      it('should reject more than 4 letters in prefix', async () => {
        await expect(prepareAdminPinForVerification('ABCDE-1234-5678')).rejects.toThrow(
          'PIN must be 4-8 digits or TENANTCODE-PIN format'
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hashPinForStorage Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('hashPinForStorage', () => {
    it('should hash locally then call edge function', async () => {
      mockInvoke.mockResolvedValue({
        data: { hashed: 'pbkdf2:final-storage-hash' },
        error: null,
      });

      const result = await hashPinForStorage('1234');

      expect(result).toBe('pbkdf2:final-storage-hash');
      expect(mockDigest).toHaveBeenCalled(); // Local hash was called
      expect(mockInvoke).toHaveBeenCalledWith('hash-pin', {
        body: { pin: EXPECTED_PREFIXED_HASH },
      });
    });

    it('should send client-hashed PIN to edge function', async () => {
      mockInvoke.mockResolvedValue({
        data: { hashed: 'pbkdf2:stored' },
        error: null,
      });

      await hashPinForStorage('5678');

      // Verify the edge function receives the sha256-prefixed hash
      expect(mockInvoke).toHaveBeenCalledWith('hash-pin', {
        body: { pin: expect.stringMatching(/^sha256:/) },
      });
    });

    it('should throw error when edge function fails', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge function timeout' },
      });

      await expect(hashPinForStorage('1234')).rejects.toThrow(
        'Failed to hash PIN: Edge function timeout'
      );
    });

    it('should throw error when edge function returns network error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      await expect(hashPinForStorage('1234')).rejects.toThrow('Failed to hash PIN: Network error');
    });

    it('should validate PIN before sending to edge function', async () => {
      // Invalid PIN should fail before reaching edge function
      await expect(hashPinForStorage('123')).rejects.toThrow('PIN must be 4-8 digits');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should return the hashed value from edge function response', async () => {
      const expectedHash = 'pbkdf2:100000:salt:derivedKey';
      mockInvoke.mockResolvedValue({
        data: { hashed: expectedHash },
        error: null,
      });

      const result = await hashPinForStorage('9999');

      expect(result).toBe(expectedHash);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isClientHashedPin Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isClientHashedPin', () => {
    it('should return true for valid client-hashed PIN', () => {
      const validHash = `sha256:${EXPECTED_MOCK_HASH}`;

      expect(isClientHashedPin(validHash)).toBe(true);
    });

    it('should return true for any 71-char sha256-prefixed string', () => {
      const validHash = 'sha256:' + 'a'.repeat(64);

      expect(isClientHashedPin(validHash)).toBe(true);
    });

    it('should return false for plain PIN', () => {
      expect(isClientHashedPin('1234')).toBe(false);
    });

    it('should return false for sha256 prefix without full hash', () => {
      expect(isClientHashedPin('sha256:abc')).toBe(false);
    });

    it('should return false for hash without prefix', () => {
      expect(isClientHashedPin(EXPECTED_MOCK_HASH)).toBe(false);
    });

    it('should return false for wrong prefix', () => {
      expect(isClientHashedPin('md5:' + 'a'.repeat(64))).toBe(false);
    });

    it('should return false for too long hash', () => {
      expect(isClientHashedPin('sha256:' + 'a'.repeat(65))).toBe(false);
    });

    it('should return false for too short hash', () => {
      expect(isClientHashedPin('sha256:' + 'a'.repeat(63))).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isClientHashedPin('')).toBe(false);
    });

    it('should return false for PBKDF2 storage hash', () => {
      expect(isClientHashedPin('pbkdf2:100000:salt:key')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hashPasswordForTransmission Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('hashPasswordForTransmission', () => {
    it('should hash a valid 8-character password', async () => {
      const result = await hashPasswordForTransmission('password');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
      expect(mockDigest).toHaveBeenCalled();
      expect(mockDigest.mock.calls[0][0]).toBe('SHA-256');
    });

    it('should hash a long password', async () => {
      const result = await hashPasswordForTransmission('MySecureP@ssword123!');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
    });

    it('should accept passwords with special characters', async () => {
      const result = await hashPasswordForTransmission('P@ss!#$%');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
    });

    it('should accept passwords with numbers', async () => {
      const result = await hashPasswordForTransmission('12345678');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
    });

    it('should accept passwords with mixed case', async () => {
      const result = await hashPasswordForTransmission('PassWord');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
    });

    it('should use same domain separator as PIN for backward compatibility', async () => {
      await hashPasswordForTransmission('testpass');

      const callArg = mockDigest.mock.calls[0][1] as Uint8Array;
      const decoder = new TextDecoder();
      const inputString = decoder.decode(callArg);

      expect(inputString).toBe('wellfit-admin-pin-v1:testpass');
    });

    it('should reject password shorter than 8 characters', async () => {
      await expect(hashPasswordForTransmission('short')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should reject 7-character password', async () => {
      await expect(hashPasswordForTransmission('1234567')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should reject empty password', async () => {
      await expect(hashPasswordForTransmission('')).rejects.toThrow(
        'Password must be at least 8 characters'
      );
    });

    it('should return hash with sha256: prefix', async () => {
      const result = await hashPasswordForTransmission('mypassword');

      expect(result.startsWith('sha256:')).toBe(true);
    });

    it('should return 71 character hash string', async () => {
      const result = await hashPasswordForTransmission('mypassword');

      expect(result.length).toBe(71);
    });

    it('should produce consistent hash for same password', async () => {
      const result1 = await hashPasswordForTransmission('samepassword');
      const result2 = await hashPasswordForTransmission('samepassword');

      expect(result1).toBe(result2);
    });

    it('should accept exactly 8 characters (minimum)', async () => {
      const result = await hashPasswordForTransmission('exactly8');

      expect(result).toBe(EXPECTED_PREFIXED_HASH);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete admin PIN setup flow', async () => {
      // Step 1: Parse and hash the PIN
      const prepared = await prepareAdminPinForVerification('MH-0001-1234');

      expect(prepared.format).toBe('tenant_code_pin');
      expect(prepared.tenantCode).toBe('MH-0001');
      expect(isClientHashedPin(prepared.hashedPin)).toBe(true);
    });

    it('should handle PIN storage workflow', async () => {
      mockInvoke.mockResolvedValue({
        data: { hashed: 'pbkdf2:stored-hash' },
        error: null,
      });

      // User creates new PIN
      const storageHash = await hashPinForStorage('5678');

      // Verify the workflow
      expect(mockDigest).toHaveBeenCalled(); // Client hash happened
      expect(mockInvoke).toHaveBeenCalledWith('hash-pin', {
        body: { pin: EXPECTED_PREFIXED_HASH },
      }); // Edge function called
      expect(storageHash).toBe('pbkdf2:stored-hash'); // Storage hash returned
    });

    it('should distinguish between hashed and unhashed values', async () => {
      const plainPin = '1234';
      const hashedPin = await hashPinForTransmission('1234');

      expect(isClientHashedPin(plainPin)).toBe(false);
      expect(isClientHashedPin(hashedPin)).toBe(true);
    });

    it('should handle password vs PIN differently', async () => {
      // PIN: 4-8 digits only
      await expect(hashPinForTransmission('password')).rejects.toThrow();

      // Password: 8+ any characters
      const passwordHash = await hashPasswordForTransmission('password');
      expect(isClientHashedPin(passwordHash)).toBe(true);
    });

    it('should produce same format for PIN and password hashes', async () => {
      const pinHash = await hashPinForTransmission('12345678');
      const passwordHash = await hashPasswordForTransmission('12345678');

      // Both should be valid client hashes
      expect(isClientHashedPin(pinHash)).toBe(true);
      expect(isClientHashedPin(passwordHash)).toBe(true);

      // Same format
      expect(pinHash.length).toBe(passwordHash.length);
      expect(pinHash.startsWith('sha256:')).toBe(true);
      expect(passwordHash.startsWith('sha256:')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Security Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Security Considerations', () => {
    it('should use SHA-256 algorithm', async () => {
      await hashPinForTransmission('1234');

      expect(mockDigest).toHaveBeenCalled();
      expect(mockDigest.mock.calls[0][0]).toBe('SHA-256');
    });

    it('should include domain separator to prevent cross-context attacks', async () => {
      await hashPinForTransmission('1234');

      const callArg = mockDigest.mock.calls[0][1] as Uint8Array;
      const decoder = new TextDecoder();
      const inputString = decoder.decode(callArg);

      expect(inputString).toContain('wellfit-admin-pin-v1:');
    });

    it('should not expose plain PIN in hash output', async () => {
      const result = await hashPinForTransmission('1234');

      expect(result).not.toContain('1234');
    });

    it('should not expose plain password in hash output', async () => {
      const result = await hashPasswordForTransmission('mypassword');

      expect(result).not.toContain('mypassword');
    });

    it('should validate input before hashing to prevent injection', async () => {
      // These should all be rejected before hashing
      const maliciousInputs = [
        'DROP TABLE users;',
        '<script>alert(1)</script>',
        '../../../etc/passwd',
        '${process.env.SECRET}',
      ];

      for (const input of maliciousInputs) {
        await expect(hashPinForTransmission(input)).rejects.toThrow();
      }
    });
  });
});
