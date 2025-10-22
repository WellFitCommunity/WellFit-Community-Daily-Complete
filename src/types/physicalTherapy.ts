// =====================================================
// PHYSICAL THERAPY WORKFLOW TYPES
// =====================================================
// TypeScript interfaces for innovative PT system
// =====================================================

// =====================================================
// 1. FUNCTIONAL ASSESSMENT TYPES
// =====================================================

export type AssessmentType =
  | 'initial_evaluation'
  | 'interim_evaluation'
  | 'discharge_evaluation'
  | 'post_discharge_followup';

export type OnsetType = 'acute' | 'insidious' | 'gradual' | 'post_surgical';

export type LivingSituation =
  | 'independent_alone'
  | 'independent_with_family'
  | 'assisted_living'
  | 'skilled_nursing'
  | 'homeless'
  | 'other';

export type TransportationAccess =
  | 'independent_driving'
  | 'family_transport'
  | 'public_transport'
  | 'medical_transport'
  | 'no_reliable_transport';

export type RehabPotential = 'excellent' | 'good' | 'fair' | 'poor' | 'guarded';

export interface PainAssessment {
  location: string;
  quality: string; // Sharp, dull, aching, burning, etc.
  intensity_at_rest: number; // 0-10 NRS
  intensity_with_activity: number;
  aggravating_factors: string[];
  alleviating_factors: string[];
  pain_pattern: string; // Constant, intermittent, nocturnal
  interference_with_function: string;
}

export interface ROMData {
  joint: string;
  movement: string; // Flexion, extension, abduction, etc.
  active_rom_degrees: number;
  passive_rom_degrees: number;
  end_feel: string; // Firm, soft, hard, empty, springy
  limiting_factors: string[]; // Pain, stiffness, weakness
  measurement_method: string; // Goniometer, visual estimate, inclinometer
}

export interface StrengthData {
  muscle_group: string;
  mmt_grade: string; // 0, 1, 2-, 2, 2+, 3-, 3, 3+, 4-, 4, 4+, 5
  mmt_numeric: number; // 0-5 for calculations
  testing_position: string;
  compensation_noted: boolean;
  pain_with_testing: boolean;
}

export interface GaitAnalysis {
  assistive_device: string | null; // None, cane, walker, crutches, wheelchair
  gait_pattern: string; // Normal, antalgic, trendelenburg, ataxic, etc.
  cadence: string; // Slow, normal, fast
  stride_length: string; // Decreased, normal, increased
  deviations: string[];
  weight_bearing_status: string; // Full, partial, non-weight bearing, TTWB
  distance_ambulated: string;
  functional_mobility_score?: number; // Timed Up and Go, 10-meter walk test
}

export interface BalanceAssessment {
  static_balance: string;
  dynamic_balance: string;
  single_leg_stance_seconds_right: number | null;
  single_leg_stance_seconds_left: number | null;
  berg_balance_scale_score?: number; // 0-56
  abc_scale_score?: number; // Activities-Specific Balance Confidence 0-100%
  fall_risk: 'low' | 'moderate' | 'high';
  assistive_device_for_balance: string | null;
}

export interface FunctionalMobilityScore {
  category: string; // Bed mobility, transfers, ambulation, stairs
  fim_score: number; // 1-7 scale
  assistance_level: string; // Independent, supervision, minimal, moderate, maximal, total
}

export interface OutcomeMeasure {
  measure_name: string;
  measure_acronym: string;
  score: number;
  max_score: number;
  percentage: number;
  interpretation: string;
  administration_date: string;
  mcid: number; // Minimal Clinically Important Difference
}

export interface HomeAccessibility {
  stairs_to_enter: number;
  stairs_inside: number;
  handrails_present: boolean;
  bathroom_setup: string;
  bedroom_location: string; // First floor, second floor, etc.
  environmental_barriers: string[];
  modifications_recommended: string[];
}

export interface WorkDemands {
  physical_demand_level: 'sedentary' | 'light' | 'medium' | 'heavy' | 'very_heavy';
  essential_functions: string[];
  lifting_requirements: string;
  standing_requirements: string;
  ergonomic_concerns: string[];
}

export interface PTFunctionalAssessment {
  id: string;
  patient_id: string;
  encounter_id?: string;
  therapist_id: string;

  assessment_type: AssessmentType;
  assessment_date: string;
  visit_number: number;

  // Chief Complaint
  chief_complaint: string;
  history_present_illness?: string;
  mechanism_of_injury?: string;
  onset_date?: string;
  onset_type?: OnsetType;

  // Medical History
  prior_level_of_function?: string;
  comorbidities?: string[];
  medications_affecting_rehab?: string[];
  surgical_history?: Record<string, any>;
  imaging_results?: Record<string, any>;
  precautions?: string[];
  contraindications?: string[];

  // Social Determinants (ICF)
  living_situation?: LivingSituation;
  home_accessibility?: HomeAccessibility;
  support_system?: string;
  transportation_access?: TransportationAccess;
  occupation?: string;
  work_demands?: WorkDemands;
  hobbies_recreational_activities?: string[];

  // Patient Goals
  patient_stated_goals?: string[];
  participation_goals?: Record<string, any>;

  // Systems Review
  cardiovascular_respiratory_findings?: string;
  integumentary_findings?: string;
  musculoskeletal_findings?: string;
  neuromuscular_findings?: string;

  // Impairments (ICF)
  pain_assessment?: PainAssessment;
  range_of_motion_data?: ROMData[];
  muscle_strength_data?: StrengthData[];
  sensory_assessment?: Record<string, any>;
  reflex_testing?: Record<string, any>;
  special_tests?: Record<string, any>;
  posture_analysis?: string;
  gait_analysis?: GaitAnalysis;
  balance_assessment?: BalanceAssessment;
  coordination_assessment?: string;

  // Activity Limitations
  bed_mobility_score?: number;
  transfer_ability_score?: number;
  ambulation_score?: number;
  stair_negotiation_score?: number;

  // Outcome Measures
  outcome_measures?: OutcomeMeasure[];

  // Clinical Impression
  primary_diagnosis: string;
  secondary_diagnoses?: string[];
  clinical_impression: string;

  // Prognosis
  rehab_potential?: RehabPotential;
  prognosis_narrative?: string;
  expected_duration_weeks?: number;
  expected_visit_frequency?: string;

  // Barriers
  barriers_to_recovery?: Record<string, any>;

  // Clinical Reasoning
  clinical_reasoning?: string;
  evidence_based_rationale?: string;

  // Digital
  video_assessment_url?: string;
  imaging_links?: string[];

  // Metadata
  created_at: string;
  updated_at: string;
  signed_by?: string;
  signed_at?: string;
}

// =====================================================
// 2. TREATMENT PLAN TYPES
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
  modification_history?: Record<string, any>;

  // Discharge Planning
  discharge_criteria?: DischargeCriteria[];
  discharge_destination?: DischargeDestination;

  // Collaboration
  interdisciplinary_referrals?: string[];
  physician_communication_log?: Record<string, any>;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// 3. TREATMENT SESSION TYPES
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
  vitals_if_needed?: Record<string, any>;
  reassessments_today?: Record<string, any>;

  // Interventions Provided
  interventions_delivered: SessionIntervention[];

  // Assessment (SOAP)
  progress_toward_goals: string;
  functional_changes?: string;
  clinical_decision_making?: string;

  // Plan (SOAP)
  plan_for_next_visit: string;
  plan_modifications?: Record<string, any>;
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

// =====================================================
// 4. EXERCISE LIBRARY TYPES
// =====================================================

export type ExerciseCategory =
  | 'therapeutic_exercise'
  | 'neuromuscular_reeducation'
  | 'balance_coordination'
  | 'gait_training'
  | 'manual_therapy'
  | 'modality'
  | 'functional_training'
  | 'cardiovascular_endurance'
  | 'flexibility_rom';

export type EvidenceLevel =
  | 'level_1a' // Systematic review of RCTs
  | 'level_1b' // Individual RCT
  | 'level_2a' // Systematic review of cohort studies
  | 'level_2b' // Individual cohort study
  | 'level_3'  // Case-control
  | 'level_4'  // Case series
  | 'level_5'  // Expert opinion
  | 'clinical_experience';

export interface PTExercise {
  id: string;

  // Identification
  exercise_name: string;
  exercise_code?: string;
  category: ExerciseCategory;
  subcategory?: string;

  // Description
  description: string;
  purpose: string;
  indications?: string[];
  contraindications?: string[];
  precautions?: string[];

  // Evidence Base
  evidence_level?: EvidenceLevel;
  research_references?: string[];
  clinical_practice_guideline?: string;

  // Dosage
  default_sets?: number;
  default_reps?: number;
  default_hold_seconds?: number;
  default_frequency_per_week?: number;
  progression_guidelines?: string;
  regression_options?: string;

  // Media
  demonstration_video_url?: string;
  patient_handout_url?: string;
  images?: string[];

  // Equipment
  equipment_required?: string[];

  // Instructions
  patient_instructions: string;
  common_errors?: string[];

  // Clinical Notes
  therapist_notes?: string;

  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
  approved_for_use: boolean;
  times_prescribed: number;
}

// =====================================================
// 5. HOME EXERCISE PROGRAM TYPES
// =====================================================

export type HEPDeliveryType =
  | 'paper_handout'
  | 'email_pdf'
  | 'patient_portal'
  | 'mobile_app'
  | 'sms_link'
  | 'telehealth_demo';

export interface HEPExercisePrescription {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  hold_seconds?: number;
  frequency_per_week: number;
  special_instructions?: string;
  video_link?: string;
  order_sequence: number;
}

export interface HEPComplianceLog {
  date: string;
  exercises_completed: string[]; // Array of exercise IDs
  difficulty_rating: number; // 1-5 scale
  pain_during?: number; // 0-10 scale
  notes?: string;
}

export interface PTHomeExerciseProgram {
  id: string;
  patient_id: string;
  treatment_plan_id: string;
  therapist_id: string;

  program_name: string;
  prescribed_date: string;
  last_modified_date?: string;
  active: boolean;

  // Exercises
  exercises: HEPExercisePrescription[];

  // Instructions
  overall_instructions?: string;
  frequency_guidance?: string;
  time_of_day_recommendation?: string;
  expected_duration_minutes?: number;

  // Compliance Tracking
  patient_tracking_enabled: boolean;
  compliance_logs?: HEPComplianceLog[];

  // Digital Delivery
  delivery_method?: HEPDeliveryType;
  sent_to_patient_at?: string;
  patient_acknowledged: boolean;
  patient_acknowledged_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// 6. OUTCOME MEASURES TYPES
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
// 7. QUALITY METRICS TYPES
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
// 8. TEAM COMMUNICATION TYPES
// =====================================================

export type ClinicalDiscipline =
  | 'physical_therapy'
  | 'occupational_therapy'
  | 'speech_therapy'
  | 'nursing'
  | 'physician'
  | 'social_work'
  | 'psychology'
  | 'case_management'
  | 'pharmacy';

export type CommunicationType =
  | 'consultation_request'
  | 'status_update'
  | 'discharge_coordination'
  | 'safety_concern'
  | 'goal_alignment'
  | 'equipment_recommendation'
  | 'patient_education_coordination';

export type CommunicationPriority = 'routine' | 'urgent' | 'emergent';

export interface PTTeamCommunication {
  id: string;
  patient_id: string;

  // Communication Details
  from_discipline: ClinicalDiscipline;
  to_discipline: ClinicalDiscipline;
  from_user_id: string;
  to_user_id?: string;

  // Message
  communication_type: CommunicationType;
  message_subject: string;
  message_body: string;
  priority: CommunicationPriority;

  // Response
  response_required: boolean;
  response_by_date?: string;
  response_received: boolean;
  response_text?: string;
  responded_by?: string;
  responded_at?: string;

  // Action Items
  action_items?: Record<string, any>;

  // Metadata
  created_at: string;
  read_at?: string;
}

// =====================================================
// 9. TELEHEALTH PT TYPES
// =====================================================

export type TelehealthPlatform =
  | 'zoom'
  | 'doxy_me'
  | 'vsee'
  | 'webex'
  | 'microsoft_teams'
  | 'native_platform';

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export interface PTTelehealthSession {
  id: string;
  session_id: string;
  patient_id: string;
  therapist_id: string;

  // Platform
  platform_used: TelehealthPlatform;

  // Technical Quality
  video_quality: ConnectionQuality;
  audio_quality: ConnectionQuality;
  technical_issues?: string;

  // Clinical Adaptations
  limitations_due_to_virtual?: Record<string, any>;
  adaptations_made?: string[];

  // Patient Environment
  home_safety_observations?: string;
  equipment_available?: string[];
  caregiver_present: boolean;
  caregiver_trained: boolean;

  // Clinical Effectiveness
  virtual_effectiveness_rating: number; // 1-5
  recommend_return_to_in_person: boolean;

  // Billing Compliance
  consent_documented: boolean;
  patient_location_verified: boolean;
  appropriate_for_telehealth_code: boolean;

  // Metadata
  session_start_time: string;
  session_end_time: string;
  recording_consent: boolean;
  recording_url?: string;
}

// =====================================================
// 10. HELPER TYPES FOR DASHBOARDS
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
// 11. STANDARDIZED OUTCOME MEASURES (Common Tools)
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

// =====================================================
// 12. API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreatePTAssessmentRequest {
  patient_id: string;
  encounter_id?: string;
  assessment_type: AssessmentType;
  assessment_date?: string;
  visit_number?: number;
  chief_complaint: string;
  history_present_illness?: string;
  mechanism_of_injury?: string;
  onset_date?: string;
  onset_type?: OnsetType;
  prior_level_of_function?: string;
  comorbidities?: string[];
  medications_affecting_rehab?: string[];
  surgical_history?: Record<string, any>;
  imaging_results?: Record<string, any>;
  precautions?: string[];
  contraindications?: string[];
  living_situation?: LivingSituation;
  home_accessibility?: HomeAccessibility;
  support_system?: string;
  transportation_access?: TransportationAccess;
  occupation?: string;
  work_demands?: WorkDemands;
  hobbies_recreational_activities?: string[];
  patient_stated_goals?: string[];
  participation_goals?: Record<string, any>;
  cardiovascular_respiratory_findings?: string;
  integumentary_findings?: string;
  musculoskeletal_findings?: string;
  neuromuscular_findings?: string;
  pain_assessment?: PainAssessment;
  range_of_motion_data?: ROMData[];
  muscle_strength_data?: StrengthData[];
  sensory_assessment?: Record<string, any>;
  reflex_testing?: Record<string, any>;
  special_tests?: Record<string, any>;
  posture_analysis?: string;
  gait_analysis?: GaitAnalysis;
  balance_assessment?: BalanceAssessment;
  coordination_assessment?: string;
  bed_mobility_score?: number;
  transfer_ability_score?: number;
  ambulation_score?: number;
  stair_negotiation_score?: number;
  outcome_measures?: OutcomeMeasure[];
  primary_diagnosis: string;
  secondary_diagnoses?: string[];
  clinical_impression: string;
  rehab_potential?: RehabPotential;
  prognosis_narrative?: string;
  expected_duration_weeks?: number;
  expected_visit_frequency?: string;
  barriers_to_recovery?: Record<string, any>;
  clinical_reasoning?: string;
  evidence_based_rationale?: string;
  video_assessment_url?: string;
  imaging_links?: string[];
}

export interface UpdatePTAssessmentRequest {
  assessment_id: string;
}

export interface CreateTreatmentPlanRequest {
  patient_id: string;
  assessment_id: string;
  care_plan_id?: string;
  goals: SMARTGoal[];
  interventions: PTIntervention[];
  total_visits_authorized: number;
  frequency: string;
  start_date: string;
  projected_end_date: string;
  treatment_approach?: string[];
  clinical_practice_guidelines_followed?: string[];
  hep_prescribed?: boolean;
  hep_delivery_method?: HEPDeliveryMethod;
  hep_compliance_tracking?: boolean;
  discharge_criteria?: DischargeCriteria[];
  discharge_destination?: DischargeDestination;
  interdisciplinary_referrals?: string[];
}

export interface RecordTreatmentSessionRequest {
  patient_id: string;
  treatment_plan_id: string;
  encounter_id?: string;
  session_date: string;
  session_duration_minutes?: number;
  interventions_delivered: SessionIntervention[];
  progress_toward_goals: string;
  plan_for_next_visit: string;
  attendance_status: AttendanceStatus;
  patient_reported_status?: string;
  pain_level_today?: number;
  hep_compliance?: HEPCompliance;
  barriers_today?: string[];
  vitals_if_needed?: Record<string, any>;
  reassessments_today?: Record<string, any>;
  functional_changes?: string;
  clinical_decision_making?: string;
  plan_modifications?: Record<string, any>;
  goals_updated?: boolean;
  exercise_videos_shared?: string[];
  educational_materials_provided?: string[];
  adverse_events?: string;
  incident_report_filed?: boolean;
}

export interface AssignHEPRequest {
  patient_id: string;
  treatment_plan_id: string;
  program_name: string;
  exercises: HEPExercisePrescription[];
  delivery_method: HEPDeliveryType;
  overall_instructions?: string;
  frequency_guidance?: string;
  time_of_day_recommendation?: string;
  expected_duration_minutes?: number;
  patient_tracking_enabled?: boolean;
}

export interface RecordOutcomeMeasureRequest {
  patient_id: string;
  assessment_id?: string;
  session_id?: string;
  measure_acronym: string;
  measure_name: string;
  raw_score: number;
  administration_context: AdministrationContext;
  administration_date: string;
  body_region?: string;
  mcid?: number;
  mdm?: number;
  percentage_score?: number;
  interpretation?: string;
  tool_validation_reference?: string;
  normative_data_reference?: string;
  digital_form_used?: boolean;
  auto_calculated?: boolean;
}

// =====================================================
// 13. CLINICAL DECISION SUPPORT TYPES
// =====================================================

export interface PTClinicalAlert {
  alert_type: 'goal_not_progressing' | 'visit_utilization_high' | 'no_outcome_measure' | 'discharge_overdue';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  recommendation: string;
  patient_id: string;
  treatment_plan_id?: string;
}

export interface ProgressIndicator {
  indicator_name: string;
  baseline_value: number;
  current_value: number;
  target_value: number;
  progress_percentage: number;
  on_track: boolean;
}

export interface TreatmentRecommendation {
  recommendation_id: string;
  intervention_type: string;
  rationale: string;
  evidence_level: EvidenceLevel;
  research_support: string[];
  contraindications_check: boolean;
}
