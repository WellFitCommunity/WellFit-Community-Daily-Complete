// ============================================================================
// Shift Handoff Risk Service - AI-Assisted Nurse Handoff
// ============================================================================
// Purpose: Auto-score patients + nurse review/adjust = smart handoff
// Design: System does 80% (auto), nurse does 20% (human judgment)
// Architecture: Scoring + time tracking extracted for 600-line compliance
//   - shiftHandoffScoring.ts: Auto-scoring engine + helpers
//   - shiftHandoffTimeTracking.ts: Time savings tracking
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { applyLimit } from '../utils/pagination';
import { getErrorMessage } from '../lib/getErrorMessage';
import type {
  ShiftHandoffSummary,
  ShiftHandoffEvent,
  NurseReviewInput,
  ManualEventInput,
  HandoffDashboardMetrics,
  ShiftType,
} from '../types/shiftHandoff';

// Extracted modules — re-exported for consumers that import by name
import { createAutoRiskScore, refreshAllAutoScores } from './shiftHandoffScoring';
import { recordHandoffTimeSavings, getMyTimeSavings } from './shiftHandoffTimeTracking';
export { createAutoRiskScore, refreshAllAutoScores, recordHandoffTimeSavings, getMyTimeSavings };

/** Dashboard metrics query result row */
interface DashboardMetricsRow {
  final_risk_level: string;
  nurse_reviewed: boolean;
  auto_composite_score: number;
  nurse_risk_level: string | null;
}

/** Emergency bypass RPC result */
interface EmergencyBypassResult {
  bypass_id: string;
  bypass_number: number;
  weekly_total: number;
  should_notify_manager: boolean;
  nurse_name: string;
}

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
// PART 3: MANUAL EVENT ENTRY
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
// PART 4: DASHBOARD METRICS
// ============================================================================

export async function getHandoffDashboardMetrics(
  shiftType: ShiftType
): Promise<HandoffDashboardMetrics> {
  const query = supabase
    .from('shift_handoff_risk_scores')
    .select('final_risk_level, nurse_reviewed, auto_composite_score, nurse_risk_level')
    .eq('shift_date', new Date().toISOString().split('T')[0])
    .eq('shift_type', shiftType);

  let data: DashboardMetricsRow[];
  try {
    data = await applyLimit<DashboardMetricsRow>(query, 100);
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
// PART 5: EMERGENCY BYPASS FUNCTIONS
// ============================================================================

export async function getNurseBypassCount(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase.rpc('get_nurse_bypass_count_last_7_days', {
    p_nurse_id: user.id,
  });

  if (error) {
    await auditLogger.error('BYPASS_COUNT_FAILED', new Error(error.message), {
      errorCode: error.code,
    });
    return 0;
  }

  return (data as number) ?? 0;
}

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
  const { data, error } = await supabase.rpc('log_handoff_override', {
    p_shift_date: shiftDate,
    p_shift_type: shiftType,
    p_pending_count: pendingCount,
    p_pending_patient_ids: pendingPatientIds,
    p_pending_patient_names: pendingPatientNames,
    p_override_reason: overrideReason,
    p_override_explanation: overrideExplanation,
    p_nurse_signature: nurseSignature,
    p_ip_address: null,
    p_user_agent: navigator.userAgent,
  });

  if (error) {
    await auditLogger.error('EMERGENCY_BYPASS_LOG_FAILED', new Error(error.message), {
      shiftType,
      reason: overrideReason,
      errorCode: error.code,
    });
    throw new Error(`Failed to log bypass: ${error.message}`);
  }

  return data as EmergencyBypassResult;
}

// ============================================================================
// PART 6: AI SHIFT SUMMARY
// ============================================================================

/** AI-generated shift handoff summary */
export interface AIShiftSummary {
  id: string;
  shift_date: string;
  shift_type: string;
  unit_name: string | null;
  executive_summary: string | null;
  critical_alerts: Array<{ patientId: string; alert: string; severity: string; timeframe?: string }>;
  high_risk_patients: Array<{ patientId: string; name: string; riskFactors: string[]; actionItems: string[]; priority: number }>;
  medication_alerts: Array<{ patientId: string; alert: string; followUp: string }>;
  behavioral_concerns: Array<{ patientId: string; concern: string; intervention: string }>;
  pending_tasks: Array<{ task: string; priority: string; deadline?: string }>;
  patient_count: number;
  high_risk_patient_count: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  handoff_notes: string | null;
  generated_at: string;
}

export async function getAIShiftSummary(
  shiftType: ShiftType,
  unitName?: string
): Promise<AIShiftSummary | null> {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('ai_shift_handoff_summaries')
    .select('id, shift_date, shift_type, unit_name, executive_summary, critical_alerts, high_risk_patients, medication_alerts, behavioral_concerns, pending_tasks, patient_count, high_risk_patient_count, acknowledged_by, acknowledged_at, handoff_notes, generated_at')
    .eq('shift_date', today)
    .eq('shift_type', shiftType)
    .order('generated_at', { ascending: false })
    .limit(1);

  if (unitName) {
    query = query.eq('unit_name', unitName);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    await auditLogger.warn('AI_SUMMARY_FETCH_FAILED', {
      shiftType,
      unitName,
      error: error.message,
    });
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    shift_date: data.shift_date,
    shift_type: data.shift_type,
    unit_name: data.unit_name,
    executive_summary: data.executive_summary,
    critical_alerts: (data.critical_alerts || []) as AIShiftSummary['critical_alerts'],
    high_risk_patients: (data.high_risk_patients || []) as AIShiftSummary['high_risk_patients'],
    medication_alerts: (data.medication_alerts || []) as AIShiftSummary['medication_alerts'],
    behavioral_concerns: (data.behavioral_concerns || []) as AIShiftSummary['behavioral_concerns'],
    pending_tasks: (data.pending_tasks || []) as AIShiftSummary['pending_tasks'],
    patient_count: data.patient_count,
    high_risk_patient_count: data.high_risk_patient_count,
    acknowledged_by: data.acknowledged_by,
    acknowledged_at: data.acknowledged_at,
    handoff_notes: data.handoff_notes,
    generated_at: data.generated_at,
  };
}

/**
 * Acknowledge an AI shift summary (incoming nurse confirms receipt)
 */
export async function acknowledgeAIShiftSummary(
  summaryId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('ai_shift_handoff_summaries')
    .update({
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', summaryId);

  if (error) {
    await auditLogger.error('AI_SUMMARY_ACKNOWLEDGE_FAILED', new Error(error.message), {
      summaryId,
      errorCode: error.code,
    });
    throw new Error(`Failed to acknowledge summary: ${error.message}`);
  }

  await auditLogger.clinical('AI_SUMMARY_ACKNOWLEDGED', true, { summaryId });
}

/**
 * Add or update nurse notes on an AI shift summary
 */
export async function updateAISummaryNotes(
  summaryId: string,
  notes: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('ai_shift_handoff_summaries')
    .update({
      handoff_notes: notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', summaryId);

  if (error) {
    await auditLogger.error('AI_SUMMARY_NOTES_FAILED', new Error(error.message), {
      summaryId,
      errorCode: error.code,
    });
    throw new Error(`Failed to update summary notes: ${error.message}`);
  }

  await auditLogger.clinical('AI_SUMMARY_NOTES_UPDATED', true, {
    summaryId,
    notesLength: notes.length,
  });
}

/**
 * Get distinct unit names for the unit filter
 */
export async function getAvailableUnits(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_shift_handoff_summaries')
    .select('unit_name')
    .not('unit_name', 'is', null)
    .order('unit_name');

  if (error || !data) return [];

  const uniqueUnits = [...new Set(data.map(d => d.unit_name as string))];
  return uniqueUnits;
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

  // AI summary
  getAIShiftSummary,
  acknowledgeAIShiftSummary,
  updateAISummaryNotes,
  getAvailableUnits,

  // Emergency bypass
  getNurseBypassCount,
  logEmergencyBypass,

  // Time tracking
  recordHandoffTimeSavings,
  getMyTimeSavings,
};
