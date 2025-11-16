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
  | 'insurance';

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
 * Log PHI access for HIPAA compliance
 * Silently fails if user not authenticated (allows guest access without breaking)
 */
export async function logPhiAccess({
  phiType,
  phiResourceId,
  patientId,
  accessType,
  accessMethod = 'UI',
  purpose = 'treatment',
}: LogPHIAccessParams): Promise<void> {
  try {
    // Get current user and role
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Not logged in - skip logging (allows public/guest access)
      return;
    }

    // Get user's role from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('user_id', user.id)
      .single();

    const role = profile?.is_admin ? 'admin' : (profile?.role || 'user');

    // Call log_phi_access RPC function
    const { error } = await supabase.rpc('log_phi_access', {
      p_accessor_user_id: user.id,
      p_accessor_role: role,
      p_phi_type: phiType,
      p_phi_resource_id: phiResourceId,
      p_patient_id: patientId,
      p_access_type: accessType,
      p_access_method: accessMethod,
      p_purpose: purpose,
      p_ip_address: null, // Frontend doesn't have reliable IP access
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
    }
  } catch (err) {
    // CRITICAL: PHI access logging failed - HIPAA compliance issue
    // Don't break user experience, but DO report the error
    errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', err as Error, {
      phiType,
      patientId,
      accessType,
      context: 'Exception during PHI logging',
    });
  }
}

/**
 * Log bulk PHI access (e.g., viewing patient list)
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

  // If more than 50, log a summary to audit_logs
  if (patientIds.length > 50) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('audit_logs').insert({
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
    } catch (err) {
      // CRITICAL: Bulk PHI access logging failed - HIPAA compliance issue
      errorReporter.reportCritical('PHI_ACCESS_LOG_FAILURE', err as Error, {
        phiType,
        patientCount: patientIds.length,
        accessMethod,
        context: 'Bulk PHI access summary',
      });
    }
  }
}

/**
 * Helper to extract patient ID from encounter/resource
 */
export function extractPatientId(resource: any): string | null {
  if (resource.patient_id) return resource.patient_id;
  if (resource.patientId) return resource.patientId;
  if (resource.patient?.id) return resource.patient.id;
  if (resource.user_id) return resource.user_id; // For patient self-access
  return null;
}
