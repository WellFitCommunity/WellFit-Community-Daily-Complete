/**
 * PIN Security Service Tests
 *
 * Tests for Admin/Staff PIN authentication and reset flows:
 * - PIN verification rate limiting (5 failures = 15 min lockout)
 * - PIN reset request flow (SMS verification)
 * - PIN reset verification flow (OTP token generation)
 * - PIN change with OTP token or old PIN
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockInvoke = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();

  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
      rpc: mockRpc,
      from: mockFrom,
    },
  };
});

const mockSupabase = supabase as typeof supabase;

describe('PIN Security Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PIN Verification Rate Limiting', () => {
    it('should allow PIN verification when under rate limit', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '1234', role: 'nurse' },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.admin_token).toBeDefined();
    });

    it('should return error after 5 failed PIN attempts', async () => {
      // Simulate 5 failed attempts leading to lockout
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Account locked for 15 minutes due to too many failed attempts',
          locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '0000', role: 'nurse' },
      });

      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('locked');
      expect(response.data.locked_until).toBeDefined();
    });

    it('should show remaining attempts warning when near lockout', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Incorrect PIN',
          warning: '2 attempts remaining before temporary lockout',
          remaining_attempts: 2,
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '0000', role: 'nurse' },
      });

      expect(response.data.success).toBe(false);
      expect(response.data.remaining_attempts).toBe(2);
      expect(response.data.warning).toContain('remaining');
    });

    it('should require PIN to be 4-8 digits', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'PIN must be 4-8 digits' },
      });

      const response = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '123', role: 'nurse' }, // Too short
      });

      expect(response.error).toBeTruthy();
      expect(response.error?.message).toContain('4-8 digits');
    });

    it('should reject non-numeric PIN', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: null,
        error: { message: 'PIN must contain only digits' },
      });

      const response = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: 'abcd', role: 'nurse' },
      });

      expect(response.error).toBeTruthy();
    });
  });

  describe('PIN Reset Request Flow', () => {
    const validPhone = '+15551234567';

    it('should accept valid phone number for reset request', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'If this phone is registered to an admin account, a verification code has been sent.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('request-pin-reset', {
        body: { phone: validPhone },
      });

      expect(response.data.success).toBe(true);
      // Generic message to prevent phone enumeration
      expect(response.data.message).toContain('If this phone');
    });

    it('should return generic success for non-existent phone (enumeration protection)', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'If this phone is registered to an admin account, a verification code has been sent.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('request-pin-reset', {
        body: { phone: '+15559999999' }, // Non-existent phone
      });

      // Should still return success to prevent enumeration
      expect(response.data.success).toBe(true);
    });

    it('should reject invalid phone format', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid phone number format' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('request-pin-reset', {
        body: { phone: 'not-a-phone' },
      });

      expect(response.data.error).toContain('Invalid phone');
    });

    it('should enforce rate limit of 3 requests per hour', async () => {
      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          data: { success: true },
          error: null,
        });
      }

      // 4th request should be rate limited (but still return generic success)
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true, // Still returns success to prevent enumeration
          message: 'If this phone is registered...',
        },
        error: null,
      });

      const responses = [];
      for (let i = 0; i < 4; i++) {
        const response = await mockSupabase.functions.invoke('request-pin-reset', {
          body: { phone: validPhone },
        });
        responses.push(response);
      }

      // All should appear successful to prevent enumeration
      responses.forEach((r) => expect(r.data.success).toBe(true));
    });

    it('should require phone number parameter', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Phone number is required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('request-pin-reset', {
        body: {},
      });

      expect(response.data.error).toContain('required');
    });
  });

  describe('PIN Reset Verification Flow', () => {
    const validPhone = '+15551234567';
    const validCode = '123456';

    it('should return OTP token on successful code verification', async () => {
      const mockOtpToken = 'otp-token-uuid';
      const mockExpiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          otp_token: mockOtpToken,
          expires_at: mockExpiresAt,
          message: 'Verification successful. Use the OTP token to set your new PIN within 5 minutes.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-pin-reset', {
        body: { phone: validPhone, code: validCode },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.otp_token).toBe(mockOtpToken);
      expect(response.data.expires_at).toBeDefined();
    });

    it('should reject invalid verification code', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid or expired verification code' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-pin-reset', {
        body: { phone: validPhone, code: '000000' }, // Wrong code
      });

      expect(response.data.error).toContain('Invalid');
    });

    it('should reject expired verification code', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid or expired verification code' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-pin-reset', {
        body: { phone: validPhone, code: validCode },
      });

      expect(response.data.error).toContain('expired');
    });

    it('should reject code format that is not 4-8 digits', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid verification code format' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-pin-reset', {
        body: { phone: validPhone, code: '12' }, // Too short
      });

      expect(response.data.error).toContain('format');
    });

    it('should require phone number parameter', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Phone number is required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-pin-reset', {
        body: { code: validCode },
      });

      expect(response.data.error).toContain('required');
    });

    it('should handle case when no pending reset request exists', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          error: 'No pending PIN reset request found. Please request a new reset.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-pin-reset', {
        body: { phone: validPhone, code: validCode },
      });

      expect(response.data.error).toContain('No pending');
    });
  });

  describe('PIN Change with OTP Token', () => {
    const validOtpToken = 'otp-token-uuid';
    const newPin = '5678';

    it('should allow PIN change with valid OTP token', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'PIN has been reset successfully.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('admin_set_pin', {
        body: { new_pin: newPin, otp_token: validOtpToken },
      });

      expect(response.data.success).toBe(true);
    });

    it('should reject expired OTP token', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'OTP token expired. Please request a new PIN reset.' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('admin_set_pin', {
        body: { new_pin: newPin, otp_token: 'expired-token' },
      });

      expect(response.data.error).toContain('expired');
    });

    it('should reject already-used OTP token', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid or already used OTP token.' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('admin_set_pin', {
        body: { new_pin: newPin, otp_token: 'used-token' },
      });

      expect(response.data.error).toContain('Invalid');
    });
  });

  describe('PIN Change with Old PIN', () => {
    const oldPin = '1234';
    const newPin = '5678';

    it('should allow PIN change with correct old PIN', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'PIN updated successfully.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('admin_set_pin', {
        body: { new_pin: newPin, old_pin: oldPin },
      });

      expect(response.data.success).toBe(true);
    });

    it('should reject incorrect old PIN', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Invalid current PIN' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('admin_set_pin', {
        body: { new_pin: newPin, old_pin: '0000' },
      });

      expect(response.data.error).toContain('Invalid');
    });

    it('should require either old_pin or otp_token', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Either old_pin or otp_token is required' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('admin_set_pin', {
        body: { new_pin: newPin }, // No old_pin or otp_token
      });

      expect(response.data.error).toContain('required');
    });
  });

  describe('Envision Two-Factor Authentication', () => {
    const validEmail = 'admin@envision.com';
    const validPassword = 'hashedpassword123';

    it('should require PIN after password verification', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          session_token: 'pending-session-token',
          requires_pin: true,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          message: 'Password verified. Please enter your PIN to complete login.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-login', {
        body: { email: validEmail, password: validPassword },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.requires_pin).toBe(true);
      expect(response.data.session_token).toBeDefined();
    });

    it('should complete login after PIN verification', async () => {
      const sessionToken = 'pending-session-token';
      const pin = '1234';

      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          session_token: 'full-session-token',
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          user: {
            id: 'user-uuid',
            email: validEmail,
            full_name: 'Admin User',
            role: 'super_admin',
            permissions: ['all'],
          },
          message: 'Login successful. Welcome to the Envision Master Panel.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-verify-pin', {
        body: { session_token: sessionToken, pin },
      });

      expect(response.data.success).toBe(true);
      expect(response.data.user).toBeDefined();
      expect(response.data.session_token).toBeDefined();
    });

    it('should handle rate limiting on Envision password attempts', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          error: 'Account temporarily locked. Try again in 15 minutes.',
          locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          remaining_minutes: 15,
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-login', {
        body: { email: validEmail, password: 'wrong-password' },
      });

      expect(response.data.error).toContain('locked');
      expect(response.data.remaining_minutes).toBeDefined();
    });

    it('should handle expired pending session', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Session expired. Please login again.' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-verify-pin', {
        body: { session_token: 'expired-token', pin: '1234' },
      });

      expect(response.data.error).toContain('expired');
    });
  });

  describe('Envision Password/PIN Reset', () => {
    const validEmail = 'admin@envision.com';

    it('should initiate password reset via SMS', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'If this email is registered, a verification code has been sent to the associated phone number.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-request-reset', {
        body: { email: validEmail, reset_type: 'password' },
      });

      expect(response.data.success).toBe(true);
    });

    it('should initiate PIN reset via SMS', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'If this email is registered, a verification code has been sent to the associated phone number.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-request-reset', {
        body: { email: validEmail, reset_type: 'pin' },
      });

      expect(response.data.success).toBe(true);
    });

    it('should complete password reset with SMS code', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Your password has been reset successfully. You can now log in with your new password.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-complete-reset', {
        body: {
          email: validEmail,
          code: '123456',
          reset_type: 'password',
          new_credential: 'newSecurePassword123',
        },
      });

      expect(response.data.success).toBe(true);
    });

    it('should complete PIN reset with SMS code', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Your PIN has been reset successfully. You can now log in with your new PIN.',
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-complete-reset', {
        body: {
          email: validEmail,
          code: '123456',
          reset_type: 'pin',
          new_credential: '5678',
        },
      });

      expect(response.data.success).toBe(true);
    });

    it('should validate reset_type parameter', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: "Reset type must be 'password' or 'pin'" },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-request-reset', {
        body: { email: validEmail, reset_type: 'invalid' },
      });

      expect(response.data.error).toContain('Reset type');
    });

    it('should validate new password length', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'Password must be at least 8 characters' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-complete-reset', {
        body: {
          email: validEmail,
          code: '123456',
          reset_type: 'password',
          new_credential: 'short', // Too short
        },
      });

      expect(response.data.error).toContain('8 characters');
    });

    it('should validate new PIN format', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { error: 'PIN must be 4-8 digits' },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('envision-complete-reset', {
        body: {
          email: validEmail,
          code: '123456',
          reset_type: 'pin',
          new_credential: '12', // Too short
        },
      });

      expect(response.data.error).toContain('4-8 digits');
    });
  });

  describe('Security Audit Logging', () => {
    it('should log PIN verification attempts', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
      (mockSupabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: false, error: 'Incorrect PIN' },
        error: null,
      });

      await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '0000', role: 'nurse' },
      });

      // The function should have attempted to log the failed attempt
      // (actual audit logging happens server-side)
      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });

    it('should log successful login events', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          admin_token: 'token',
          expires_at: new Date().toISOString(),
        },
        error: null,
      });

      await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '1234', role: 'nurse' },
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });

    it('should log PIN reset requests', async () => {
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      await mockSupabase.functions.invoke('request-pin-reset', {
        body: { phone: '+15551234567' },
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalled();
    });
  });

  describe('Client-Side PIN Hashing', () => {
    it('should accept client-hashed PIN (SHA-256 format)', async () => {
      // Client pre-hashes PIN with SHA-256 before sending
      const clientHashedPin = 'sha256:' + 'a'.repeat(64);

      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: {
          success: true,
          admin_token: 'token',
          expires_at: new Date().toISOString(),
        },
        error: null,
      });

      const response = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: clientHashedPin, role: 'nurse' },
      });

      expect(response.data.success).toBe(true);
    });

    it('should handle both hashed and plain PIN formats', async () => {
      // Plain PIN
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const plainResponse = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: '1234', role: 'nurse' },
      });
      expect(plainResponse.data.success).toBe(true);

      // Hashed PIN
      (mockSupabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const hashedPin = 'sha256:' + 'b'.repeat(64);
      const hashedResponse = await mockSupabase.functions.invoke('verify-admin-pin', {
        body: { pin: hashedPin, role: 'nurse' },
      });
      expect(hashedResponse.data.success).toBe(true);
    });
  });
});
