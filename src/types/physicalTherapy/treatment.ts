/**
 * Physical Therapy - Treatment Plan & Session Types
 *
 * Defines treatment plan status, SMART goals, interventions,
 * discharge criteria, treatment sessions, and session interventions.
 */

// =====================================================
// TREATMENT PLAN TYPES
// =====================================================

export type PlanStatus = 'draft' | 'active' | 'on_hold' | 'modified' | 'completed' | 'discontinued';

export type ICFCategory = 'body_function' | 'activity' | 'participation';

export type HEPDeliveryMethod =
  | 'paper_handout'
  | 'digital_app'
  | 'video_demonstration'
  | 'telehealth_instruction'
  | 'combination';

export type DischargeDestination =
  | 'home_independent'
  | 'home_with_services'
  | 'subacute_rehab'
  | 'continued_outpatient'
  | 'self_maintenance_program';

export interface SMARTGoal {
  goal_id: string;
  goal_statement: string;
  icf_category: ICFCategory;
  baseline_status: string;
  target_status: string;
  timeframe_weeks: number;
  progress_percentage: number;
  outcome_measure_used?: string;
  achieved: boolean;
  achieved_date?: string;
}

export interface PTIntervention {
  intervention_id: string;
  intervention_type: string;
  intervention_name: string;
  cpt_code: string; // 97110, 97112, 97116, 97140, etc.
  rationale: string;
  frequency: string; // "Each visit", "3x per week", etc.
  duration_minutes: number;
  evidence_base?: string;
}

export interface DischargeCriteria {
  criterion_id: string;
  description: string;
  target_value: string;
  current_status: string;
  met: boolean;
}

export interface PTTreatmentPlan {
  id: string;
  patient_id: string;
  assessment_id: string;
  care_plan_id?: string;
  therapist_id: string;

  status: PlanStatus;

  // Plan Period
  start_date: string;
  projected_end_date: string;
  actual_end_date?: string;

  // Visit Management
  total_visits_authorized: number;
  visits_used: number;
  visits_remaining: number;
  frequency: string;

  // Goals
  goals: SMARTGoal[];

  // Interventions
  interventions: PTIntervention[];

  // Treatment Approach
  treatment_approach?: string[];
  clinical_practice_guidelines_followed?: string[];

  // Home Exercise Program
  hep_prescribed: boolean;
  hep_delivery_method?: HEPDeliveryMethod;
  hep_compliance_tracking: boolean;

  // Modifications
  modification_history?: Record<string, string | number | boolean | null>;

  // Discharge Planning
  discharge_criteria?: DischargeCriteria[];
  discharge_destination?: DischargeDestination;

  // Collaboration
  interdisciplinary_referrals?: string[];
  physician_communication_log?: Record<string, string | number | boolean | null>;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// TREATMENT SESSION TYPES
// =====================================================

export type AttendanceStatus =
  | 'attended'
  | 'late_cancel'
  | 'no_show'
  | 'rescheduled'
  | 'cancelled_by_facility';

export type HEPCompliance =
  | 'fully_compliant'
  | 'mostly_compliant'
  | 'partially_compliant'
  | 'non_compliant'
  | 'not_applicable';

export interface SessionIntervention {
  intervention_type: string;
  intervention_name: string;
  cpt_code: string;
  time_spent_minutes: number;
  parameters: string; // "10 reps x 3 sets", "Grade III mobilization L4-L5"
  patient_response: string;
}

export interface PTTreatmentSession {
  id: string;
  patient_id: string;
  treatment_plan_id: string;
  encounter_id?: string;
  therapist_id: string;

  session_date: string;
  session_number: number;
  session_duration_minutes: number;

  attendance_status: AttendanceStatus;

  // Subjective (SOAP)
  patient_reported_status?: string;
  pain_level_today?: number;
  hep_compliance?: HEPCompliance;
  barriers_today?: string[];

  // Objective (SOAP)
  vitals_if_needed?: Record<string, string | number | boolean | null>;
  reassessments_today?: Record<string, string | number | boolean | null>;

  // Interventions Provided
  interventions_delivered: SessionIntervention[];

  // Assessment (SOAP)
  progress_toward_goals: string;
  functional_changes?: string;
  clinical_decision_making?: string;

  // Plan (SOAP)
  plan_for_next_visit: string;
  plan_modifications?: Record<string, string | number | boolean | null>;
  goals_updated: boolean;

  // Billing
  total_timed_minutes?: number;
  total_billable_units?: number;
  cpt_codes_billed?: string[];

  // Digital Assets
  exercise_videos_shared?: string[];
  educational_materials_provided?: string[];

  // Safety
  adverse_events?: string;
  incident_report_filed: boolean;

  // Metadata
  created_at: string;
  updated_at: string;
  co_signed_by?: string;
  co_signed_at?: string;
}
