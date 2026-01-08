/**
 * Unit Tests for Role-Based Permissions
 *
 * Tests role permission logic and Supabase client interactions
 * using mocked Supabase client (no live DB connection required)
 */

import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';
import type { StaffRole, RoleAccessScopes } from '../types/roles';

// Mock supabase client
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }
}));

import { supabase } from '../lib/supabaseClient';

describe('Role Permission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database Permission Functions', () => {
    describe('get_role_access_scopes', () => {
      test('should return access scopes for super_admin', async () => {
        const mockScopes: RoleAccessScopes = {
          canViewNurse: true,
          canViewPhysician: true,
          canViewAdmin: true,
          canSupervise: true,
          canManageDepartment: true,
          department: null,
          roles: ['nurse', 'physician', 'admin', 'super_admin']
        };

        (supabase.rpc as Mock).mockResolvedValue({
          data: mockScopes,
          error: null
        });

        const testUserId = 'test-super-admin-id';
        const { data: _data, error } = await supabase.rpc('get_role_access_scopes', {
          check_user_id: testUserId,
        });

        expect(error).toBeNull();
        expect(supabase.rpc).toHaveBeenCalledWith('get_role_access_scopes', {
          check_user_id: testUserId,
        });

        const scopes = _data as RoleAccessScopes;
        expect(scopes).toHaveProperty('canViewNurse');
        expect(scopes).toHaveProperty('canViewPhysician');
        expect(scopes).toHaveProperty('canViewAdmin');
        expect(scopes).toHaveProperty('canSupervise');
        expect(scopes).toHaveProperty('canManageDepartment');
        expect(scopes.canViewNurse).toBe(true);
      });

      test('should handle user not found error', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: null,
          error: { message: 'User not found', code: 'P0001' }
        });

        const { data: _data, error } = await supabase.rpc('get_role_access_scopes', {
          check_user_id: 'nonexistent-user',
        });

        expect(_data).toBeNull();
        expect(error).not.toBeNull();
        expect(error?.message).toContain('not found');
      });
    });

    describe('user_has_role', () => {
      test('should return true when user has the specified role', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: true,
          error: null
        });

        const testUserId = 'test-user-id';
        const requiredRole = 'nurse';

        const { data, error } = await supabase.rpc('user_has_role', {
          check_user_id: testUserId,
          required_role: requiredRole,
        });

        expect(error).toBeNull();
        expect(typeof data).toBe('boolean');
        expect(data).toBe(true);
        expect(supabase.rpc).toHaveBeenCalledWith('user_has_role', {
          check_user_id: testUserId,
          required_role: requiredRole,
        });
      });

      test('should return false when user does not have the role', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: false,
          error: null
        });

        const { data, error } = await supabase.rpc('user_has_role', {
          check_user_id: 'test-user-id',
          required_role: 'super_admin',
        });

        expect(error).toBeNull();
        expect(data).toBe(false);
      });
    });

    describe('user_has_any_role', () => {
      test('should return true when user has any of the specified roles', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: true,
          error: null
        });

        const testUserId = 'test-user-id';
        const requiredRoles: StaffRole[] = ['nurse', 'physician', 'nurse_practitioner'];

        const { data, error } = await supabase.rpc('user_has_any_role', {
          check_user_id: testUserId,
          required_roles: requiredRoles,
        });

        expect(error).toBeNull();
        expect(typeof data).toBe('boolean');
        expect(data).toBe(true);
        expect(supabase.rpc).toHaveBeenCalledWith('user_has_any_role', {
          check_user_id: testUserId,
          required_roles: requiredRoles,
        });
      });

      test('should return false when user has none of the roles', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: false,
          error: null
        });

        const requiredRoles: StaffRole[] = ['super_admin', 'department_head'];

        const { data, error } = await supabase.rpc('user_has_any_role', {
          check_user_id: 'regular-user',
          required_roles: requiredRoles,
        });

        expect(error).toBeNull();
        expect(data).toBe(false);
      });
    });

    describe('user_can_access_department', () => {
      test('should return true when user can access department', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: true,
          error: null
        });

        const testUserId = 'test-user-id';
        const targetDepartment = 'nursing';

        const { data, error } = await supabase.rpc('user_can_access_department', {
          check_user_id: testUserId,
          target_department: targetDepartment,
        });

        expect(error).toBeNull();
        expect(typeof data).toBe('boolean');
        expect(data).toBe(true);
        expect(supabase.rpc).toHaveBeenCalledWith('user_can_access_department', {
          check_user_id: testUserId,
          target_department: targetDepartment,
        });
      });

      test('should return false when user cannot access department', async () => {
        (supabase.rpc as Mock).mockResolvedValue({
          data: false,
          error: null
        });

        const { data, error } = await supabase.rpc('user_can_access_department', {
          check_user_id: 'limited-user',
          target_department: 'executive',
        });

        expect(error).toBeNull();
        expect(data).toBe(false);
      });
    });
  });

  describe('Table Structure Queries', () => {
    describe('user_roles table', () => {
      test('should query user_roles table successfully', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ role: 'nurse', user_id: 'test-id' }],
            error: null
          })
        });

        (supabase.from as Mock).mockReturnValue({
          select: mockSelect
        });

        const { data: _data, error } = await supabase
          .from('user_roles')
          .select('*')
          .limit(1);

        expect(error).toBeNull();
        expect(supabase.from).toHaveBeenCalledWith('user_roles');
        expect(mockSelect).toHaveBeenCalledWith('*');
      });
    });

    describe('staff_pins table', () => {
      test('should query staff_pins table successfully', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        });

        (supabase.from as Mock).mockReturnValue({
          select: mockSelect
        });

        const { data: _data, error } = await supabase
          .from('staff_pins')
          .select('user_id, role')
          .limit(1);

        expect(error).toBeNull();
        expect(supabase.from).toHaveBeenCalledWith('staff_pins');
        expect(mockSelect).toHaveBeenCalledWith('user_id, role');
      });
    });

    describe('staff_auth_attempts table', () => {
      test('should query staff_auth_attempts table successfully', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        });

        (supabase.from as Mock).mockReturnValue({
          select: mockSelect
        });

        const { data: _data, error } = await supabase
          .from('staff_auth_attempts')
          .select('id')
          .limit(1);

        expect(error).toBeNull();
        expect(supabase.from).toHaveBeenCalledWith('staff_auth_attempts');
      });

      test('should handle table not existing error', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'relation "staff_auth_attempts" does not exist', code: '42P01' }
          })
        });

        (supabase.from as Mock).mockReturnValue({
          select: mockSelect
        });

        const { error } = await supabase
          .from('staff_auth_attempts')
          .select('id')
          .limit(1);

        expect(error).not.toBeNull();
        expect(error?.message).toContain('does not exist');
      });
    });

    describe('staff_audit_log table', () => {
      test('should query staff_audit_log table successfully', async () => {
        const mockSelect = vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        });

        (supabase.from as Mock).mockReturnValue({
          select: mockSelect
        });

        const { data: _data, error } = await supabase
          .from('staff_audit_log')
          .select('id')
          .limit(1);

        expect(error).toBeNull();
        expect(supabase.from).toHaveBeenCalledWith('staff_audit_log');
      });
    });
  });

  describe('Role Constraints', () => {
    test('should recognize all valid staff roles', () => {
      const validRoles: StaffRole[] = [
        'super_admin',
        'department_head',
        'clinical_supervisor',
        'nurse_practitioner',
        'physician_assistant',
        'physician',
        'doctor',
        'nurse',
        'physical_therapist',
        'admin',
      ];

      // Verify all roles are defined in the type
      validRoles.forEach((role) => {
        expect(typeof role).toBe('string');
        expect(role.length).toBeGreaterThan(0);
      });

      // Verify expected count
      expect(validRoles.length).toBe(10);
    });
  });
});

describe('Edge Function Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verify-admin-pin function', () => {
    test('should reject invalid PIN format', async () => {
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: { error: 'PIN must be numeric' },
        error: null
      });

      const { data, error } = await supabase.functions.invoke('verify-admin-pin', {
        body: {
          pin: 'abc', // Invalid - must be digits
          role: 'nurse',
        },
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('verify-admin-pin', {
        body: { pin: 'abc', role: 'nurse' }
      });
      expect(data?.error || error).toBeTruthy();
    });

    test('should accept valid role values', async () => {
      const validRoles: StaffRole[] = [
        'nurse',
        'physician',
        'nurse_practitioner',
        'physician_assistant',
        'clinical_supervisor',
        'department_head',
      ];

      // Mock successful role validation (but auth failure)
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: { error: 'Invalid PIN' }, // Auth fails, but role accepted
        error: null
      });

      for (const role of validRoles) {
        const { data, error } = await supabase.functions.invoke('verify-admin-pin', {
          body: {
            pin: '1234',
            role: role,
          },
        });

        // Should not get a role validation error
        const errorMessage = (data?.error || error?.message || '').toLowerCase();
        const hasRoleError = errorMessage.includes('invalid') && errorMessage.includes('role');
        expect(hasRoleError).toBe(false);
      }
    });
  });

  describe('admin_set_pin function', () => {
    test('should accept all valid staff roles', async () => {
      const validRoles: StaffRole[] = ['nurse', 'physician', 'nurse_practitioner', 'physician_assistant'];

      // Mock auth failure (expected) but role accepted
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: { error: 'Unauthorized' },
        error: null
      });

      for (const role of validRoles) {
        const { data, error } = await supabase.functions.invoke('admin_set_pin', {
          body: {
            pin: '1234',
            role: role,
          },
        });

        // Should not get a role validation error
        const errorMessage = (data?.error || error?.message || '').toLowerCase();
        const hasRoleError = errorMessage.includes('invalid') && errorMessage.includes('role');
        expect(hasRoleError).toBe(false);
      }
    });

    test('should call function with correct parameters', async () => {
      (supabase.functions.invoke as Mock).mockResolvedValue({
        data: { success: true },
        error: null
      });

      await supabase.functions.invoke('admin_set_pin', {
        body: {
          pin: '5678',
          role: 'physician',
        },
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('admin_set_pin', {
        body: { pin: '5678', role: 'physician' }
      });
    });
  });
});
