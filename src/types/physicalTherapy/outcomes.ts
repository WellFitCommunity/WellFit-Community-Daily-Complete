/**
 * Physical Therapy - Outcome Measures, Quality Metrics, Dashboard & Standardized Scores
 *
 * Defines outcome measurement tracking, quality metrics for therapist performance,
 * dashboard helper types, and standardized clinical outcome measure interfaces
 * (LEFS, ODI, DASH, PSFS, TUG, BBS).
 */

// =====================================================
// OUTCOME MEASURES TYPES
// =====================================================

export type AdministrationContext =
  | 'initial_evaluation'
  | 'interim_reassessment'
  | 'discharge'
  | 'follow_up';

export interface PTOutcomeMeasure {
  id: string;
  patient_id: string;
  therapist_id: string;
  assessment_id?: string;
  session_id?: string;

  // Measure Details
  measure_name: string;
  measure_acronym: string; // LEFS, ODI, DASH, QuickDASH, NDI, PSFS, etc.
  body_region?: string;

  // Psychometrics
  mcid?: number; // Minimal Clinically Important Difference
  mdm?: number; // Minimal Detectable Change

  // Administration
  administration_date: string;
  administration_context: AdministrationContext;

  // Scoring
  raw_score: number;
  percentage_score?: number;
  interpretation?: string;

  // Comparison
  previous_score?: number;
  change_from_previous?: number;
  mcid_achieved?: boolean;

  // Evidence
  tool_validation_reference?: string;
  normative_data_reference?: string;

  // Digital
  digital_form_used: boolean;
  auto_calculated: boolean;

  // Metadata
  created_at: string;
}

// =====================================================
// QUALITY METRICS TYPES
// =====================================================

export interface PTQualityMetrics {
  id: string;
  therapist_id: string;

  // Reporting Period
  period_start: string;
  period_end: string;

  // Patient Outcomes
  avg_functional_improvement?: number;
  mcid_achievement_rate?: number;
  discharge_to_prior_level_rate?: number;

  // Efficiency
  avg_visits_to_discharge?: number;
  avg_length_of_care_days?: number;
  no_show_rate?: number;
  cancellation_rate?: number;

  // Documentation Quality
  initial_eval_timeliness_rate?: number;
  daily_note_compliance_rate?: number;
  discharge_summary_completion_rate?: number;

  // Patient Satisfaction
  avg_satisfaction_score?: number;
  nps_score?: number;

  // Safety
  adverse_event_count: number;
  fall_count: number;

  // Productivity
  billable_hours?: number;
  productivity_percentage?: number;

  // Evidence-Based Practice
  cpg_adherence_rate?: number;
  outcome_measure_usage_rate?: number;

  // Metadata
  calculated_at: string;
  calculation_version?: string;
}

// =====================================================
// DASHBOARD HELPER TYPES
// =====================================================

export interface PTCaseloadPatient {
  patient_id: string;
  patient_name: string;
  diagnosis: string;
  visits_used: number;
  visits_remaining: number;
  next_scheduled_visit?: string;
  days_since_last_visit: number;
  progress_status: 'on_track' | 'at_risk' | 'not_progressing';
}

export interface DischargeReadiness {
  ready_for_discharge: boolean;
  goals_met_count: number;
  total_goals: number;
  goals_met_percentage: number;
  recommendations: string;
}

export interface QualityDashboardMetric {
  metric_name: string;
  metric_value: number;
  benchmark: number;
  performance: 'Above Benchmark' | 'At Benchmark' | 'Below Benchmark';
  trend?: 'improving' | 'stable' | 'declining';
}

// =====================================================
// STANDARDIZED OUTCOME MEASURES (Common Tools)
// =====================================================

export interface LEFSScore {
  measure_acronym: 'LEFS';
  measure_name: 'Lower Extremity Functional Scale';
  score: number; // 0-80
  mcid: 9;
  interpretation: string;
}

export interface OSWESTRYScore {
  measure_acronym: 'ODI';
  measure_name: 'Oswestry Disability Index';
  score: number; // 0-100%
  mcid: 10;
  interpretation: 'Minimal' | 'Moderate' | 'Severe' | 'Crippled' | 'Bed-bound';
}

export interface DASHScore {
  measure_acronym: 'DASH';
  measure_name: 'Disabilities of Arm, Shoulder and Hand';
  score: number; // 0-100
  mcid: 10;
  interpretation: string;
}

export interface PSFSScore {
  measure_acronym: 'PSFS';
  measure_name: 'Patient Specific Functional Scale';
  activities: { activity: string; score: number }[]; // Each 0-10
  average_score: number;
  mcid: 2;
}

export interface TUGScore {
  measure_acronym: 'TUG';
  measure_name: 'Timed Up and Go';
  time_seconds: number;
  fall_risk: 'low' | 'moderate' | 'high';
  assistive_device?: string;
}

export interface BergBalanceScore {
  measure_acronym: 'BBS';
  measure_name: 'Berg Balance Scale';
  score: number; // 0-56
  fall_risk: 'low' | 'moderate' | 'high';
  mcid: 5;
}
