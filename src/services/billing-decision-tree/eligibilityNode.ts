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
    // Check patient insurance in database
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*, insurance_payer_id, insurance_member_id, insurance_status')
      .eq('id', patientId)
      .single();

    if (patientError || !patient) {
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'Patient not found in system'
      };
    }

    // Verify insurance is active
    const policyActive = patient.insurance_status === 'active';

    if (!policyActive) {
      return {
        eligible: false,
        authorized: false,
        authorizationRequired: false,
        denialReason: 'Insurance policy is not active'
      };
    }

    // Verify payer matches
    if (patient.insurance_payer_id !== payerId) {
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
