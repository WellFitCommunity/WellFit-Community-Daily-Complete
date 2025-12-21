/**
 * Tests for useClinicalMode Hook
 *
 * Tests the clinical vs community mode detection for users.
 * Clinical users see Envision Atlus features, community users see WellFit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClinicalMode } from '../useClinicalMode';

// Mock the auth context
const mockIsAdmin = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockUser = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAdmin: mockIsAdmin() }),
  useSupabaseClient: () => ({
    from: mockSupabaseFrom,
  }),
  useUser: () => mockUser(),
}));

// Helper to set up Supabase mock responses
function mockSupabaseProfile(profileData: { role?: string; role_code?: number; is_admin?: boolean } | null) {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: profileData,
          error: null,
        }),
      }),
    }),
  });
}

function mockSupabaseError() {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      }),
    }),
  });
}

describe('useClinicalMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(false);
    mockUser.mockReturnValue(null);
  });

  describe('no user logged in', () => {
    it('returns loading false when no user', async () => {
      mockUser.mockReturnValue(null);
      mockSupabaseProfile(null);

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.isClinical).toBe(false);
      expect(result.current.isCommunity).toBe(false);
    });
  });

  describe('clinical users', () => {
    it('identifies admin role as clinical', async () => {
      mockUser.mockReturnValue({ id: 'user-1' });
      mockSupabaseProfile({ role: 'admin', role_code: 1, is_admin: true });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
      expect(result.current.isCommunity).toBe(false);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.role).toBe('admin');
      expect(result.current.roleCode).toBe(1);
    });

    it('identifies physician role as clinical', async () => {
      mockUser.mockReturnValue({ id: 'user-2' });
      mockSupabaseProfile({ role: 'physician', role_code: 8 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
      expect(result.current.isCommunity).toBe(false);
      expect(result.current.role).toBe('physician');
    });

    it('identifies nurse role as clinical', async () => {
      mockUser.mockReturnValue({ id: 'user-3' });
      mockSupabaseProfile({ role: 'nurse', role_code: 9 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
      expect(result.current.role).toBe('nurse');
    });

    it('identifies nurse_practitioner role as clinical', async () => {
      mockUser.mockReturnValue({ id: 'user-4' });
      mockSupabaseProfile({ role: 'nurse_practitioner', role_code: 10 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
    });

    it('identifies care_coordinator as clinical', async () => {
      mockUser.mockReturnValue({ id: 'user-5' });
      mockSupabaseProfile({ role: 'care_coordinator', role_code: 13 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
    });

    it('identifies it_admin as clinical', async () => {
      mockUser.mockReturnValue({ id: 'user-6' });
      mockSupabaseProfile({ role: 'it_admin' });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
    });

    it('identifies physical_therapist as clinical by role code', async () => {
      mockUser.mockReturnValue({ id: 'user-7' });
      mockSupabaseProfile({ role: 'physical_therapist', role_code: 17 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
    });
  });

  describe('community users', () => {
    it('identifies senior role as community', async () => {
      mockUser.mockReturnValue({ id: 'user-10' });
      mockSupabaseProfile({ role: 'senior', role_code: 4 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(false);
      expect(result.current.isCommunity).toBe(true);
      expect(result.current.isCaregiver).toBe(false);
    });

    it('identifies patient role as community', async () => {
      mockUser.mockReturnValue({ id: 'user-11' });
      mockSupabaseProfile({ role: 'patient', role_code: 5 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(false);
      expect(result.current.isCommunity).toBe(true);
    });

    it('identifies caregiver role as community and caregiver', async () => {
      mockUser.mockReturnValue({ id: 'user-12' });
      mockSupabaseProfile({ role: 'caregiver', role_code: 6 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(false);
      expect(result.current.isCommunity).toBe(true);
      expect(result.current.isCaregiver).toBe(true);
    });

    it('identifies family_member role as community', async () => {
      mockUser.mockReturnValue({ id: 'user-13' });
      mockSupabaseProfile({ role: 'family_member', role_code: 7 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(false);
      expect(result.current.isCommunity).toBe(true);
    });
  });

  describe('admin detection', () => {
    it('identifies super_admin as admin', async () => {
      mockUser.mockReturnValue({ id: 'user-20' });
      mockSupabaseProfile({ role: 'super_admin', role_code: 2, is_admin: true });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isClinical).toBe(true);
    });

    it('uses auth context isAdmin as fallback', async () => {
      mockUser.mockReturnValue({ id: 'user-21' });
      mockIsAdmin.mockReturnValue(true);
      mockSupabaseProfile({ role: 'staff', role_code: 3 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(true);
    });

    it('detects admin from is_admin flag in profile', async () => {
      mockUser.mockReturnValue({ id: 'user-22' });
      mockSupabaseProfile({ role: 'staff', is_admin: true });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isAdmin).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles database error gracefully', async () => {
      mockUser.mockReturnValue({ id: 'user-30' });
      mockSupabaseError();

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should default to non-clinical when error
      expect(result.current.isClinical).toBe(false);
      expect(result.current.role).toBeNull();
    });

    it('handles case-insensitive role names', async () => {
      mockUser.mockReturnValue({ id: 'user-31' });
      mockSupabaseProfile({ role: 'PHYSICIAN', role_code: 8 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
    });

    it('handles null role_code with valid role name', async () => {
      mockUser.mockReturnValue({ id: 'user-32' });
      mockSupabaseProfile({ role: 'nurse', role_code: undefined });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isClinical).toBe(true);
      expect(result.current.roleCode).toBeNull();
    });

    it('uses role_code when role name is missing', async () => {
      mockUser.mockReturnValue({ id: 'user-33' });
      mockSupabaseProfile({ role: '', role_code: 4 }); // 4 = senior

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isCommunity).toBe(true);
    });
  });

  describe('loading state', () => {
    it('starts with loading true when user exists', async () => {
      mockUser.mockReturnValue({ id: 'user-40' });
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
          }),
        }),
      });

      const { result } = renderHook(() => useClinicalMode());

      // Initial state should have loading true
      expect(result.current.loading).toBe(true);
    });

    it('sets loading false after profile fetch completes', async () => {
      mockUser.mockReturnValue({ id: 'user-41' });
      mockSupabaseProfile({ role: 'nurse', role_code: 9 });

      const { result } = renderHook(() => useClinicalMode());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('uses authIsAdmin as fallback during loading', async () => {
      mockUser.mockReturnValue({ id: 'user-42' });
      mockIsAdmin.mockReturnValue(true);
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => new Promise(() => {})),
          }),
        }),
      });

      const { result } = renderHook(() => useClinicalMode());

      // While loading, should use authIsAdmin fallback
      expect(result.current.loading).toBe(true);
      expect(result.current.isClinical).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });
  });
});
