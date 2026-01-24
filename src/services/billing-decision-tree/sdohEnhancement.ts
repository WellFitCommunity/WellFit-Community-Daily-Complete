// Billing Decision Tree - SDOH Enhancement
// Enhances decision tree results with SDOH-specific codes and CCM recommendations
// HIPAA §164.312(b): PHI access logging enabled

import { auditLogger } from '../auditLogger';
import { SDOHBillingService } from '../sdohBillingService';
import type { DecisionTreeResult } from './types';

/**
 * Integration with SDOH Billing Service
 * Enhances decision tree results with SDOH-specific codes and CCM recommendations
 */
export async function enhanceWithSDOH(
  result: DecisionTreeResult,
  patientId: string
): Promise<DecisionTreeResult> {
  if (!result.success || !result.claimLine) {
    return result;
  }

  // HIPAA §164.312(b): Log PHI access for SDOH assessment
  await auditLogger.phi('BILLING_SDOH_ENHANCEMENT', patientId, {
    resourceType: 'SDOHAssessment',
    operation: 'enhanceWithSDOH',
  });

  try {
    // Get SDOH assessment
    const sdohAssessment = await SDOHBillingService.assessSDOHComplexity(patientId);

    // Add SDOH Z-codes to diagnosis list
    const sdohCodes: string[] = [];

    if (sdohAssessment.housingInstability) {
      sdohCodes.push(sdohAssessment.housingInstability.zCode);
    }
    if (sdohAssessment.foodInsecurity) {
      sdohCodes.push(sdohAssessment.foodInsecurity.zCode);
    }
    if (sdohAssessment.transportationBarriers) {
      sdohCodes.push(sdohAssessment.transportationBarriers.zCode);
    }
    if (sdohAssessment.socialIsolation) {
      sdohCodes.push(sdohAssessment.socialIsolation.zCode);
    }
    if (sdohAssessment.financialInsecurity) {
      sdohCodes.push(sdohAssessment.financialInsecurity.zCode);
    }

    // Enhanced claim line with SDOH codes
    result.claimLine.icd10Codes = [...result.claimLine.icd10Codes, ...sdohCodes];

    // Add CCM code if eligible
    if (sdohAssessment.ccmEligible) {
      result.warnings.push({
        severity: 'info',
        code: 'CCM_ELIGIBLE',
        message: `Patient eligible for ${sdohAssessment.ccmTier} CCM services`,
        suggestion: 'Consider adding CCM codes if time requirements are met'
      });
    }

    return result;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'SDOH enhancement failed';
    auditLogger.error('Failed to enhance with SDOH', errorMessage, { patientId });
    // If SDOH enhancement fails, return original result
    return result;
  }
}
