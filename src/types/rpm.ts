/**
 * RPM (Remote Patient Monitoring) Types
 *
 * Shared type definitions for RPM enrollment tracking, vital threshold
 * rules, and the clinical RPM dashboard.
 */

// ── Enrollment ───────────────────────────────────────────────────────────────

export type RpmEnrollmentStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface RpmEnrollment {
  id: string;
  tenant_id: string;
  patient_id: string;
  status: RpmEnrollmentStatus;
  enrolled_at: string;
  enrolled_by: string | null;
  primary_diagnosis_code: string | null;
  monitoring_reason: string | null;
  ordering_provider_id: string | null;
  device_types: string[];
  setup_completed_at: string | null;
  total_monitoring_minutes: number;
  monitoring_start_date: string | null;
  monitoring_end_date: string | null;
  // Joined from profiles
  patient_name?: string;
  provider_name?: string;
}

// ── Vital Threshold Rules ────────────────────────────────────────────────────

export type VitalType =
  | 'heart_rate'
  | 'bp_systolic'
  | 'bp_diastolic'
  | 'oxygen_saturation'
  | 'glucose'
  | 'weight'
  | 'temperature';

export type ThresholdOperator = '>=' | '>' | '<=' | '<';
export type AlertType = 'vital_watch' | 'vital_warning' | 'vital_critical';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface VitalThresholdRule {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  condition_code: string | null;
  rule_name: string;
  vital_type: VitalType;
  loinc_code: string | null;
  threshold_operator: ThresholdOperator;
  threshold_value: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  escalation_level: number;
  escalation_targets: string[];
  cooldown_minutes: number;
  auto_resolve: boolean;
  is_active: boolean;
}

// ── Aggregated Vital Reading ─────────────────────────────────────────────────

export interface AggregatedVital {
  vital_type: VitalType;
  latest_value: number;
  latest_recorded_at: string;
  source: 'check_in' | 'fhir_observation';
  is_abnormal: boolean;
  unit: string;
}

// ── Vital Alert (from guardian_alerts) ────────────────────────────────────────

export interface VitalAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  triggered_at: string;
  resolved_at: string | null;
  metadata: {
    rule_id?: string;
    rule_name?: string;
    vital_type?: string;
    vital_value?: number;
    threshold_operator?: string;
    threshold_value?: number;
    source?: string;
    enrollment_id?: string;
  };
}

// ── Dashboard Summary ────────────────────────────────────────────────────────

export interface RpmDashboardSummary {
  enrolled_count: number;
  active_alerts_count: number;
  needs_review_count: number;
  total_monitoring_minutes: number;
}
