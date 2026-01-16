/**
 * usePhiAccessLogging - HIPAA §164.312(b) PHI Access Audit Hook
 *
 * Provides automatic PHI access logging for patient-facing components.
 * Logs to audit_logs table via log_phi_access RPC function.
 *
 * HIPAA COMPLIANCE:
 * - Logs who accessed what patient data and when
 * - Captures access type (VIEW, EDIT, DELETE, EXPORT)
 * - Records additional context metadata
 * - Silent failure to prevent blocking UI
 *
 * Usage:
 * ```tsx
 * const MyComponent = ({ patientId }) => {
 *   usePhiAccessLogging({
 *     resourceType: 'patient_dashboard',
 *     resourceId: patientId,
 *     action: 'VIEW'
 *   });
 *   // Component renders...
 * };
 * ```
 *
 * @module usePhiAccessLogging
 */

import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export type PhiAccessAction = 'VIEW' | 'EDIT' | 'CREATE' | 'DELETE' | 'EXPORT' | 'PRINT';

export interface PhiAccessLogOptions {
  /** Type of PHI resource being accessed */
  resourceType: string;
  /** UUID of the resource (usually patient_id) */
  resourceId: string | null | undefined;
  /** Access action type */
  action?: PhiAccessAction;
  /** Optional additional metadata (no PHI!) */
  metadata?: Record<string, unknown>;
  /** Skip logging (useful for conditional access) */
  skip?: boolean;
}

/**
 * Hook to log PHI access on component mount
 *
 * IMPORTANT: Only logs once per mount. Re-logging requires remount or
 * calling logPhiAccess manually.
 */
export function usePhiAccessLogging(options: PhiAccessLogOptions): void {
  const { resourceType, resourceId, action = 'VIEW', metadata = {}, skip = false } = options;
  const loggedRef = useRef(false);

  useEffect(() => {
    // Skip if no resource ID or already logged or skip flag
    if (!resourceId || loggedRef.current || skip) {
      return;
    }

    const logAccess = async () => {
      try {
        await supabase.rpc('log_phi_access', {
          p_resource_type: resourceType,
          p_resource_id: resourceId,
          p_action: action,
          p_metadata: metadata,
        });
        loggedRef.current = true;
      } catch {
        // Silent failure - PHI logging should never block UI
        // The audit system will detect gaps during compliance audits
      }
    };

    logAccess();
  }, [resourceId, resourceType, action, metadata, skip]);
}

/**
 * Manual PHI access logging function
 *
 * Use this for:
 * - EDIT actions (log after successful save)
 * - DELETE actions (log before deletion)
 * - EXPORT actions (log when export starts)
 * - Multiple resources in one view
 */
export async function logPhiAccess(options: PhiAccessLogOptions): Promise<string | null> {
  const { resourceType, resourceId, action = 'VIEW', metadata = {}, skip = false } = options;

  if (!resourceId || skip) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('log_phi_access', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_action: action,
      p_metadata: metadata,
    });

    if (error) {
      // Silent failure
      return null;
    }

    return data as string;
  } catch {
    // Silent failure
    return null;
  }
}

/**
 * PHI Resource Types for consistent logging
 *
 * Use these constants for the resourceType parameter to ensure
 * consistent naming across the application.
 */
export const PHI_RESOURCE_TYPES = {
  // Patient-level resources
  PATIENT_DASHBOARD: 'patient_dashboard',
  PATIENT_PROFILE: 'patient_profile',
  PATIENT_SUMMARY: 'patient_summary',

  // Clinical data
  OBSERVATION: 'observation',
  OBSERVATION_HISTORY: 'observation_history',
  MEDICATION: 'medication',
  MEDICATION_LIST: 'medication_list',
  CONDITION: 'condition',
  CONDITION_LIST: 'condition_list',
  ALLERGY: 'allergy',
  ALLERGY_LIST: 'allergy_list',
  IMMUNIZATION: 'immunization',
  IMMUNIZATION_LIST: 'immunization_list',
  CARE_PLAN: 'care_plan',
  CARE_PLAN_LIST: 'care_plan_list',

  // Encounters and visits
  ENCOUNTER: 'encounter',
  ENCOUNTER_HISTORY: 'encounter_history',

  // Documents
  CLINICAL_DOCUMENT: 'clinical_document',
  LAB_RESULT: 'lab_result',
  IMAGING_REPORT: 'imaging_report',

  // Billing (PHI-adjacent)
  CLAIM: 'claim',
  PRIOR_AUTH: 'prior_authorization',

  // Practitioner viewing patient
  PRACTITIONER_PATIENT_VIEW: 'practitioner_patient_view',
} as const;

export type PhiResourceType = (typeof PHI_RESOURCE_TYPES)[keyof typeof PHI_RESOURCE_TYPES];

export default usePhiAccessLogging;
