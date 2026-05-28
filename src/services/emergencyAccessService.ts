/**
 * Emergency Access Service — ONC 170.315 (d)(6) "Break-the-Glass"
 *
 * Thin, audited wrapper over the server-side RPCs that record time-limited
 * emergency access to a patient record:
 *   - grant_emergency_access     -> records the grant (reason required), 60m default
 *   - revoke_emergency_access    -> ends a grant early
 *   - has_active_emergency_access-> is there a live grant for this patient now?
 *
 * All authorization, name/IP lookup, tenant isolation, and expiry are enforced
 * in the SECURITY DEFINER functions (see migration 20260528140000). This
 * service does NOT re-implement any of that — it calls the RPC and maps the
 * result into the ServiceResult shape.
 *
 * Supervisor notification: grant returns should_notify_supervisor. Dispatching
 * the notification email requires server-side resolution of tenant-admin
 * addresses (auth.users), so it is handled by a dedicated edge function
 * (notify-emergency-access) — NOT from this client service.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

export interface GrantEmergencyAccessInput {
  patientId: string;
  reason: string;
  explanation?: string;
  /** Minutes until the grant auto-expires. Server clamps to 5..480; default 60. */
  durationMinutes?: number;
}

export interface EmergencyAccessGrant {
  accessId: string;
  accessingUserName: string;
  patientName: string;
  tenantId: string;
  grantedAt: string;
  expiresAt: string;
  durationMinutes: number;
  shouldNotifySupervisor: boolean;
}

interface GrantRpcRow {
  access_id: string;
  accessing_user_name: string;
  patient_name: string;
  tenant_id: string;
  granted_at: string;
  expires_at: string;
  duration_minutes: number;
  should_notify_supervisor: boolean;
}

export const emergencyAccessService = {
  /**
   * Break the glass: record a time-limited emergency-access grant to a patient
   * record. A non-empty reason is required (enforced server-side too).
   */
  async grantAccess(
    input: GrantEmergencyAccessInput
  ): Promise<ServiceResult<EmergencyAccessGrant>> {
    if (!input.reason || input.reason.trim() === '') {
      return failure('VALIDATION_ERROR', 'A reason is required to break the glass');
    }

    try {
      const { data, error } = await supabase.rpc('grant_emergency_access', {
        p_patient_id: input.patientId,
        p_access_reason: input.reason.trim(),
        p_access_explanation: input.explanation?.trim() || null,
        p_duration_minutes: input.durationMinutes ?? 60,
        p_user_agent:
          typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (error) {
        await auditLogger.error(
          'EMERGENCY_ACCESS_GRANT_FAILED',
          new Error(error.message),
          { patientId: input.patientId }
        ).catch(() => {});
        return failure('OPERATION_FAILED', 'Failed to record emergency access');
      }

      const row = (Array.isArray(data) ? data[0] : data) as GrantRpcRow | null;
      if (!row?.access_id) {
        return failure('OPERATION_FAILED', 'Emergency access was not recorded');
      }

      await auditLogger.info('EMERGENCY_ACCESS_GRANTED', {
        accessId: row.access_id,
        patientId: input.patientId,
        expiresAt: row.expires_at,
      }).catch(() => {});

      return success({
        accessId: row.access_id,
        accessingUserName: row.accessing_user_name,
        patientName: row.patient_name,
        tenantId: row.tenant_id,
        grantedAt: row.granted_at,
        expiresAt: row.expires_at,
        durationMinutes: row.duration_minutes,
        shouldNotifySupervisor: row.should_notify_supervisor,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'EMERGENCY_ACCESS_GRANT_EXCEPTION',
        err instanceof Error ? err : new Error(String(err)),
        { patientId: input.patientId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to record emergency access');
    }
  },

  /** End an emergency-access grant early (accessor or a tenant admin). */
  async revokeAccess(accessId: string): Promise<ServiceResult<{ accessId: string }>> {
    try {
      const { error } = await supabase.rpc('revoke_emergency_access', {
        p_access_id: accessId,
      });

      if (error) {
        await auditLogger.error(
          'EMERGENCY_ACCESS_REVOKE_FAILED',
          new Error(error.message),
          { accessId }
        ).catch(() => {});
        return failure('OPERATION_FAILED', 'Failed to revoke emergency access');
      }

      await auditLogger.info('EMERGENCY_ACCESS_REVOKED', { accessId }).catch(() => {});
      return success({ accessId });
    } catch (err: unknown) {
      await auditLogger.error(
        'EMERGENCY_ACCESS_REVOKE_EXCEPTION',
        err instanceof Error ? err : new Error(String(err)),
        { accessId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to revoke emergency access');
    }
  },

  /** Does the current user hold a live (unrevoked, unexpired) grant for this patient? */
  async hasActiveAccess(patientId: string): Promise<ServiceResult<boolean>> {
    try {
      const { data, error } = await supabase.rpc('has_active_emergency_access', {
        p_patient_id: patientId,
      });

      if (error) {
        await auditLogger.error(
          'EMERGENCY_ACCESS_CHECK_FAILED',
          new Error(error.message),
          { patientId }
        ).catch(() => {});
        return failure('OPERATION_FAILED', 'Failed to check emergency access');
      }

      return success(data === true);
    } catch (err: unknown) {
      await auditLogger.error(
        'EMERGENCY_ACCESS_CHECK_EXCEPTION',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      ).catch(() => {});
      return failure('UNKNOWN_ERROR', 'Failed to check emergency access');
    }
  },
};
