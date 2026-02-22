/**
 * Barrier Identification for Medication Adherence Prediction
 *
 * Identifies adherence barriers from patient context, medication data,
 * and regimen complexity. Categories: cost, complexity, side effects,
 * cognitive, access, social.
 *
 * @skill #31 - Medication Adherence Predictor
 */

import type { MedicationInfo, AdherenceBarrier, RegimenComplexity } from './types.ts';

/**
 * Identify adherence barriers based on patient context, medications, and regimen complexity.
 */
export function identifyBarriers(
  context: Record<string, unknown>,
  medications: MedicationInfo[],
  regimenComplexity: Pick<RegimenComplexity, 'complexityLevel' | 'complexityScore'>
): AdherenceBarrier[] {
  const barriers: AdherenceBarrier[] = [];
  const sdohFactors = context.sdohFactors as Array<{ category: string; risk_level: string }> || [];
  const age = context.age as number | undefined;
  const cogAssessments = context.cognitiveAssessments as Array<{ score: number }> || [];

  // Cost barriers
  const hasSpecialtyMeds = medications.some(m => m.cost_tier === 'specialty' || m.cost_tier === 'non_preferred');
  const hasFinancialSDOH = sdohFactors.some(s =>
    s.category.toLowerCase().includes('financial') && s.risk_level !== 'low'
  );

  if (hasSpecialtyMeds || hasFinancialSDOH) {
    barriers.push({
      barrier: 'Medication cost concerns',
      category: 'cost',
      severity: hasSpecialtyMeds ? 'high' : 'moderate',
      evidence: hasSpecialtyMeds
        ? 'Patient has specialty or non-preferred tier medications'
        : 'Financial concerns identified in SDOH screening',
      mitigable: true,
      interventions: [
        'Review patient assistance programs',
        'Check for generic alternatives',
        'Connect with social worker for financial assistance',
        'Evaluate 90-day supply options for cost savings',
      ],
    });
  }

  // Complexity barriers
  if (regimenComplexity.complexityLevel === 'complex' || regimenComplexity.complexityLevel === 'very_complex') {
    barriers.push({
      barrier: 'Complex medication regimen',
      category: 'complexity',
      severity: regimenComplexity.complexityLevel === 'very_complex' ? 'high' : 'moderate',
      evidence: `${medications.length} medications with complexity score of ${regimenComplexity.complexityScore}`,
      mitigable: true,
      interventions: [
        'Review for combination products',
        'Align dosing times where clinically appropriate',
        'Provide medication organizer/pill box',
        'Set up automated reminders',
      ],
    });
  }

  // Side effect barriers
  const medsWithSideEffects = medications.filter(m =>
    m.side_effects_reported && m.side_effects_reported.length > 0
  );
  if (medsWithSideEffects.length > 0) {
    barriers.push({
      barrier: 'Side effects affecting quality of life',
      category: 'side_effects',
      severity: medsWithSideEffects.length >= 2 ? 'high' : 'moderate',
      evidence: `Patient reported side effects with: ${medsWithSideEffects.map(m => m.name).join(', ')}`,
      mitigable: true,
      interventions: [
        'Review timing of medications relative to side effects',
        'Consider alternative formulations',
        'Evaluate dose adjustments',
        'Provide side effect management counseling',
      ],
    });
  }

  // Cognitive barriers
  const hasCognitiveIssue = cogAssessments.some(a => a.score < 24) || (age !== undefined && age > 75);
  if (hasCognitiveIssue) {
    barriers.push({
      barrier: 'Cognitive challenges with medication management',
      category: 'cognitive',
      severity: cogAssessments.some(a => a.score < 20) ? 'high' : 'moderate',
      evidence: cogAssessments.length > 0
        ? 'Cognitive assessment indicates potential challenges'
        : 'Advanced age may impact medication management',
      mitigable: true,
      interventions: [
        'Involve caregiver in medication management',
        'Provide simplified medication schedule',
        'Use blister packs or medication dispenser',
        'Set up caregiver reminder system',
      ],
    });
  }

  // Transportation/Access barriers
  const hasTransportSDOH = sdohFactors.some(s =>
    s.category.toLowerCase().includes('transport') && s.risk_level !== 'low'
  );
  if (hasTransportSDOH) {
    barriers.push({
      barrier: 'Transportation barriers to pharmacy access',
      category: 'access',
      severity: 'moderate',
      evidence: 'Transportation challenges identified in SDOH screening',
      mitigable: true,
      interventions: [
        'Set up mail-order pharmacy',
        'Coordinate with community transportation services',
        'Explore pharmacy delivery options',
        'Synchronize refills to minimize trips',
      ],
    });
  }

  // Social support barriers
  const hasSocialSDOH = sdohFactors.some(s =>
    s.category.toLowerCase().includes('social') && s.risk_level !== 'low'
  );
  if (hasSocialSDOH) {
    barriers.push({
      barrier: 'Limited social support for medication adherence',
      category: 'social',
      severity: 'moderate',
      evidence: 'Social isolation or limited support identified',
      mitigable: true,
      interventions: [
        'Connect with community health worker',
        'Enroll in telephonic medication support program',
        'Consider home health medication assistance',
        'Engage family members in care plan',
      ],
    });
  }

  return barriers;
}
