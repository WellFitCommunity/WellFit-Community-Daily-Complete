/**
 * MFA Enrollment Service
 *
 * Manages MFA enrollment status, compliance reporting,
 * and exemption workflows for admin/clinical roles.
 *
 * Uses user_roles as authoritative role source (per CLAUDE.md).
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
import type {
  MfaEnrollmentStatus,
  MfaComplianceRow,
} from './mfaEnrollmentService.types';

/**
 * Get MFA enrollment status for a user via RPC
 */
export async function getMfaStatus(
  userId: string
): Promise<ServiceResult<MfaEnrollmentStatus>> {
  try {
    const { data, error } = await supabase.rpc('get_mfa_enrollment_status', {
      p_user_id: userId,
    });

    if (error) {
      await auditLogger.error('MFA_STATUS_FETCH_FAILED', error, { userId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    if (!data) {
      return failure('NOT_FOUND', 'No MFA enrollment status found');
    }

    return success(data as MfaEnrollmentStatus);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MFA_STATUS_FETCH_FAILED', error, { userId });
    return failure('UNKNOWN_ERROR', 'Failed to fetch MFA status', err);
  }
}

/**
 * Update MFA enabled status after TOTP setup
 */
export async function updateMfaEnabled(
  userId: string,
  enabled: boolean,
  method: 'totp' | null = 'totp'
): Promise<ServiceResult<void>> {
  try {
    const { error } = await supabase
      .from('mfa_enrollment')
      .update({
        mfa_enabled: enabled,
        mfa_method: method,
        enrollment_date: enabled ? new Date().toISOString() : null,
        enforcement_status: enabled ? 'enforced' : 'grace_period',
        last_verified: enabled ? new Date().toISOString() : null,
      })
      .eq('user_id', userId);

    if (error) {
      await auditLogger.error('MFA_UPDATE_FAILED', error, { userId, enabled });
      return failure('DATABASE_ERROR', error.message, error);
    }

    await auditLogger.info('MFA_ENROLLMENT_UPDATED', {
      userId,
      enabled,
      method,
    });

    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MFA_UPDATE_FAILED', error, { userId });
    return failure('UNKNOWN_ERROR', 'Failed to update MFA status', err);
  }
}

/**
 * Get MFA compliance report for admin dashboard
 */
export async function getMfaComplianceReport(): Promise<
  ServiceResult<MfaComplianceRow[]>
> {
  try {
    const { data, error } = await supabase
      .from('mfa_compliance_report')
      .select('*');

    if (error) {
      await auditLogger.error('MFA_COMPLIANCE_FETCH_FAILED', error);
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success((data || []) as MfaComplianceRow[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MFA_COMPLIANCE_FETCH_FAILED', error);
    return failure('UNKNOWN_ERROR', 'Failed to fetch compliance report', err);
  }
}

/**
 * Grant MFA exemption via RPC (super admin only)
 */
export async function grantExemption(
  userId: string,
  reason: string
): Promise<ServiceResult<void>> {
  try {
    const { data, error } = await supabase.rpc('grant_mfa_exemption', {
      p_user_id: userId,
      p_reason: reason,
    });

    if (error) {
      await auditLogger.error('MFA_EXEMPTION_FAILED', error, { userId });
      return failure('DATABASE_ERROR', error.message, error);
    }

    const result = data as { success: boolean; error?: string };
    if (!result?.success) {
      return failure('FORBIDDEN', result?.error || 'Exemption denied');
    }

    await auditLogger.info('MFA_EXEMPTION_GRANTED', { userId, reason });
    return success(undefined);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MFA_EXEMPTION_FAILED', error, { userId });
    return failure('UNKNOWN_ERROR', 'Failed to grant exemption', err);
  }
}
