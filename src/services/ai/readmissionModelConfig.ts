/**
 * READMISSION_MODEL_V1 - Versioned Model Configuration
 *
 * This module centralizes ALL thresholds, weights, keyword lists, and
 * categorization maps used in readmission risk prediction.
 *
 * CRITICAL: All values must remain BYTE-FOR-BYTE IDENTICAL to preserve
 * exact behavior. Do NOT modify these values without updating the model version.
 *
 * Version History:
 * - V1: Initial extraction from readmissionRiskPredictor.ts and readmissionFeatureExtractor.ts
 *
 * @module readmissionModelConfig
 */

// =====================================================
// MODEL VERSION
// =====================================================

export const MODEL_VERSION = 'V1' as const;

// =====================================================
// CLINICAL THRESHOLDS
// =====================================================

/**
 * Length of Stay (LOS) categorization thresholds
 *
 * Logic: if (!days) return 'normal'
 *        if (days < LOS_TOO_SHORT_THRESHOLD) return 'too_short'
 *        if (days <= LOS_NORMAL_MAX_THRESHOLD) return 'normal'
 *        if (days <= LOS_EXTENDED_MAX_THRESHOLD) return 'extended'
 *        else return 'prolonged'
 */
export const LOS_THRESHOLDS = {
  /** Days below this are 'too_short' - risk factor */
  TOO_SHORT: 2,
  /** Days at or below this are 'normal' */
  NORMAL_MAX: 5,
  /** Days at or below this are 'extended' */
  EXTENDED_MAX: 10
} as const;

/**
 * Vital signs stability thresholds at discharge
 *
 * Logic: Value is stable if (!value || (value >= MIN && value <= MAX))
 * Note: 0 is falsy, so 0 would pass as "missing" - intentional behavior
 */
export const VITALS_STABILITY_THRESHOLDS = {
  SYSTOLIC: { MIN: 90, MAX: 160 },
  DIASTOLIC: { MIN: 60, MAX: 100 },
  HEART_RATE: { MIN: 60, MAX: 100 },
  /** O2 saturation has only minimum threshold */
  O2_SATURATION_MIN: 92
} as const;

/**
 * Lab values - Normal ranges and concerning thresholds
 */
export const LAB_THRESHOLDS = {
  /** Normal ranges */
  NORMAL: {
    EGFR_MIN: 60,
    HEMOGLOBIN_MIN: 12,
    HEMOGLOBIN_MAX: 17,
    SODIUM_MIN: 135,
    SODIUM_MAX: 145,
    GLUCOSE_MIN: 70,
    GLUCOSE_MAX: 140
  },
  /** Concerning thresholds - any of these triggers labTrendsConcerning = true */
  CONCERNING: {
    EGFR_CRITICAL_LOW: 30,
    HEMOGLOBIN_CRITICAL_LOW: 10,
    SODIUM_CRITICAL_LOW: 130,
    SODIUM_CRITICAL_HIGH: 150,
    GLUCOSE_CRITICAL_LOW: 60,
    GLUCOSE_CRITICAL_HIGH: 200
  }
} as const;

/**
 * ICD-10 code prefixes for condition categorization
 */
export const ICD10_PREFIXES = {
  CHF: ['I50'],
  COPD: ['J44', 'J45'],
  DIABETES: ['E11', 'E10'],
  RENAL_FAILURE: ['N18'],
  CANCER: ['C'],
  PNEUMONIA: ['J18'],
  STROKE: ['I63'],
  SEPSIS: ['A41']
} as const;

/**
 * High-risk diagnosis code prefixes
 * Used to determine isHighRiskDiagnosis flag
 */
export const HIGH_RISK_DIAGNOSIS_PREFIXES = ['I50', 'J44', 'J45', 'E11', 'E10', 'N18'] as const;

// =====================================================
// MEDICATION THRESHOLDS
// =====================================================

/**
 * Medication-related thresholds
 */
export const MEDICATION_THRESHOLDS = {
  /** Number of medications that triggers polypharmacy flag */
  POLYPHARMACY: 5,
  /** Number of medication changes that triggers significant changes flag */
  SIGNIFICANT_CHANGES: 3
} as const;

/**
 * High-risk medication class keywords
 * Used with case-insensitive substring matching on medication_display
 */
export const HIGH_RISK_MEDICATION_KEYWORDS = {
  ANTICOAGULANTS: ['warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban'],
  INSULIN: ['insulin'],
  OPIOIDS: ['oxycodone', 'hydrocodone', 'morphine', 'fentanyl', 'tramadol'],
  IMMUNOSUPPRESSANTS: ['prednisone', 'tacrolimus', 'cyclosporine']
} as const;

// =====================================================
// POST-DISCHARGE THRESHOLDS
// =====================================================

/**
 * Follow-up appointment timing thresholds
 *
 * Logic: followUpWithin7Days = daysUntil ? daysUntil <= 7 : false
 * Note: 0 daysUntil is falsy -> returns false, even though same-day is within 7
 * This is intentional behavior and must NOT be changed
 */
export const FOLLOW_UP_THRESHOLDS = {
  /** Days threshold for "within 7 days" flag */
  WITHIN_7_DAYS: 7,
  /** Days threshold for "within 14 days" flag */
  WITHIN_14_DAYS: 14
} as const;

// =====================================================
// FUNCTIONAL STATUS THRESHOLDS
// =====================================================

/**
 * Cognitive impairment thresholds
 */
export const COGNITIVE_THRESHOLDS = {
  /** Score above this triggers hasCognitiveImpairment = true */
  IMPAIRMENT_THRESHOLD: 6,
  /** Severity categorization thresholds */
  SEVERITY: {
    /** Score below this returns undefined */
    MIN_FOR_SEVERITY: 4,
    /** Score below this is 'mild' */
    MILD_MAX: 7,
    /** Score below this is 'moderate', else 'severe' */
    MODERATE_MAX: 9
  }
} as const;

/**
 * Fall risk score calculation parameters
 *
 * Calculation order (must be preserved):
 * 1. base = Math.min(fallsCount * FALLS_MULTIPLIER, FALLS_MAX_BASE)
 * 2. +MOBILITY_BONUS if mobility_risk_score > MOBILITY_THRESHOLD
 * 3. +COGNITIVE_BONUS if cognitive_risk_score > COGNITIVE_THRESHOLD
 * 4. +WALKER_BONUS if walkingAbility includes 'walker' or 'wheelchair'
 * 5. result = Math.min(score, MAX_SCORE)
 */
export const FALL_RISK_PARAMS = {
  /** Multiplier for falls count */
  FALLS_MULTIPLIER: 2,
  /** Maximum base score from falls count */
  FALLS_MAX_BASE: 6,
  /** Mobility risk score threshold for bonus */
  MOBILITY_THRESHOLD: 7,
  /** Bonus points if mobility threshold exceeded */
  MOBILITY_BONUS: 2,
  /** Cognitive risk score threshold for bonus */
  COGNITIVE_THRESHOLD: 6,
  /** Bonus points if cognitive threshold exceeded */
  COGNITIVE_BONUS: 1,
  /** Bonus points if using walker or wheelchair */
  WALKER_BONUS: 1,
  /** Maximum fall risk score */
  MAX_SCORE: 10
} as const;

/**
 * Keywords for mobility device detection
 */
export const MOBILITY_DEVICE_KEYWORDS = ['walker', 'wheelchair'] as const;

// =====================================================
// SOCIAL DETERMINANTS THRESHOLDS
// =====================================================

/**
 * Distance-to-care risk weight calculation parameters
 *
 * Calculation order (MUST be preserved - order matters):
 * 1. Accumulate hospital distance weight
 * 2. Accumulate PCP distance weight
 * 3. Apply RUCA multiplier
 * 4. Cap at MAX_WEIGHT
 */
export const DISTANCE_TO_CARE_PARAMS = {
  /** Hospital distance thresholds and weights */
  HOSPITAL: {
    VERY_FAR_THRESHOLD: 60,
    VERY_FAR_WEIGHT: 0.20,
    FAR_THRESHOLD: 30,
    FAR_WEIGHT: 0.15,
    MODERATE_THRESHOLD: 15,
    MODERATE_WEIGHT: 0.10,
    SLIGHT_THRESHOLD: 5,
    SLIGHT_WEIGHT: 0.05
  },
  /** PCP distance thresholds and weights */
  PCP: {
    FAR_THRESHOLD: 30,
    FAR_WEIGHT: 0.08,
    MODERATE_THRESHOLD: 15,
    MODERATE_WEIGHT: 0.05
  },
  /** RUCA category multipliers (applied BEFORE cap) */
  RUCA_MULTIPLIERS: {
    ISOLATED_RURAL: 1.3,
    SMALL_RURAL: 1.15
  },
  /** Maximum weight (cap applied AFTER multiplier) */
  MAX_WEIGHT: 0.25
} as const;

/**
 * Rural isolation score parameters
 */
export const RURAL_ISOLATION_PARAMS = {
  /** Base scores by RUCA category */
  BASE_SCORES: {
    ISOLATED_RURAL: 8,
    SMALL_RURAL: 6,
    LARGE_RURAL: 4,
    DEFAULT: 3
  },
  /** Distance bonuses */
  HOSPITAL_VERY_FAR_BONUS: 2,
  HOSPITAL_VERY_FAR_THRESHOLD: 60,
  HOSPITAL_FAR_BONUS: 1,
  HOSPITAL_FAR_THRESHOLD: 30,
  PCP_FAR_BONUS: 1,
  PCP_FAR_THRESHOLD: 30,
  /** No public transit bonus */
  NO_TRANSIT_BONUS: 1,
  /** Maximum isolation score */
  MAX_SCORE: 10
} as const;

/**
 * RUCA code thresholds for rural classification
 */
export const RUCA_THRESHOLDS = {
  /** RUCA codes 1-3 are urban */
  URBAN_MAX: 3,
  /** RUCA codes 4-6 are large rural */
  LARGE_RURAL_MAX: 6,
  /** RUCA codes 7-9 are small rural */
  SMALL_RURAL_MAX: 9
  /** RUCA code 10 is isolated rural */
} as const;

/**
 * Estimated driving time multipliers (minutes per mile)
 */
export const DRIVING_TIME_MULTIPLIERS = {
  RURAL: 2,
  URBAN: 1.5
} as const;

/**
 * Rural ZIP code prefixes for fallback classification
 * Used when RUCA database lookup fails
 */
export const RURAL_ZIP_PREFIXES = {
  /** Montana rural prefixes */
  MONTANA: ['592', '593', '594', '595', '596', '597', '598', '599'],
  /** North Dakota rural prefixes */
  NORTH_DAKOTA: ['693', '694', '695', '696', '697'],
  /** South Dakota rural prefixes */
  SOUTH_DAKOTA: ['570', '571', '572', '573', '574', '575', '576', '577']
} as const;

/**
 * Frontier (very remote) ZIP prefixes
 */
export const FRONTIER_ZIP_PREFIXES = ['592', '593', '697'] as const;

// =====================================================
// ENGAGEMENT THRESHOLDS
// =====================================================

/**
 * Check-in rate calculation denominators
 * CRITICAL: These are fixed denominators, NOT allCheckIns.length
 */
export const CHECK_IN_DENOMINATORS = {
  /** Denominator for 30-day rate */
  RATE_30_DAY: 30,
  /** Denominator for 7-day rate */
  RATE_7_DAY: 7,
  /** Denominator for previous period rate (30 - 7 = 23) */
  PREVIOUS_PERIOD: 23
} as const;

/**
 * Engagement pattern thresholds
 */
export const ENGAGEMENT_THRESHOLDS = {
  /** Consecutive missed check-ins that triggers concern flag */
  CONSECUTIVE_MISSED_CONCERN: 3,
  /** Engagement drop threshold (30% decline) */
  ENGAGEMENT_DROP: 0.3,
  /** Negative mood trend threshold (40% of check-ins) */
  NEGATIVE_MOOD: 0.4,
  /** Game engagement decline threshold (70% of baseline) */
  GAME_DECLINE: 0.7,
  /** Minimum days of data needed for game decline detection */
  GAME_DECLINE_MIN_DAYS: 14,
  /** Days with zero activity threshold for concerning flag */
  ZERO_ACTIVITY_CONCERN: 7,
  /** Days with zero activity threshold for disengaging flag */
  ZERO_ACTIVITY_DISENGAGING: 10,
  /** Engagement change threshold for disengaging flag */
  DISENGAGING_DROP: -30,
  /** Vitals reporting consistency threshold */
  VITALS_CONSISTENCY: 0.7,
  /** Missed vitals in 7 days threshold */
  MISSED_VITALS_CONCERN: 4
} as const;

/**
 * Negative mood keywords for trend detection
 * Used with case-insensitive substring matching
 */
export const NEGATIVE_MOOD_KEYWORDS = [
  'sad',
  'anxious',
  'not great',
  'stressed',
  'tired'
] as const;

/**
 * Red flag symptom keywords
 * Used with case-insensitive substring matching
 */
export const RED_FLAG_SYMPTOM_KEYWORDS = [
  'chest pain',
  'shortness of breath',
  'sob',
  'severe pain',
  'bleeding',
  'confusion',
  'dizzy',
  'faint',
  'unconscious'
] as const;

/**
 * Concerning pattern identifiers
 */
export const CONCERNING_PATTERN_IDS = {
  DECLINING_MOOD: 'declining_mood',
  MISSED_VITALS: 'missed_vitals',
  NO_GAMES: 'no_games',
  ZERO_ACTIVITY: 'zero_activity',
  CRITICAL_ALERTS: 'critical_alerts'
} as const;

// =====================================================
// SELF-REPORTED HEALTH THRESHOLDS
// =====================================================

/**
 * Blood pressure thresholds for self-reported values
 */
export const SELF_REPORTED_BP_THRESHOLDS = {
  SYSTOLIC_HIGH: 160,
  SYSTOLIC_LOW: 90,
  DIASTOLIC_HIGH: 100
} as const;

/**
 * Blood sugar thresholds for self-reported values
 */
export const SELF_REPORTED_BLOOD_SUGAR_THRESHOLDS = {
  HIGH: 250,
  LOW: 70
} as const;

/**
 * Weight change threshold (percentage of last reading)
 * Logic: Math.abs(first - last) > (last * THRESHOLD)
 * Note: Uses LAST reading as baseline, not first
 */
export const WEIGHT_CHANGE_THRESHOLD = 0.05 as const;

/**
 * Symptom count thresholds for self-reported data
 */
export const SYMPTOM_THRESHOLDS = {
  /** Mobility complaints threshold */
  MOBILITY_DECLINING: 3,
  /** Pain complaints threshold */
  PAIN_INCREASING: 5,
  /** Fatigue complaints threshold */
  FATIGUE_INCREASING: 5
} as const;

/**
 * Social isolation thresholds
 */
export const SOCIAL_ISOLATION_THRESHOLDS = {
  /** Days home alone threshold (> this is concerning) */
  DAYS_HOME_ALONE: 15,
  /** Family contact threshold (< this is concerning) */
  FAMILY_CONTACT_MIN: 8
} as const;

// =====================================================
// DATA COMPLETENESS
// =====================================================

/**
 * Critical data fields and their weights for completeness scoring
 *
 * Calculation:
 * 1. Sum weights of fields where value !== undefined && value !== null
 * 2. completeness = Math.round((presentWeight / totalWeight) * 100)
 *
 * Note: false and 0 count as present (only null/undefined are missing)
 */
export const DATA_COMPLETENESS_WEIGHTS = [
  { key: 'clinical.priorAdmissions30Day', weight: 5 },
  { key: 'clinical.comorbidityCount', weight: 5 },
  { key: 'postDischarge.followUpScheduled', weight: 4 },
  { key: 'socialDeterminants.livesAlone', weight: 3 },
  { key: 'medication.activeMedicationCount', weight: 3 }
] as const;

// =====================================================
// EVIDENCE-BASED FEATURE WEIGHTS (for AI prompt)
// =====================================================

/**
 * Clinical feature weights for AI system prompt
 * These guide the AI's risk assessment
 */
export const AI_PROMPT_WEIGHTS = {
  CLINICAL: {
    PRIOR_ADMISSIONS_30DAY: 0.25,
    PRIOR_ADMISSIONS_90DAY: 0.20,
    ED_VISITS_6MONTH: 0.15,
    COMORBIDITY_COUNT: 0.18,
    HIGH_RISK_DIAGNOSIS: 0.15
  },
  MEDICATIONS: {
    POLYPHARMACY: 0.13,
    HIGH_RISK_MEDS: 0.14,
    NO_PRESCRIPTION_FILLED: 0.16
  },
  POST_DISCHARGE: {
    NO_FOLLOW_UP: 0.18,
    FOLLOW_UP_WITHIN_7_DAYS: -0.12 // Protective
  },
  SOCIAL: {
    TRANSPORTATION_BARRIER: 0.16,
    LIVES_ALONE: 0.14,
    RURAL_LOCATION: 0.15,
    LOW_HEALTH_LITERACY: 0.12
  },
  FUNCTIONAL: {
    ADL_DEPENDENCIES: 0.12,
    RECENT_FALLS: 0.11,
    COGNITIVE_IMPAIRMENT: 0.13
  },
  CLINICAL_SECONDARY: {
    LENGTH_OF_STAY: 0.10,
    VITALS_STABLE: -0.09, // Protective
    LAB_TRENDS_CONCERNING: 0.11
  },
  ENGAGEMENT: {
    CONSECUTIVE_MISSED: 0.16,
    ENGAGEMENT_DROP: 0.18,
    RED_FLAG_SYMPTOMS: 0.20,
    NEGATIVE_MOOD: 0.13,
    GAME_DECLINING: 0.14,
    DAYS_ZERO_ACTIVITY: 0.15,
    IS_DISENGAGING: 0.19,
    STOPPED_RESPONDING: 0.22
  }
} as const;

/**
 * RUCA category weights for AI prompt display
 */
export const RUCA_PROMPT_WEIGHTS: Record<string, string> = {
  urban: '0.00 (baseline)',
  large_rural: '0.08',
  small_rural: '0.12',
  isolated_rural: '0.18'
} as const;

// =====================================================
// TENANT CONFIG DEFAULTS
// =====================================================

/**
 * Default tenant configuration values
 */
export const TENANT_CONFIG_DEFAULTS = {
  READMISSION_PREDICTOR_ENABLED: false,
  AUTO_CREATE_CARE_PLAN: false,
  HIGH_RISK_THRESHOLD: 0.50,
  DEFAULT_MODEL: 'claude-sonnet-4-5-20250929'
} as const;

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type LengthOfStayCategory = 'too_short' | 'normal' | 'extended' | 'prolonged';
export type CognitiveSeverity = 'mild' | 'moderate' | 'severe' | undefined;
export type MobilityLevel = 'independent' | 'cane' | 'walker' | 'wheelchair' | 'bedbound';
export type InsuranceType = 'medicare' | 'medicaid' | 'commercial' | 'uninsured' | 'dual_eligible';
export type HealthLiteracyLevel = 'adequate' | 'marginal' | 'low';
export type RUCACategory = 'urban' | 'large_rural' | 'small_rural' | 'isolated_rural';
export type PatientRurality = 'urban' | 'suburban' | 'rural' | 'frontier';
export type DiagnosisCategory = 'CHF' | 'COPD' | 'diabetes' | 'renal_failure' | 'pneumonia' | 'stroke' | 'sepsis' | 'other';

// =====================================================
// ALIAS EXPORTS FOR DOMAIN MODULES
// =====================================================

/**
 * Aliases for socialDeterminants.ts module
 */
export const DISTANCE_RISK_WEIGHTS = {
  HOSPITAL: {
    VERY_HIGH_THRESHOLD: DISTANCE_TO_CARE_PARAMS.HOSPITAL.VERY_FAR_THRESHOLD,
    VERY_HIGH_WEIGHT: DISTANCE_TO_CARE_PARAMS.HOSPITAL.VERY_FAR_WEIGHT,
    HIGH_THRESHOLD: DISTANCE_TO_CARE_PARAMS.HOSPITAL.FAR_THRESHOLD,
    HIGH_WEIGHT: DISTANCE_TO_CARE_PARAMS.HOSPITAL.FAR_WEIGHT,
    MODERATE_THRESHOLD: DISTANCE_TO_CARE_PARAMS.HOSPITAL.MODERATE_THRESHOLD,
    MODERATE_WEIGHT: DISTANCE_TO_CARE_PARAMS.HOSPITAL.MODERATE_WEIGHT,
    LOW_THRESHOLD: DISTANCE_TO_CARE_PARAMS.HOSPITAL.SLIGHT_THRESHOLD,
    LOW_WEIGHT: DISTANCE_TO_CARE_PARAMS.HOSPITAL.SLIGHT_WEIGHT
  },
  PCP: {
    HIGH_THRESHOLD: DISTANCE_TO_CARE_PARAMS.PCP.FAR_THRESHOLD,
    HIGH_WEIGHT: DISTANCE_TO_CARE_PARAMS.PCP.FAR_WEIGHT,
    MODERATE_THRESHOLD: DISTANCE_TO_CARE_PARAMS.PCP.MODERATE_THRESHOLD,
    MODERATE_WEIGHT: DISTANCE_TO_CARE_PARAMS.PCP.MODERATE_WEIGHT
  },
  RUCA_MULTIPLIERS: DISTANCE_TO_CARE_PARAMS.RUCA_MULTIPLIERS,
  MAX_WEIGHT: DISTANCE_TO_CARE_PARAMS.MAX_WEIGHT
} as const;

export const RURAL_ISOLATION_BASE_SCORES = RURAL_ISOLATION_PARAMS.BASE_SCORES;

/**
 * Alias for engagementFactors.ts module
 */
export const RED_FLAG_KEYWORDS = RED_FLAG_SYMPTOM_KEYWORDS;

/**
 * Extended engagement thresholds for engagementFactors.ts module
 * These provide clearer names for the domain module
 */
export const ENGAGEMENT_MODULE_THRESHOLDS = {
  ...ENGAGEMENT_THRESHOLDS,
  DROP_THRESHOLD: ENGAGEMENT_THRESHOLDS.ENGAGEMENT_DROP,
  NEGATIVE_MOOD_THRESHOLD: ENGAGEMENT_THRESHOLDS.NEGATIVE_MOOD,
  CONSECUTIVE_MISSED_THRESHOLD: ENGAGEMENT_THRESHOLDS.CONSECUTIVE_MISSED_CONCERN,
  ZERO_ACTIVITY_DAYS_THRESHOLD: ENGAGEMENT_THRESHOLDS.ZERO_ACTIVITY_DISENGAGING,
  STOPPED_RESPONDING_THRESHOLD: ENGAGEMENT_THRESHOLDS.CONSECUTIVE_MISSED_CONCERN,
  VITALS_CONSISTENT_THRESHOLD: ENGAGEMENT_THRESHOLDS.VITALS_CONSISTENCY,
  DISENGAGING_CHANGE: ENGAGEMENT_THRESHOLDS.DISENGAGING_DROP
} as const;

/**
 * Aliases for selfReportedHealth.ts module
 */
export const SELF_REPORTED_THRESHOLDS = {
  BP: SELF_REPORTED_BP_THRESHOLDS,
  BLOOD_SUGAR: SELF_REPORTED_BLOOD_SUGAR_THRESHOLDS,
  WEIGHT_CHANGE_PERCENT: WEIGHT_CHANGE_THRESHOLD,
  MOBILITY_COMPLAINTS_THRESHOLD: SYMPTOM_THRESHOLDS.MOBILITY_DECLINING,
  PAIN_COMPLAINTS_THRESHOLD: SYMPTOM_THRESHOLDS.PAIN_INCREASING,
  FATIGUE_COMPLAINTS_THRESHOLD: SYMPTOM_THRESHOLDS.FATIGUE_INCREASING,
  HOME_ALONE_DAYS_THRESHOLD: SOCIAL_ISOLATION_THRESHOLDS.DAYS_HOME_ALONE,
  FAMILY_CONTACT_THRESHOLD: SOCIAL_ISOLATION_THRESHOLDS.FAMILY_CONTACT_MIN
} as const;

/**
 * Symptom keyword lists for selfReportedHealth.ts
 */
export const MOBILITY_COMPLAINT_KEYWORDS = ['walking', 'mobility', 'weakness'] as const;
export const PAIN_COMPLAINT_KEYWORDS = ['pain', 'ache', 'sore'] as const;
export const FATIGUE_COMPLAINT_KEYWORDS = ['tired', 'fatigue', 'exhausted'] as const;
export const SIDE_EFFECT_KEYWORDS = ['side effect', 'nausea', 'dizzy from'] as const;
export const HOME_ALONE_KEYWORDS = ['stayed home alone', 'no visitors'] as const;

// =====================================================
// EXPORT ALL AS SINGLE CONFIG OBJECT
// =====================================================

export const READMISSION_MODEL_V1 = {
  VERSION: MODEL_VERSION,
  LOS: LOS_THRESHOLDS,
  VITALS: VITALS_STABILITY_THRESHOLDS,
  LABS: LAB_THRESHOLDS,
  ICD10: ICD10_PREFIXES,
  HIGH_RISK_DIAGNOSES: HIGH_RISK_DIAGNOSIS_PREFIXES,
  MEDICATION: MEDICATION_THRESHOLDS,
  HIGH_RISK_MEDS: HIGH_RISK_MEDICATION_KEYWORDS,
  FOLLOW_UP: FOLLOW_UP_THRESHOLDS,
  COGNITIVE: COGNITIVE_THRESHOLDS,
  FALL_RISK: FALL_RISK_PARAMS,
  MOBILITY_DEVICES: MOBILITY_DEVICE_KEYWORDS,
  DISTANCE_TO_CARE: DISTANCE_TO_CARE_PARAMS,
  RURAL_ISOLATION: RURAL_ISOLATION_PARAMS,
  RUCA: RUCA_THRESHOLDS,
  DRIVING_TIME: DRIVING_TIME_MULTIPLIERS,
  RURAL_ZIPS: RURAL_ZIP_PREFIXES,
  FRONTIER_ZIPS: FRONTIER_ZIP_PREFIXES,
  CHECK_IN: CHECK_IN_DENOMINATORS,
  ENGAGEMENT: ENGAGEMENT_THRESHOLDS,
  NEGATIVE_MOODS: NEGATIVE_MOOD_KEYWORDS,
  RED_FLAGS: RED_FLAG_SYMPTOM_KEYWORDS,
  PATTERNS: CONCERNING_PATTERN_IDS,
  BP: SELF_REPORTED_BP_THRESHOLDS,
  BLOOD_SUGAR: SELF_REPORTED_BLOOD_SUGAR_THRESHOLDS,
  WEIGHT_CHANGE: WEIGHT_CHANGE_THRESHOLD,
  SYMPTOMS: SYMPTOM_THRESHOLDS,
  SOCIAL_ISOLATION: SOCIAL_ISOLATION_THRESHOLDS,
  DATA_COMPLETENESS: DATA_COMPLETENESS_WEIGHTS,
  AI_WEIGHTS: AI_PROMPT_WEIGHTS,
  RUCA_WEIGHTS: RUCA_PROMPT_WEIGHTS,
  TENANT_DEFAULTS: TENANT_CONFIG_DEFAULTS
} as const;

export default READMISSION_MODEL_V1;
