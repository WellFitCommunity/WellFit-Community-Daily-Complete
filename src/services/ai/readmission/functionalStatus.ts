/**
 * Functional Status Extraction Module
 *
 * Extracts functional status risk indicators:
 * - ADL (Activities of Daily Living) dependencies
 * - Cognitive impairment
 * - Fall history and risk
 * - Mobility level
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/functionalStatus
 */

import { supabase } from '../../../lib/supabaseClient';
import type { FunctionalStatus } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import { COGNITIVE_THRESHOLDS } from '../readmissionModelConfig';
import {
  isRecord,
  categorizeCognitiveSeverity,
  categorizeMobility,
  calculateFallRiskScore,
  getDaysAgoISO
} from './utils';

// =====================================================
// TYPES
// =====================================================

interface AdlAssessment {
  adlDependencies: number;
  needsHelpBathing: boolean;
  needsHelpDressing: boolean;
  needsHelpToileting: boolean;
  needsHelpEating: boolean;
  needsHelpTransferring: boolean;
  needsHelpWalking: boolean;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract ADL dependencies from risk assessment
 *
 * Checks these specific fields for 'needs_help' or 'dependent' keywords:
 * - bathing_ability
 * - walking_ability
 * - toilet_transfer
 * - meal_preparation
 * - medication_management
 */
function extractAdlAssessment(riskAssessment: unknown): AdlAssessment {
  const adlFields = [
    'bathing_ability',
    'walking_ability',
    'toilet_transfer',
    'meal_preparation',
    'medication_management'
  ];

  let adlDependencies = 0;
  adlFields.forEach(field => {
    const value = isRecord(riskAssessment) ? (riskAssessment[field] as unknown) : undefined;
    if (typeof value === 'string' && (value.includes('needs_help') || value.includes('dependent'))) {
      adlDependencies++;
    }
  });

  return {
    adlDependencies,
    needsHelpBathing: (isRecord(riskAssessment) && typeof riskAssessment['bathing_ability'] === 'string')
      ? (riskAssessment['bathing_ability'] as string).includes('needs_help')
      : false,
    needsHelpDressing: (isRecord(riskAssessment) && typeof riskAssessment['dressing_ability'] === 'string')
      ? (riskAssessment['dressing_ability'] as string).includes('needs_help')
      : false,
    needsHelpToileting: (isRecord(riskAssessment) && typeof riskAssessment['toilet_transfer'] === 'string')
      ? (riskAssessment['toilet_transfer'] as string).includes('needs_help')
      : false,
    needsHelpEating: (isRecord(riskAssessment) && typeof riskAssessment['eating_ability'] === 'string')
      ? (riskAssessment['eating_ability'] as string).includes('needs_help')
      : false,
    needsHelpTransferring: (isRecord(riskAssessment) && typeof riskAssessment['sitting_ability'] === 'string')
      ? (riskAssessment['sitting_ability'] as string).includes('needs_help')
      : false,
    needsHelpWalking: (isRecord(riskAssessment) && typeof riskAssessment['walking_ability'] === 'string')
      ? (riskAssessment['walking_ability'] as string).includes('needs_help')
      : false
  };
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract functional status for a patient at discharge
 *
 * Key risk indicators:
 * - ADL dependencies: 0.12 weight
 * - Recent falls: 0.11 weight
 * - Cognitive impairment: 0.13 weight
 *
 * @param context - Discharge context
 * @param now - Current timestamp (for testing)
 * @returns Functional status factors
 */
export async function extractFunctionalStatus(
  context: DischargeContext,
  now: number = Date.now()
): Promise<FunctionalStatus> {
  const patientId = context.patientId;

  // Get most recent risk assessment with functional data
  const { data: riskAssessment } = await supabase
    .from('risk_assessments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get fall history
  const { data: falls } = await supabase
    .from('patient_daily_check_ins')
    .select('*')
    .eq('patient_id', patientId)
    .contains('concern_flags', ['fall'])
    .gte('check_in_date', getDaysAgoISO(90, now))
    .order('check_in_date', { ascending: false });

  const fallsList = falls || [];
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const fallsLast30Days = fallsList.filter(f =>
    new Date(f.check_in_date).getTime() > thirtyDaysAgo
  ).length;
  const fallsLast90Days = fallsList.length;

  // Extract ADL data from risk assessment
  const adlData = extractAdlAssessment(riskAssessment);

  const cognitiveRiskScore = isRecord(riskAssessment) ? (riskAssessment['cognitive_risk_score'] as number | undefined) : undefined;
  const riskFactors = isRecord(riskAssessment) ? (riskAssessment['risk_factors'] as unknown) : undefined;

  const hasRiskFactorsArray = Array.isArray(riskFactors);
  const riskFactorsList = hasRiskFactorsArray ? (riskFactors as unknown[]).filter((x): x is string => typeof x === 'string') : [];

  return {
    adlDependencies: adlData.adlDependencies,
    needsHelpBathing: adlData.needsHelpBathing,
    needsHelpDressing: adlData.needsHelpDressing,
    needsHelpToileting: adlData.needsHelpToileting,
    needsHelpEating: adlData.needsHelpEating,
    needsHelpTransferring: adlData.needsHelpTransferring,
    needsHelpWalking: adlData.needsHelpWalking,

    // CRITICAL: Preserve exact comparison - cognitiveRiskScore > 6 (not >=)
    hasCognitiveImpairment: typeof cognitiveRiskScore === 'number' ? cognitiveRiskScore > COGNITIVE_THRESHOLDS.IMPAIRMENT_THRESHOLD : false,
    cognitiveImpairmentSeverity: categorizeCognitiveSeverity(cognitiveRiskScore),
    hasDementia: riskFactorsList.includes('dementia'),
    hasDelirium: riskFactorsList.includes('delirium'),

    hasRecentFalls: fallsLast90Days > 0,
    fallsInPast30Days: fallsLast30Days,
    fallsInPast90Days: fallsLast90Days,
    fallRiskScore: calculateFallRiskScore(fallsLast90Days, riskAssessment as unknown),

    mobilityLevel: categorizeMobility(isRecord(riskAssessment) ? (riskAssessment['walking_ability'] as string | undefined) : undefined),
    requiresDurableMedicalEquipment: riskFactorsList.includes('dme_needed')
  };
}
