/**
 * Shared Utilities for Readmission Risk Prediction
 *
 * Common helper functions used across domain modules.
 * These functions preserve EXACT behavior from the original implementation.
 *
 * CRITICAL: Do NOT modify these functions without updating golden tests.
 *
 * @module readmission/utils
 */

import {
  LOS_THRESHOLDS,
  COGNITIVE_THRESHOLDS,
  FALL_RISK_PARAMS,
  MOBILITY_DEVICE_KEYWORDS,
  RUCA_THRESHOLDS as _RUCA_THRESHOLDS,
  ICD10_PREFIXES as _ICD10_PREFIXES,
  HIGH_RISK_DIAGNOSIS_PREFIXES
} from '../readmissionModelConfig';

import type {
  LengthOfStayCategory,
  CognitiveSeverity,
  MobilityLevel,
  InsuranceType,
  HealthLiteracyLevel,
  DiagnosisCategory
} from '../readmissionModelConfig';

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Type guard for Record<string, unknown>
 * Preserves exact behavior from original implementation
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// =====================================================
// CLINICAL CATEGORIZATION
// =====================================================

/**
 * Categorize length of stay
 *
 * BEHAVIOR NOTES:
 * - if (!days) return 'normal' — 0 is falsy, returns 'normal'
 * - Uses strict comparison operators as documented
 *
 * @param days - Length of stay in days
 * @returns Category: 'too_short' | 'normal' | 'extended' | 'prolonged'
 */
export function categorizeLengthOfStay(days?: number): LengthOfStayCategory {
  if (!days) return 'normal';
  if (days < LOS_THRESHOLDS.TOO_SHORT) return 'too_short';
  if (days <= LOS_THRESHOLDS.NORMAL_MAX) return 'normal';
  if (days <= LOS_THRESHOLDS.EXTENDED_MAX) return 'extended';
  return 'prolonged';
}

/**
 * Categorize ICD-10 diagnosis code to condition category
 *
 * @param code - ICD-10 code
 * @returns Condition category
 */
export function categorizeCondition(code: string): string {
  if (code?.startsWith('I50')) return 'CHF';
  if (code?.startsWith('J44') || code?.startsWith('J45')) return 'COPD';
  if (code?.startsWith('E11') || code?.startsWith('E10')) return 'diabetes';
  if (code?.startsWith('N18')) return 'renal_failure';
  if (code?.startsWith('C')) return 'cancer';
  return 'other';
}

/**
 * Categorize primary diagnosis to clinical category
 *
 * @param code - ICD-10 code
 * @returns Diagnosis category
 */
export function categorizeDiagnosis(code?: string): DiagnosisCategory {
  if (!code) return 'other';
  if (code.startsWith('I50')) return 'CHF';
  if (code.startsWith('J44') || code.startsWith('J45')) return 'COPD';
  if (code.startsWith('E11') || code.startsWith('E10')) return 'diabetes';
  if (code.startsWith('N18')) return 'renal_failure';
  if (code.startsWith('J18')) return 'pneumonia';
  if (code.startsWith('I63')) return 'stroke';
  if (code.startsWith('A41')) return 'sepsis';
  return 'other';
}

/**
 * Check if diagnosis code is high-risk
 *
 * @param code - ICD-10 code
 * @returns True if high-risk diagnosis
 */
export function checkHighRiskDiagnosis(code: string): boolean {
  return HIGH_RISK_DIAGNOSIS_PREFIXES.some(prefix => code.startsWith(prefix));
}

// =====================================================
// FUNCTIONAL STATUS CATEGORIZATION
// =====================================================

/**
 * Categorize cognitive impairment severity
 *
 * BEHAVIOR NOTES:
 * - if (!score) return undefined — 0 is falsy, returns undefined
 * - Uses strict < comparisons as documented
 *
 * @param score - Cognitive risk score
 * @returns Severity: undefined | 'mild' | 'moderate' | 'severe'
 */
export function categorizeCognitiveSeverity(score?: number): CognitiveSeverity {
  if (!score) return undefined;
  if (score < COGNITIVE_THRESHOLDS.SEVERITY.MIN_FOR_SEVERITY) return undefined;
  if (score < COGNITIVE_THRESHOLDS.SEVERITY.MILD_MAX) return 'mild';
  if (score < COGNITIVE_THRESHOLDS.SEVERITY.MODERATE_MAX) return 'moderate';
  return 'severe';
}

/**
 * Categorize mobility level from walking ability
 *
 * @param walkingAbility - Walking ability string from risk assessment
 * @returns Mobility level
 */
export function categorizeMobility(walkingAbility?: string): MobilityLevel {
  if (!walkingAbility) return 'independent';
  if (walkingAbility.includes('bedbound')) return 'bedbound';
  if (walkingAbility.includes('wheelchair')) return 'wheelchair';
  if (walkingAbility.includes('walker')) return 'walker';
  if (walkingAbility.includes('cane')) return 'cane';
  return 'independent';
}

/**
 * Calculate fall risk score
 *
 * CALCULATION ORDER (must be preserved):
 * 1. base = Math.min(fallsCount * FALLS_MULTIPLIER, FALLS_MAX_BASE)
 * 2. +MOBILITY_BONUS if mobility_risk_score > MOBILITY_THRESHOLD
 * 3. +COGNITIVE_BONUS if cognitive_risk_score > COGNITIVE_THRESHOLD
 * 4. +WALKER_BONUS if walkingAbility includes 'walker' or 'wheelchair'
 * 5. result = Math.min(score, MAX_SCORE)
 *
 * @param fallsCount - Number of falls in period
 * @param riskAssessment - Risk assessment data object
 * @returns Fall risk score 0-10
 */
export function calculateFallRiskScore(fallsCount: number, riskAssessment: unknown): number {
  let score = Math.min(fallsCount * FALL_RISK_PARAMS.FALLS_MULTIPLIER, FALL_RISK_PARAMS.FALLS_MAX_BASE);

  if (isRecord(riskAssessment)) {
    const mobilityRiskScore = riskAssessment['mobility_risk_score'];
    const cognitiveRiskScore = riskAssessment['cognitive_risk_score'];
    const walkingAbility = riskAssessment['walking_ability'];

    if (typeof mobilityRiskScore === 'number' && mobilityRiskScore > FALL_RISK_PARAMS.MOBILITY_THRESHOLD) {
      score += FALL_RISK_PARAMS.MOBILITY_BONUS;
    }
    if (typeof cognitiveRiskScore === 'number' && cognitiveRiskScore > FALL_RISK_PARAMS.COGNITIVE_THRESHOLD) {
      score += FALL_RISK_PARAMS.COGNITIVE_BONUS;
    }
    if (typeof walkingAbility === 'string') {
      if (MOBILITY_DEVICE_KEYWORDS.some(device => walkingAbility.includes(device))) {
        score += FALL_RISK_PARAMS.WALKER_BONUS;
      }
    }
  }

  return Math.min(score, FALL_RISK_PARAMS.MAX_SCORE);
}

// =====================================================
// SOCIAL DETERMINANTS CATEGORIZATION
// =====================================================

/**
 * Categorize insurance type
 *
 * @param type - Insurance type string
 * @returns Categorized insurance type
 */
export function categorizeInsurance(type?: string): InsuranceType {
  if (!type) return 'uninsured';
  if (type.includes('dual')) return 'dual_eligible';
  if (type.includes('medicaid')) return 'medicaid';
  if (type.includes('medicare')) return 'medicare';
  if (type.includes('commercial') || type.includes('private')) return 'commercial';
  return 'uninsured';
}

/**
 * Categorize health literacy level
 *
 * @param level - Health literacy level string
 * @returns Categorized health literacy level
 */
export function categorizeHealthLiteracy(level?: string): HealthLiteracyLevel {
  if (!level) return 'marginal';
  if (level.includes('adequate')) return 'adequate';
  if (level.includes('low')) return 'low';
  return 'marginal';
}

// =====================================================
// NESTED VALUE ACCESS
// =====================================================

/**
 * Get nested value from object by dot-notation path
 * Used for data completeness calculation
 *
 * @param obj - Object to search
 * @param path - Dot-notation path (e.g., 'clinical.priorAdmissions30Day')
 * @returns Value at path or undefined
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, obj);
}

// =====================================================
// MEDICATION MATCHING
// =====================================================

/**
 * Check if medication matches a class by keyword
 * Uses case-insensitive substring matching
 *
 * @param med - Medication object
 * @param classKeywords - Keywords to match
 * @returns True if medication matches any keyword
 */
export function medicationMatchesClass(med: unknown, classKeywords: readonly string[]): boolean {
  const medName =
    isRecord(med) && typeof med['medication_display'] === 'string'
      ? (med['medication_display'] as string).toLowerCase()
      : '';
  return classKeywords.some(keyword => medName.includes(keyword));
}

// =====================================================
// TIME CALCULATIONS
// =====================================================

/**
 * Get timestamp for N days ago from now
 *
 * @param days - Number of days ago
 * @param now - Current timestamp (for testing)
 * @returns Date object for N days ago
 */
export function getDaysAgo(days: number, now: number = Date.now()): Date {
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

/**
 * Get ISO string for N days ago from now
 *
 * @param days - Number of days ago
 * @param now - Current timestamp (for testing)
 * @returns ISO date string for N days ago
 */
export function getDaysAgoISO(days: number, now: number = Date.now()): string {
  return getDaysAgo(days, now).toISOString();
}

/**
 * Calculate age from date of birth
 *
 * @param dob - Date of birth (ISO string or Date)
 * @param now - Current timestamp (for testing)
 * @returns Age in years (floored)
 */
export function calculateAge(dob: string | Date, now: number = Date.now()): number {
  const dobTime = typeof dob === 'string' ? new Date(dob).getTime() : dob.getTime();
  return Math.floor((now - dobTime) / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Calculate days between two dates
 *
 * @param startDate - Start date (ISO string or Date)
 * @param endDate - End date (ISO string or Date)
 * @returns Days between dates (floored)
 */
export function daysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === 'string' ? new Date(startDate).getTime() : startDate.getTime();
  const end = typeof endDate === 'string' ? new Date(endDate).getTime() : endDate.getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}
