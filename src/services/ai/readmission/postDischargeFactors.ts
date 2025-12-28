/**
 * Post-Discharge Factors Extraction Module
 *
 * Extracts post-discharge setup risk indicators:
 * - Follow-up appointment timing
 * - PCP assignment
 * - Pending test results
 * - Discharge instructions
 *
 * CRITICAL: All logic preserves EXACT behavior from original implementation.
 *
 * @module readmission/postDischargeFactors
 */

import { supabase } from '../../../lib/supabaseClient';
import type { PostDischargeFactors } from '../../../types/readmissionRiskFeatures';
import type { DischargeContext } from '../readmissionRiskPredictor';
import { FOLLOW_UP_THRESHOLDS } from '../readmissionModelConfig';
import { isRecord, daysBetween } from './utils';

// =====================================================
// TYPES
// =====================================================

interface FollowUpResult {
  scheduled: boolean;
  daysUntil?: number;
}

interface PcpResult {
  assigned: boolean;
  contacted: boolean;
}

interface PendingTestsResult {
  hasPending: boolean;
  testsList: string[];
}

interface DischargeInstructionsResult {
  provided: boolean;
  understood: boolean;
  teachBackCompleted: boolean;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get follow-up appointment info
 */
async function getFollowUpAppointment(patientId: string, dischargeDate: string): Promise<FollowUpResult> {
  const { data } = await supabase
    .from('fhir_appointments')
    .select('*')
    .eq('patient_id', patientId)
    .gte('start', dischargeDate)
    .order('start', { ascending: true })
    .limit(1)
    .single();

  if (!data) {
    return { scheduled: false, daysUntil: undefined };
  }

  const daysUntil = Math.floor(
    (new Date(data.start).getTime() - new Date(dischargeDate).getTime()) / (24 * 60 * 60 * 1000)
  );

  return { scheduled: true, daysUntil };
}

/**
 * Get PCP assignment status
 */
async function getPcpAssignment(patientId: string): Promise<PcpResult> {
  const { data } = await supabase
    .from('profiles')
    .select('primary_care_provider_id')
    .eq('id', patientId)
    .single();

  return {
    assigned: !!data?.primary_care_provider_id,
    contacted: false // Would need discharge notification tracking
  };
}

/**
 * Get pending test results
 */
async function getPendingTestResults(patientId: string, dischargeDate: string): Promise<PendingTestsResult> {
  const { data } = await supabase
    .from('fhir_diagnostic_reports')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'pending')
    .lte('effective_date_time', dischargeDate);

  const pending = data || [];

  return {
    hasPending: pending.length > 0,
    testsList: pending.map(t => t.code_display || 'Unknown test')
  };
}

/**
 * Get discharge instructions status
 *
 * NOTE: This is a placeholder implementation that returns fixed values.
 * The original implementation also returns these placeholder values.
 * DO NOT "improve" this - preserve exact behavior.
 */
async function getDischargeInstructions(_patientId: string, _dischargeDate: string): Promise<DischargeInstructionsResult> {
  // This would check discharge documentation
  // For now, return placeholder data - INTENTIONAL, DO NOT CHANGE
  return {
    provided: true,
    understood: true,
    teachBackCompleted: false
  };
}

/**
 * Check if patient has home support
 */
async function hasHomeSupport(patientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('sdoh_indicators')
    .select('*')
    .eq('patient_id', patientId)
    .eq('category', 'social_support')
    .eq('status', 'active')
    .single();

  return (isRecord(data?.details) ? (data.details['has_caregiver'] as boolean | undefined) : undefined)
    || (isRecord(data?.details) ? (data.details['family_support'] as boolean | undefined) : undefined)
    || false;
}

// =====================================================
// MAIN EXPORT
// =====================================================

/**
 * Extract post-discharge factors for a patient at discharge
 *
 * Key risk indicators:
 * - No follow-up scheduled: 0.18 weight
 * - Follow-up within 7 days: -0.12 weight (protective)
 *
 * @param context - Discharge context
 * @returns Post-discharge factors
 */
export async function extractPostDischargeFactors(
  context: DischargeContext
): Promise<PostDischargeFactors> {
  const patientId = context.patientId;

  // Check for scheduled follow-up appointments
  const followUp = await getFollowUpAppointment(patientId, context.dischargeDate);

  // Check PCP assignment
  const pcp = await getPcpAssignment(patientId);

  // Check pending test results
  const pendingTests = await getPendingTestResults(patientId, context.dischargeDate);

  // Check discharge instructions
  const dischargeInstructions = await getDischargeInstructions(patientId, context.dischargeDate);

  const dischargeToHomeAlone = context.dischargeDisposition === 'home' &&
    !(await hasHomeSupport(patientId));

  return {
    followUpScheduled: followUp.scheduled,
    daysUntilFollowUp: followUp.daysUntil,
    // CRITICAL: Preserve exact falsy handling
    // daysUntil ? daysUntil <= 7 : false
    // 0 daysUntil is falsy -> returns false
    followUpWithin7Days: followUp.daysUntil ? followUp.daysUntil <= FOLLOW_UP_THRESHOLDS.WITHIN_7_DAYS : false,
    followUpWithin14Days: followUp.daysUntil ? followUp.daysUntil <= FOLLOW_UP_THRESHOLDS.WITHIN_14_DAYS : false,
    noFollowUpScheduled: !followUp.scheduled,

    hasPcpAssigned: pcp.assigned,
    pcpContactedAboutDischarge: pcp.contacted,

    dischargeDestination: context.dischargeDisposition,
    dischargeToHomeAlone,
    hasHomeHealthServices: context.dischargeDisposition === 'home_health',

    hasPendingTestResults: pendingTests.hasPending,
    pendingTestResultsList: pendingTests.testsList,

    dischargeInstructionsProvided: dischargeInstructions.provided,
    dischargeInstructionsUnderstood: dischargeInstructions.understood,
    patientTeachBackCompleted: dischargeInstructions.teachBackCompleted
  };
}
