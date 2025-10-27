// Discharge Planning TypeScript Type Definitions
// Comprehensive type system for discharge planning and post-acute care coordination

export type DischargeDisposition =
  | 'home'
  | 'home_with_home_health'
  | 'skilled_nursing'
  | 'inpatient_rehab'
  | 'long_term_acute_care'
  | 'hospice'
  | 'hospital_transfer'
  | 'left_ama'
  | 'expired';

export type DischargePlanStatus = 'draft' | 'pending_items' | 'ready' | 'discharged' | 'cancelled';

export type ReadmissionRiskCategory = 'low' | 'moderate' | 'high' | 'very_high';

export type PostDischargeFollowUpType =
  | '24hr_call'
  | '48hr_call'
  | '72hr_call'
  | '7day_call'
  | 'pcp_visit_reminder';

export type FollowUpStatus =
  | 'pending'
  | 'attempted'
  | 'completed'
  | 'patient_declined'
  | 'unable_to_reach'
  | 'cancelled';

export type FacilityType =
  | 'skilled_nursing'
  | 'inpatient_rehab'
  | 'long_term_acute_care'
  | 'home_health_agency'
  | 'hospice';

export type MobilityLevel = 'ambulatory' | 'walker' | 'wheelchair' | 'bedbound';

export type CognitiveStatus = 'intact' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';

export type InsuranceType = 'medicare' | 'medicaid' | 'commercial' | 'self_pay';

export interface DischargePlan {
  id: string;
  patient_id: string;
  encounter_id: string;
  discharge_disposition: DischargeDisposition;
  planned_discharge_date: string;
  planned_discharge_time?: string;
  actual_discharge_datetime?: string;

  // Joint Commission Checklist
  medication_reconciliation_complete: boolean;
  discharge_prescriptions_sent: boolean;
  discharge_prescriptions_pharmacy?: string;

  follow_up_appointment_scheduled: boolean;
  follow_up_appointment_date?: string;
  follow_up_appointment_provider?: string;
  follow_up_appointment_location?: string;

  discharge_summary_completed: boolean;
  discharge_summary_sent_to_pcp: boolean;
  discharge_summary_sent_at?: string;

  patient_education_completed: boolean;
  patient_education_topics?: string[];
  patient_understands_diagnosis: boolean;
  patient_understands_medications: boolean;
  patient_understands_followup: boolean;

  dme_needed: boolean;
  dme_ordered: boolean;
  dme_items?: string[];

  home_health_needed: boolean;
  home_health_ordered: boolean;
  home_health_agency?: string;
  home_health_start_date?: string;

  caregiver_identified: boolean;
  caregiver_name?: string;
  caregiver_phone?: string;
  caregiver_training_completed: boolean;

  transportation_arranged: boolean;
  transportation_method?: string;

  // Risk Assessment
  readmission_risk_score: number;
  readmission_risk_category: ReadmissionRiskCategory;
  requires_48hr_call: boolean;
  requires_72hr_call: boolean;
  requires_7day_pcp_visit: boolean;
  risk_factors?: string[];

  // Post-Acute Placement
  post_acute_facility_id?: string;
  post_acute_facility_name?: string;
  post_acute_facility_phone?: string;
  post_acute_facility_address?: string;
  post_acute_bed_confirmed: boolean;
  post_acute_bed_confirmed_at?: string;
  post_acute_handoff_packet_id?: string;

  // Billing
  discharge_planning_time_minutes: number;
  care_coordination_time_minutes: number;
  billing_codes_generated: boolean;
  billing_codes?: BillingCode[];

  // Status
  status: DischargePlanStatus;
  checklist_completion_percentage: number;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
  discharge_planner_id?: string;
  discharge_planner_notes?: string;
  clinical_notes?: string;
  barriers_to_discharge?: string[];
}

export interface BillingCode {
  code: string;
  description: string;
}

export interface PostDischargeFollowUp {
  id: string;
  discharge_plan_id: string;
  patient_id: string;
  follow_up_type: PostDischargeFollowUpType;
  scheduled_datetime: string;
  completed_datetime?: string;
  status: FollowUpStatus;
  attempted_by?: string;
  attempt_count: number;
  last_attempt_datetime?: string;

  // Assessment Results
  patient_doing_well?: boolean;
  patient_has_concerns?: boolean;
  concerns_description?: string;

  medication_adherence_confirmed?: boolean;
  medication_issues?: string;

  follow_up_appointment_confirmed?: boolean;
  follow_up_appointment_attended?: boolean;

  warning_signs_present?: boolean;
  warning_signs_description?: string;

  // Actions
  actions_taken?: string[];
  needs_escalation: boolean;
  escalated_to?: string;
  escalated_at?: string;

  outcome?: string;
  call_notes?: string;

  created_at: string;
  updated_at: string;
}

export interface PostAcuteFacility {
  id: string;
  facility_type: FacilityType;
  facility_name: string;
  facility_address?: string;
  facility_city?: string;
  facility_state?: string;
  facility_zip?: string;
  facility_phone: string;
  facility_fax?: string;
  facility_email?: string;

  // Bed Availability
  total_beds?: number;
  available_beds?: number;
  last_bed_count_update?: string;

  // Quality Metrics
  cms_star_rating?: number;
  accepts_medicare: boolean;
  accepts_medicaid: boolean;

  // Specialties
  specialties?: string[];

  // Contract Status
  is_preferred_provider: boolean;
  contract_status?: 'active' | 'inactive' | 'pending';

  // Contact
  primary_contact_name?: string;
  primary_contact_phone?: string;
  primary_contact_email?: string;

  // Metadata
  active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientPostAcuteNeeds {
  patient_id: string;
  age: number;
  primary_diagnosis: string;
  secondary_diagnoses?: string[];

  // Functional Status
  adl_score: number;
  mobility_level: MobilityLevel;
  cognitive_status: CognitiveStatus;

  // Clinical Needs
  requires_iv_therapy: boolean;
  requires_wound_care: boolean;
  requires_physical_therapy: boolean;
  requires_occupational_therapy: boolean;
  requires_speech_therapy: boolean;
  requires_skilled_nursing: boolean;
  requires_24hr_monitoring: boolean;

  // Social Factors
  has_caregiver_at_home: boolean;
  home_environment_safe: boolean;
  insurance_type: InsuranceType;

  // Geographic
  preferred_zip_code?: string;
  max_distance_miles?: number;
}

export interface PostAcuteRecommendation {
  recommended_setting: DischargeDisposition;
  confidence_score: number;
  rationale: string;
  care_needs_summary: string;
  estimated_length_of_stay_days?: number;

  matched_facilities: FacilityMatch[];

  alternative_settings?: AlternativeSetting[];
}

export interface FacilityMatch {
  facility: PostAcuteFacility;
  match_score: number;
  match_reasons: string[];
  concerns?: string[];
}

export interface AlternativeSetting {
  setting: string;
  rationale: string;
}

export interface CreateDischargePlanRequest {
  patient_id: string;
  encounter_id: string;
  discharge_disposition: DischargeDisposition;
  planned_discharge_date: string;
  planned_discharge_time?: string;
  discharge_planner_notes?: string;
}

export interface UpdateDischargePlanRequest {
  // Checklist items
  medication_reconciliation_complete?: boolean;
  discharge_prescriptions_sent?: boolean;
  discharge_prescriptions_pharmacy?: string;

  follow_up_appointment_scheduled?: boolean;
  follow_up_appointment_date?: string;
  follow_up_appointment_provider?: string;
  follow_up_appointment_location?: string;

  discharge_summary_completed?: boolean;
  discharge_summary_sent_to_pcp?: boolean;

  patient_education_completed?: boolean;
  patient_education_topics?: string[];
  patient_understands_diagnosis?: boolean;
  patient_understands_medications?: boolean;
  patient_understands_followup?: boolean;

  dme_needed?: boolean;
  dme_ordered?: boolean;
  dme_items?: string[];

  home_health_needed?: boolean;
  home_health_ordered?: boolean;
  home_health_agency?: string;
  home_health_start_date?: string;

  caregiver_identified?: boolean;
  caregiver_name?: string;
  caregiver_phone?: string;
  caregiver_training_completed?: boolean;

  transportation_arranged?: boolean;
  transportation_method?: string;

  // Post-acute facility
  post_acute_facility_id?: string;
  post_acute_facility_name?: string;
  post_acute_facility_phone?: string;
  post_acute_bed_confirmed?: boolean;

  // Time tracking
  discharge_planning_time_minutes?: number;
  care_coordination_time_minutes?: number;

  // Status
  status?: DischargePlanStatus;

  // Notes
  discharge_planner_notes?: string;
  clinical_notes?: string;
  barriers_to_discharge?: string[];
}

export interface CompleteFollowUpRequest {
  patient_doing_well?: boolean;
  patient_has_concerns?: boolean;
  concerns_description?: string;

  medication_adherence_confirmed?: boolean;
  medication_issues?: string;

  follow_up_appointment_confirmed?: boolean;
  follow_up_appointment_attended?: boolean;

  warning_signs_present?: boolean;
  warning_signs_description?: string;

  actions_taken?: string[];
  needs_escalation?: boolean;

  outcome?: string;
  call_notes?: string;
}

export interface PostAcuteTransferRequest {
  discharge_plan_id: string;
  patient_id: string;
  encounter_id: string;
  receiving_facility_name: string;
  receiving_facility_phone: string;
  receiving_facility_contact_name?: string;
  receiving_facility_contact_email?: string;
  post_acute_facility_type: FacilityType;
  urgency_level: 'routine' | 'urgent' | 'emergent';
  expected_transfer_date: string;
  clinical_summary: string;
}

export interface DischargePlanningMetrics {
  total_plans: number;
  plans_by_status: Record<DischargePlanStatus, number>;
  plans_by_disposition: Record<DischargeDisposition, number>;
  average_checklist_completion: number;
  high_risk_patients: number;
  pending_follow_ups: number;
  readmission_rate_30_day: number;
  average_length_of_stay: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  category: 'medication' | 'follow_up' | 'documentation' | 'education' | 'equipment' | 'support' | 'transport';
}

// Helper type for checklist validation
export type RequiredChecklistItems = {
  [K in keyof DischargePlan]: DischargePlan[K] extends boolean ? K : never;
}[keyof DischargePlan];
