/**
 * Explainability Helpers for Readmission Risk Prediction
 *
 * Provides human-readable explanations and risk factor summaries.
 * These helpers are STRICTLY ADDITIVE - they do NOT change any prediction logic.
 *
 * Use cases:
 * - Generate patient-friendly risk summaries
 * - Create clinician-oriented risk factor lists
 * - Explain feature contributions to risk scores
 * - Support care planning decisions
 *
 * @module readmission/explainability
 */

import type { ReadmissionRiskFeatures } from '../../../types/readmissionRiskFeatures';
import { AI_PROMPT_WEIGHTS, RUCA_PROMPT_WEIGHTS, DATA_COMPLETENESS_WEIGHTS } from '../readmissionModelConfig';
import { getNestedValue } from './utils';

// =====================================================
// TYPES
// =====================================================

export interface RiskFactor {
  /** Feature name */
  name: string;
  /** Feature category */
  category: 'clinical' | 'medication' | 'post_discharge' | 'social' | 'functional' | 'engagement' | 'self_reported';
  /** Current value */
  value: unknown;
  /** Weight contribution (positive = risk, negative = protective) */
  weight: number;
  /** Human-readable explanation */
  explanation: string;
  /** Clinical evidence or guideline reference */
  evidence?: string;
  /** Whether this is a protective factor */
  isProtective: boolean;
}

export interface RiskSummary {
  /** Top risk factors (highest weight) */
  topRiskFactors: RiskFactor[];
  /** Protective factors (negative weight) */
  protectiveFactors: RiskFactor[];
  /** Data quality assessment */
  dataQuality: {
    completeness: number;
    missingFields: string[];
    confidence: 'high' | 'medium' | 'low';
  };
  /** Actionable recommendations based on risk factors */
  recommendations: string[];
}

// =====================================================
// RISK FACTOR EXPLANATIONS
// =====================================================

const RISK_EXPLANATIONS: Record<string, { explanation: string; evidence?: string }> = {
  // Clinical
  'priorAdmissions30Day': {
    explanation: 'Recent hospital admission within 30 days is the strongest predictor of readmission',
    evidence: 'CMS Hospital Readmissions Reduction Program'
  },
  'priorAdmissions90Day': {
    explanation: 'Multiple hospitalizations in 90 days indicates unstable health status',
    evidence: 'Jencks et al., NEJM 2009'
  },
  'edVisits6Month': {
    explanation: 'Frequent ED visits suggest difficulty managing conditions at home',
    evidence: 'AHRQ Quality Indicators'
  },
  'comorbidityCount': {
    explanation: 'Multiple chronic conditions increase complexity and readmission risk',
    evidence: 'Charlson Comorbidity Index'
  },
  'isHighRiskDiagnosis': {
    explanation: 'CHF, COPD, diabetes, and renal failure have highest readmission rates',
    evidence: 'CMS Hospital Compare'
  },
  'labTrendsConcerning': {
    explanation: 'Abnormal lab values at discharge indicate incomplete stabilization',
    evidence: 'Clinical guidelines'
  },

  // Medications
  'isPolypharmacy': {
    explanation: '5+ medications increases risk of interactions and adherence issues',
    evidence: 'WHO Medication Safety Report'
  },
  'hasHighRiskMedications': {
    explanation: 'Anticoagulants, insulin, opioids require careful monitoring',
    evidence: 'ISMP High-Alert Medications'
  },
  'noPrescriptionFilled': {
    explanation: 'Unfilled prescriptions prevent proper treatment continuation',
    evidence: 'Pharmacy claims data analysis'
  },

  // Post-discharge
  'noFollowUpScheduled': {
    explanation: 'No follow-up appointment leaves patients without clinical monitoring',
    evidence: 'Transitional Care Model'
  },
  'followUpWithin7Days': {
    explanation: 'Early follow-up catches deterioration before it requires rehospitalization',
    evidence: 'AHRQ Care Transitions'
  },

  // Social
  'hasTransportationBarrier': {
    explanation: 'Transportation barriers prevent follow-up attendance and pharmacy access',
    evidence: 'SDOH research'
  },
  'livesAlone': {
    explanation: 'Living alone means no immediate help if symptoms worsen',
    evidence: 'Social support studies'
  },
  'isRuralLocation': {
    explanation: 'Rural patients face longer travel times and limited healthcare access',
    evidence: 'Rural Health Research'
  },
  'lowHealthLiteracy': {
    explanation: 'Low health literacy affects understanding of discharge instructions',
    evidence: 'Health Literacy Universal Precautions'
  },

  // Functional
  'adlDependencies': {
    explanation: 'Difficulty with daily activities indicates need for support services',
    evidence: 'Katz ADL Index'
  },
  'hasRecentFalls': {
    explanation: 'Fall history indicates frailty and injury risk',
    evidence: 'CDC STEADI program'
  },
  'hasCognitiveImpairment': {
    explanation: 'Cognitive issues affect medication management and symptom recognition',
    evidence: 'Dementia care guidelines'
  },

  // Engagement
  'isDisengaging': {
    explanation: 'Sudden drop in engagement often precedes clinical deterioration',
    evidence: 'WellFit behavioral data analysis'
  },
  'stoppedResponding': {
    explanation: 'No response for 3+ days is a critical warning sign',
    evidence: 'WellFit early warning system'
  },
  'consecutiveMissedCheckIns': {
    explanation: 'Missed check-ins may indicate health decline or social withdrawal',
    evidence: 'WellFit engagement patterns'
  },
  'hasEngagementDrop': {
    explanation: 'Significant engagement decline correlates with health status change',
    evidence: 'WellFit longitudinal analysis'
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get risk factors from features with their weights
 */
function extractRiskFactors(features: ReadmissionRiskFeatures): RiskFactor[] {
  const factors: RiskFactor[] = [];

  // Clinical factors
  if (features.clinical.priorAdmissions30Day > 0) {
    factors.push({
      name: 'priorAdmissions30Day',
      category: 'clinical',
      value: features.clinical.priorAdmissions30Day,
      weight: AI_PROMPT_WEIGHTS.CLINICAL.PRIOR_ADMISSIONS_30DAY,
      explanation: RISK_EXPLANATIONS['priorAdmissions30Day'].explanation,
      evidence: RISK_EXPLANATIONS['priorAdmissions30Day'].evidence,
      isProtective: false
    });
  }

  if (features.clinical.priorAdmissions90Day > 0) {
    factors.push({
      name: 'priorAdmissions90Day',
      category: 'clinical',
      value: features.clinical.priorAdmissions90Day,
      weight: AI_PROMPT_WEIGHTS.CLINICAL.PRIOR_ADMISSIONS_90DAY,
      explanation: RISK_EXPLANATIONS['priorAdmissions90Day'].explanation,
      evidence: RISK_EXPLANATIONS['priorAdmissions90Day'].evidence,
      isProtective: false
    });
  }

  if (features.clinical.edVisits6Month > 0) {
    factors.push({
      name: 'edVisits6Month',
      category: 'clinical',
      value: features.clinical.edVisits6Month,
      weight: AI_PROMPT_WEIGHTS.CLINICAL.ED_VISITS_6MONTH,
      explanation: RISK_EXPLANATIONS['edVisits6Month'].explanation,
      evidence: RISK_EXPLANATIONS['edVisits6Month'].evidence,
      isProtective: false
    });
  }

  if (features.clinical.comorbidityCount >= 3) {
    factors.push({
      name: 'comorbidityCount',
      category: 'clinical',
      value: features.clinical.comorbidityCount,
      weight: AI_PROMPT_WEIGHTS.CLINICAL.COMORBIDITY_COUNT,
      explanation: RISK_EXPLANATIONS['comorbidityCount'].explanation,
      evidence: RISK_EXPLANATIONS['comorbidityCount'].evidence,
      isProtective: false
    });
  }

  if (features.clinical.isHighRiskDiagnosis) {
    factors.push({
      name: 'isHighRiskDiagnosis',
      category: 'clinical',
      value: true,
      weight: AI_PROMPT_WEIGHTS.CLINICAL.HIGH_RISK_DIAGNOSIS,
      explanation: RISK_EXPLANATIONS['isHighRiskDiagnosis'].explanation,
      evidence: RISK_EXPLANATIONS['isHighRiskDiagnosis'].evidence,
      isProtective: false
    });
  }

  if (features.clinical.labTrendsConcerning) {
    factors.push({
      name: 'labTrendsConcerning',
      category: 'clinical',
      value: true,
      weight: AI_PROMPT_WEIGHTS.CLINICAL_SECONDARY.LAB_TRENDS_CONCERNING,
      explanation: RISK_EXPLANATIONS['labTrendsConcerning'].explanation,
      evidence: RISK_EXPLANATIONS['labTrendsConcerning'].evidence,
      isProtective: false
    });
  }

  // Stable vitals is protective
  if (features.clinical.vitalSignsStableAtDischarge) {
    factors.push({
      name: 'vitalSignsStableAtDischarge',
      category: 'clinical',
      value: true,
      weight: AI_PROMPT_WEIGHTS.CLINICAL_SECONDARY.VITALS_STABLE,
      explanation: 'Stable vital signs at discharge indicate clinical readiness',
      evidence: 'Clinical assessment guidelines',
      isProtective: true
    });
  }

  // Medication factors
  if (features.medication.isPolypharmacy) {
    factors.push({
      name: 'isPolypharmacy',
      category: 'medication',
      value: features.medication.activeMedicationCount,
      weight: AI_PROMPT_WEIGHTS.MEDICATIONS.POLYPHARMACY,
      explanation: RISK_EXPLANATIONS['isPolypharmacy'].explanation,
      evidence: RISK_EXPLANATIONS['isPolypharmacy'].evidence,
      isProtective: false
    });
  }

  if (features.medication.hasHighRiskMedications) {
    factors.push({
      name: 'hasHighRiskMedications',
      category: 'medication',
      value: features.medication.highRiskMedicationList,
      weight: AI_PROMPT_WEIGHTS.MEDICATIONS.HIGH_RISK_MEDS,
      explanation: RISK_EXPLANATIONS['hasHighRiskMedications'].explanation,
      evidence: RISK_EXPLANATIONS['hasHighRiskMedications'].evidence,
      isProtective: false
    });
  }

  if (features.medication.noPrescriptionFilled) {
    factors.push({
      name: 'noPrescriptionFilled',
      category: 'medication',
      value: true,
      weight: AI_PROMPT_WEIGHTS.MEDICATIONS.NO_PRESCRIPTION_FILLED,
      explanation: RISK_EXPLANATIONS['noPrescriptionFilled'].explanation,
      evidence: RISK_EXPLANATIONS['noPrescriptionFilled'].evidence,
      isProtective: false
    });
  }

  // Post-discharge factors
  if (features.postDischarge.noFollowUpScheduled) {
    factors.push({
      name: 'noFollowUpScheduled',
      category: 'post_discharge',
      value: true,
      weight: AI_PROMPT_WEIGHTS.POST_DISCHARGE.NO_FOLLOW_UP,
      explanation: RISK_EXPLANATIONS['noFollowUpScheduled'].explanation,
      evidence: RISK_EXPLANATIONS['noFollowUpScheduled'].evidence,
      isProtective: false
    });
  }

  // Follow-up within 7 days is protective
  if (features.postDischarge.followUpWithin7Days) {
    factors.push({
      name: 'followUpWithin7Days',
      category: 'post_discharge',
      value: true,
      weight: AI_PROMPT_WEIGHTS.POST_DISCHARGE.FOLLOW_UP_WITHIN_7_DAYS,
      explanation: RISK_EXPLANATIONS['followUpWithin7Days'].explanation,
      evidence: RISK_EXPLANATIONS['followUpWithin7Days'].evidence,
      isProtective: true
    });
  }

  // Social factors
  if (features.socialDeterminants.hasTransportationBarrier) {
    factors.push({
      name: 'hasTransportationBarrier',
      category: 'social',
      value: true,
      weight: AI_PROMPT_WEIGHTS.SOCIAL.TRANSPORTATION_BARRIER,
      explanation: RISK_EXPLANATIONS['hasTransportationBarrier'].explanation,
      evidence: RISK_EXPLANATIONS['hasTransportationBarrier'].evidence,
      isProtective: false
    });
  }

  if (features.socialDeterminants.livesAlone) {
    factors.push({
      name: 'livesAlone',
      category: 'social',
      value: true,
      weight: AI_PROMPT_WEIGHTS.SOCIAL.LIVES_ALONE,
      explanation: RISK_EXPLANATIONS['livesAlone'].explanation,
      evidence: RISK_EXPLANATIONS['livesAlone'].evidence,
      isProtective: false
    });
  }

  if (features.socialDeterminants.isRuralLocation) {
    factors.push({
      name: 'isRuralLocation',
      category: 'social',
      value: features.socialDeterminants.rucaCategory,
      weight: AI_PROMPT_WEIGHTS.SOCIAL.RURAL_LOCATION,
      explanation: RISK_EXPLANATIONS['isRuralLocation'].explanation,
      evidence: RISK_EXPLANATIONS['isRuralLocation'].evidence,
      isProtective: false
    });
  }

  if (features.socialDeterminants.lowHealthLiteracy) {
    factors.push({
      name: 'lowHealthLiteracy',
      category: 'social',
      value: features.socialDeterminants.healthLiteracyLevel,
      weight: AI_PROMPT_WEIGHTS.SOCIAL.LOW_HEALTH_LITERACY,
      explanation: RISK_EXPLANATIONS['lowHealthLiteracy'].explanation,
      evidence: RISK_EXPLANATIONS['lowHealthLiteracy'].evidence,
      isProtective: false
    });
  }

  // Functional status
  if (features.functionalStatus.adlDependencies > 0) {
    factors.push({
      name: 'adlDependencies',
      category: 'functional',
      value: features.functionalStatus.adlDependencies,
      weight: AI_PROMPT_WEIGHTS.FUNCTIONAL.ADL_DEPENDENCIES,
      explanation: RISK_EXPLANATIONS['adlDependencies'].explanation,
      evidence: RISK_EXPLANATIONS['adlDependencies'].evidence,
      isProtective: false
    });
  }

  if (features.functionalStatus.hasRecentFalls) {
    factors.push({
      name: 'hasRecentFalls',
      category: 'functional',
      value: features.functionalStatus.fallsInPast90Days,
      weight: AI_PROMPT_WEIGHTS.FUNCTIONAL.RECENT_FALLS,
      explanation: RISK_EXPLANATIONS['hasRecentFalls'].explanation,
      evidence: RISK_EXPLANATIONS['hasRecentFalls'].evidence,
      isProtective: false
    });
  }

  if (features.functionalStatus.hasCognitiveImpairment) {
    factors.push({
      name: 'hasCognitiveImpairment',
      category: 'functional',
      value: features.functionalStatus.cognitiveImpairmentSeverity,
      weight: AI_PROMPT_WEIGHTS.FUNCTIONAL.COGNITIVE_IMPAIRMENT,
      explanation: RISK_EXPLANATIONS['hasCognitiveImpairment'].explanation,
      evidence: RISK_EXPLANATIONS['hasCognitiveImpairment'].evidence,
      isProtective: false
    });
  }

  // Engagement factors
  if (features.engagement.isDisengaging) {
    factors.push({
      name: 'isDisengaging',
      category: 'engagement',
      value: true,
      weight: AI_PROMPT_WEIGHTS.ENGAGEMENT.IS_DISENGAGING,
      explanation: RISK_EXPLANATIONS['isDisengaging'].explanation,
      evidence: RISK_EXPLANATIONS['isDisengaging'].evidence,
      isProtective: false
    });
  }

  if (features.engagement.stoppedResponding) {
    factors.push({
      name: 'stoppedResponding',
      category: 'engagement',
      value: features.engagement.consecutiveMissedCheckIns,
      weight: AI_PROMPT_WEIGHTS.ENGAGEMENT.STOPPED_RESPONDING,
      explanation: RISK_EXPLANATIONS['stoppedResponding'].explanation,
      evidence: RISK_EXPLANATIONS['stoppedResponding'].evidence,
      isProtective: false
    });
  }

  if (features.engagement.consecutiveMissedCheckIns >= 3) {
    factors.push({
      name: 'consecutiveMissedCheckIns',
      category: 'engagement',
      value: features.engagement.consecutiveMissedCheckIns,
      weight: AI_PROMPT_WEIGHTS.ENGAGEMENT.CONSECUTIVE_MISSED,
      explanation: RISK_EXPLANATIONS['consecutiveMissedCheckIns'].explanation,
      evidence: RISK_EXPLANATIONS['consecutiveMissedCheckIns'].evidence,
      isProtective: false
    });
  }

  if (features.engagement.hasEngagementDrop) {
    factors.push({
      name: 'hasEngagementDrop',
      category: 'engagement',
      value: features.engagement.engagementChangePercent,
      weight: AI_PROMPT_WEIGHTS.ENGAGEMENT.ENGAGEMENT_DROP,
      explanation: RISK_EXPLANATIONS['hasEngagementDrop'].explanation,
      evidence: RISK_EXPLANATIONS['hasEngagementDrop'].evidence,
      isProtective: false
    });
  }

  return factors;
}

/**
 * Calculate data completeness and quality
 */
function calculateDataQuality(features: ReadmissionRiskFeatures): RiskSummary['dataQuality'] {
  const missingFields: string[] = [];
  let presentWeight = 0;
  let totalWeight = 0;

  for (const item of DATA_COMPLETENESS_WEIGHTS) {
    totalWeight += item.weight;
    const value = getNestedValue(features, item.key);
    if (value !== undefined && value !== null) {
      presentWeight += item.weight;
    } else {
      missingFields.push(item.key);
    }
  }

  const completeness = Math.round((presentWeight / totalWeight) * 100);
  const confidence = completeness >= 80 ? 'high' : completeness >= 60 ? 'medium' : 'low';

  return { completeness, missingFields, confidence };
}

/**
 * Generate recommendations based on risk factors
 */
function generateRecommendations(factors: RiskFactor[]): string[] {
  const recommendations: string[] = [];

  // Sort by weight (highest risk first)
  const sortedFactors = factors
    .filter(f => !f.isProtective)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  for (const factor of sortedFactors.slice(0, 5)) {
    switch (factor.name) {
      case 'priorAdmissions30Day':
      case 'priorAdmissions90Day':
        recommendations.push('Intensive transitional care management recommended');
        break;
      case 'noFollowUpScheduled':
        recommendations.push('Schedule follow-up appointment within 7 days of discharge');
        break;
      case 'hasTransportationBarrier':
        recommendations.push('Arrange transportation assistance or telehealth visits');
        break;
      case 'isPolypharmacy':
        recommendations.push('Medication reconciliation and pharmacist consultation');
        break;
      case 'hasHighRiskMedications':
        recommendations.push('Close monitoring of high-risk medications with dosing education');
        break;
      case 'livesAlone':
        recommendations.push('Consider home health services or daily check-in program');
        break;
      case 'isRuralLocation':
        recommendations.push('Establish telehealth follow-up and local support resources');
        break;
      case 'hasCognitiveImpairment':
        recommendations.push('Ensure caregiver receives discharge instructions and medication training');
        break;
      case 'isDisengaging':
      case 'stoppedResponding':
        recommendations.push('URGENT: Immediate welfare check and care team outreach');
        break;
      case 'noPrescriptionFilled':
        recommendations.push('Confirm prescription access and affordability');
        break;
    }
  }

  // Remove duplicates
  return [...new Set(recommendations)];
}

// =====================================================
// MAIN EXPORTS
// =====================================================

/**
 * Generate a comprehensive risk summary from features
 *
 * @param features - Extracted readmission risk features
 * @returns Risk summary with factors, quality assessment, and recommendations
 */
export function generateRiskSummary(features: ReadmissionRiskFeatures): RiskSummary {
  const allFactors = extractRiskFactors(features);

  const topRiskFactors = allFactors
    .filter(f => !f.isProtective)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 5);

  const protectiveFactors = allFactors
    .filter(f => f.isProtective)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  const dataQuality = calculateDataQuality(features);
  const recommendations = generateRecommendations(allFactors);

  return {
    topRiskFactors,
    protectiveFactors,
    dataQuality,
    recommendations
  };
}

/**
 * Get all identified risk factors (both risk and protective)
 *
 * @param features - Extracted readmission risk features
 * @returns Array of all identified risk factors
 */
export function getAllRiskFactors(features: ReadmissionRiskFeatures): RiskFactor[] {
  return extractRiskFactors(features);
}

/**
 * Generate a patient-friendly summary of risk factors
 *
 * @param features - Extracted readmission risk features
 * @returns Plain language summary suitable for patient communication
 */
export function generatePatientSummary(features: ReadmissionRiskFeatures): string {
  const summary = generateRiskSummary(features);

  const parts: string[] = [];

  if (summary.topRiskFactors.length > 0) {
    parts.push('Based on your health information, we want to help you stay well at home. Some things to focus on:');

    for (const factor of summary.topRiskFactors.slice(0, 3)) {
      switch (factor.category) {
        case 'clinical':
          parts.push('• Your recent health history means staying in close contact with your doctor is important');
          break;
        case 'medication':
          parts.push('• Taking your medications correctly is key - ask if you have any questions');
          break;
        case 'post_discharge':
          parts.push('• Making it to your follow-up appointments helps us catch problems early');
          break;
        case 'social':
          parts.push('• Having support at home and a way to get to appointments makes a big difference');
          break;
        case 'functional':
          parts.push('• Being careful with daily activities and asking for help when needed keeps you safe');
          break;
        case 'engagement':
          parts.push('• Checking in regularly helps us know how you\'re doing');
          break;
      }
    }
  }

  if (summary.protectiveFactors.length > 0) {
    parts.push('\nGood news - you have some things working in your favor:');
    for (const factor of summary.protectiveFactors) {
      if (factor.name === 'followUpWithin7Days') {
        parts.push('• Your follow-up appointment is scheduled soon');
      }
      if (factor.name === 'vitalSignsStableAtDischarge') {
        parts.push('• Your vital signs looked good when you left');
      }
    }
  }

  return parts.join('\n');
}

/**
 * Get RUCA weight for risk display
 *
 * @param rucaCategory - RUCA category
 * @returns Display weight string
 */
export function getRUCAWeightDisplay(rucaCategory?: string): string {
  return RUCA_PROMPT_WEIGHTS[rucaCategory || 'urban'] || '0.00';
}
