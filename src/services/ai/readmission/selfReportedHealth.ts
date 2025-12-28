/**
 * Self-Reported Health Extraction Module
 *
 * Extracts patient self-reported health status from check-ins:
 * - Symptoms and red flag symptoms
 * - Self-reported vital trends
 * - Functional changes
 * - Medication adherence
 * - Social activity patterns
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/selfReportedHealth
 */

import { supabase } from '../../../lib/supabaseClient';
import type { SelfReportedHealth } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import {
  SELF_REPORTED_THRESHOLDS,
  RED_FLAG_SYMPTOM_KEYWORDS,
  MOBILITY_COMPLAINT_KEYWORDS,
  PAIN_COMPLAINT_KEYWORDS,
  FATIGUE_COMPLAINT_KEYWORDS,
  SIDE_EFFECT_KEYWORDS,
  HOME_ALONE_KEYWORDS
} from '../readmissionModelConfig';

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract symptoms from check-ins
 */
function extractSymptoms(allCheckIns: Array<{ responses?: Record<string, unknown> }>) {
  const symptoms = allCheckIns
    .filter(c => c.responses?.symptoms)
    .map(c => c.responses!.symptoms as string);

  const redFlagSymptoms = symptoms.filter(s =>
    RED_FLAG_SYMPTOM_KEYWORDS.some(keyword => s.toLowerCase().includes(keyword))
  );

  return { symptoms, redFlagSymptoms };
}

/**
 * Extract vital trends from self-reported data
 */
function extractVitalTrends(allCheckIns: Array<{ responses?: Record<string, unknown> }>) {
  // BP readings
  const bpReadings = allCheckIns
    .filter(c => c.responses?.blood_pressure)
    .map(c => {
      const bp = (c.responses!.blood_pressure as string).split('/');
      return { systolic: parseInt(bp[0]), diastolic: parseInt(bp[1]) };
    });

  // CRITICAL: Preserve exact thresholds - > 160, < 90, > 100
  const bpTrendConcerning = bpReadings.some(bp =>
    bp.systolic > SELF_REPORTED_THRESHOLDS.BP.SYSTOLIC_HIGH ||
    bp.systolic < SELF_REPORTED_THRESHOLDS.BP.SYSTOLIC_LOW ||
    bp.diastolic > SELF_REPORTED_THRESHOLDS.BP.DIASTOLIC_HIGH
  );

  // Blood sugar readings
  const bloodSugarReadings = allCheckIns
    .filter(c => c.responses?.blood_sugar)
    .map(c => parseInt(c.responses!.blood_sugar as string));

  // CRITICAL: Preserve exact thresholds - > 250, < 70
  const bsTrendConcerning = bloodSugarReadings.some(bs =>
    bs > SELF_REPORTED_THRESHOLDS.BLOOD_SUGAR.HIGH ||
    bs < SELF_REPORTED_THRESHOLDS.BLOOD_SUGAR.LOW
  );

  // Weight readings
  const weightReadings = allCheckIns
    .filter(c => c.responses?.weight)
    .map(c => parseFloat(c.responses!.weight as string));

  // CRITICAL: Preserve exact condition - length >= 2 && Math.abs comparison > 5%
  const weightChangeConcerning = weightReadings.length >= 2 &&
    Math.abs(weightReadings[0] - weightReadings[weightReadings.length - 1]) > (weightReadings[weightReadings.length - 1] * SELF_REPORTED_THRESHOLDS.WEIGHT_CHANGE_PERCENT);

  return { bpTrendConcerning, bsTrendConcerning, weightChangeConcerning };
}

/**
 * Extract functional changes from symptoms
 */
function extractFunctionalChanges(symptoms: string[]) {
  const mobilityComplaints = symptoms.filter(s =>
    MOBILITY_COMPLAINT_KEYWORDS.some(keyword => s.toLowerCase().includes(keyword))
  );

  const painComplaints = symptoms.filter(s =>
    PAIN_COMPLAINT_KEYWORDS.some(keyword => s.toLowerCase().includes(keyword))
  );

  const fatigueComplaints = symptoms.filter(s =>
    FATIGUE_COMPLAINT_KEYWORDS.some(keyword => s.toLowerCase().includes(keyword))
  );

  return {
    // CRITICAL: Preserve exact thresholds - > 3, > 5, > 5
    reportedMobilityDeclining: mobilityComplaints.length > SELF_REPORTED_THRESHOLDS.MOBILITY_COMPLAINTS_THRESHOLD,
    reportedPainIncreasing: painComplaints.length > SELF_REPORTED_THRESHOLDS.PAIN_COMPLAINTS_THRESHOLD,
    reportedFatigueIncreasing: fatigueComplaints.length > SELF_REPORTED_THRESHOLDS.FATIGUE_COMPLAINTS_THRESHOLD
  };
}

/**
 * Extract medication adherence from check-ins
 */
function extractMedicationAdherence(
  allCheckIns: Array<{ responses?: Record<string, unknown>; concern_flags?: string[] }>,
  symptoms: string[]
) {
  const medRelatedResponses = allCheckIns.filter(c =>
    c.responses?.medications_taken === false ||
    c.responses?.forgot_medication === true ||
    c.concern_flags?.includes('medication_non_adherence')
  );

  const missedMedsDays = medRelatedResponses.length;

  const sideEffectsReported = symptoms.some(s =>
    SIDE_EFFECT_KEYWORDS.some(keyword => s.toLowerCase().includes(keyword))
  );

  const medicationConcerns = medRelatedResponses
    .map(r => (r.responses?.medication_concern as string | undefined) || '')
    .filter(Boolean);

  return {
    missedMedsDays,
    sideEffectsReported,
    medicationConcerns
  };
}

/**
 * Extract social activity patterns
 */
function extractSocialActivity(allCheckIns: Array<{ responses?: Record<string, unknown> }>) {
  const socialResponses = allCheckIns
    .filter(c => c.responses?.social_activity)
    .map(c => c.responses!.social_activity as string);

  const daysHomeAlone = socialResponses.filter(s =>
    HOME_ALONE_KEYWORDS.some(keyword => s.toLowerCase().includes(keyword))
  ).length;

  // CRITICAL: Preserve exact threshold - > 15 (>50% of days)
  const socialIsolationIncreasing = daysHomeAlone > SELF_REPORTED_THRESHOLDS.HOME_ALONE_DAYS_THRESHOLD;

  const familyContact = socialResponses.filter(s =>
    s.toLowerCase().includes('family') ||
    s.toLowerCase().includes('children') ||
    s.toLowerCase().includes('spouse')
  ).length;

  // CRITICAL: Preserve exact threshold - < 8 (<2x per week)
  const familyContactDecreasing = familyContact < SELF_REPORTED_THRESHOLDS.FAMILY_CONTACT_THRESHOLD;

  return {
    daysHomeAlone,
    socialIsolationIncreasing,
    familyContactDecreasing
  };
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract self-reported health for a patient at discharge
 *
 * Key risk indicators:
 * - Red flag symptoms: 0.20 weight
 * - Missed medications: 0.14 weight
 * - Social isolation increasing: 0.12 weight
 *
 * @param context - Discharge context
 * @param now - Current timestamp (for testing)
 * @returns Self-reported health factors
 */
export async function extractSelfReportedHealth(
  context: DischargeContext,
  now: number = Date.now()
): Promise<SelfReportedHealth> {
  const patientId = context.patientId;
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Get check-ins with health responses
  const { data: checkIns } = await supabase
    .from('patient_daily_check_ins')
    .select('*')
    .eq('patient_id', patientId)
    .gte('check_in_date', thirtyDaysAgo.toISOString())
    .order('check_in_date', { ascending: false });

  const allCheckIns = checkIns || [];

  // Extract symptoms
  const { symptoms, redFlagSymptoms } = extractSymptoms(allCheckIns);

  // Extract vital trends
  const vitalTrends = extractVitalTrends(allCheckIns);

  // Extract functional changes
  const functionalChanges = extractFunctionalChanges(symptoms);

  // Extract medication adherence
  const medAdherence = extractMedicationAdherence(allCheckIns, symptoms);

  // Extract social activity
  const socialActivity = extractSocialActivity(allCheckIns);

  return {
    recentSymptoms: symptoms,
    symptomCount30Day: symptoms.length,
    hasRedFlagSymptoms: redFlagSymptoms.length > 0,
    redFlagSymptomsList: redFlagSymptoms,

    selfReportedBpTrendConcerning: vitalTrends.bpTrendConcerning,
    selfReportedBloodSugarUnstable: vitalTrends.bsTrendConcerning,
    selfReportedWeightChangeConcerning: vitalTrends.weightChangeConcerning,

    reportedMobilityDeclining: functionalChanges.reportedMobilityDeclining,
    reportedPainIncreasing: functionalChanges.reportedPainIncreasing,
    reportedFatigueIncreasing: functionalChanges.reportedFatigueIncreasing,

    missedMedicationsDays30Day: medAdherence.missedMedsDays,
    medicationSideEffectsReported: medAdherence.sideEffectsReported,
    medicationConcerns: medAdherence.medicationConcerns,

    daysHomeAlone30Day: socialActivity.daysHomeAlone,
    socialIsolationIncreasing: socialActivity.socialIsolationIncreasing,
    familyContactDecreasing: socialActivity.familyContactDecreasing
  };
}
