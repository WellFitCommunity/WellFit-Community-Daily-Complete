// ============================================================================
// Shift Handoff Risk Service - AI-Assisted Nurse Handoff
// ============================================================================
// Purpose: Auto-score patients + nurse review/adjust = smart handoff
// Design: System does 80% (auto), nurse does 20% (human judgment)
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import type {
  ShiftHandoffRiskScore,
  ShiftHandoffSummary,
  ShiftHandoffEvent,
  NurseReviewInput,
  ManualEventInput,
  EarlyWarningScoreInput,
  HandoffDashboardMetrics,
  ShiftType,
} from '../types/shiftHandoff';

// ============================================================================
// PART 1: SHIFT HANDOFF SUMMARY (Main Dashboard Query)
// ============================================================================

/**
 * Get current shift handoff summary (prioritized list for incoming nurse)
 * @param shiftType Which shift (day, evening, night)
 * @returns Prioritized patient list (CRITICAL first, then HIGH, MEDIUM, LOW)
 */
export async function getCurrentShiftHandoff(
  shiftType: ShiftType = 'night'
): Promise<ShiftHandoffSummary[]> {
  const { data, error } = await supabase
    .rpc('get_current_shift_handoff', {
      p_shift_type: shiftType,
    });

  if (error) {
    console.error('ShiftHandoffService.getCurrentShiftHandoff error:', error);
    throw new Error(`Failed to get shift handoff: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// PART 2: NURSE REVIEW (One-Click Confirm/Adjust)
// ============================================================================

/**
 * Nurse quick review: confirm auto-score or override with human judgment
 * @param input Nurse review input (risk_score_id, optional override)
 * @returns Success boolean
 */
export async function nurseReviewHandoffRisk(
  input: NurseReviewInput
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('nurse_review_handoff_risk', {
      p_risk_score_id: input.risk_score_id,
      p_nurse_risk_level: input.nurse_risk_level || null,
      p_adjustment_reason: input.nurse_adjustment_reason || null,
    });

  if (error) {
    console.error('ShiftHandoffService.nurseReviewHandoffRisk error:', error);
    throw new Error(`Failed to review handoff risk: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Bulk confirm: nurse confirms multiple auto-scores at once
 * @param riskScoreIds Array of risk score IDs to confirm
 * @returns Number of scores confirmed
 */
export async function bulkConfirmAutoScores(
  riskScoreIds: string[]
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { count, error } = await supabase
    .from('shift_handoff_risk_scores')
    .update({
      nurse_reviewed: true,
      nurse_id: user.id,
      nurse_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', riskScoreIds);

  if (error) {
    console.error('ShiftHandoffService.bulkConfirmAutoScores error:', error);
    throw new Error(`Failed to bulk confirm: ${error.message}`);
  }

  return count || 0;
}

// ============================================================================
// PART 3: AUTO-SCORING (System-Generated Risk Scores)
// ============================================================================

/**
 * Create auto-scored risk assessment for a patient
 * @param patientId Patient user ID
 * @param shiftType Current shift type
 * @returns Created risk score
 */
export async function createAutoRiskScore(
  patientId: string,
  shiftType: ShiftType
): Promise<ShiftHandoffRiskScore> {
  // Get latest vitals and events for this patient
  const [vitals, events, diagnosis] = await Promise.all([
    getLatestVitals(patientId),
    getRecentEvents(patientId),
    getPatientDiagnosis(patientId),
  ]);

  // Calculate component scores
  const medicalAcuityScore = calculateMedicalAcuityScore(diagnosis);
  const stabilityScore = calculateStabilityScore(vitals);
  const earlyWarningScore = vitals ? await calculateEarlyWarningScoreFromVitals(vitals) : 0;
  const eventRiskScore = calculateEventRiskScore(events);

  // Build clinical snapshot
  const clinicalSnapshot = buildClinicalSnapshot(vitals, events, diagnosis);

  // Build risk factors array
  const riskFactors = identifyRiskFactors(vitals, events, diagnosis);

  // Insert risk score
  const { data, error } = await supabase
    .from('shift_handoff_risk_scores')
    .insert({
      patient_id: patientId,
      shift_date: new Date().toISOString().split('T')[0],
      shift_type: shiftType,
      scoring_time: new Date().toISOString(),
      auto_medical_acuity_score: medicalAcuityScore,
      auto_stability_score: stabilityScore,
      auto_early_warning_score: earlyWarningScore,
      auto_event_risk_score: eventRiskScore,
      risk_factors: riskFactors,
      clinical_snapshot: clinicalSnapshot,
      nurse_reviewed: false,
    })
    .select()
    .single();

  if (error) {
    console.error('ShiftHandoffService.createAutoRiskScore error:', error);
    throw new Error(`Failed to create auto risk score: ${error.message}`);
  }

  return data;
}

/**
 * Refresh auto-scores for all current patients (run every 2-4 hours)
 * @param shiftType Current shift type
 * @returns Number of scores refreshed
 */
export async function refreshAllAutoScores(
  shiftType: ShiftType
): Promise<number> {
  // Get all admitted patients
  const { data: patients, error: patientsError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'senior')
    .eq('admitted', true); // Assuming there's an 'admitted' flag

  if (patientsError) {
    console.error('ShiftHandoffService.refreshAllAutoScores error:', patientsError);
    throw new Error(`Failed to get patients: ${patientsError.message}`);
  }

  if (!patients || patients.length === 0) {
    return 0;
  }

  // Create/update auto-scores for each patient
  const results = await Promise.allSettled(
    patients.map(patient => createAutoRiskScore(patient.id, shiftType))
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  return successCount;
}

// ============================================================================
// PART 4: MANUAL EVENT ENTRY
// ============================================================================

/**
 * Log a clinical event that happened during the shift
 * @param input Event details
 * @returns Created event
 */
export async function logHandoffEvent(
  input: ManualEventInput
): Promise<ShiftHandoffEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get current risk score for this patient
  const { data: riskScore } = await supabase
    .from('shift_handoff_risk_scores')
    .select('id')
    .eq('patient_id', input.patient_id)
    .eq('shift_date', new Date().toISOString().split('T')[0])
    .order('scoring_time', { ascending: false })
    .limit(1)
    .single();

  if (!riskScore) {
    throw new Error('No risk score found for this patient. Create auto-score first.');
  }

  // Insert event
  const { data, error } = await supabase
    .from('shift_handoff_events')
    .insert({
      risk_score_id: riskScore.id,
      patient_id: input.patient_id,
      event_type: input.event_type,
      event_severity: input.event_severity,
      event_description: input.event_description,
      action_taken: input.action_taken || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('ShiftHandoffService.logHandoffEvent error:', error);
    throw new Error(`Failed to log event: ${error.message}`);
  }

  return data;
}

// ============================================================================
// PART 5: DASHBOARD METRICS
// ============================================================================

/**
 * Get dashboard summary metrics
 * @param shiftType Current shift type
 * @returns Dashboard metrics
 */
export async function getHandoffDashboardMetrics(
  shiftType: ShiftType
): Promise<HandoffDashboardMetrics> {
  const { data, error } = await supabase
    .from('shift_handoff_risk_scores')
    .select('final_risk_level, nurse_reviewed, auto_composite_score, nurse_risk_level')
    .eq('shift_date', new Date().toISOString().split('T')[0])
    .eq('shift_type', shiftType);

  if (error) {
    console.error('ShiftHandoffService.getHandoffDashboardMetrics error:', error);
    throw new Error(`Failed to get metrics: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      total_patients: 0,
      critical_patients: 0,
      high_risk_patients: 0,
      pending_nurse_review: 0,
      nurse_adjusted_count: 0,
      avg_auto_score: 0,
    };
  }

  const totalPatients = data.length;
  const criticalPatients = data.filter(r => r.final_risk_level === 'CRITICAL').length;
  const highRiskPatients = data.filter(r => r.final_risk_level === 'HIGH').length;
  const pendingReview = data.filter(r => !r.nurse_reviewed).length;
  const nurseAdjusted = data.filter(r => r.nurse_risk_level !== null).length;
  const avgAutoScore = data.reduce((sum, r) => sum + (r.auto_composite_score || 0), 0) / totalPatients;

  return {
    total_patients: totalPatients,
    critical_patients: criticalPatients,
    high_risk_patients: highRiskPatients,
    pending_nurse_review: pendingReview,
    nurse_adjusted_count: nurseAdjusted,
    avg_auto_score: Math.round(avgAutoScore),
  };
}

// ============================================================================
// PART 6: HELPER FUNCTIONS (Auto-Scoring Logic)
// ============================================================================

/**
 * Get latest vitals for a patient
 */
async function getLatestVitals(patientId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('fhir_observations')
    .select('*')
    .eq('subject_id', patientId)
    .in('code', ['85354-9', '8867-4', '8310-5', '8462-4', '2708-6']) // BP, HR, Temp, O2
    .order('effective_datetime', { ascending: false })
    .limit(10);

  if (error) {
    console.warn('Failed to get vitals:', error);
    return null;
  }

  // Parse FHIR observations into simple vitals object
  const vitals: any = {};
  data?.forEach(obs => {
    if (obs.code === '8462-4') vitals.systolic_bp = obs.value_quantity?.value;
    if (obs.code === '8867-4') vitals.heart_rate = obs.value_quantity?.value;
    if (obs.code === '9279-1') vitals.respiratory_rate = obs.value_quantity?.value;
    if (obs.code === '8310-5') vitals.temperature = obs.value_quantity?.value;
    if (obs.code === '2708-6') vitals.oxygen_sat = obs.value_quantity?.value;
  });

  return vitals;
}

/**
 * Get recent events (last 8 hours)
 */
async function getRecentEvents(patientId: string): Promise<ShiftHandoffEvent[]> {
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('shift_handoff_events')
    .select('*')
    .eq('patient_id', patientId)
    .gte('event_time', eightHoursAgo)
    .order('event_time', { ascending: false });

  if (error) {
    console.warn('Failed to get recent events:', error);
    return [];
  }

  return data || [];
}

/**
 * Get patient diagnosis
 */
async function getPatientDiagnosis(patientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('fhir_conditions')
    .select('code_text')
    .eq('subject_id', patientId)
    .eq('clinical_status', 'active')
    .order('recorded_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.warn('Failed to get diagnosis:', error);
    return null;
  }

  return data?.code_text || null;
}

/**
 * Calculate medical acuity score based on diagnosis
 */
function calculateMedicalAcuityScore(diagnosis: string | null): number {
  if (!diagnosis) return 50; // Default moderate

  const highRiskDiagnoses = [
    'stroke', 'cardiac arrest', 'sepsis', 'myocardial infarction',
    'respiratory failure', 'acute kidney injury'
  ];

  const diagnosisLower = diagnosis.toLowerCase();
  const isHighRisk = highRiskDiagnoses.some(d => diagnosisLower.includes(d));

  return isHighRisk ? 85 : 50;
}

/**
 * Calculate stability score from vitals trend
 */
function calculateStabilityScore(vitals: any): number {
  if (!vitals) return 50; // Default

  let instabilityPoints = 0;

  // Check for unstable vitals
  if (vitals.systolic_bp && (vitals.systolic_bp < 90 || vitals.systolic_bp > 180)) {
    instabilityPoints += 30;
  }

  if (vitals.heart_rate && (vitals.heart_rate < 50 || vitals.heart_rate > 120)) {
    instabilityPoints += 25;
  }

  if (vitals.oxygen_sat && vitals.oxygen_sat < 92) {
    instabilityPoints += 30;
  }

  if (vitals.temperature && (vitals.temperature < 36.0 || vitals.temperature > 38.5)) {
    instabilityPoints += 15;
  }

  return Math.min(100, instabilityPoints);
}

/**
 * Calculate early warning score from vitals
 */
async function calculateEarlyWarningScoreFromVitals(vitals: any): Promise<number> {
  if (!vitals.systolic_bp || !vitals.heart_rate) {
    return 0;
  }

  const input: EarlyWarningScoreInput = {
    systolic_bp: vitals.systolic_bp,
    heart_rate: vitals.heart_rate,
    respiratory_rate: vitals.respiratory_rate || 16,
    temperature: vitals.temperature || 37.0,
    oxygen_sat: vitals.oxygen_sat || 98,
  };

  const { data, error } = await supabase
    .rpc('calculate_early_warning_score', input);

  if (error) {
    console.warn('Failed to calculate MEWS:', error);
    return 0;
  }

  return data as number;
}

/**
 * Calculate event risk score based on recent events
 */
function calculateEventRiskScore(events: ShiftHandoffEvent[]): number {
  if (events.length === 0) return 0;

  const criticalEvents = events.filter(e => e.event_severity === 'critical').length;
  const majorEvents = events.filter(e => e.event_severity === 'major').length;

  return Math.min(100, criticalEvents * 40 + majorEvents * 20);
}

/**
 * Build clinical snapshot for handoff report
 */
function buildClinicalSnapshot(vitals: any, events: ShiftHandoffEvent[], diagnosis: string | null): any {
  return {
    bp_trend: vitals?.systolic_bp ? `${vitals.systolic_bp}/${vitals.diastolic_bp || 'N/A'}` : 'N/A',
    o2_sat: vitals?.oxygen_sat ? `${vitals.oxygen_sat}%` : 'N/A',
    heart_rate: vitals?.heart_rate || null,
    temp: vitals?.temperature || null,
    recent_events: events.slice(0, 3).map(e => e.event_description),
    prn_meds_today: events.filter(e => e.event_type === 'prn_administered').length,
    last_assessment: '2 hours ago', // TODO: Calculate from last observation
    diagnosis: diagnosis || 'Unknown',
  };
}

/**
 * Identify risk factors from vitals/events
 */
function identifyRiskFactors(vitals: any, events: ShiftHandoffEvent[], diagnosis: string | null): string[] {
  const factors: string[] = [];

  if (vitals?.systolic_bp && (vitals.systolic_bp < 90 || vitals.systolic_bp > 180)) {
    factors.push('unstable_vitals');
  }

  if (vitals?.oxygen_sat && vitals.oxygen_sat < 92) {
    factors.push('hypoxia');
  }

  if (events.some(e => e.event_type === 'neuro_change')) {
    factors.push('neuro_changes');
  }

  if (events.some(e => e.event_type === 'code_blue' || e.event_type === 'rapid_response')) {
    factors.push('post_code');
  }

  if (events.some(e => e.event_type === 'fall')) {
    factors.push('fall_risk');
  }

  if (diagnosis?.toLowerCase().includes('sepsis')) {
    factors.push('sepsis_risk');
  }

  return factors;
}

// ============================================================================
// PART 7: EMERGENCY BYPASS FUNCTIONS
// ============================================================================

/**
 * Get nurse's bypass count for last 7 days
 */
export async function getNurseBypassCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .rpc('get_nurse_bypass_count_last_7_days', {
      p_nurse_id: user.id,
    });

  if (error) {
    console.error('ShiftHandoffService.getNurseBypassCount error:', error);
    return 0; // Fail open - allow bypass if can't get count
  }

  return data as number;
}

/**
 * Log an emergency bypass
 */
export async function logEmergencyBypass(
  shiftDate: string,
  shiftType: ShiftType,
  pendingCount: number,
  pendingPatientIds: string[],
  pendingPatientNames: string[],
  overrideReason: string,
  overrideExplanation: string,
  nurseSignature: string
): Promise<{
  bypass_id: string;
  bypass_number: number;
  weekly_total: number;
  should_notify_manager: boolean;
  nurse_name: string;
}> {
  const { data, error } = await supabase
    .rpc('log_handoff_override', {
      p_shift_date: shiftDate,
      p_shift_type: shiftType,
      p_pending_count: pendingCount,
      p_pending_patient_ids: pendingPatientIds,
      p_pending_patient_names: pendingPatientNames,
      p_override_reason: overrideReason,
      p_override_explanation: overrideExplanation,
      p_nurse_signature: nurseSignature,
      p_ip_address: null, // TODO: Get client IP if available
      p_user_agent: navigator.userAgent,
    });

  if (error) {
    console.error('ShiftHandoffService.logEmergencyBypass error:', error);
    throw new Error(`Failed to log bypass: ${error.message}`);
  }

  return data as any;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ShiftHandoffService = {
  getCurrentShiftHandoff,
  nurseReviewHandoffRisk,
  bulkConfirmAutoScores,
  createAutoRiskScore,
  refreshAllAutoScores,
  logHandoffEvent,
  getHandoffDashboardMetrics,
  getNurseBypassCount,
  logEmergencyBypass,
};
