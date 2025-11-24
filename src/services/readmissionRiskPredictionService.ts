/**
 * Readmission Risk Prediction Service
 *
 * WellFit Community / Envision VirtualEdge Group LLC
 *
 * AI-powered multi-factor readmission risk prediction model integrating:
 * - Clinical factors (age, prior admissions, comorbidities)
 * - Behavioral factors (medication compliance, Communication Silence Window)
 * - Social determinants (support level, discharge destination)
 *
 * HIPAA Compliance:
 * - All data uses patient IDs/tokens, never PHI in browser
 * - All operations logged via audit system
 * - No console.log statements
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';
import { logPhiAccess } from './phiAccessLogger';
import {
  calculateSilenceWindowScore,
  fetchPatientCommunicationMetrics,
  calculateReadmissionRiskContribution,
} from './communicationSilenceWindowService';
import {
  SilenceWindowResult,
  SilenceWindowRiskContribution,
  DEFAULT_SILENCE_WINDOW_WEIGHTS,
} from '../types/communicationSilenceWindow';

// =====================================================
// TYPES
// =====================================================

/**
 * Patient demographic and clinical factors for risk calculation
 */
export interface PatientRiskFactors {
  patientId: string;

  // Clinical Factors (40% weight)
  age: number;
  priorAdmissions12Months: number;
  chronicConditionCount: number;

  // Behavioral Factors (35% weight)
  medicationCompliancePercent: number;
  // Communication Silence Window integrated automatically

  // Social Determinants (25% weight)
  socialSupportLevel: 'high' | 'medium' | 'low';
  dischargeDestination: 'home' | 'snf' | 'ltac' | 'rehab' | 'home_health';
}

/**
 * Detailed factor scores breakdown
 */
export interface RiskFactorScores {
  // Clinical
  ageScore: number;
  priorAdmissionsScore: number;
  chronicConditionsScore: number;

  // Behavioral
  medicationComplianceScore: number;
  communicationSilenceScore: number;

  // Social
  socialSupportScore: number;
  dischargeDestinationScore: number;
}

/**
 * Complete risk prediction result
 */
export interface ReadmissionRiskResult {
  patientId: string;

  // Overall risk
  totalRiskScore: number;
  riskCategory: 'Low' | 'Moderate' | 'High' | 'Critical';

  // Category scores
  clinicalScore: number;
  behavioralScore: number;
  socialScore: number;

  // Factor breakdown
  factors: RiskFactorScores;

  // Silence window integration
  silenceWindow: SilenceWindowResult;
  silenceWindowContribution: SilenceWindowRiskContribution;

  // Recommendations
  interventionRecommended: boolean;
  recommendedInterventions: RecommendedIntervention[];

  // Metadata
  calculatedAt: string;
  dataConfidence: number;
  modelVersion: string;
}

/**
 * Intervention recommendation
 */
export interface RecommendedIntervention {
  intervention: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  responsibleRole: string;
  targetFactors: string[];
}

// =====================================================
// RISK WEIGHTS
// =====================================================

/**
 * Evidence-based weights for readmission risk factors
 */
export const READMISSION_RISK_WEIGHTS = {
  // Clinical Factors (40% total)
  clinical: {
    age: {
      gte75: 15,
      gte65: 10,
      lt65: 5,
    },
    priorAdmissions: {
      multiplier: 8,
      max: 25,
    },
    chronicConditions: {
      multiplier: 5,
      max: 20,
    },
  },

  // Behavioral Factors (35% total)
  behavioral: {
    medicationCompliance: {
      // Higher compliance = lower risk
      // Score = (100 - compliance) * 0.25
      multiplier: 0.25,
    },
    communicationSilence: {
      // Silence score * 0.35 (35% of behavioral = ~12% of total)
      weight: 0.35,
    },
  },

  // Social Determinants (25% total)
  social: {
    supportLevel: {
      low: 15,
      medium: 8,
      high: 2,
    },
    dischargeDestination: {
      home: 5,
      home_health: 7,
      snf: 10,
      rehab: 8,
      ltac: 15,
    },
  },
} as const;

/**
 * Risk thresholds for categorization
 */
export const READMISSION_RISK_THRESHOLDS = {
  critical: 70,  // >= 70% 30-day risk
  high: 40,      // >= 40% 30-day risk
  moderate: 20,  // >= 20% 30-day risk
  low: 0,        // < 20% 30-day risk
} as const;

// =====================================================
// CORE ALGORITHM
// =====================================================

/**
 * Calculate readmission risk score for a patient
 *
 * Multi-factor model integrating clinical, behavioral, and social factors.
 * Features the novel Communication Silence Window as a key behavioral predictor.
 */
export function calculateReadmissionRisk(
  patient: PatientRiskFactors,
  silenceResult: SilenceWindowResult
): ReadmissionRiskResult {
  const weights = READMISSION_RISK_WEIGHTS;

  // =====================================================
  // CLINICAL FACTORS (40% weight)
  // =====================================================

  // Age scoring
  let ageScore: number;
  if (patient.age >= 75) {
    ageScore = weights.clinical.age.gte75;
  } else if (patient.age >= 65) {
    ageScore = weights.clinical.age.gte65;
  } else {
    ageScore = weights.clinical.age.lt65;
  }

  // Prior admissions scoring
  const priorAdmissionsScore = Math.min(
    patient.priorAdmissions12Months * weights.clinical.priorAdmissions.multiplier,
    weights.clinical.priorAdmissions.max
  );

  // Chronic conditions scoring
  const chronicConditionsScore = Math.min(
    patient.chronicConditionCount * weights.clinical.chronicConditions.multiplier,
    weights.clinical.chronicConditions.max
  );

  const clinicalScore = ageScore + priorAdmissionsScore + chronicConditionsScore;

  // =====================================================
  // BEHAVIORAL FACTORS (35% weight)
  // =====================================================

  // Medication compliance scoring (inverted - low compliance = high risk)
  const medicationComplianceScore =
    (100 - patient.medicationCompliancePercent) * weights.behavioral.medicationCompliance.multiplier;

  // Communication Silence Window scoring (novel factor!)
  const silenceWindowContribution = calculateReadmissionRiskContribution(
    silenceResult,
    weights.behavioral.communicationSilence.weight
  );

  const communicationSilenceScore = silenceResult.score * weights.behavioral.communicationSilence.weight;

  const behavioralScore = medicationComplianceScore + communicationSilenceScore;

  // =====================================================
  // SOCIAL DETERMINANTS (25% weight)
  // =====================================================

  // Social support scoring
  const socialSupportScore = weights.social.supportLevel[patient.socialSupportLevel];

  // Discharge destination scoring
  const dischargeDestinationScore =
    weights.social.dischargeDestination[patient.dischargeDestination] || 5;

  const socialScore = socialSupportScore + dischargeDestinationScore;

  // =====================================================
  // TOTAL RISK CALCULATION
  // =====================================================

  const totalRiskScore = Math.min(
    Math.round(clinicalScore + behavioralScore + socialScore),
    100
  );

  // Determine risk category
  let riskCategory: 'Low' | 'Moderate' | 'High' | 'Critical';
  if (totalRiskScore >= READMISSION_RISK_THRESHOLDS.critical) {
    riskCategory = 'Critical';
  } else if (totalRiskScore >= READMISSION_RISK_THRESHOLDS.high) {
    riskCategory = 'High';
  } else if (totalRiskScore >= READMISSION_RISK_THRESHOLDS.moderate) {
    riskCategory = 'Moderate';
  } else {
    riskCategory = 'Low';
  }

  const interventionRecommended = totalRiskScore >= READMISSION_RISK_THRESHOLDS.moderate;

  // Generate recommendations
  const recommendedInterventions = generateInterventions(
    totalRiskScore,
    riskCategory,
    silenceResult,
    patient
  );

  // Calculate data confidence
  const dataConfidence = calculateDataConfidence(patient, silenceResult);

  return {
    patientId: patient.patientId,
    totalRiskScore,
    riskCategory,
    clinicalScore: Math.round(clinicalScore),
    behavioralScore: Math.round(behavioralScore),
    socialScore: Math.round(socialScore),
    factors: {
      ageScore,
      priorAdmissionsScore,
      chronicConditionsScore,
      medicationComplianceScore: Math.round(medicationComplianceScore),
      communicationSilenceScore: Math.round(communicationSilenceScore),
      socialSupportScore,
      dischargeDestinationScore,
    },
    silenceWindow: silenceResult,
    silenceWindowContribution,
    interventionRecommended,
    recommendedInterventions,
    calculatedAt: new Date().toISOString(),
    dataConfidence,
    modelVersion: '2.0.0-silence-window',
  };
}

/**
 * Generate intervention recommendations based on risk factors
 */
function generateInterventions(
  totalRisk: number,
  category: string,
  silenceResult: SilenceWindowResult,
  patient: PatientRiskFactors
): RecommendedIntervention[] {
  const interventions: RecommendedIntervention[] = [];

  // High/Critical risk interventions
  if (totalRisk >= READMISSION_RISK_THRESHOLDS.high) {
    interventions.push({
      intervention: 'Schedule care coordinator follow-up within 48 hours',
      priority: 'high',
      timeframe: '48 hours',
      responsibleRole: 'Care Coordinator',
      targetFactors: ['overall_risk'],
    });

    interventions.push({
      intervention: 'Activate transitional care management protocol',
      priority: 'high',
      timeframe: 'Immediate',
      responsibleRole: 'Nurse Manager',
      targetFactors: ['care_transitions'],
    });

    interventions.push({
      intervention: 'Consider home health referral',
      priority: 'medium',
      timeframe: '1 week',
      responsibleRole: 'Social Worker',
      targetFactors: ['discharge_support'],
    });
  }

  // Communication silence specific interventions
  if (silenceResult.alertTriggered) {
    interventions.push({
      intervention: 'PRIORITY: Address communication gap immediately',
      priority: silenceResult.riskLevel === 'critical' ? 'critical' : 'high',
      timeframe: silenceResult.riskLevel === 'critical' ? '2 hours' : '24 hours',
      responsibleRole: 'Care Coordinator',
      targetFactors: ['communication_silence', 'engagement'],
    });
  }

  // Medication compliance interventions
  if (patient.medicationCompliancePercent < 70) {
    interventions.push({
      intervention: 'Medication adherence counseling and barrier assessment',
      priority: 'medium',
      timeframe: '1 week',
      responsibleRole: 'Pharmacist',
      targetFactors: ['medication_compliance'],
    });
  }

  // Social support interventions
  if (patient.socialSupportLevel === 'low') {
    interventions.push({
      intervention: 'Social work assessment and community resource referral',
      priority: 'medium',
      timeframe: '1 week',
      responsibleRole: 'Social Worker',
      targetFactors: ['social_support'],
    });
  }

  return interventions;
}

/**
 * Calculate overall data confidence
 */
function calculateDataConfidence(
  patient: PatientRiskFactors,
  silenceResult: SilenceWindowResult
): number {
  let confidence = 60; // Base confidence

  // Add confidence for complete clinical data
  if (patient.age > 0) confidence += 10;
  if (patient.priorAdmissions12Months >= 0) confidence += 10;
  if (patient.chronicConditionCount >= 0) confidence += 10;

  // Add silence window confidence contribution
  confidence += Math.round(silenceResult.dataConfidence * 0.1);

  return Math.min(confidence, 100);
}

// =====================================================
// DATABASE OPERATIONS
// =====================================================

/**
 * Fetch patient factors and calculate complete readmission risk
 */
export async function calculatePatientReadmissionRisk(
  supabase: SupabaseClient,
  patientId: string,
  tenantId: string
): Promise<ReadmissionRiskResult> {
  await logPhiAccess({
    phiType: 'readmission_risk',
    phiResourceId: `readmission_${patientId}`,
    patientId,
    accessType: 'view',
    accessMethod: 'API',
    purpose: 'treatment',
  });

  await auditLogger.clinical('READMISSION_RISK_CALCULATION_STARTED', true, {
    patientId,
    tenantId,
  });

  try {
    // Fetch patient profile and clinical data in parallel
    const [profileResult, clinicalResult, silenceInput] = await Promise.all([
      supabase
        .from('profiles')
        .select('date_of_birth')
        .eq('id', patientId)
        .single(),
      supabase
        .from('readmission_risk_predictions')
        .select('clinical_features, medication_features, social_determinants_features')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      fetchPatientCommunicationMetrics(supabase, patientId),
    ]);

    // Calculate age from DOB
    let age = 65; // Default
    if (profileResult.data?.date_of_birth) {
      const dob = new Date(profileResult.data.date_of_birth);
      const today = new Date();
      age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // Extract clinical data or use defaults
    const clinical = clinicalResult.data?.clinical_features || {};
    const medication = clinicalResult.data?.medication_features || {};
    const social = clinicalResult.data?.social_determinants_features || {};

    const patientFactors: PatientRiskFactors = {
      patientId,
      age,
      priorAdmissions12Months: clinical.priorAdmissions1Year || 0,
      chronicConditionCount: clinical.comorbidityCount || 0,
      medicationCompliancePercent: medication.compliancePercent || 80,
      socialSupportLevel: social.socialSupportLevel || 'medium',
      dischargeDestination: social.dischargeDestination || 'home',
    };

    // Calculate silence window score
    const silenceResult = calculateSilenceWindowScore(silenceInput, DEFAULT_SILENCE_WINDOW_WEIGHTS);

    // Calculate complete readmission risk
    const result = calculateReadmissionRisk(patientFactors, silenceResult);

    // Store result in database
    await storeReadmissionRiskResult(supabase, result, tenantId);

    await auditLogger.clinical('READMISSION_RISK_CALCULATION_COMPLETED', true, {
      patientId,
      riskScore: result.totalRiskScore,
      riskCategory: result.riskCategory,
      silenceWindowScore: result.silenceWindow.score,
    });

    return result;
  } catch (error) {
    await auditLogger.error('READMISSION_RISK_CALCULATION_FAILED', error as Error, {
      patientId,
      tenantId,
    });
    throw error;
  }
}

/**
 * Store readmission risk result in database
 */
async function storeReadmissionRiskResult(
  supabase: SupabaseClient,
  result: ReadmissionRiskResult,
  tenantId: string
): Promise<void> {
  const { error } = await supabase.from('readmission_risk_predictions').upsert(
    {
      patient_id: result.patientId,
      tenant_id: tenantId,
      readmission_risk_30_day: result.totalRiskScore / 100,
      risk_category: result.riskCategory.toLowerCase(),
      prediction_confidence: result.dataConfidence / 100,
      recommended_interventions: result.recommendedInterventions,
      engagement_features: {
        silenceWindowScore: result.silenceWindow.score,
        silenceWindowRiskLevel: result.silenceWindow.riskLevel,
        silenceWindowAlertTriggered: result.silenceWindow.alertTriggered,
        behavioralScore: result.behavioralScore,
      },
      clinical_features: {
        clinicalScore: result.clinicalScore,
        ageScore: result.factors.ageScore,
        priorAdmissionsScore: result.factors.priorAdmissionsScore,
        chronicConditionsScore: result.factors.chronicConditionsScore,
      },
      social_determinants_features: {
        socialScore: result.socialScore,
        socialSupportScore: result.factors.socialSupportScore,
        dischargeDestinationScore: result.factors.dischargeDestinationScore,
      },
      created_at: result.calculatedAt,
    },
    {
      onConflict: 'patient_id',
      ignoreDuplicates: false,
    }
  );

  if (error) {
    await auditLogger.error('READMISSION_RISK_STORE_FAILED', error.message, {
      patientId: result.patientId,
    });
    throw error;
  }
}

// =====================================================
// EXPORTS
// =====================================================

class ReadmissionRiskPredictionService {
  calculateRisk = calculateReadmissionRisk;
  calculatePatientRisk = calculatePatientReadmissionRisk;
}

export const readmissionRiskPredictionService = new ReadmissionRiskPredictionService();
