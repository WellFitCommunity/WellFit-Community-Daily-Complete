// ============================================================================
// Shift Handoff Auto-Scoring Engine
// ============================================================================
// Extracted from shiftHandoffService.ts for 600-line compliance
// Purpose: Auto-generate risk scores from vitals, events, and diagnoses
// ============================================================================

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { applyLimit } from '../utils/pagination';
import { getErrorMessage } from '../lib/getErrorMessage';
import type {
  ShiftHandoffRiskScore,
  ShiftHandoffEvent,
  EarlyWarningScoreInput,
  ShiftType,
} from '../types/shiftHandoff';

/** Patient vitals data structure from FHIR observations */
interface VitalsData {
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  temperature?: number;
  oxygen_sat?: number;
  respiratory_rate?: number;
}

// ============================================================================
// AUTO-SCORING
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
// HELPERS
// ============================================================================

async function getLatestVitals(patientId: string): Promise<VitalsData | null> {
  const { data, error } = await supabase
    .from('fhir_observations')
    .select('code, value_quantity_value')
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

  const vitals: VitalsData = {};
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
    .select('id, risk_score_id, patient_id, event_time, event_type, event_severity, event_description, increases_risk, risk_weight, action_taken, action_by, created_at, created_by')
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

function calculateStabilityScore(vitals: VitalsData | null): number {
  if (!vitals) return 50;
  let score = 0;
  if (vitals.systolic_bp && (vitals.systolic_bp < 90 || vitals.systolic_bp > 180)) score += 30;
  if (vitals.heart_rate && (vitals.heart_rate < 50 || vitals.heart_rate > 120)) score += 25;
  if (vitals.oxygen_sat && vitals.oxygen_sat < 92) score += 30;
  return Math.min(score, 100);
}

async function calculateEarlyWarningScoreFromVitals(vitals: VitalsData): Promise<number> {
  const input: EarlyWarningScoreInput = {
    systolic_bp: vitals.systolic_bp ?? 0,
    heart_rate: vitals.heart_rate ?? 0,
    respiratory_rate: vitals.respiratory_rate || 16,
    temperature: vitals.temperature || 37,
    oxygen_sat: vitals.oxygen_sat || 98,
  };

  const { data, error } = await supabase.rpc('calculate_early_warning_score', input);

  if (error) return 0;
  return data as number;
}

function calculateEventRiskScore(events: ShiftHandoffEvent[]): number {
  const critical = events.filter(e => e.event_severity === 'critical').length;
  const major = events.filter(e => e.event_severity === 'major').length;
  return Math.min(100, critical * 40 + major * 20);
}

function buildClinicalSnapshot(v: VitalsData | null, e: ShiftHandoffEvent[], d: string | null) {
  return {
    bp: v?.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : 'N/A',
    o2_sat: v?.oxygen_sat || null,
    recent_events: e.slice(0, 3).map(x => x.event_description),
    diagnosis: d || 'Unknown',
  };
}

function identifyRiskFactors(
  vitals: VitalsData | null,
  events: ShiftHandoffEvent[],
  diagnosis: string | null
): string[] {
  const f: string[] = [];
  if (vitals?.oxygen_sat && vitals.oxygen_sat < 92) f.push('hypoxia');
  if (events.some(e => e.event_type === 'fall')) f.push('fall_risk');
  if (diagnosis?.toLowerCase().includes('sepsis')) f.push('sepsis_risk');
  return f;
}
