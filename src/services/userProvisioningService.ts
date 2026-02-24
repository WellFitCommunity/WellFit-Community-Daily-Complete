/**
 * User Provisioning Service
 *
 * Wraps the admin_register edge function for creating users from the admin panel.
 * Also queries pending_registrations for invitation management.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import type {
  InviteUserInput,
  InviteUserResult,
  PendingRegistration,
  ProvisioningRole,
} from '../components/admin/user-provisioning/types';

// ============================================================================
// Role mapping — aligned with admin_register edge function
// ============================================================================

/**
 * Roles supported by the admin_register edge function.
 * Note: Clinical roles (nurse_practitioner, pharmacist, etc.) are not in this set.
 * After creating a user, use UserRoleManagementPanel to assign a clinical role.
 */
export const PROVISIONING_ROLES: ProvisioningRole[] = [
  { code: 1, slug: 'admin', label: 'Administrator', level: 'elevated' },
  { code: 2, slug: 'super_admin', label: 'Platform Administrator', level: 'elevated' },
  { code: 3, slug: 'staff', label: 'Clinical Staff (Nurse)', level: 'elevated' },
  { code: 5, slug: 'volunteer', label: 'Volunteer', level: 'public' },
  { code: 6, slug: 'caregiver', label: 'Caregiver', level: 'public' },
  { code: 12, slug: 'nurse_admin', label: 'Nurse Administrator', level: 'elevated' },
  { code: 14, slug: 'moderator', label: 'Moderator', level: 'elevated' },
  { code: 4, slug: 'senior', label: 'Patient / Senior', level: 'public' },
  { code: 13, slug: 'regular', label: 'Community Member', level: 'public' },
];

interface PendingRow {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string;
  last_name: string;
  role_code: number | null;
  role_slug: string | null;
  hcaptcha_verified: boolean;
  verification_code_sent: boolean;
  created_at: string;
  expires_at: string | null;
}

// ============================================================================
// Service
// ============================================================================

export const userProvisioningService = {
  /**
   * Create a new user via admin_register edge function
   */
  async inviteUser(input: InviteUserInput): Promise<ServiceResult<InviteUserResult>> {
    try {
      const { data, error } = await supabase.functions.invoke('admin_register', {
        body: {
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email || undefined,
          phone: input.phone || undefined,
          role_code: input.role_code,
          delivery: input.delivery,
        },
      });

      if (error) {
        await auditLogger.error('USER_INVITE_FAILED',
          new Error(error.message),
          { email: input.email, role_code: input.role_code }
        ).catch(() => {});
        return failure('OPERATION_FAILED', error.message || 'Failed to create user');
      }

      if (!data?.success) {
        const msg = data?.error || 'User creation failed';
        return failure('OPERATION_FAILED', msg);
      }

      await auditLogger.info('USER_INVITED', {
        userId: data.user_id,
        email: input.email,
        roleCode: input.role_code,
        roleSlug: data.role_slug,
        delivery: input.delivery,
      }).catch(() => {});

      return success(data as InviteUserResult);
    } catch (err: unknown) {
      await auditLogger.error('USER_INVITE_EXCEPTION',
        err instanceof Error ? err : new Error(String(err)),
        { email: input.email }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to invite user');
    }
  },

  /**
   * Get pending registrations (users who started signup but haven't completed verification)
   */
  async getPendingRegistrations(): Promise<ServiceResult<PendingRegistration[]>> {
    try {
      const { data, error } = await supabase
        .from('pending_registrations')
        .select('id, phone, email, first_name, last_name, role_code, role_slug, hcaptcha_verified, verification_code_sent, created_at, expires_at')
        .order('created_at', { ascending: false });

      if (error) {
        // RLS may block access — pending_registrations is service_role only
        // Return empty array gracefully
        if (error.code === '42501' || error.message?.includes('permission')) {
          return success([]);
        }
        return failure('DATABASE_ERROR', 'Failed to load pending registrations');
      }

      const rows = (data || []) as PendingRow[];
      return success(rows.map(row => ({
        id: row.id,
        phone: row.phone,
        email: row.email,
        first_name: row.first_name,
        last_name: row.last_name,
        role_code: row.role_code,
        role_slug: row.role_slug,
        hcaptcha_verified: row.hcaptcha_verified ?? false,
        verification_code_sent: row.verification_code_sent ?? false,
        created_at: row.created_at,
        expires_at: row.expires_at,
      })));
    } catch (err: unknown) {
      await auditLogger.error('PENDING_REGISTRATIONS_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err))
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to load pending registrations');
    }
  },

  /**
   * Delete a pending registration
   */
  async deletePendingRegistration(id: string): Promise<ServiceResult<boolean>> {
    try {
      const { error } = await supabase
        .from('pending_registrations')
        .delete()
        .eq('id', id);

      if (error) {
        return failure('DATABASE_ERROR', 'Failed to delete pending registration');
      }

      await auditLogger.info('PENDING_REGISTRATION_DELETED', { registrationId: id }).catch(() => {});
      return success(true);
    } catch (err: unknown) {
      await auditLogger.error('PENDING_REGISTRATION_DELETE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { registrationId: id }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to delete pending registration');
    }
  },

  /**
   * Get available provisioning roles
   */
  getRoles(): ProvisioningRole[] {
    return PROVISIONING_ROLES;
  },
};
