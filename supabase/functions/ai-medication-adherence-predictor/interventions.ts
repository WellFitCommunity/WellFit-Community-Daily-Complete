/**
 * Intervention Generation for Medication Adherence Prediction
 *
 * Generates prioritized, actionable interventions based on identified
 * barriers, medication risks, and regimen complexity.
 *
 * @skill #31 - Medication Adherence Predictor
 */

import type {
  AdherenceBarrier,
  MedicationRisk,
  AdherenceIntervention,
  RegimenComplexity,
} from './types.ts';

/**
 * Map barrier category to intervention category.
 */
function barrierCategoryToInterventionCategory(
  barrierCategory: AdherenceBarrier['category']
): AdherenceIntervention['category'] {
  switch (barrierCategory) {
    case 'cost': return 'financial';
    case 'complexity': return 'simplification';
    case 'cognitive': return 'reminder';
    default: return 'social_support';
  }
}

/**
 * Map barrier category to the implementer role.
 */
function barrierCategoryToImplementer(barrierCategory: AdherenceBarrier['category']): string {
  switch (barrierCategory) {
    case 'cost': return 'Social Worker';
    case 'cognitive': return 'Care Coordinator';
    default: return 'Care Team';
  }
}

/**
 * Generate prioritized interventions from barriers, medication risks, and complexity.
 */
export function generateInterventions(
  barriers: AdherenceBarrier[],
  medicationRisks: MedicationRisk[],
  regimenComplexity: Pick<RegimenComplexity, 'complexityLevel'>
): AdherenceIntervention[] {
  const interventions: AdherenceIntervention[] = [];
  const highRiskMeds = medicationRisks.filter(m =>
    m.adherenceRisk === 'high' || m.adherenceRisk === 'very_high'
  );

  // Universal interventions
  interventions.push({
    intervention: 'Conduct teach-back to verify medication understanding',
    category: 'education',
    priority: 'recommended',
    expectedImpact: 'moderate',
    implementedBy: 'Nurse or Pharmacist',
    timeframe: 'At next encounter',
  });

  // Barrier-specific interventions
  for (const barrier of barriers) {
    if (barrier.severity === 'high' || barrier.severity === 'critical') {
      const topIntervention = barrier.interventions[0];
      interventions.push({
        intervention: topIntervention,
        category: barrierCategoryToInterventionCategory(barrier.category),
        priority: barrier.severity === 'critical' ? 'critical' : 'strongly_recommended',
        expectedImpact: 'high',
        implementedBy: barrierCategoryToImplementer(barrier.category),
        timeframe: barrier.severity === 'critical' ? 'Within 48 hours' : 'Within 1 week',
      });
    }
  }

  // Complexity-based interventions
  if (regimenComplexity.complexityLevel === 'complex' || regimenComplexity.complexityLevel === 'very_complex') {
    interventions.push({
      intervention: 'Pharmacist medication therapy management (MTM) review',
      category: 'simplification',
      priority: 'strongly_recommended',
      expectedImpact: 'high',
      implementedBy: 'Clinical Pharmacist',
      timeframe: 'Within 2 weeks',
    });
  }

  // High-risk medication interventions
  if (highRiskMeds.length > 0) {
    interventions.push({
      intervention: `Focused counseling on high-risk medications: ${highRiskMeds.map(m => m.medication).join(', ')}`,
      category: 'education',
      priority: 'strongly_recommended',
      expectedImpact: 'high',
      implementedBy: 'Pharmacist',
      timeframe: 'At next encounter or by phone within 1 week',
    });
  }

  // Reminder interventions
  interventions.push({
    intervention: 'Set up medication reminder system (app, alarm, or pill organizer)',
    category: 'reminder',
    priority: 'recommended',
    expectedImpact: 'moderate',
    implementedBy: 'Patient/Caregiver with staff support',
    timeframe: 'Implement at next visit',
  });

  return interventions;
}
