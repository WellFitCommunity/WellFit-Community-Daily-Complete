/**
 * Unit Tests for AdminAuthContext
 *
 * Tests authentication, authorization, and permission management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { AdminAuthProvider, useAdminAuth } from '../AdminAuthContext';
import { supabase } from '../../lib/supabaseClient';
import { StaffRole, RoleAccessScopes } from '../../types/roles';
import React from 'react';

// Mock Supabase client
jest.mock('../../lib/supabaseClient', () => {
  const mockInvoke = jest.fn();
  const mockGetUser = jest.fn();
  const mockRpc = jest.fn();

  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
      auth: {
        getUser: mockGetUser,
      },
      rpc: mockRpc,
    },
  };
});

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('AdminAuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AdminAuthProvider>{children}</AdminAuthProvider>
  );

  describe('Initial State', () => {
    it('should initialize with unauthenticated state', () => {
      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      expect(result.current.isAdminAuthenticated).toBe(false);
      expect(result.current.adminRole).toBeNull();
      expect(result.current.accessScopes).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.canViewNurse).toBe(false);
      expect(result.current.canViewPhysician).toBe(false);
      expect(result.current.canViewAdmin).toBe(false);
      expect(result.current.canSupervise).toBe(false);
      expect(result.current.canManageDepartment).toBe(false);
    });
  });

  describe('verifyPinAndLogin', () => {
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    const mockAccessScopes: RoleAccessScopes = {
      canViewNurse: true,
      canViewPhysician: true,
      canViewAdmin: false,
      canSupervise: false,
      canManageDepartment: false,
      department: null,
      roles: ['nurse_practitioner'],
    };

    it('should successfully authenticate nurse_practitioner with valid PIN', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockAccessScopes,
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('1234', 'nurse_practitioner');
      });

      expect(success).toBe(true);
      expect(result.current.isAdminAuthenticated).toBe(true);
      expect(result.current.adminRole).toBe('nurse_practitioner');
      expect(result.current.canViewNurse).toBe(true);
      expect(result.current.canViewPhysician).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should successfully authenticate clinical_supervisor', async () => {
      const supervisorScopes: RoleAccessScopes = {
        canViewNurse: true,
        canViewPhysician: true,
        canViewAdmin: false,
        canSupervise: true,
        canManageDepartment: false,
        department: null,
        roles: ['clinical_supervisor'],
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: supervisorScopes,
        error: null,
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('1234', 'clinical_supervisor');
      });

      expect(success).toBe(true);
      expect(result.current.canSupervise).toBe(true);
    });

    it('should successfully authenticate department_head with department scope', async () => {
      const deptHeadScopes: RoleAccessScopes = {
        canViewNurse: true,
        canViewPhysician: true,
        canViewAdmin: true,
        canSupervise: true,
        canManageDepartment: true,
        department: 'nursing',
        roles: ['department_head'],
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: deptHeadScopes,
        error: null,
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('1234', 'department_head');
      });

      expect(success).toBe(true);
      expect(result.current.canManageDepartment).toBe(true);
      expect(result.current.accessScopes?.department).toBe('nursing');
    });

    it('should fail authentication with invalid PIN', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Incorrect PIN',
        },
        error: null,
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('0000', 'nurse');
      });

      expect(success).toBe(false);
      expect(result.current.isAdminAuthenticated).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('should fail authentication when Edge Function returns error', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'PIN not set' },
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('1234', 'nurse');
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain('PIN');
    });

    it('should handle all staff roles', async () => {
      const roles: StaffRole[] = [
        'super_admin',
        'department_head',
        'clinical_supervisor',
        'nurse_practitioner',
        'physician_assistant',
        'physician',
        'nurse',
        'physical_therapist',
        'admin',
      ];

      for (const role of roles) {
        jest.clearAllMocks();

        (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
          data: {
            success: true,
            expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
            admin_token: `mock-token-${role}`,
          },
          error: null,
        });

        (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
          data: { user: mockUser },
          error: null,
        } as any);

        (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
          data: mockAccessScopes,
          error: null,
        });

        const { result } = renderHook(() => useAdminAuth(), { wrapper });

        await act(async () => {
          await result.current.verifyPinAndLogin('1234', role);
        });

        expect(result.current.adminRole).toBe(role);
      }
    });
  });

  describe('logoutAdmin', () => {
    it('should clear all authentication state', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          canViewNurse: true,
          canViewPhysician: false,
          canViewAdmin: false,
          canSupervise: false,
          canManageDepartment: false,
          department: null,
          roles: ['nurse'],
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      // First login
      await act(async () => {
        await result.current.verifyPinAndLogin('1234', 'nurse');
      });

      expect(result.current.isAdminAuthenticated).toBe(true);

      // Then logout
      act(() => {
        result.current.logoutAdmin();
      });

      expect(result.current.isAdminAuthenticated).toBe(false);
      expect(result.current.adminRole).toBeNull();
      expect(result.current.accessScopes).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.canViewNurse).toBe(false);
      expect(result.current.canViewPhysician).toBe(false);
    });
  });

  describe('hasAccess', () => {
    it('should correctly check role-based access for nurse_practitioner', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          canViewNurse: true,
          canViewPhysician: true,
          canViewAdmin: false,
          canSupervise: false,
          canManageDepartment: false,
          department: null,
          roles: ['nurse_practitioner'],
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      await act(async () => {
        await result.current.verifyPinAndLogin('1234', 'nurse_practitioner');
      });

      expect(result.current.hasAccess('nurse')).toBe(true);
      expect(result.current.hasAccess('physician')).toBe(true);
      expect(result.current.hasAccess('admin')).toBe(false);
      expect(result.current.hasAccess('super_admin')).toBe(false);
    });

    it('should return false when not authenticated', () => {
      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      expect(result.current.hasAccess('nurse')).toBe(false);
      expect(result.current.hasAccess('admin')).toBe(false);
    });
  });

  describe('Session Persistence', () => {
    it('should persist session to sessionStorage', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          canViewNurse: true,
          canViewPhysician: false,
          canViewAdmin: false,
          canSupervise: false,
          canManageDepartment: false,
          department: null,
          roles: ['nurse'],
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      await act(async () => {
        await result.current.verifyPinAndLogin('1234', 'nurse');
      });

      const stored = sessionStorage.getItem('wellfit_admin_auth');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.isAuthenticated).toBe(true);
      expect(parsed.role).toBe('nurse');
      expect(parsed.expires_at).toBeTruthy();
    });

    it('should clear sessionStorage on logout', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          admin_token: 'mock-admin-token',
        },
        error: null,
      });

      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      } as any);

      (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          canViewNurse: true,
          canViewPhysician: false,
          canViewAdmin: false,
          canSupervise: false,
          canManageDepartment: false,
          department: null,
          roles: ['nurse'],
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK',
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      await act(async () => {
        await result.current.verifyPinAndLogin('1234', 'nurse');
      });

      expect(sessionStorage.getItem('wellfit_admin_auth')).toBeTruthy();

      act(() => {
        result.current.logoutAdmin();
      });

      expect(sessionStorage.getItem('wellfit_admin_auth')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing admin_token in response', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          success: true,
          expires_at: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
          // Missing admin_token
        },
        error: null,
      });

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('1234', 'nurse');
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain('admin token');
    });

    it('should handle network errors', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAdminAuth(), { wrapper });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.verifyPinAndLogin('1234', 'nurse');
      });

      expect(success).toBe(false);
      expect(result.current.error).toContain('Network error');
    });
  });
});
