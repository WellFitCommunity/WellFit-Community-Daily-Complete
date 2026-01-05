/**
 * Login Security Service Tests
 *
 * Tests for SOC2 CC6.1 compliant login security:
 * - Account lockout checking (fail-open behavior)
 * - Login attempt recording (success/failure)
 * - Lockout message formatting
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAccountLocked,
  recordLoginAttempt,
  formatLockoutMessage,
  type LoginAttemptData,
  type AccountLockoutInfo,
} from '../loginSecurityService';
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

describe('loginSecurityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isAccountLocked Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isAccountLocked', () => {
    it('should return locked status when account is locked', async () => {
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      mockInvoke.mockResolvedValueOnce({
        data: {
          isLocked: true,
          lockedUntil,
          failedAttempts: 5,
          minutesRemaining: 14,
        },
        error: null,
      });

      const result = await isAccountLocked('user@example.com');

      expect(result.isLocked).toBe(true);
      expect(result.lockedUntil).toBe(lockedUntil);
      expect(result.failedAttempts).toBe(5);
      expect(result.minutesRemaining).toBe(14);
      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'check_lock',
          identifier: 'user@example.com',
        },
      });
    });

    it('should return not locked when account is not locked', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          isLocked: false,
          failedAttempts: 2,
        },
        error: null,
      });

      const result = await isAccountLocked('user@example.com');

      expect(result.isLocked).toBe(false);
      expect(result.failedAttempts).toBe(2);
      expect(result.lockedUntil).toBeUndefined();
      expect(result.minutesRemaining).toBeUndefined();
    });

    it('should fail open when edge function returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge function error' },
      });

      const result = await isAccountLocked('user@example.com');

      // Fail open - don't block login if check fails
      expect(result.isLocked).toBe(false);
    });

    it('should fail open when edge function throws exception', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      const result = await isAccountLocked('user@example.com');

      // Fail open - don't block login if check fails
      expect(result.isLocked).toBe(false);
    });

    it('should handle null data fields gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          isLocked: null,
          lockedUntil: null,
          failedAttempts: null,
          minutesRemaining: null,
        },
        error: null,
      });

      const result = await isAccountLocked('user@example.com');

      // Uses nullish coalescing - null becomes false
      expect(result.isLocked).toBe(false);
    });

    it('should handle undefined data gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: undefined,
        error: null,
      });

      const result = await isAccountLocked('user@example.com');

      expect(result.isLocked).toBe(false);
    });

    it('should work with phone number identifier', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          isLocked: true,
          minutesRemaining: 10,
        },
        error: null,
      });

      const result = await isAccountLocked('+15551234567');

      expect(result.isLocked).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'check_lock',
          identifier: '+15551234567',
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordLoginAttempt Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('recordLoginAttempt', () => {
    it('should record successful password login attempt', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const attempt: LoginAttemptData = {
        identifier: 'user@example.com',
        attemptType: 'password',
        success: true,
        userId: 'user-uuid-123',
      };

      await recordLoginAttempt(attempt);

      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'record_attempt',
          identifier: 'user@example.com',
          attemptType: 'password',
          success: true,
          userId: 'user-uuid-123',
          errorMessage: null,
          metadata: {},
        },
      });
    });

    it('should record failed password login attempt with error message', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const attempt: LoginAttemptData = {
        identifier: 'user@example.com',
        attemptType: 'password',
        success: false,
        errorMessage: 'Invalid password',
      };

      await recordLoginAttempt(attempt);

      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'record_attempt',
          identifier: 'user@example.com',
          attemptType: 'password',
          success: false,
          userId: null,
          errorMessage: 'Invalid password',
          metadata: {},
        },
      });
    });

    it('should record PIN login attempt', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const attempt: LoginAttemptData = {
        identifier: 'admin@hospital.com',
        attemptType: 'pin',
        success: true,
        userId: 'admin-uuid-456',
        metadata: { role: 'nurse' },
      };

      await recordLoginAttempt(attempt);

      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'record_attempt',
          identifier: 'admin@hospital.com',
          attemptType: 'pin',
          success: true,
          userId: 'admin-uuid-456',
          errorMessage: null,
          metadata: { role: 'nurse' },
        },
      });
    });

    it('should record MFA login attempt', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const attempt: LoginAttemptData = {
        identifier: 'user@example.com',
        attemptType: 'mfa',
        success: false,
        errorMessage: 'Invalid TOTP code',
        metadata: { mfaType: 'totp' },
      };

      await recordLoginAttempt(attempt);

      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'record_attempt',
          identifier: 'user@example.com',
          attemptType: 'mfa',
          success: false,
          userId: null,
          errorMessage: 'Invalid TOTP code',
          metadata: { mfaType: 'totp' },
        },
      });
    });

    it('should handle missing optional fields', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const attempt: LoginAttemptData = {
        identifier: 'user@example.com',
        attemptType: 'password',
        success: true,
        // No userId, errorMessage, or metadata
      };

      await recordLoginAttempt(attempt);

      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'record_attempt',
          identifier: 'user@example.com',
          attemptType: 'password',
          success: true,
          userId: null,
          errorMessage: null,
          metadata: {},
        },
      });
    });

    it('should not throw when edge function returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge function error' },
      });

      const attempt: LoginAttemptData = {
        identifier: 'user@example.com',
        attemptType: 'password',
        success: true,
      };

      // Should not throw - login flow should continue
      await expect(recordLoginAttempt(attempt)).resolves.toBeUndefined();
    });

    it('should not throw when edge function throws exception', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      const attempt: LoginAttemptData = {
        identifier: 'user@example.com',
        attemptType: 'password',
        success: true,
      };

      // Should not throw - login flow should continue
      await expect(recordLoginAttempt(attempt)).resolves.toBeUndefined();
    });

    it('should handle phone number identifier', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const attempt: LoginAttemptData = {
        identifier: '+15551234567',
        attemptType: 'password',
        success: true,
        userId: 'phone-user-789',
      };

      await recordLoginAttempt(attempt);

      expect(mockInvoke).toHaveBeenCalledWith('login-security', {
        body: {
          action: 'record_attempt',
          identifier: '+15551234567',
          attemptType: 'password',
          success: true,
          userId: 'phone-user-789',
          errorMessage: null,
          metadata: {},
        },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // formatLockoutMessage Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('formatLockoutMessage', () => {
    it('should return empty string when not locked', () => {
      const lockoutInfo: AccountLockoutInfo = {
        isLocked: false,
      };

      const message = formatLockoutMessage(lockoutInfo);

      expect(message).toBe('');
    });

    it('should return formatted message with default 15 minutes', () => {
      const lockoutInfo: AccountLockoutInfo = {
        isLocked: true,
        // No minutesRemaining - should default to 15
      };

      const message = formatLockoutMessage(lockoutInfo);

      expect(message).toBe(
        'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes.'
      );
    });

    it('should return singular "minute" for 1 minute remaining', () => {
      const lockoutInfo: AccountLockoutInfo = {
        isLocked: true,
        minutesRemaining: 1,
      };

      const message = formatLockoutMessage(lockoutInfo);

      expect(message).toBe(
        'Account temporarily locked due to multiple failed login attempts. Please try again in 1 minute.'
      );
      expect(message).not.toContain('minutes');
    });

    it('should return plural "minutes" for multiple minutes remaining', () => {
      const lockoutInfo: AccountLockoutInfo = {
        isLocked: true,
        minutesRemaining: 10,
      };

      const message = formatLockoutMessage(lockoutInfo);

      expect(message).toBe(
        'Account temporarily locked due to multiple failed login attempts. Please try again in 10 minutes.'
      );
    });

    it('should handle 0 minutes remaining (defaults to 15)', () => {
      const lockoutInfo: AccountLockoutInfo = {
        isLocked: true,
        minutesRemaining: 0,
      };

      const message = formatLockoutMessage(lockoutInfo);

      // 0 is falsy, so defaults to 15
      expect(message).toContain('15 minutes');
    });

    it('should handle various minute values', () => {
      const testCases = [
        { minutes: 2, expected: '2 minutes' },
        { minutes: 5, expected: '5 minutes' },
        { minutes: 14, expected: '14 minutes' },
        { minutes: 30, expected: '30 minutes' },
      ];

      testCases.forEach(({ minutes, expected }) => {
        const lockoutInfo: AccountLockoutInfo = {
          isLocked: true,
          minutesRemaining: minutes,
        };

        const message = formatLockoutMessage(lockoutInfo);

        expect(message).toContain(expected);
      });
    });

    it('should ignore other lockout info fields when not locked', () => {
      const lockoutInfo: AccountLockoutInfo = {
        isLocked: false,
        lockedUntil: new Date().toISOString(),
        failedAttempts: 5,
        minutesRemaining: 10,
      };

      const message = formatLockoutMessage(lockoutInfo);

      expect(message).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete login flow with lockout check and recording', async () => {
      // Step 1: Check if account is locked (not locked)
      mockInvoke.mockResolvedValueOnce({
        data: { isLocked: false, failedAttempts: 0 },
        error: null,
      });

      const lockStatus = await isAccountLocked('user@example.com');
      expect(lockStatus.isLocked).toBe(false);

      // Step 2: Record successful login
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await recordLoginAttempt({
        identifier: 'user@example.com',
        attemptType: 'password',
        success: true,
        userId: 'user-123',
      });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle failed login with approaching lockout', async () => {
      // Check if account is locked (not yet, but close)
      mockInvoke.mockResolvedValueOnce({
        data: { isLocked: false, failedAttempts: 4 },
        error: null,
      });

      const lockStatus = await isAccountLocked('user@example.com');
      expect(lockStatus.isLocked).toBe(false);
      expect(lockStatus.failedAttempts).toBe(4);

      // Record failed attempt
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await recordLoginAttempt({
        identifier: 'user@example.com',
        attemptType: 'password',
        success: false,
        errorMessage: 'Invalid password',
      });

      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('should handle locked account scenario', async () => {
      // Check if account is locked (yes, locked)
      mockInvoke.mockResolvedValueOnce({
        data: {
          isLocked: true,
          failedAttempts: 5,
          minutesRemaining: 12,
        },
        error: null,
      });

      const lockStatus = await isAccountLocked('user@example.com');
      expect(lockStatus.isLocked).toBe(true);

      // Format message for user
      const message = formatLockoutMessage(lockStatus);
      expect(message).toContain('12 minutes');
      expect(message).toContain('temporarily locked');
    });
  });
});
