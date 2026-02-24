/**
 * User Role Management Service
 *
 * CRUD operations for staff role assignments within a tenant.
 * Enforces role hierarchy — admins can only assign roles within their scope.
 * All mutations are audit-logged per HIPAA § 164.312(b).
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import {
  StaffRole,
  ROLE_HIERARCHY,
  ROLE_DISPLAY_NAMES,
  ROLE_TO_CODE,
  type Department,
} from '../types/roles';

// ============================================================================
// Types
// ============================================================================

export interface StaffUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: StaffRole | null;
  role_code: number | null;
  department: Department;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface RoleChangeRequest {
  user_id: string;
  new_role: StaffRole;
  department?: Department;
  reason: string;
}

interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
  role_code: number | null;
  department: string | null;
  is_active: boolean | null;
  created_at: string;
  last_sign_in_at: string | null;
}

// Synonym roles that should not appear in assignment UI
const SYNONYM_ROLES: StaffRole[] = ['doctor', 'chw', 'pt'];

// Non-staff roles excluded from management
const NON_STAFF_ROLES: string[] = ['patient', 'senior', 'volunteer', 'caregiver', 'staff'];

// ============================================================================
// Service
// ============================================================================

export const userRoleManagementService = {
  /**
   * Get all staff users within the current tenant
   */
  async getStaffUsers(): Promise<ServiceResult<StaffUser[]>> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return failure('SESSION_EXPIRED', 'No active session');

      // Query profiles for staff users (exclude patients/volunteers/caregivers)
      // RLS ensures tenant scoping automatically
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, role, role_code, department, is_active, created_at, last_sign_in_at')
        .not('role', 'in', `(${NON_STAFF_ROLES.join(',')})`)
        .order('last_name', { ascending: true });

      if (error) {
        await auditLogger.error('STAFF_LIST_FETCH_FAILED',
          new Error(error.message),
          { code: error.code }
        ).catch(() => {});
        return failure('DATABASE_ERROR', 'Failed to load staff list');
      }

      const rows = (data || []) as ProfileRow[];
      const staffUsers: StaffUser[] = rows.map(row => ({
        user_id: row.user_id,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        email: row.email || '',
        role: (row.role as StaffRole) || null,
        role_code: row.role_code,
        department: (row.department as Department) || null,
        is_active: row.is_active ?? true,
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at || null,
      }));

      return success(staffUsers);
    } catch (err: unknown) {
      await auditLogger.error('STAFF_LIST_FETCH_EXCEPTION',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to load staff list');
    }
  },

  /**
   * Get roles that the current admin is allowed to assign
   * Based on ROLE_HIERARCHY — admins can only assign roles within their scope
   */
  getAssignableRoles(adminRole: StaffRole): StaffRole[] {
    const hierarchy = ROLE_HIERARCHY[adminRole] || [];
    // Filter out synonym roles and the admin's own role
    return hierarchy.filter(
      role => !SYNONYM_ROLES.includes(role) && role !== adminRole
    );
  },

  /**
   * Get display-friendly role options for a dropdown
   */
  getAssignableRoleOptions(adminRole: StaffRole): Array<{ value: StaffRole; label: string }> {
    return this.getAssignableRoles(adminRole).map(role => ({
      value: role,
      label: ROLE_DISPLAY_NAMES[role] || role,
    }));
  },

  /**
   * Assign or change a user's role
   * Validates hierarchy, updates profiles + user_roles, audit logs the change
   */
  async assignRole(
    request: RoleChangeRequest,
    adminRole: StaffRole,
    adminUserId: string
  ): Promise<ServiceResult<StaffUser>> {
    try {
      const { user_id, new_role, department, reason } = request;

      // Validate hierarchy — admin can only assign roles within their scope
      const assignable = ROLE_HIERARCHY[adminRole] || [];
      if (!assignable.includes(new_role)) {
        return failure('FORBIDDEN', `Your role (${ROLE_DISPLAY_NAMES[adminRole]}) cannot assign ${ROLE_DISPLAY_NAMES[new_role]}`);
      }

      // Cannot modify your own role
      if (user_id === adminUserId) {
        return failure('FORBIDDEN', 'You cannot modify your own role assignment');
      }

      // Get current role for audit trail
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role, role_code, first_name, last_name')
        .eq('user_id', user_id)
        .maybeSingle();

      const previousRole = currentProfile?.role || 'none';
      const roleCode = ROLE_TO_CODE[new_role] ?? null;

      // Update profiles table (primary user record)
      const updatePayload: Record<string, unknown> = {
        role: new_role,
        role_code: roleCode,
      };
      if (department !== undefined) {
        updatePayload.department = department;
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', user_id);

      if (profileErr) {
        await auditLogger.error('ROLE_ASSIGN_PROFILE_UPDATE_FAILED',
          new Error(profileErr.message),
          { user_id, new_role, code: profileErr.code }
        ).catch(() => {});
        return failure('DATABASE_ERROR', 'Failed to update user profile');
      }

      // Upsert user_roles table (authoritative role source)
      const { error: roleErr } = await supabase
        .from('user_roles')
        .upsert(
          { user_id, role: new_role },
          { onConflict: 'user_id' }
        );

      if (roleErr) {
        // Log but don't fail — profiles update is the critical path
        await auditLogger.error('ROLE_ASSIGN_USER_ROLES_UPSERT_FAILED',
          new Error(roleErr.message),
          { user_id, new_role, code: roleErr.code }
        ).catch(() => {});
      }

      // Audit log the role change
      await auditLogger.info('USER_ROLE_CHANGED', {
        targetUserId: user_id,
        targetUserName: `${currentProfile?.first_name || ''} ${currentProfile?.last_name || ''}`.trim(),
        previousRole,
        newRole: new_role,
        department: department || null,
        reason,
        changedBy: adminUserId,
        changedByRole: adminRole,
      }).catch(() => {});

      // Return updated user
      const { data: updated } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email, role, role_code, department, is_active, created_at, last_sign_in_at')
        .eq('user_id', user_id)
        .maybeSingle();

      const row = updated as ProfileRow | null;
      if (!row) return failure('NOT_FOUND', 'User not found after update');

      return success({
        user_id: row.user_id,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        email: row.email || '',
        role: (row.role as StaffRole) || null,
        role_code: row.role_code,
        department: (row.department as Department) || null,
        is_active: row.is_active ?? true,
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at || null,
      });
    } catch (err: unknown) {
      await auditLogger.error('ROLE_ASSIGN_EXCEPTION',
        err instanceof Error ? err : new Error(String(err)),
        { userId: request.user_id, newRole: request.new_role }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to assign role');
    }
  },

  /**
   * Revoke a user's staff role (reset to basic 'admin' or remove)
   */
  async revokeRole(
    userId: string,
    reason: string,
    adminRole: StaffRole,
    adminUserId: string
  ): Promise<ServiceResult<boolean>> {
    try {
      // Cannot revoke your own role
      if (userId === adminUserId) {
        return failure('FORBIDDEN', 'You cannot revoke your own role');
      }

      // Get current role for audit + hierarchy check
      const { data: current } = await supabase
        .from('profiles')
        .select('role, first_name, last_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (!current) return failure('NOT_FOUND', 'User not found');

      const currentRole = current.role as StaffRole | null;
      if (currentRole) {
        // Validate hierarchy — can only revoke roles within your scope
        const assignable = ROLE_HIERARCHY[adminRole] || [];
        if (!assignable.includes(currentRole)) {
          return failure('FORBIDDEN', `Your role cannot revoke ${ROLE_DISPLAY_NAMES[currentRole] || currentRole}`);
        }
      }

      // Remove from user_roles
      const { error: roleErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (roleErr) {
        await auditLogger.error('ROLE_REVOKE_DELETE_FAILED',
          new Error(roleErr.message),
          { userId, code: roleErr.code }
        ).catch(() => {});
      }

      // Clear role from profiles
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: null, role_code: null })
        .eq('user_id', userId);

      if (profileErr) {
        return failure('DATABASE_ERROR', 'Failed to clear user role');
      }

      // Audit log
      await auditLogger.info('USER_ROLE_REVOKED', {
        targetUserId: userId,
        targetUserName: `${current.first_name || ''} ${current.last_name || ''}`.trim(),
        previousRole: currentRole || 'none',
        reason,
        revokedBy: adminUserId,
        revokedByRole: adminRole,
      }).catch(() => {});

      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('ROLE_REVOKE_EXCEPTION',
        err instanceof Error ? err : new Error(String(err)),
        { userId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to revoke role');
    }
  },
};
