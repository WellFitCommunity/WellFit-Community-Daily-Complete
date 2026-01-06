/**
 * Auth Service Tests
 *
 * Comprehensive tests for authentication service:
 * - Phone E.164 formatting
 * - Phone login (user authentication)
 * - Email login (admin authentication)
 * - Admin role assertion
 * - Route determination after login
 * - Sign out functionality
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toE164,
  loginUserWithPhoneResult,
  loginUserWithPhone,
  loginAdminWithEmailResult,
  loginAdminWithEmail,
  assertAdminRoleOrSignOutResult,
  assertAdminRoleOrSignOut,
  nextRouteForUserResult,
  nextRouteForUser,
  signOutEverywhereResult,
  signOutEverywhere,
} from '../authService';
import type { User, Session, AuthError } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('../../lib/supabaseClient', () => {
  const mockSignInWithPassword = vi.fn();
  const mockGetUser = vi.fn();
  const mockGetSession = vi.fn();
  const mockSignOut = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();

  return {
    supabase: {
      auth: {
        signInWithPassword: mockSignInWithPassword,
        getUser: mockGetUser,
        getSession: mockGetSession,
        signOut: mockSignOut,
      },
      from: vi.fn(() => ({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle,
          }),
        }),
      })),
    },
  };
});

// Import mocked supabase after mock setup
import { supabase } from '../../lib/supabaseClient';

const mockSignInWithPassword = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>;
const mockGetUser = supabase.auth.getUser as ReturnType<typeof vi.fn>;
const mockGetSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
const mockSignOut = supabase.auth.signOut as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

// Helper to create mock user
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-123',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

// Helper to create mock session
function createMockSession(user: User): Session {
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session;
}

// Helper to create mock auth error
function createMockAuthError(message: string): AuthError {
  return {
    message,
    name: 'AuthError',
    status: 400,
  } as AuthError;
}

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // toE164 Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('toE164', () => {
    it('should convert 10-digit US phone number', () => {
      expect(toE164('5551234567')).toBe('+15551234567');
    });

    it('should convert phone number with formatting', () => {
      expect(toE164('(555) 123-4567')).toBe('+15551234567');
    });

    it('should handle 11-digit number starting with 1', () => {
      expect(toE164('15551234567')).toBe('+15551234567');
    });

    it('should preserve already formatted international number', () => {
      expect(toE164('+15551234567')).toBe('+15551234567');
    });

    it('should handle phone with spaces and dashes', () => {
      expect(toE164('555-123-4567')).toBe('+15551234567');
    });

    it('should handle phone with dots', () => {
      expect(toE164('555.123.4567')).toBe('+15551234567');
    });

    it('should handle international numbers without + prefix', () => {
      expect(toE164('445551234567')).toBe('+445551234567');
    });

    it('should handle numbers with letters (stripped to digits only)', () => {
      // Letters are stripped, leaving only digits - '555' is 3 digits, gets + prefix
      expect(toE164('555-GET-HELP')).toBe('+555');
    });

    it('should handle empty formatting characters', () => {
      expect(toE164('(555) - 123 - 4567')).toBe('+15551234567');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loginUserWithPhoneResult Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loginUserWithPhoneResult', () => {
    it('should successfully login user with phone and password', async () => {
      const mockUser = createMockUser({ phone: '+15551234567' });
      const mockSession = createMockSession(mockUser);

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await loginUserWithPhoneResult('5551234567', 'password123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user).toEqual(mockUser);
        expect(result.data.session).toEqual(mockSession);
      }
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        phone: '+15551234567',
        password: 'password123',
      });
    });

    it('should format phone to E.164 before login', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: createMockUser(), session: createMockSession(createMockUser()) },
        error: null,
      });

      await loginUserWithPhoneResult('(555) 123-4567', 'password123');

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        phone: '+15551234567',
        password: 'password123',
      });
    });

    it('should return failure on invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: createMockAuthError('Invalid login credentials'),
      });

      const result = await loginUserWithPhoneResult('5551234567', 'wrongpassword');

      expect(result.success).toBe(false);
      if (!result.success) {
        // The error is captured by withServiceWrapper
        expect(result.error.code).toBeDefined();
      }
    });

    it('should return failure on network error', async () => {
      mockSignInWithPassword.mockRejectedValueOnce(new Error('Network error'));

      const result = await loginUserWithPhoneResult('5551234567', 'password123');

      expect(result.success).toBe(false);
    });

    it('should handle already E.164 formatted phone', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: createMockUser(), session: createMockSession(createMockUser()) },
        error: null,
      });

      await loginUserWithPhoneResult('+15551234567', 'password123');

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        phone: '+15551234567',
        password: 'password123',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loginUserWithPhone (Legacy) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loginUserWithPhone (legacy)', () => {
    it('should return auth data on successful login', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await loginUserWithPhone('5551234567', 'password123');

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('should throw error on failed login', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: createMockAuthError('Invalid credentials'),
      });

      await expect(loginUserWithPhone('5551234567', 'wrong')).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loginAdminWithEmailResult Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loginAdminWithEmailResult', () => {
    it('should successfully login admin with email and password', async () => {
      const mockUser = createMockUser({
        email: 'admin@hospital.com',
        user_metadata: { role: 'admin' },
      });
      const mockSession = createMockSession(mockUser);

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await loginAdminWithEmailResult('admin@hospital.com', 'adminpass123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user?.email).toBe('admin@hospital.com');
        expect(result.data.session).toEqual(mockSession);
      }
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'admin@hospital.com',
        password: 'adminpass123',
      });
    });

    it('should return failure on invalid admin credentials', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: createMockAuthError('Invalid login credentials'),
      });

      const result = await loginAdminWithEmailResult('admin@hospital.com', 'wrongpass');

      expect(result.success).toBe(false);
      if (!result.success) {
        // The error is captured by withServiceWrapper
        expect(result.error.code).toBeDefined();
      }
    });

    it('should handle case-insensitive email', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: createMockUser(), session: createMockSession(createMockUser()) },
        error: null,
      });

      await loginAdminWithEmailResult('ADMIN@Hospital.com', 'password');

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'ADMIN@Hospital.com',
        password: 'password',
      });
    });

    it('should return failure on network error', async () => {
      mockSignInWithPassword.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await loginAdminWithEmailResult('admin@hospital.com', 'password');

      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // loginAdminWithEmail (Legacy) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loginAdminWithEmail (legacy)', () => {
    it('should return auth data on successful login', async () => {
      const mockUser = createMockUser({ email: 'admin@hospital.com' });
      const mockSession = createMockSession(mockUser);

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await loginAdminWithEmail('admin@hospital.com', 'password');

      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
    });

    it('should throw error on failed login', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: createMockAuthError('Invalid credentials'),
      });

      await expect(loginAdminWithEmail('admin@hospital.com', 'wrong')).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // assertAdminRoleOrSignOutResult Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('assertAdminRoleOrSignOutResult', () => {
    it('should succeed for admin role', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: { role: 'admin' } }),
        },
        error: null,
      });

      const result = await assertAdminRoleOrSignOutResult();

      expect(result.success).toBe(true);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('should succeed for super_admin role', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: { role: 'super_admin' } }),
        },
        error: null,
      });

      const result = await assertAdminRoleOrSignOutResult();

      expect(result.success).toBe(true);
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it('should sign out and fail for non-admin role', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: { role: 'patient' } }),
        },
        error: null,
      });
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await assertAdminRoleOrSignOutResult();

      expect(result.success).toBe(false);
      expect(mockSignOut).toHaveBeenCalled();
      if (!result.success) {
        expect(result.error.message).toContain('Admin access required');
      }
    });

    it('should sign out and fail for user without role', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: {} }),
        },
        error: null,
      });
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await assertAdminRoleOrSignOutResult();

      expect(result.success).toBe(false);
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should sign out and fail for caregiver role', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: { role: 'caregiver' } }),
        },
        error: null,
      });
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await assertAdminRoleOrSignOutResult();

      expect(result.success).toBe(false);
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should handle null user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await assertAdminRoleOrSignOutResult();

      expect(result.success).toBe(false);
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // assertAdminRoleOrSignOut (Legacy) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('assertAdminRoleOrSignOut (legacy)', () => {
    it('should not throw for admin user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: { role: 'admin' } }),
        },
        error: null,
      });

      await expect(assertAdminRoleOrSignOut()).resolves.toBeUndefined();
    });

    it('should throw for non-admin user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: {
          user: createMockUser({ user_metadata: { role: 'patient' } }),
        },
        error: null,
      });
      mockSignOut.mockResolvedValueOnce({ error: null });

      await expect(assertAdminRoleOrSignOut()).rejects.toThrow('Admin access required');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // nextRouteForUserResult Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('nextRouteForUserResult', () => {
    const setupMockProfile = (profile: Record<string, unknown>) => {
      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: profile,
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });
    };

    it('should return /login when no session exists', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/login');
      }
    });

    it('should return /change-password when force_password_change is true', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: true,
        consent: true,
        demographics_complete: true,
        role: 'patient',
        role_code: 5,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/change-password');
      }
    });

    it('should return /consent-photo when consent is false', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: false,
        demographics_complete: true,
        role: 'patient',
        role_code: 5,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/consent-photo');
      }
    });

    it('should return /demographics when demographics_complete is false', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: false,
        role: 'patient',
        role_code: 5,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/demographics');
      }
    });

    it('should return /admin-login for admin role', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: 'admin',
        role_code: 1,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/admin-login');
      }
    });

    it('should return /admin-login for super_admin role', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: 'super_admin',
        role_code: 2,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/admin-login');
      }
    });

    it('should return /admin-login for role_code 1 (admin)', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: '',
        role_code: 1,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/admin-login');
      }
    });

    it('should return /admin-login for role_code 2 (super_admin)', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: '',
        role_code: 2,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/admin-login');
      }
    });

    it('should return /caregiver-dashboard for caregiver role', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: 'caregiver',
        role_code: 6,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/caregiver-dashboard');
      }
    });

    it('should return /caregiver-dashboard for role_code 6', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: '',
        role_code: 6,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/caregiver-dashboard');
      }
    });

    it('should return /dashboard for regular patient', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: 'patient',
        role_code: 5,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/dashboard');
      }
    });

    it('should return /dashboard for senior role', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      setupMockProfile({
        force_password_change: false,
        consent: true,
        demographics_complete: true,
        role: 'senior',
        role_code: 4,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/dashboard');
      }
    });

    it('should return /login on profile fetch error', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Profile not found' },
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/login');
      }
    });

    it('should return /login when profile data is null', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: null,
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('/login');
      }
    });

    it('should check onboarding steps in correct order', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });
      // All onboarding incomplete - should return first one (password change)
      setupMockProfile({
        force_password_change: true,
        consent: false,
        demographics_complete: false,
        role: 'patient',
        role_code: 5,
      });

      const result = await nextRouteForUserResult();

      expect(result.success).toBe(true);
      if (result.success) {
        // force_password_change is checked first
        expect(result.data).toBe('/change-password');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // nextRouteForUser (Legacy) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('nextRouteForUser (legacy)', () => {
    it('should return route on success', async () => {
      const mockUser = createMockUser();
      mockGetSession.mockResolvedValueOnce({
        data: { session: createMockSession(mockUser) },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: {
          force_password_change: false,
          consent: true,
          demographics_complete: true,
          role: 'patient',
          role_code: 5,
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const route = await nextRouteForUser();

      expect(route).toBe('/dashboard');
    });

    it('should return /login on failure', async () => {
      mockGetSession.mockRejectedValueOnce(new Error('Session error'));

      const route = await nextRouteForUser();

      expect(route).toBe('/login');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // signOutEverywhereResult Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('signOutEverywhereResult', () => {
    it('should successfully sign out', async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await signOutEverywhereResult();

      expect(result.success).toBe(true);
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should handle sign out error gracefully', async () => {
      mockSignOut.mockResolvedValueOnce({
        error: createMockAuthError('Sign out failed'),
      });

      // withServiceWrapper catches errors, so this should still succeed
      // unless the implementation throws on error
      const result = await signOutEverywhereResult();

      expect(mockSignOut).toHaveBeenCalled();
      // The current implementation doesn't check for signOut errors
      expect(result.success).toBe(true);
    });

    it('should handle network error during sign out', async () => {
      mockSignOut.mockRejectedValueOnce(new Error('Network error'));

      const result = await signOutEverywhereResult();

      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // signOutEverywhere (Legacy) Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('signOutEverywhere (legacy)', () => {
    it('should complete without throwing on success', async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      await expect(signOutEverywhere()).resolves.toBeUndefined();
    });

    it('should not throw even on sign out error', async () => {
      mockSignOut.mockResolvedValueOnce({
        error: createMockAuthError('Sign out failed'),
      });

      // Legacy function uses await on result, doesn't throw
      await expect(signOutEverywhere()).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete user login flow', async () => {
      // Step 1: Login with phone
      const mockUser = createMockUser({ phone: '+15551234567' });
      const mockSession = createMockSession(mockUser);

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const loginResult = await loginUserWithPhoneResult('5551234567', 'password123');
      expect(loginResult.success).toBe(true);

      // Step 2: Determine next route
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: {
          force_password_change: false,
          consent: true,
          demographics_complete: true,
          role: 'patient',
          role_code: 5,
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const routeResult = await nextRouteForUserResult();
      expect(routeResult.success).toBe(true);
      if (routeResult.success) {
        expect(routeResult.data).toBe('/dashboard');
      }
    });

    it('should handle complete admin login flow', async () => {
      // Step 1: Login with email
      const mockUser = createMockUser({
        email: 'admin@hospital.com',
        user_metadata: { role: 'admin' },
      });
      const mockSession = createMockSession(mockUser);

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const loginResult = await loginAdminWithEmailResult('admin@hospital.com', 'adminpass');
      expect(loginResult.success).toBe(true);

      // Step 2: Assert admin role
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const assertResult = await assertAdminRoleOrSignOutResult();
      expect(assertResult.success).toBe(true);

      // Step 3: Determine next route (should go to admin-login for PIN)
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: {
          force_password_change: false,
          consent: true,
          demographics_complete: true,
          role: 'admin',
          role_code: 1,
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const routeResult = await nextRouteForUserResult();
      expect(routeResult.success).toBe(true);
      if (routeResult.success) {
        expect(routeResult.data).toBe('/admin-login');
      }
    });

    it('should handle new user onboarding flow', async () => {
      const mockUser = createMockUser();
      const mockSession = createMockSession(mockUser);

      // User logs in
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      await loginUserWithPhoneResult('5551234567', 'password');

      // New user needs to complete onboarding
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const mockSingle = vi.fn().mockResolvedValueOnce({
        data: {
          force_password_change: true,
          consent: false,
          demographics_complete: false,
          role: 'patient',
          role_code: 5,
        },
        error: null,
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockFrom.mockReturnValue({ select: mockSelect });

      const routeResult = await nextRouteForUserResult();
      expect(routeResult.success).toBe(true);
      if (routeResult.success) {
        // First step is password change
        expect(routeResult.data).toBe('/change-password');
      }
    });

    it('should handle sign out flow', async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await signOutEverywhereResult();
      expect(result.success).toBe(true);

      // After sign out, nextRouteForUser should return /login
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const routeResult = await nextRouteForUserResult();
      expect(routeResult.success).toBe(true);
      if (routeResult.success) {
        expect(routeResult.data).toBe('/login');
      }
    });
  });
});
