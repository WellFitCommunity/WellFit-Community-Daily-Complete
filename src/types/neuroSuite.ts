// =====================================================
// NEUROSUITE TYPES
// =====================================================
// TypeScript interfaces for Stroke & Dementia Care System
// =====================================================

// =====================================================
// 1. STROKE ASSESSMENT TYPES
// =====================================================

export type StrokeAssessmentType =
  | 'baseline'
  | '24_hour'
  | 'discharge'
  | '90_day'
  | 'annual'
  | 'deterioration';

export type StrokeType =
  | 'ischemic_large_vessel'
  | 'ischemic_small_vessel'
  | 'ischemic_cardioembolic'
  | 'ischemic_cryptogenic'
  | 'hemorrhagic_intracerebral'
  | 'hemorrhagic_subarachnoid'
  | 'tia';

export type NIHSSSeverity =
  | 'no_stroke'
  | 'minor_stroke'
  | 'moderate_stroke'
  | 'moderate_severe_stroke'
  | 'severe_stroke';

export interface StrokeAssessment {
  id: string;
  patient_id: string;
  encounter_id?: string;
  assessor_id: string;

  // Context
  assessment_date: string;
  assessment_type: StrokeAssessmentType;

  // Stroke Details
  stroke_type?: StrokeType;
  stroke_territory?: string;

  // Time Critical
  last_known_well?: string;
  symptom_onset?: string;
  arrival_time?: string;
  ct_time?: string;
  time_to_assessment_minutes?: number;

  // NIH Stroke Scale Individual Scores (0-42 total)
  loc_score?: number; // 0-3
  loc_questions_score?: number; // 0-2
  loc_commands_score?: number; // 0-2
  best_gaze_score?: number; // 0-2
  visual_fields_score?: number; // 0-3
  facial_palsy_score?: number; // 0-3
  left_arm_motor_score?: number; // 0-4
  right_arm_motor_score?: number; // 0-4
  left_leg_motor_score?: number; // 0-4
  right_leg_motor_score?: number; // 0-4
  limb_ataxia_score?: number; // 0-2
  sensory_score?: number; // 0-2
  best_language_score?: number; // 0-3
  dysarthria_score?: number; // 0-2
  extinction_inattention_score?: number; // 0-2

  // Calculated Fields
  nihss_total_score: number; // Auto-calculated sum
  nihss_severity: NIHSSSeverity; // Auto-calculated interpretation

  // Treatment
  tpa_eligible?: boolean;
  tpa_administered?: boolean;
  tpa_bolus_time?: string;
  thrombectomy_eligible?: boolean;
  thrombectomy_performed?: boolean;
  groin_puncture_time?: string;
  recanalization_time?: string;

  // Notes
  clinical_notes?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// =====================================================
// 2. MODIFIED RANKIN SCALE (mRS) TYPES
// =====================================================

export type mRSTimepoint =
  | 'pre_stroke'
  | 'discharge'
  | '90_day'
  | '6_month'
  | '1_year'
  | 'annual';

export interface ModifiedRankinScale {
  id: string;
  patient_id: string;
  stroke_assessment_id?: string;
  assessor_id: string;

  assessment_date: string;
  assessment_timepoint: mRSTimepoint;

  // mRS Score (0-6)
  mrs_score: number;
  // 0 = No symptoms
  // 1 = No significant disability despite symptoms
  // 2 = Slight disability
  // 3 = Moderate disability
  // 4 = Moderately severe disability
  // 5 = Severe disability
  // 6 = Dead

  // Structured Details
  ambulation?: string;
  self_care?: string;
  usual_activities?: string;
  pain_discomfort?: string;
  anxiety_depression?: string;

  functional_description?: string;

  created_at: string;
}

// =====================================================
// 3. BARTHEL INDEX TYPES
// =====================================================

export type BarthelInterpretation =
  | 'independent'
  | 'minimal_assistance'
  | 'moderate_assistance'
  | 'severe_dependence'
  | 'total_dependence';

export interface BarthelIndex {
  id: string;
  patient_id: string;
  assessor_id: string;

  assessment_date: string;

  // Individual Items
  feeding: 0 | 5 | 10;
  bathing: 0 | 5;
  grooming: 0 | 5;
  dressing: 0 | 5 | 10;
  bowel_control: 0 | 5 | 10;
  bladder_control: 0 | 5 | 10;
  toilet_use: 0 | 5 | 10;
  transfers: 0 | 5 | 10 | 15;
  mobility: 0 | 5 | 10 | 15;
  stairs: 0 | 5 | 10;

  // Calculated Fields
  barthel_total: number; // 0-100
  barthel_interpretation: BarthelInterpretation;

  created_at: string;
}

// =====================================================
// 4. COGNITIVE ASSESSMENT TYPES (MoCA/MMSE)
// =====================================================

export type CognitiveAssessmentTool = 'MoCA' | 'MMSE' | 'SLUMS' | 'Mini-Cog';

export interface CognitiveAssessment {
  id: string;
  patient_id: string;
  assessor_id: string;
  encounter_id?: string;

  assessment_date: string;
  assessment_tool: CognitiveAssessmentTool;

  // Patient Education
  years_education?: number;
  education_adjustment_applied?: boolean;

  // MoCA Scoring (0-30)
  moca_visuospatial?: number; // 0-5
  moca_naming?: number; // 0-3
  moca_attention?: number; // 0-6
  moca_language?: number; // 0-3
  moca_abstraction?: number; // 0-2
  moca_delayed_recall?: number; // 0-5
  moca_orientation?: number; // 0-6
  moca_total_score?: number; // Auto-calculated, ≥26 = normal

  // MMSE Scoring (0-30)
  mmse_orientation_time?: number; // 0-5
  mmse_orientation_place?: number; // 0-5
  mmse_registration?: number; // 0-3
  mmse_attention_calculation?: number; // 0-5
  mmse_recall?: number; // 0-3
  mmse_naming?: number; // 0-2
  mmse_repetition?: number; // 0-1
  mmse_comprehension?: number; // 0-3
  mmse_reading?: number; // 0-1
  mmse_writing?: number; // 0-1
  mmse_drawing?: number; // 0-1
  mmse_total_score?: number; // Auto-calculated, ≥24 = normal

  // Clinical Interpretation
  cognitive_status?: string;
  concerns_noted?: string[];

  // Notes
  behavioral_observations?: string;
  informant_report?: string;

  created_at: string;
}

// =====================================================
// 5. DEMENTIA STAGING (CDR) TYPES
// =====================================================

export type CDRScore = 0 | 0.5 | 1 | 2 | 3;

export type DementiaStage =
  | 'no_dementia'
  | 'questionable_dementia_mci'
  | 'mild_dementia'
  | 'moderate_dementia'
  | 'severe_dementia';

export interface DementiaStaging {
  id: string;
  patient_id: string;
  assessor_id: string;

  assessment_date: string;

  // CDR Domain Scores (each 0, 0.5, 1, 2, or 3)
  cdr_memory: CDRScore;
  cdr_orientation: CDRScore;
  cdr_judgment_problem_solving: CDRScore;
  cdr_community_affairs: CDRScore;
  cdr_home_hobbies: CDRScore;
  cdr_personal_care: CDRScore;

  // Calculated Fields
  cdr_global_score: CDRScore; // Algorithm-based, not simple average
  cdr_sum_boxes: number; // 0-18, sum of all domains
  dementia_stage: DementiaStage;

  // Informant Details
  informant_name?: string;
  informant_relationship?: string;
  informant_contact_frequency?: string;

  // Notes
  functional_decline_examples?: string;

  created_at: string;
}

// =====================================================
// 6. CAREGIVER BURDEN ASSESSMENT (Zarit) TYPES
// =====================================================

export type BurdenLevel =
  | 'little_no_burden'
  | 'mild_moderate_burden'
  | 'moderate_severe_burden';

export interface CaregiverAssessment {
  id: string;
  patient_id: string;
  caregiver_id?: string;
  assessor_id: string;

  assessment_date: string;

  // Caregiver Info
  caregiver_name: string;
  caregiver_relationship: string;
  caregiver_lives_with_patient?: boolean;
  hours_caregiving_per_week?: number;
  other_caregivers_available?: boolean;

  // Zarit Burden Interview Short Form (12 items, 0-4 each)
  zbi_feel_strain?: number;
  zbi_time_affected?: number;
  zbi_stressed?: number;
  zbi_embarrassed?: number;
  zbi_angry?: number;
  zbi_relationships_affected?: number;
  zbi_health_suffered?: number;
  zbi_privacy_affected?: number;
  zbi_social_life_affected?: number;
  zbi_lost_control?: number;
  zbi_uncertain_what_to_do?: number;
  zbi_should_do_more?: number;

  // Calculated Fields
  zbi_total_score: number; // 0-48
  burden_level: BurdenLevel;

  // Support Needs
  respite_care_needed?: boolean;
  support_group_interest?: boolean;
  counseling_needed?: boolean;
  financial_assistance_needed?: boolean;

  // Notes
  caregiver_concerns?: string;
  interventions_recommended?: string[];

  created_at: string;
}

// =====================================================
// 7. NEURO CARE PLAN TYPES
// =====================================================

export type NeuroCareType =
  | 'acute_stroke'
  | 'stroke_rehab'
  | 'stroke_secondary_prevention'
  | 'dementia_early_stage'
  | 'dementia_moderate_stage'
  | 'dementia_advanced_stage'
  | 'mci_monitoring';

export type CarePlanStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface NeuroCarePlan {
  id: string;
  patient_id: string;
  fhir_care_plan_id?: string;

  // Plan Type
  care_plan_type: NeuroCareType;
  status: CarePlanStatus;

  // Timeline
  start_date: string;
  projected_end_date?: string;
  actual_end_date?: string;

  // Stroke-Specific
  stroke_prevention_medications?: Record<string, any>;
  blood_pressure_target?: string;
  cholesterol_target?: string;
  diabetes_management_plan?: string;
  smoking_cessation_plan?: string;

  // Dementia-Specific
  cognitive_stimulation_activities?: Record<string, any>;
  behavioral_management_strategies?: Record<string, any>;
  medication_management_plan?: string;
  safety_interventions?: Record<string, any>;
  advance_directive_status?: string;
  legal_planning_status?: string;

  // Goals
  patient_goals?: Record<string, any>;
  family_goals?: Record<string, any>;

  // Care Team
  neurologist_id?: string;
  primary_care_id?: string;
  case_manager_id?: string;
  social_worker_id?: string;

  // Monitoring
  follow_up_schedule?: Record<string, any>;
  imaging_schedule?: Record<string, any>;
  lab_monitoring_schedule?: Record<string, any>;

  // Education
  patient_education_completed?: Record<string, any>;
  caregiver_education_completed?: Record<string, any>;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// 8. WEARABLE DATA TYPES
// =====================================================

export type WearableDeviceType =
  | 'apple_watch'
  | 'fitbit'
  | 'garmin'
  | 'samsung_health'
  | 'withings'
  | 'empatica' // Seizure detection
  | 'other';

export interface WearableConnection {
  id: string;
  user_id: string;

  device_type: WearableDeviceType;
  device_model?: string;
  device_id?: string;

  // Connection Status
  connected: boolean;
  last_sync: string;
  sync_frequency_minutes: number;

  // Permissions
  permissions_granted: string[]; // ['heart_rate', 'steps', 'fall_detection', etc.]

  // Integration Details
  api_token?: string; // Encrypted
  refresh_token?: string; // Encrypted

  created_at: string;
  updated_at: string;
}

export interface WearableVitalSign {
  id: string;
  user_id: string;
  device_id: string;

  // Data Type
  vital_type: 'heart_rate' | 'blood_pressure' | 'oxygen_saturation' | 'temperature' | 'respiratory_rate';

  // Measurement
  value: number;
  unit: string;
  measured_at: string;

  // Context
  activity_state?: 'resting' | 'active' | 'sleeping';
  quality_indicator?: 'good' | 'fair' | 'poor';

  // Alerts
  alert_triggered?: boolean;
  alert_type?: 'high' | 'low' | 'irregular';

  created_at: string;
}

export interface WearableActivityData {
  id: string;
  user_id: string;
  device_id: string;

  date: string; // Day of activity

  // Activity Metrics
  steps?: number;
  distance_meters?: number;
  active_minutes?: number;
  calories_burned?: number;
  floors_climbed?: number;

  // Sleep Data
  sleep_minutes?: number;
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  sleep_quality_score?: number; // 0-100

  // Sedentary Behavior
  sedentary_minutes?: number;

  created_at: string;
}

export interface WearableFallDetection {
  id: string;
  user_id: string;
  device_id: string;

  // Fall Event
  detected_at: string;
  fall_severity?: 'low' | 'medium' | 'high';

  // Location (if available)
  latitude?: number;
  longitude?: number;
  location_accuracy_meters?: number;

  // Response
  user_responded?: boolean;
  user_response_time_seconds?: number;
  emergency_contact_notified?: boolean;
  ems_dispatched?: boolean;

  // Outcome
  injury_reported?: boolean;
  hospital_transport?: boolean;

  // Clinical Follow-up
  clinical_assessment_id?: string; // Link to neuro assessment
  follow_up_completed?: boolean;

  created_at: string;
}

// Gait and tremor analysis (for Parkinson's - future)
export interface WearableGaitAnalysis {
  id: string;
  user_id: string;
  device_id: string;

  recorded_at: string;
  duration_seconds: number;

  // Gait Metrics
  step_count?: number;
  cadence?: number; // Steps per minute
  stride_length_cm?: number;
  gait_speed_m_per_s?: number;
  double_support_time_percent?: number;
  gait_variability_score?: number; // Higher = more variable = worse

  // Balance Metrics
  postural_sway_mm?: number;
  balance_confidence_score?: number;

  // Tremor Detection (accelerometer-based)
  tremor_detected?: boolean;
  tremor_frequency_hz?: number;
  tremor_amplitude?: number;

  // Clinical Correlation
  freezing_of_gait_episodes?: number;
  medication_state?: 'on' | 'off' | 'wearing_off';

  created_at: string;
}

// =====================================================
// 9. API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateStrokeAssessmentRequest {
  patient_id: string;
  encounter_id?: string;
  assessment_type: StrokeAssessmentType;
  assessment_date?: string;
  stroke_type?: StrokeType;
  stroke_territory?: string;
  last_known_well?: string;
  symptom_onset?: string;
  arrival_time?: string;
  ct_time?: string;
  time_to_assessment_minutes?: number;
  loc_score?: number;
  loc_questions_score?: number;
  loc_commands_score?: number;
  best_gaze_score?: number;
  visual_fields_score?: number;
  facial_palsy_score?: number;
  left_arm_motor_score?: number;
  right_arm_motor_score?: number;
  left_leg_motor_score?: number;
  right_leg_motor_score?: number;
  limb_ataxia_score?: number;
  sensory_score?: number;
  best_language_score?: number;
  dysarthria_score?: number;
  extinction_inattention_score?: number;
  tpa_administered?: boolean;
  tpa_bolus_time?: string;
  thrombectomy_eligible?: boolean;
  thrombectomy_performed?: boolean;
  groin_puncture_time?: string;
  recanalization_time?: string;
  clinical_notes?: string;
}

export interface CreateCognitiveAssessmentRequest {
  patient_id: string;
  encounter_id?: string;
  assessment_date?: string;
  assessment_tool: CognitiveAssessmentTool;
  years_education?: number;
  moca_visuospatial?: number;
  moca_naming?: number;
  moca_attention?: number;
  moca_language?: number;
  moca_abstraction?: number;
  moca_delayed_recall?: number;
  moca_orientation?: number;
  mmse_orientation_time?: number;
  mmse_orientation_place?: number;
  mmse_registration?: number;
  mmse_attention_calculation?: number;
  mmse_recall?: number;
  mmse_naming?: number;
  mmse_repetition?: number;
  mmse_comprehension?: number;
  mmse_reading?: number;
  mmse_writing?: number;
  mmse_drawing?: number;
  concerns_noted?: string[];
  behavioral_observations?: string;
  informant_report?: string;
}

export interface CreateCaregiverAssessmentRequest {
  patient_id: string;
  caregiver_id?: string;
  caregiver_name: string;
  caregiver_relationship: string;
  caregiver_lives_with_patient?: boolean;
  hours_caregiving_per_week?: number;
  other_caregivers_available?: boolean;
  zbi_feel_strain?: number;
  zbi_time_affected?: number;
  zbi_stressed?: number;
  zbi_embarrassed?: number;
  zbi_angry?: number;
  zbi_relationships_affected?: number;
  zbi_health_suffered?: number;
  zbi_privacy_affected?: number;
  zbi_social_life_affected?: number;
  zbi_lost_control?: number;
  zbi_uncertain_what_to_do?: number;
  zbi_should_do_more?: number;
  respite_care_needed?: boolean;
  support_group_interest?: boolean;
  counseling_needed?: boolean;
  financial_assistance_needed?: boolean;
  caregiver_concerns?: string;
  interventions_recommended?: string[];
}

export interface ConnectWearableRequest {
  user_id: string;
  device_type: WearableDeviceType;
  auth_code: string; // OAuth code from device provider
}

export interface WearableDataSyncRequest {
  device_id: string;
  start_date: string;
  end_date: string;
}

// =====================================================
// 10. CLINICAL DECISION SUPPORT TYPES
// =====================================================

export interface StrokeRiskAssessment {
  patient_id: string;
  assessment_date: string;

  // Risk Factors
  hypertension: boolean;
  diabetes: boolean;
  atrial_fibrillation: boolean;
  smoking: boolean;
  previous_stroke_tia: boolean;
  family_history: boolean;
  age_over_55: boolean;

  // Risk Score
  risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'very_high';

  // Recommendations
  prevention_strategies: string[];
}

export interface FallRiskAssessment {
  patient_id: string;
  assessment_date: string;

  // Risk Factors
  previous_falls: number; // In past year
  gait_impairment: boolean;
  balance_impairment: boolean;
  cognitive_impairment: boolean;
  medication_risk_factors: string[];
  environmental_hazards: string[];

  // Risk Score (Morse Fall Scale or similar)
  fall_risk_score: number;
  fall_risk_level: 'low' | 'moderate' | 'high';

  // Interventions
  interventions_recommended: string[];
}

export interface CognitiveDeclineTrajectory {
  patient_id: string;

  // Baseline
  baseline_date: string;
  baseline_score: number;
  baseline_tool: CognitiveAssessmentTool;

  // Trend Data
  assessments: Array<{
    date: string;
    score: number;
    change_from_baseline: number;
  }>;

  // Projection
  projected_decline_rate_per_year: number;
  projected_next_score: number;
  projected_next_assessment_date: string;

  // Clinical Significance
  clinically_significant_decline: boolean;
  intervention_needed: boolean;
}
