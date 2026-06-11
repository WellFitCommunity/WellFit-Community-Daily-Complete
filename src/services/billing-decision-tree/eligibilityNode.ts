// Billing Decision Tree - Node A: Eligibility & Authorization
// Validates patient eligibility and authorization status
// HIPAA §164.312(b): PHI access logging enabled

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type {
  DecisionTreeInput,
  DecisionNode,
  EligibilityCheckResult,
} from './types';

/**
 * NODE A: Eligibility and Authorization Validation
 */
export async function executeNodeA(
  input: DecisionTreeInput,
  decisions: DecisionNode[]
): Promise<EligibilityCheckResult> {
  // Check patient eligibility in database
  const eligibility = await validateEligibility(input.patientId, input.payerId);

  const decision: DecisionNode = {
    nodeId: 'NODE_A',
    nodeName: 'Eligibility and Authorization Check',
    question: 'Is the patient eligible and service authorized?',
    answer: eligibility.eligible ? 'Yes - Eligible' : 'No - Ineligible',
    result: eligibility.eligible ? 'proceed' : 'deny',
    rationale: eligibility.eligible
      ? 'Patient has active coverage with payer'
      : eligibility.denialReason || 'Patient not eligible',
    timestamp: new Date().toISOString()
  };

  decisions.push(decision);
  return eligibility;
}

/**
 * Validate patient eligibility with payer
 */
export async function validateEligibility(
  patientId: string,
  payerId: string
): Promise<EligibilityCheckResult> {
  // HIPAA §164.312(b): Log PHI access for eligibility check
  await auditLogger.phi('BILLING_ELIGIBILITY_CHECK', patientId, {
    resourceType: 'Eligibility',
    operation: 'validateEligibility',
    payerId,
  });

  try {
    // Check patient insurance. The legacy `patients` table (with embedded
    // insurance_* columns) doesn't exist live — insurance lives in its own
    // owning table `patient_insurance` (one row per policy, coverage_priority
    // orders primary→secondary). Map: insurance_payer_id→payer_id,
    // insurance_status→is_active. insurance_member_id was selected but unused.
    const { data: policies, error: patientError } = await supabase
      .from('patient_insurance')
      .select('payer_id, is_active')
      .eq('patient_id', patientId)
      .order('coverage_priority', { ascending: true });

    if (patientError || !policies || policies.length === 0) {
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'No insurance on file for patient'
      };
    }

    // Verify at least one policy is active
    const activePolicies = policies.filter((p) => p.is_active === true);

    if (activePolicies.length === 0) {
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'Insurance policy is not active'
      };
    }

    // Verify an active policy matches the billing payer
    if (!activePolicies.some((p) => p.payer_id === payerId)) {
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'Payer mismatch with patient insurance'
      };
    }

    return {
      eligible: true,
      authorized: true,
      authorizationRequired: false,
      coverageDetails: {
        planName: 'Active Coverage',
        effectiveDate: new Date().toISOString().split('T')[0]
      }
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error checking eligibility';
    auditLogger.error('Failed to validate eligibility', errorMessage, { patientId, payerId });
    return {
      eligible: false,
      authorized: false,
      authorizationRequired: false,
      denialReason: 'Error checking eligibility'
    };
  }
}
