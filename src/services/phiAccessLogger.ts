/**
 * PHI Access Logger
 * HIPAA §164.312(b) Compliance - Audit Controls
 *
 * Logs all PHI access to phi_access_log table via log_phi_access() RPC function
 */

import { supabase } from '../lib/supabaseClient';
import { errorReporter } from './errorReporter';

export type PHIType =
  | 'patient_record'
  | 'encounter'
  | 'medication'
  | 'lab_result'
  | 'diagnosis'
  | 'procedure'
  | 'vital_signs'
  | 'wearable_data'
  | 'assessment'
  | 'care_plan'
  | 'handoff'
  | 'billing'
  | 'insurance'
  | 'communication_metrics'
  | 'readmission_risk'
  | 'enrollment';

export type AccessType =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print';

export type AccessMethod =
  | 'UI'
  | 'API'
  | 'BULK_EXPORT'
  | 'REPORT';

export type AccessPurpose =
  | 'treatment'
  | 'payment'
  | 'operations'
  | 'patient_request'
  | 'legal_requirement';

export interface LogPHIAccessParams {
  phiType: PHIType;
  phiResourceId: string;
  patientId: string;
  accessType: AccessType;
  accessMethod?: AccessMethod;
  purpose?: AccessPurpose;
}

/**
 * Log PHI access for HIPAA compliance — FAIL CLOSED (§164.312(b))
 *
 * Skips silently only for unauthenticated users (guest surfaces carry no
 * authenticated PHI scope). For authenticated users, a failed log write
 * REPORTS CRITICAL AND THROWS: a PHI operation that cannot be audited must
 * not proceed. This mirrors the CHW module's audit gate (chwService). The
 * previous swallow-and-continue behavior is how a broken RPC signature went
 * unnoticed for months while zero rows were written (2026-07-25 audit,
 * finding 1). Callers already wrap in try/catch → ServiceResult failure.
 */
export async function logPhiAccess({
  phiType,
  phiResourceId,
  patientId,
  accessType,
  accessMethod = 'UI',
  purpose = 'treatment',
}: LogPHIAccessParams): Promise<void> {
  // Get current user - unauthenticated callers skip logging (guest access)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return;
  }

  // Get user's role from profiles (best-effort; identity itself is enforced
  // server-side — the RPC rejects any accessor that is not auth.uid())
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('user_id', user.id)
    .single();

  const role = profile?.is_admin ? 'admin' : (profile?.role || 'user');

  // Nine-argument log_phi_access RPC → public.phi_access_log
  // (restored by migration 20260725100000; writer shape pinned in tests)
  const { error } = await supabase.rpc('log_phi_access', {
    p_accessor_user_id: user.id,
    p_accessor_role: role,
    p_phi_type: phiType,
    p_phi_resource_id: phiResourceId,
    p_patient_id: patientId,
    p_access_type: accessType,
    p_access_method: accessMethod,
    p_purpose: purpose,
    p_ip_address: null, // Frontend doesn't have reliable IP access; RPC falls back to x-forwarded-for
  });

  if (error) {
    // CRITICAL: PHI access logging failed - HIPAA compliance issue
    errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', error.message, {
      phiType,
      patientId,
      accessType,
      userId: user.id,
      errorCode: error.code,
    });
    throw new Error('Audit logging failed. Cannot proceed with PHI operation for compliance reasons.');
  }
}

/**
 * Log bulk PHI access (e.g., viewing patient list)
 * FAIL CLOSED — each individual log failure propagates (see logPhiAccess).
 */
export async function logBulkPhiAccess(
  phiType: PHIType,
  patientIds: string[],
  accessType: AccessType,
  accessMethod: AccessMethod = 'UI',
  purpose: AccessPurpose = 'treatment'
): Promise<void> {
  // Log up to 50 individual accesses (prevent overwhelming the log)
  const idsToLog = patientIds.slice(0, 50);

  await Promise.all(
    idsToLog.map((patientId) =>
      logPhiAccess({
        phiType,
        phiResourceId: patientId,
        patientId,
        accessType,
        accessMethod,
        purpose,
      })
    )
  );

  // If more than 50, log a summary to audit_logs (fail closed on error)
  if (patientIds.length > 50) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('audit_logs').insert({
      event_type: 'BULK_PHI_ACCESS',
      event_category: 'DATA_ACCESS',
      actor_user_id: user.id,
      operation: 'VIEW',
      resource_type: phiType,
      success: true,
      metadata: {
        patient_count: patientIds.length,
        logged_count: idsToLog.length,
        access_method: accessMethod,
        purpose,
      },
    });

    if (error) {
      // CRITICAL: Bulk PHI access logging failed - HIPAA compliance issue
      errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', new Error(error.message), {
        phiType,
        patientCount: patientIds.length,
        accessMethod,
        context: 'Bulk PHI access summary',
      });
      throw new Error('Audit logging failed. Cannot proceed with PHI operation for compliance reasons.');
    }
  }
}

/**
 * Resource shape that may contain a patient ID
 */
interface PatientResource {
  patient_id?: string;
  patientId?: string;
  patient?: { id?: string };
  user_id?: string;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Helper to extract patient ID from encounter/resource
 */
export function extractPatientId(resource: PatientResource): string | null {
  if (resource.patient_id) return resource.patient_id;
  if (resource.patientId) return resource.patientId;
  if (resource.patient?.id) return resource.patient.id;
  if (resource.user_id) return resource.user_id; // For patient self-access
  return null;
}
