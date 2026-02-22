/**
 * Physical Therapy - Team Communication, Telehealth, API Requests & Clinical Decision Support
 *
 * Defines interdisciplinary communication types, telehealth session tracking,
 * API request/response interfaces, and clinical decision support types.
 */

import type {
  AssessmentType,
  OnsetType,
  LivingSituation,
  TransportationAccess,
  RehabPotential,
  PainAssessment,
  ROMData,
  StrengthData,
  GaitAnalysis,
  BalanceAssessment,
  HomeAccessibility,
  WorkDemands,
  OutcomeMeasure,
} from './assessment';

import type {
  SMARTGoal,
  PTIntervention,
  HEPDeliveryMethod,
  DischargeCriteria,
  DischargeDestination,
  AttendanceStatus,
  HEPCompliance,
  SessionIntervention,
} from './treatment';

import type { HEPExercisePrescription, HEPDeliveryType, EvidenceLevel } from './exercises';
import type { AdministrationContext } from './outcomes';

// =====================================================
// TEAM COMMUNICATION TYPES
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
  action_items?: Record<string, string | number | boolean | null>;

  // Metadata
  created_at: string;
  read_at?: string;
}

// =====================================================
// TELEHEALTH PT TYPES
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
  limitations_due_to_virtual?: Record<string, string | number | boolean | null>;
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
// API REQUEST/RESPONSE TYPES
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
  surgical_history?: Record<string, string | number | boolean | null>;
  imaging_results?: Record<string, string | number | boolean | null>;
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
  participation_goals?: Record<string, string | number | boolean | null>;
  cardiovascular_respiratory_findings?: string;
  integumentary_findings?: string;
  musculoskeletal_findings?: string;
  neuromuscular_findings?: string;
  pain_assessment?: PainAssessment;
  range_of_motion_data?: ROMData[];
  muscle_strength_data?: StrengthData[];
  sensory_assessment?: Record<string, string | number | boolean | null>;
  reflex_testing?: Record<string, string | number | boolean | null>;
  special_tests?: Record<string, string | number | boolean | null>;
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
  barriers_to_recovery?: Record<string, string | number | boolean | null>;
  clinical_reasoning?: string;
  evidence_based_rationale?: string;
  video_assessment_url?: string;
  imaging_links?: string[];
}

export interface UpdatePTAssessmentRequest {
  assessment_id: string;
}

/** PT treatment plan creation -- SMART goals, interventions, authorized visits (distinct from oncology/dental CreateTreatmentPlanRequest) */
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
  vitals_if_needed?: Record<string, string | number | boolean | null>;
  reassessments_today?: Record<string, string | number | boolean | null>;
  functional_changes?: string;
  clinical_decision_making?: string;
  plan_modifications?: Record<string, string | number | boolean | null>;
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
// CLINICAL DECISION SUPPORT TYPES
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
