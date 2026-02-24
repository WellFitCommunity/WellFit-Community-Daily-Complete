// ============================================================================
// Shift Handoff Dashboard - Demo Mode Data
// ============================================================================
// Synthetic test data for demo presentations. Uses obviously fake names
// per CLAUDE.md PHI hygiene rules.
// ============================================================================

import type { ShiftHandoffSummary, HandoffDashboardMetrics } from '../../../types/shiftHandoff';
import type { AIShiftSummary } from '../../../services/shiftHandoffService';

export const DEMO_HANDOFF_PATIENTS: ShiftHandoffSummary[] = [
  {
    patient_id: 'demo-patient-001',
    patient_name: 'Demo Patient Alpha',
    room_number: '301A',
    risk_score_id: 'demo-score-001',
    final_risk_level: 'CRITICAL',
    auto_risk_level: 'CRITICAL',
    nurse_reviewed: false,
    nurse_adjusted: false,
    handoff_priority: 1,
    risk_factors: ['fall_risk', 'medication_change', 'recent_procedure'],
    clinical_snapshot: {
      diagnosis: 'CHF Exacerbation',
      bp_trend: '148/92',
      o2_sat: '91%',
      heart_rate: 108,
      prn_meds_today: 3,
    },
    recent_events: null,
  },
  {
    patient_id: 'demo-patient-002',
    patient_name: 'Demo Patient Bravo',
    room_number: '305',
    risk_score_id: 'demo-score-002',
    final_risk_level: 'HIGH',
    auto_risk_level: 'HIGH',
    nurse_reviewed: true,
    nurse_adjusted: false,
    handoff_priority: 2,
    risk_factors: ['fall_risk', 'isolation_precautions'],
    clinical_snapshot: {
      diagnosis: 'Post-op Hip Replacement',
      bp_trend: '132/84',
      o2_sat: '95%',
      heart_rate: 88,
      prn_meds_today: 2,
    },
    recent_events: null,
  },
  {
    patient_id: 'demo-patient-003',
    patient_name: 'Demo Patient Charlie',
    room_number: '208',
    risk_score_id: 'demo-score-003',
    final_risk_level: 'MEDIUM',
    auto_risk_level: 'MEDIUM',
    nurse_reviewed: true,
    nurse_adjusted: false,
    handoff_priority: 3,
    risk_factors: [],
    clinical_snapshot: {
      diagnosis: 'Pneumonia — Improving',
      bp_trend: '122/78',
      o2_sat: '97%',
      heart_rate: 76,
      prn_meds_today: 1,
    },
    recent_events: null,
  },
  {
    patient_id: 'demo-patient-004',
    patient_name: 'Demo Patient Delta',
    room_number: '210',
    risk_score_id: 'demo-score-004',
    final_risk_level: 'LOW',
    auto_risk_level: 'LOW',
    nurse_reviewed: true,
    nurse_adjusted: false,
    handoff_priority: 4,
    risk_factors: [],
    clinical_snapshot: {
      diagnosis: 'Observation — Chest Pain r/o',
      bp_trend: '118/74',
      o2_sat: '99%',
      heart_rate: 68,
      prn_meds_today: 0,
    },
    recent_events: null,
  },
];

export const DEMO_METRICS: HandoffDashboardMetrics = {
  total_patients: 4,
  critical_patients: 1,
  high_risk_patients: 1,
  pending_nurse_review: 1,
  nurse_adjusted_count: 0,
  avg_auto_score: 57,
};

export const DEMO_AI_SUMMARY: AIShiftSummary = {
  id: 'demo-summary-001',
  shift_date: new Date().toISOString().split('T')[0],
  shift_type: 'night',
  unit_name: 'ICU',
  executive_summary:
    'Four patients on unit. One critical CHF exacerbation in 301A requiring close cardiac monitoring and strict I/O. ' +
    'Post-op hip replacement in 305 is stable but high fall risk — bed alarm active. ' +
    'Two standard acuity patients progressing as expected.',
  critical_alerts: [
    { patientId: 'demo-patient-001', alert: 'O2 saturation trending down — was 94% at 2200, now 91%', severity: 'high', timeframe: 'Last 4 hours' },
    { patientId: 'demo-patient-001', alert: 'Furosemide dose increased at 2000 — monitor urine output q2h', severity: 'medium', timeframe: 'Since 2000' },
  ],
  high_risk_patients: [],
  medication_alerts: [
    { patientId: 'demo-patient-001', alert: 'Furosemide 40mg → 80mg IV', followUp: 'Monitor urine output q2h, daily weight' },
    { patientId: 'demo-patient-002', alert: 'Enoxaparin 40mg SQ daily for DVT prophylaxis', followUp: 'Check injection sites' },
  ],
  behavioral_concerns: [],
  pending_tasks: [
    { task: 'Follow-up chest X-ray for Demo Patient Alpha', priority: 'high', deadline: '0600' },
    { task: 'PT consult for Demo Patient Bravo — first ambulation', priority: 'medium', deadline: '0800' },
    { task: 'Repeat BMP for Demo Patient Charlie', priority: 'low', deadline: '0600' },
  ],
  patient_count: 4,
  high_risk_patient_count: 2,
  acknowledged_by: null,
  acknowledged_at: null,
  handoff_notes: null,
  generated_at: new Date().toISOString(),
};

export const DEMO_UNITS = ['ICU', 'Med-Surg', 'Telemetry', 'ED'];
