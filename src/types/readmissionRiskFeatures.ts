/**
 * Comprehensive Readmission Risk Feature Definitions
 *
 * Evidence-based predictive features for hospital readmission risk prediction
 * Based on CMS quality measures and clinical research
 *
 * HIPAA Compliance: All features use patient IDs/tokens, never PHI in browser
 */

// =====================================================
// FEATURE CATEGORIES
// =====================================================

/**
 * Clinical Factors - Core medical risk indicators
 * Highest weight predictors: prior admissions, comorbidity count
 */
export interface ClinicalFactors {
  // Primary diagnosis & comorbidities
  primaryDiagnosisCode?: string;
  primaryDiagnosisDescription?: string;
  primaryDiagnosisCategory?: 'CHF' | 'COPD' | 'diabetes' | 'renal_failure' | 'pneumonia' | 'stroke' | 'sepsis' | 'other';
  isHighRiskDiagnosis: boolean; // CHF, COPD, diabetes, renal failure

  comorbidityCount: number;
  comorbidities: string[]; // ICD-10 codes
  hasChf: boolean;
  hasCopd: boolean;
  hasDiabetes: boolean;
  hasRenalFailure: boolean;
  hasCancer: boolean;

  // Utilization history (strongest predictor)
  priorAdmissions30Day: number;
  priorAdmissions60Day: number;
  priorAdmissions90Day: number;
  priorAdmissions1Year: number;

  edVisits30Day: number;
  edVisits90Day: number;
  edVisits6Month: number;

  // Length of stay (both too short and too long are risk factors)
  lengthOfStayDays?: number;
  lengthOfStayCategory?: 'too_short' | 'normal' | 'extended' | 'prolonged';

  // Vital sign instability at discharge
  vitalSignsStableAtDischarge: boolean;
  systolicBpAtDischarge?: number;
  diastolicBpAtDischarge?: number;
  heartRateAtDischarge?: number;
  oxygenSaturationAtDischarge?: number;
  temperatureAtDischarge?: number;

  // Lab abnormalities (key predictors)
  labsWithinNormalLimits: boolean;
  eGfr?: number; // Kidney function
  hemoglobin?: number;
  sodiumLevel?: number;
  glucoseLevel?: number;
  labTrendsConcerning: boolean;
}

/**
 * Medication Red Flags - High-risk medication patterns
 */
export interface MedicationFactors {
  // Polypharmacy (5+ medications is a risk factor)
  activeMedicationCount: number;
  isPolypharmacy: boolean; // 5+ medications

  // High-risk medication classes
  hasAnticoagulants: boolean;
  hasInsulin: boolean;
  hasOpioids: boolean;
  hasImmunosuppressants: boolean;
  hasHighRiskMedications: boolean;
  highRiskMedicationList: string[];

  // Medication changes during admission
  medicationsAdded: number;
  medicationsDiscontinued: number;
  medicationsDoseChanged: number;
  significantMedicationChanges: boolean; // >= 3 changes

  // Post-discharge prescription fill timing
  prescriptionFilledWithin3Days?: boolean;
  daysUntilPrescriptionFill?: number;
  noPrescriptionFilled: boolean;

  // Medication reconciliation
  medicationReconciliationCompleted: boolean;
  medicationListAccurate: boolean;
}

/**
 * Post-Discharge Setup - Critical for successful transitions
 */
export interface PostDischargeFactors {
  // Follow-up appointment timing (>7 days = risk)
  followUpScheduled: boolean;
  daysUntilFollowUp?: number;
  followUpWithin7Days: boolean;
  followUpWithin14Days: boolean;
  noFollowUpScheduled: boolean;

  // Primary care provider
  hasPcpAssigned: boolean;
  pcpContactedAboutDischarge: boolean;

  // Discharge destination
  dischargeDestination: 'home' | 'home_with_support' | 'home_health' | 'snf' | 'ltac' | 'rehab' | 'hospice' | 'homeless';
  dischargeToHomeAlone: boolean;
  hasHomeHealthServices: boolean;

  // Pending test results at discharge (risk factor)
  hasPendingTestResults: boolean;
  pendingTestResultsList: string[];

  // Discharge instructions
  dischargeInstructionsProvided: boolean;
  dischargeInstructionsUnderstood: boolean;
  patientTeachBackCompleted: boolean;
}

/**
 * Social Determinants of Health - Critical for rural populations
 * Heavy weight for rural isolation and transportation barriers
 */
export interface SocialDeterminants {
  // Living situation
  livesAlone: boolean;
  hasCaregiver: boolean;
  caregiverAvailable24Hours: boolean;
  caregiverReliable: boolean;

  // Transportation barriers (critical for rural)
  hasTransportationBarrier: boolean;
  distanceToNearestHospitalMiles?: number;
  distanceToPcpMiles?: number;
  publicTransitAvailable: boolean;

  // Rural isolation - ENHANCED with RUCA-based classification
  isRuralLocation: boolean;
  ruralIsolationScore?: number; // 0-10 scale
  /**
   * RUCA (Rural-Urban Commuting Area) code category
   * 1-3: Urban, 4-6: Large Rural, 7-9: Small Rural, 10: Isolated Rural
   */
  rucaCategory?: 'urban' | 'large_rural' | 'small_rural' | 'isolated_rural';
  /**
   * Distance-to-care risk factor (miles to nearest appropriate care)
   * Used to weight rural risk - higher distance = higher risk
   */
  distanceToCareRiskWeight?: number; // 0.0 to 0.25 contribution to risk
  /**
   * Patient's rurality classification (from demographic tracking)
   * Maps to patient_rurality column in ai_predictions
   */
  patientRurality?: 'urban' | 'suburban' | 'rural' | 'frontier';
  /**
   * Whether patient is in a healthcare shortage area (HPSA)
   */
  isInHealthcareShortageArea?: boolean;
  /**
   * Minutes to nearest emergency department
   */
  minutesToNearestED?: number;

  // Insurance & financial
  insuranceType?: 'medicare' | 'medicaid' | 'commercial' | 'uninsured' | 'dual_eligible';
  hasMedicaid: boolean;
  hasInsuranceGaps: boolean;
  financialBarriersToMedications: boolean;
  financialBarriersToFollowUp: boolean;

  // Health literacy
  healthLiteracyLevel?: 'adequate' | 'marginal' | 'low';
  lowHealthLiteracy: boolean;
  languageBarrier: boolean;
  interpreterNeeded: boolean;

  // Social support
  socialSupportScore?: number; // 0-10 scale
  hasFamilySupport: boolean;
  hasCommunitySupport: boolean;
  sociallyIsolated: boolean;
}

/**
 * Functional Status - Activities of daily living and mobility
 */
export interface FunctionalStatus {
  // ADL dependencies
  adlDependencies: number; // Count of ADLs needing assistance
  needsHelpBathing: boolean;
  needsHelpDressing: boolean;
  needsHelpToileting: boolean;
  needsHelpEating: boolean;
  needsHelpTransferring: boolean;
  needsHelpWalking: boolean;

  // Cognitive impairment
  hasCognitiveImpairment: boolean;
  cognitiveImpairmentSeverity?: 'mild' | 'moderate' | 'severe';
  hasDementia: boolean;
  hasDelirium: boolean;

  // Fall risk
  hasRecentFalls: boolean;
  fallsInPast30Days: number;
  fallsInPast90Days: number;
  fallRiskScore?: number; // 0-10 scale

  // Mobility
  mobilityLevel?: 'independent' | 'cane' | 'walker' | 'wheelchair' | 'bedbound';
  requiresDurableMedicalEquipment: boolean;
}

/**
 * Engagement & Behavioral Factors - WellFit's unique early warning system
 * Leverages self-check-ins, game participation, and daily activities
 * CRITICAL: Sudden drops in engagement = early predictor of health decline
 */
export interface EngagementFactors {
  // Daily check-in compliance
  checkInCompletionRate30Day: number; // 0.0 to 1.0
  checkInCompletionRate7Day: number;
  missedCheckIns30Day: number;
  missedCheckIns7Day: number;
  consecutiveMissedCheckIns: number; // Red flag if >= 3
  hasEngagementDrop: boolean; // Sudden drop from baseline

  // Self-reported vitals compliance
  vitalsReportingRate30Day: number; // 0.0 to 1.0
  missedVitalsReports7Day: number;
  vitalsReportingConsistent: boolean;

  // Mood and symptom reporting
  moodReportingRate30Day: number;
  negativeModeTrend: boolean; // Increasing "sad", "anxious", "not great"
  concerningSymptomsReported: boolean;
  symptomSeverityIncreasing: boolean;

  // Game participation (cognitive engagement)
  triviaParticipationRate30Day: number; // 0.0 to 1.0
  wordFindParticipationRate30Day: number;
  gameEngagementScore: number; // 0-100 composite
  gameEngagementDeclining: boolean; // Red flag

  // Social engagement
  mealPhotoShareRate30Day: number;
  communityInteractionScore: number; // 0-100
  socialEngagementDeclining: boolean;
  daysWithZeroActivity: number; // Days with no interaction at all

  // Alert patterns
  healthAlertsTriggered30Day: number;
  healthAlertsTriggered7Day: number;
  criticalAlertsTriggered: number;

  // Overall engagement trends
  overallEngagementScore: number; // 0-100 (from existing system)
  engagementChangePercent: number; // % change from 30-day baseline
  isDisengaging: boolean; // Critical red flag

  // Behavioral red flags
  stoppedResponding: boolean; // No response 3+ days
  concerningPatterns: string[]; // e.g., ["declining_mood", "missed_vitals", "no_games"]
}

/**
 * Self-Reported Health Status - Direct from patient check-ins
 * Complements clinical data with patient perspective
 */
export interface SelfReportedHealth {
  // Recent symptoms
  recentSymptoms: string[]; // From check-in symptom descriptions
  symptomCount30Day: number;
  hasRedFlagSymptoms: boolean; // SOB, chest pain, severe pain, etc.
  redFlagSymptomsList: string[];

  // Vital trends (self-reported)
  selfReportedBpTrendConcerning: boolean;
  selfReportedBloodSugarUnstable: boolean;
  selfReportedWeightChangeConcerning: boolean;

  // Functional changes
  reportedMobilityDeclining: boolean;
  reportedPainIncreasing: boolean;
  reportedFatigueIncreasing: boolean;

  // Medication adherence (self-reported)
  missedMedicationsDays30Day: number;
  medicationSideEffectsReported: boolean;
  medicationConcerns: string[];

  // Social activity (self-reported)
  daysHomeAlone30Day: number;
  socialIsolationIncreasing: boolean;
  familyContactDecreasing: boolean;
}

/**
 * Complete feature set for readmission risk prediction
 */
export interface ReadmissionRiskFeatures {
  patientId: string;
  tenantId: string;
  dischargeDate: string;
  assessmentTimestamp: string;

  // Evidence-based clinical factors
  clinical: ClinicalFactors;
  medication: MedicationFactors;
  postDischarge: PostDischargeFactors;
  socialDeterminants: SocialDeterminants;
  functionalStatus: FunctionalStatus;

  // WellFit's unique behavioral early warning system
  engagement: EngagementFactors;
  selfReported: SelfReportedHealth;

  // Data completeness score
  dataCompletenessScore: number; // 0-100, affects prediction confidence
  missingCriticalData: string[]; // List of critical missing features
}

/**
 * Feature importance weights based on clinical evidence
 * Used to guide AI prediction and explain risk scores
 */
export interface FeatureImportanceWeights {
  // Utilization history (highest weight)
  priorAdmissions30Day: number; // 0.25 - strongest predictor
  priorAdmissions90Day: number; // 0.20
  edVisits6Month: number; // 0.15

  // Comorbidities
  comorbidityCount: number; // 0.18
  isHighRiskDiagnosis: number; // 0.15

  // Post-discharge follow-up
  followUpWithin7Days: number; // 0.12 (protective when true)
  noFollowUpScheduled: number; // 0.18 (risk when true)

  // Social determinants (heavy weight for rural)
  hasTransportationBarrier: number; // 0.16
  livesAlone: number; // 0.14
  isRuralLocation: number; // 0.15
  lowHealthLiteracy: number; // 0.12

  // Medications
  isPolypharmacy: number; // 0.13
  hasHighRiskMedications: number; // 0.14
  noPrescriptionFilled: number; // 0.16

  // Functional status
  adlDependencies: number; // 0.12
  hasRecentFalls: number; // 0.11
  hasCognitiveImpairment: number; // 0.13

  // Clinical
  lengthOfStayCategory: number; // 0.10
  vitalSignsStableAtDischarge: number; // 0.09
  labTrendsConcerning: number; // 0.11
}

/**
 * Predicted risk output with detailed feature contributions
 */
export interface ReadmissionRiskPrediction {
  patientId: string;
  dischargeDate: string;

  // Risk scores
  readmissionRisk7Day: number; // 0.00 to 1.00
  readmissionRisk30Day: number;
  readmissionRisk90Day: number;

  // Risk category
  riskCategory: 'low' | 'moderate' | 'high' | 'critical';
  riskPercentile: number; // Compared to similar patients

  // Feature contributions (what drove the risk score)
  topRiskFactors: FeatureContribution[];
  topProtectiveFactors: FeatureContribution[];

  // Recommended interventions (prioritized)
  recommendedInterventions: RecommendedIntervention[];

  // Prediction metadata
  predictionConfidence: number; // 0.00 to 1.00
  dataCompletenessScore: number;
  modelVersion: string;
  predictedReadmissionDate?: string;

  // Clinical insights
  clinicalSummary: string;
  urgentActions: string[];
}

export interface FeatureContribution {
  featureName: string;
  featureCategory: 'clinical' | 'medication' | 'post_discharge' | 'social' | 'functional';
  featureValue: any;
  contributionWeight: number; // 0.00 to 1.00
  explanation: string;
  evidenceBase: string; // Citation or clinical guideline
}

export interface RecommendedIntervention {
  intervention: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'clinical' | 'medication' | 'social_support' | 'care_coordination' | 'education';
  estimatedImpact: number; // 0.00 to 1.00 reduction in readmission risk
  timeframe: string;
  responsible: string; // Role
  specificActions: string[];
  targetFeatures: string[]; // Which risk factors this addresses
}

/**
 * Risk stratification thresholds
 */
export const READMISSION_RISK_THRESHOLDS = {
  critical: 0.50, // >= 50% 30-day risk
  high: 0.30,     // >= 30% 30-day risk
  moderate: 0.15, // >= 15% 30-day risk
  low: 0.0        // < 15% 30-day risk
} as const;

/**
 * Evidence-based feature importance (normalized 0-1)
 * Based on clinical literature, CMS quality measures, and WellFit's data
 *
 * Note: WellFit's engagement data provides EARLY WARNING signals that
 * traditional clinical systems miss. Sudden disengagement often precedes
 * clinical deterioration by days or weeks.
 */
export const EVIDENCE_BASED_WEIGHTS: FeatureImportanceWeights = {
  // Utilization history (strongest clinical predictors)
  priorAdmissions30Day: 0.25,
  priorAdmissions90Day: 0.20,
  edVisits6Month: 0.15,

  // Comorbidities
  comorbidityCount: 0.18,
  isHighRiskDiagnosis: 0.15,

  // Post-discharge timing (critical)
  followUpWithin7Days: -0.12, // Protective factor
  noFollowUpScheduled: 0.18,

  // Social determinants (rural population focus)
  hasTransportationBarrier: 0.16,
  livesAlone: 0.14,
  isRuralLocation: 0.15,
  lowHealthLiteracy: 0.12,

  // Medications
  isPolypharmacy: 0.13,
  hasHighRiskMedications: 0.14,
  noPrescriptionFilled: 0.16,

  // Functional
  adlDependencies: 0.12,
  hasRecentFalls: 0.11,
  hasCognitiveImpairment: 0.13,

  // Clinical
  lengthOfStayCategory: 0.10,
  vitalSignsStableAtDischarge: -0.09, // Protective when stable
  labTrendsConcerning: 0.11
};

/**
 * WellFit engagement feature weights
 * These are EARLY WARNING indicators unique to WellFit's platform
 */
export const ENGAGEMENT_FEATURE_WEIGHTS = {
  // Check-in compliance (behavioral health indicator)
  consecutiveMissedCheckIns: 0.16, // High risk when >= 3
  hasEngagementDrop: 0.18, // Sudden change from baseline
  checkInCompletionRate7Day: -0.10, // Protective when high

  // Game participation (cognitive engagement)
  gameEngagementDeclining: 0.14, // Red flag
  daysWithZeroActivity: 0.15, // Complete disengagement

  // Self-reported health concerns
  hasRedFlagSymptoms: 0.20, // SOB, chest pain, etc.
  negativeModeTrend: 0.13, // Declining mood
  concerningSymptomsReported: 0.12,

  // Medication adherence (self-reported)
  missedMedicationsDays30Day: 0.14,

  // Social engagement
  daysHomeAlone30Day: 0.12,
  socialEngagementDeclining: 0.11,

  // Overall disengagement (strongest behavioral predictor)
  isDisengaging: 0.19, // Critical red flag
  stoppedResponding: 0.22 // Highest behavioral risk
} as const;
