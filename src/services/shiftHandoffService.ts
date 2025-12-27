// ============================================================================
// Shift Handoff Risk Service - AI-Assisted Nurse Handoff
// ============================================================================
// Purpose: Auto-score patients + nurse review/adjust = smart handoff
// Design: System does 80% (auto), nurse does 20% (human judgment)
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import { getErrorMessage } from '../lib/getErrorMessage';
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
// PART 1: SHIFT HANDOFF SUMMARY
// ============================================================================

export async function getCurrentShiftHandoff(
  shiftType: ShiftType = 'night'
): Promise<ShiftHandoffSummary[]> {
  const { data, error } = await supabase.rpc('get_current_shift_handoff', {
    p_shift_type: shiftType,
  });

  if (error) {
    await auditLogger.error('HANDOFF_LOAD_FAILED', new Error(error.message), {
      shiftType,
      errorCode: error.code,
    });
    throw new Error(`Failed to get shift handoff: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// PART 2: NURSE REVIEW
// ============================================================================

export async function nurseReviewHandoffRisk(
  input: NurseReviewInput
): Promise<boolean> {
  const { data, error } = await supabase.rpc('nurse_review_handoff_risk', {
    p_risk_score_id: input.risk_score_id,
    p_nurse_risk_level: input.nurse_risk_level || null,
    p_adjustment_reason: input.nurse_adjustment_reason || null,
  });

  if (error) {
    await auditLogger.error('NURSE_REVIEW_FAILED', new Error(error.message), {
      riskScoreId: input.risk_score_id,
      nurseRiskLevel: input.nurse_risk_level,
      errorCode: error.code,
    });
    throw new Error(`Failed to review handoff risk: ${error.message}`);
  }

  return data as boolean;
}

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
    await auditLogger.error('BULK_CONFIRM_FAILED', new Error(error.message), {
      riskScoreIds,
      errorCode: error.code,
    });
    throw new Error(`Failed to bulk confirm: ${error.message}`);
  }

  return count || 0;
}

// ============================================================================
// PART 3: AUTO-SCORING
// ============================================================================

export async function createAutoRiskScore(
  patientId: string,
  shiftType: ShiftType
): Promise<ShiftHandoffRiskScore> {
  const [vitals, events, diagnosis] = await Promise.all([
    getLatestVitals(patientId),
    getRecentEvents(patientId),
    getPatientDiagnosis(patientId),
  ]);

  const medicalAcuityScore = calculateMedicalAcuityScore(diagnosis);
  const stabilityScore = calculateStabilityScore(vitals);
  const earlyWarningScore = vitals
    ? await calculateEarlyWarningScoreFromVitals(vitals)
    : 0;
  const eventRiskScore = calculateEventRiskScore(events);

  const clinicalSnapshot = buildClinicalSnapshot(vitals, events, diagnosis);
  const riskFactors = identifyRiskFactors(vitals, events, diagnosis);

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
    await auditLogger.error('CREATE_AUTO_SCORE_FAILED', new Error(error.message), {
      patientId,
      shiftType,
      errorCode: error.code,
    });
    throw new Error(`Failed to create auto risk score: ${error.message}`);
  }

  return data;
}

export async function refreshAllAutoScores(
  shiftType: ShiftType
): Promise<number> {
  const { data: patients, error } = await supabase.rpc('get_admitted_patients');

  if (error) {
    await auditLogger.error('REFRESH_AUTO_SCORES_FAILED', new Error(error.message), {
      shiftType,
      errorCode: error.code,
    });
    throw new Error(`Failed to get admitted patients: ${error.message}`);
  }

  if (!patients?.length) return 0;

  const results = await Promise.allSettled(
    patients.map((p: { patient_id: string }) =>
      createAutoRiskScore(p.patient_id, shiftType)
    )
  );

  return results.filter(r => r.status === 'fulfilled').length;
}

// ============================================================================
// PART 4: MANUAL EVENT ENTRY
// ============================================================================

export async function logHandoffEvent(
  input: ManualEventInput
): Promise<ShiftHandoffEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: riskScore } = await supabase
    .from('shift_handoff_risk_scores')
    .select('id')
    .eq('patient_id', input.patient_id)
    .eq('shift_date', new Date().toISOString().split('T')[0])
    .order('scoring_time', { ascending: false })
    .limit(1)
    .single();

  if (!riskScore) throw new Error('No risk score found');

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
    await auditLogger.error('LOG_HANDOFF_EVENT_FAILED', new Error(error.message), {
      riskScoreId: riskScore.id,
      eventType: input.event_type,
      errorCode: error.code,
    });
    throw new Error(`Failed to log event: ${error.message}`);
  }

  return data;
}

// ============================================================================
// PART 5: DASHBOARD METRICS
// ============================================================================

export async function getHandoffDashboardMetrics(
  shiftType: ShiftType
): Promise<HandoffDashboardMetrics> {
  const query = supabase
    .from('shift_handoff_risk_scores')
    .select('final_risk_level, nurse_reviewed, auto_composite_score, nurse_risk_level')
    .eq('shift_date', new Date().toISOString().split('T')[0])
    .eq('shift_type', shiftType);

  let data;
  try {
    data = await applyLimit<any>(query, 100);
  } catch (err: unknown) {
    await auditLogger.error(
      'DASHBOARD_METRICS_FAILED',
      new Error(getErrorMessage(err)),
      { shiftType }
    );
    throw new Error(`Failed to get metrics: ${getErrorMessage(err)}`);
  }

  if (!data?.length) {
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

  return {
    total_patients: totalPatients,
    critical_patients: data.filter(r => r.final_risk_level === 'CRITICAL').length,
    high_risk_patients: data.filter(r => r.final_risk_level === 'HIGH').length,
    pending_nurse_review: data.filter(r => !r.nurse_reviewed).length,
    nurse_adjusted_count: data.filter(r => r.nurse_risk_level !== null).length,
    avg_auto_score: Math.round(
      data.reduce((s, r) => s + (r.auto_composite_score || 0), 0) / totalPatients
    ),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

async function getLatestVitals(patientId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('fhir_observations')
    .select('*')
    .eq('subject_id', patientId)
    .order('effective_datetime', { ascending: false })
    .limit(10);

  if (error) {
    await auditLogger.warn('VITALS_FETCH_FAILED', {
      patientId,
      error: error.message,
    });
    return null;
  }

  const vitals: any = {};
  data?.forEach(o => {
    if (o.code === '8462-4') vitals.systolic_bp = o.value_quantity_value;
    if (o.code === '8480-6') vitals.diastolic_bp = o.value_quantity_value;
    if (o.code === '8867-4') vitals.heart_rate = o.value_quantity_value;
    if (o.code === '8310-5') vitals.temperature = o.value_quantity_value;
    if (o.code === '2708-6') vitals.oxygen_sat = o.value_quantity_value;
  });

  return vitals;
}

async function getRecentEvents(patientId: string): Promise<ShiftHandoffEvent[]> {
  const query = supabase
    .from('shift_handoff_events')
    .select('*')
    .eq('patient_id', patientId)
    .order('event_time', { ascending: false });

  try {
    return await applyLimit(query, 50);
  } catch (err: unknown) {
    await auditLogger.warn('EVENTS_FETCH_FAILED', {
      patientId,
      error: getErrorMessage(err),
    });
    return [];
  }
}

async function getPatientDiagnosis(patientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('fhir_conditions')
    .select('code_text')
    .eq('subject_id', patientId)
    .eq('clinical_status', 'active')
    .limit(1)
    .single();

  if (error) {
    await auditLogger.warn('DIAGNOSIS_FETCH_FAILED', {
      patientId,
      error: error.message,
    });
    return null;
  }

  return data?.code_text || null;
}

function calculateMedicalAcuityScore(diagnosis: string | null): number {
  if (!diagnosis) return 50;
  return diagnosis.toLowerCase().includes('sepsis') ? 85 : 50;
}

function calculateStabilityScore(vitals: any): number {
  if (!vitals) return 50;
  let score = 0;
  if (vitals.systolic_bp < 90 || vitals.systolic_bp > 180) score += 30;
  if (vitals.heart_rate < 50 || vitals.heart_rate > 120) score += 25;
  if (vitals.oxygen_sat < 92) score += 30;
  return Math.min(score, 100);
}

async function calculateEarlyWarningScoreFromVitals(vitals: any): Promise<number> {
  const input: EarlyWarningScoreInput = {
    systolic_bp: vitals.systolic_bp,
    heart_rate: vitals.heart_rate,
    respiratory_rate: vitals.respiratory_rate || 16,
    temperature: vitals.temperature || 37,
    oxygen_sat: vitals.oxygen_sat || 98,
  };

  const { data, error } = await supabase.rpc(
    'calculate_early_warning_score',
    input
  );

  if (error) return 0;
  return data as number;
}

function calculateEventRiskScore(events: ShiftHandoffEvent[]): number {
  const critical = events.filter(e => e.event_severity === 'critical').length;
  const major = events.filter(e => e.event_severity === 'major').length;
  return Math.min(100, critical * 40 + major * 20);
}

function buildClinicalSnapshot(v: any, e: ShiftHandoffEvent[], d: string | null) {
  return {
    bp: v?.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : 'N/A',
    o2_sat: v?.oxygen_sat || null,
    recent_events: e.slice(0, 3).map(x => x.event_description),
    diagnosis: d || 'Unknown',
  };
}

function identifyRiskFactors(
  vitals: any,
  events: ShiftHandoffEvent[],
  diagnosis: string | null
): string[] {
  const f: string[] = [];
  if (vitals?.oxygen_sat < 92) f.push('hypoxia');
  if (events.some(e => e.event_type === 'fall')) f.push('fall_risk');
  if (diagnosis?.toLowerCase().includes('sepsis')) f.push('sepsis_risk');
  return f;
}

// ============================================================================
// EXPORT
// ============================================================================

export const ShiftHandoffService = {
  getCurrentShiftHandoff,
  nurseReviewHandoffRisk,
  bulkConfirmAutoScores,
  createAutoRiskScore,
  refreshAllAutoScores,
  logHandoffEvent,
  getHandoffDashboardMetrics,
};
