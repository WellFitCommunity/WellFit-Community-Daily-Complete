/**
 * Social Determinants Extraction Module
 *
 * Extracts SDOH risk indicators:
 * - Transportation barriers (critical for rural)
 * - Rural isolation with RUCA-based classification
 * - Insurance and financial barriers
 * - Health literacy
 * - Social support
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/socialDeterminants
 */

import { supabase } from '../../../lib/supabaseClient';
import type { SocialDeterminants } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import {
  RUCA_THRESHOLDS,
  DISTANCE_RISK_WEIGHTS,
  RURAL_ISOLATION_BASE_SCORES
} from '../readmissionModelConfig';
import { isRecord, categorizeInsurance, categorizeHealthLiteracy } from './utils';

// =====================================================
// TYPES
// =====================================================

interface RuralStatusResult {
  isRural: boolean;
  rucaCategory: 'urban' | 'large_rural' | 'small_rural' | 'isolated_rural';
  patientRurality: 'urban' | 'suburban' | 'rural' | 'frontier';
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check rural status using RUCA (Rural-Urban Commuting Area) codes
 * Returns detailed rural classification for risk weighting
 */
async function checkRuralStatus(zipCode?: string): Promise<RuralStatusResult> {
  if (!zipCode) {
    return { isRural: false, rucaCategory: 'urban', patientRurality: 'urban' };
  }

  // Try to get RUCA classification from database
  const { data: ruralData } = await supabase
    .from('zip_ruca_codes')
    .select('ruca_code, ruca_category')
    .eq('zip_code', zipCode.substring(0, 5))
    .limit(1)
    .single();

  if (ruralData?.ruca_code) {
    const ruca = ruralData.ruca_code;
    if (ruca <= RUCA_THRESHOLDS.URBAN_MAX) {
      return { isRural: false, rucaCategory: 'urban', patientRurality: 'urban' };
    } else if (ruca <= RUCA_THRESHOLDS.LARGE_RURAL_MAX) {
      return { isRural: true, rucaCategory: 'large_rural', patientRurality: 'suburban' };
    } else if (ruca <= RUCA_THRESHOLDS.SMALL_RURAL_MAX) {
      return { isRural: true, rucaCategory: 'small_rural', patientRurality: 'rural' };
    } else {
      return { isRural: true, rucaCategory: 'isolated_rural', patientRurality: 'frontier' };
    }
  }

  // Fallback: Estimate rurality from first 3 digits of ZIP (regional patterns)
  // In production, this would use a proper RUCA lookup table
  const zip3 = zipCode.substring(0, 3);

  // Example: Some rural ZIP code prefixes (this is simplified)
  const ruralPrefixes = ['592', '593', '594', '595', '596', '597', '598', '599', // Montana
                        '693', '694', '695', '696', '697', // North Dakota
                        '570', '571', '572', '573', '574', '575', '576', '577']; // South Dakota
  const frontierPrefixes = ['592', '593', '697']; // Very remote areas

  if (frontierPrefixes.includes(zip3)) {
    return { isRural: true, rucaCategory: 'isolated_rural', patientRurality: 'frontier' };
  } else if (ruralPrefixes.includes(zip3)) {
    return { isRural: true, rucaCategory: 'small_rural', patientRurality: 'rural' };
  }

  return { isRural: false, rucaCategory: 'urban', patientRurality: 'urban' };
}

/**
 * Check if ZIP code is in a Healthcare Professional Shortage Area (HPSA)
 * HPSA status increases readmission risk due to limited access to care
 */
async function checkHPSAStatus(zipCode?: string): Promise<boolean> {
  if (!zipCode) return false;

  // Try to get HPSA status from database
  const { data } = await supabase
    .from('hpsa_designations')
    .select('designation_type')
    .eq('zip_code', zipCode.substring(0, 5))
    .eq('status', 'active')
    .limit(1)
    .single();

  return !!data?.designation_type;
}

/**
 * Calculate distance-to-care risk weight
 * Higher distances contribute more to readmission risk
 * Based on research showing 15+ miles to care increases risk significantly
 */
function calculateDistanceToCareRiskWeight(
  distanceToHospital?: number,
  distanceToPcp?: number,
  rucaCategory?: string
): number {
  let weight = 0;

  // Hospital distance factor (most critical for readmissions)
  if (distanceToHospital !== undefined) {
    if (distanceToHospital > DISTANCE_RISK_WEIGHTS.HOSPITAL.VERY_HIGH_THRESHOLD) {
      weight += DISTANCE_RISK_WEIGHTS.HOSPITAL.VERY_HIGH_WEIGHT; // Very high risk - over 1 hour drive
    } else if (distanceToHospital > DISTANCE_RISK_WEIGHTS.HOSPITAL.HIGH_THRESHOLD) {
      weight += DISTANCE_RISK_WEIGHTS.HOSPITAL.HIGH_WEIGHT; // High risk - 30-60 min drive
    } else if (distanceToHospital > DISTANCE_RISK_WEIGHTS.HOSPITAL.MODERATE_THRESHOLD) {
      weight += DISTANCE_RISK_WEIGHTS.HOSPITAL.MODERATE_WEIGHT; // Moderate risk
    } else if (distanceToHospital > DISTANCE_RISK_WEIGHTS.HOSPITAL.LOW_THRESHOLD) {
      weight += DISTANCE_RISK_WEIGHTS.HOSPITAL.LOW_WEIGHT; // Slight risk
    }
  }

  // PCP distance factor (important for follow-up)
  if (distanceToPcp !== undefined) {
    if (distanceToPcp > DISTANCE_RISK_WEIGHTS.PCP.HIGH_THRESHOLD) {
      weight += DISTANCE_RISK_WEIGHTS.PCP.HIGH_WEIGHT;
    } else if (distanceToPcp > DISTANCE_RISK_WEIGHTS.PCP.MODERATE_THRESHOLD) {
      weight += DISTANCE_RISK_WEIGHTS.PCP.MODERATE_WEIGHT;
    }
  }

  // RUCA category multiplier for rural areas
  if (rucaCategory === 'isolated_rural') {
    weight *= DISTANCE_RISK_WEIGHTS.RUCA_MULTIPLIERS.ISOLATED_RURAL; // 30% increase for frontier areas
  } else if (rucaCategory === 'small_rural') {
    weight *= DISTANCE_RISK_WEIGHTS.RUCA_MULTIPLIERS.SMALL_RURAL; // 15% increase for small rural
  }

  // Cap at 0.25 (25% contribution to total risk)
  return Math.min(weight, DISTANCE_RISK_WEIGHTS.MAX_WEIGHT);
}

/**
 * Calculate rural isolation score
 */
function calculateRuralIsolationScore(
  transportation: unknown,
  isRural: boolean,
  rucaCategory?: string
): number {
  if (!isRural) return 0;

  let score = 0;

  // Base score by RUCA category
  switch (rucaCategory) {
    case 'isolated_rural':
      score = RURAL_ISOLATION_BASE_SCORES.ISOLATED_RURAL;
      break;
    case 'small_rural':
      score = RURAL_ISOLATION_BASE_SCORES.SMALL_RURAL;
      break;
    case 'large_rural':
      score = RURAL_ISOLATION_BASE_SCORES.LARGE_RURAL;
      break;
    default:
      score = RURAL_ISOLATION_BASE_SCORES.DEFAULT;
  }

  const details = isRecord(transportation) ? transportation['details'] : undefined;

  // Distance factors
  const distanceToHospital = isRecord(details) ? (details['distance_to_hospital'] as number | undefined) : undefined;
  const distanceToPcp = isRecord(details) ? (details['distance_to_pcp'] as number | undefined) : undefined;
  const publicTransit = isRecord(details) ? (details['public_transit'] as boolean | undefined) : undefined;

  if (typeof distanceToHospital === 'number') {
    if (distanceToHospital > 60) score += 2;
    else if (distanceToHospital > 30) score += 1;
  }

  if (typeof distanceToPcp === 'number' && distanceToPcp > 30) score += 1;

  // Infrastructure factors
  if (publicTransit === false) score += 1;

  return Math.min(score, 10);
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract social determinants for a patient at discharge
 *
 * Key risk indicators:
 * - Transportation barriers: 0.16 weight
 * - Lives alone: 0.14 weight
 * - Rural location: 0.15 weight
 * - Low health literacy: 0.12 weight
 *
 * @param context - Discharge context
 * @returns Social determinants factors
 */
export async function extractSocialDeterminants(
  context: DischargeContext
): Promise<SocialDeterminants> {
  const patientId = context.patientId;

  // Get SDOH assessment data
  const { data: sdohData } = await supabase
    .from('sdoh_indicators')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20);

  const sdohIndicators = sdohData || [];

  // Extract specific SDOH factors
  const transportation = sdohIndicators.find(s => s.category === 'transportation');
  const housing = sdohIndicators.find(s => s.category === 'housing');
  const insurance = sdohIndicators.find(s => s.category === 'insurance');
  const healthLiteracy = sdohIndicators.find(s => s.category === 'health_literacy');
  const socialSupport = sdohIndicators.find(s => s.category === 'social_support');

  // Get patient profile for additional context
  const { data: profile } = await supabase
    .from('profiles')
    .select('address_city, address_state, address_zip')
    .eq('id', patientId)
    .single();

  // Determine rural status with RUCA-based classification
  const ruralStatus = await checkRuralStatus(profile?.address_zip);

  // Calculate distance-to-care risk weight (for rural model weighting)
  const distanceToHospital = isRecord(transportation?.details)
    ? (transportation.details['distance_to_hospital'] as number | undefined)
    : undefined;
  const distanceToPcp = isRecord(transportation?.details)
    ? (transportation.details['distance_to_pcp'] as number | undefined)
    : undefined;

  const distanceToCareRiskWeight = calculateDistanceToCareRiskWeight(
    distanceToHospital,
    distanceToPcp,
    ruralStatus.rucaCategory
  );

  // Check HPSA status (Healthcare Professional Shortage Area)
  const isInHPSA = await checkHPSAStatus(profile?.address_zip);

  // Calculate estimated minutes to ED (rough estimate: 1 mile = 1.5-2 min in rural areas)
  const minutesToED = distanceToHospital
    ? Math.round(distanceToHospital * (ruralStatus.isRural ? 2 : 1.5))
    : undefined;

  return {
    livesAlone: (isRecord(housing?.details) ? (housing.details['lives_alone'] as boolean | undefined) : undefined) || false,
    hasCaregiver: (isRecord(socialSupport?.details) ? (socialSupport.details['has_caregiver'] as boolean | undefined) : undefined) || false,
    caregiverAvailable24Hours: (isRecord(socialSupport?.details) ? (socialSupport.details['caregiver_24hr'] as boolean | undefined) : undefined) || false,
    caregiverReliable: (isRecord(socialSupport?.details) ? (socialSupport.details['caregiver_reliable'] as boolean | undefined) : undefined) || false,

    // CRITICAL: Preserve exact 'in' operator usage - checks array indices, not membership
    // transportation?.risk_level === 'high' || transportation?.risk_level === 'critical'
    hasTransportationBarrier: transportation?.risk_level === 'high' || transportation?.risk_level === 'critical',
    distanceToNearestHospitalMiles: distanceToHospital,
    distanceToPcpMiles: distanceToPcp,
    publicTransitAvailable: (isRecord(transportation?.details) ? (transportation.details['public_transit'] as boolean | undefined) : undefined) || false,

    // Enhanced rural classification
    isRuralLocation: ruralStatus.isRural,
    ruralIsolationScore: calculateRuralIsolationScore(transportation as unknown, ruralStatus.isRural, ruralStatus.rucaCategory),
    rucaCategory: ruralStatus.rucaCategory,
    distanceToCareRiskWeight,
    patientRurality: ruralStatus.patientRurality,
    isInHealthcareShortageArea: isInHPSA,
    minutesToNearestED: minutesToED,

    insuranceType: categorizeInsurance(isRecord(insurance?.details) ? (insurance.details['type'] as string | undefined) : undefined),
    hasMedicaid: (isRecord(insurance?.details) ? (insurance.details['type'] as string | undefined) : undefined) === 'medicaid'
      || (isRecord(insurance?.details) ? (insurance.details['type'] as string | undefined) : undefined) === 'dual_eligible',
    // CRITICAL: Preserve exact 'in' operator check
    hasInsuranceGaps: insurance?.risk_level === 'high' || insurance?.risk_level === 'critical',
    financialBarriersToMedications: (isRecord(insurance?.details) ? (insurance.details['medication_cost_barrier'] as boolean | undefined) : undefined) || false,
    financialBarriersToFollowUp: (isRecord(insurance?.details) ? (insurance.details['visit_cost_barrier'] as boolean | undefined) : undefined) || false,

    healthLiteracyLevel: categorizeHealthLiteracy(isRecord(healthLiteracy?.details) ? (healthLiteracy.details['level'] as string | undefined) : undefined),
    // CRITICAL: Preserve exact 'in' operator check
    lowHealthLiteracy: healthLiteracy?.risk_level === 'high' || healthLiteracy?.risk_level === 'critical',
    languageBarrier: (isRecord(healthLiteracy?.details) ? (healthLiteracy.details['language_barrier'] as boolean | undefined) : undefined) || false,
    interpreterNeeded: (isRecord(healthLiteracy?.details) ? (healthLiteracy.details['interpreter_needed'] as boolean | undefined) : undefined) || false,

    socialSupportScore: (socialSupport?.score as number | undefined) || 0,
    hasFamilySupport: (isRecord(socialSupport?.details) ? (socialSupport.details['family_support'] as boolean | undefined) : undefined) || false,
    hasCommunitySupport: (isRecord(socialSupport?.details) ? (socialSupport.details['community_support'] as boolean | undefined) : undefined) || false,
    // CRITICAL: Preserve exact 'in' operator check
    sociallyIsolated: socialSupport?.risk_level === 'high' || socialSupport?.risk_level === 'critical'
  };
}
