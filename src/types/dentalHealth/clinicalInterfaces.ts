/**
 * Dental Health Core Clinical Interfaces
 * FHIR-compliant types for dental assessments, tooth charts,
 * procedures, treatment plans, observations, imaging, referrals,
 * patient self-tracking, and CDT billing codes.
 */

import type {
  DentalProviderRole,
  DentalVisitType,
  DentalAssessmentStatus,
  ToothCondition,
  PeriodontalStatus,
  TreatmentPriority,
  DentalImageType,
  ReferralStatus,
  TreatmentPlanStatus,
} from './baseTypes';

// =====================================================
// CORE INTERFACES
// =====================================================

/**
 * Dental Assessment - Main clinical documentation
 */
export interface DentalAssessment {
  id: string;
  patient_id: string;
  provider_id: string | null;
  provider_role: DentalProviderRole | null;
  visit_type: DentalVisitType;
  visit_date: string; // ISO timestamp
  status: DentalAssessmentStatus;

  // Chief Complaint
  chief_complaint?: string;
  pain_level?: number; // 0-10
  pain_location?: string;

  // Clinical Findings
  overall_oral_health_rating?: number; // 1-5
  periodontal_status?: PeriodontalStatus;
  plaque_index?: number; // 0-3
  bleeding_index?: number; // 0-3
  gingival_index?: number; // 0-3

  // Risk Factors
  dry_mouth?: boolean;
  smoking_tobacco?: boolean;
  diabetes_present?: boolean;
  heart_disease_present?: boolean;
  immunocompromised?: boolean;
  medications_affecting_oral_health?: string[];

  // Hygiene Assessment
  brushing_frequency_per_day?: number;
  flossing_frequency_per_week?: number;
  last_dental_cleaning_date?: string;
  last_dental_exam_date?: string;

  // Clinical Notes
  clinical_notes?: string;
  treatment_recommendations?: string;
  referral_needed?: boolean;
  referral_specialty?: DentalProviderRole;
  referral_reason?: string;

  // Follow-up
  next_appointment_recommended_in_months?: number;
  patient_education_provided?: string[];

  // FHIR Mapping
  fhir_encounter_id?: string;
  fhir_diagnostic_report_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

/**
 * Surface Conditions - Tooth surface status
 */
export interface SurfaceConditions {
  M?: ToothCondition; // Mesial
  O?: ToothCondition; // Occlusal
  D?: ToothCondition; // Distal
  B?: ToothCondition; // Buccal
  L?: ToothCondition; // Lingual
}

/**
 * Tooth Chart Entry - Individual tooth tracking
 */
export interface ToothChartEntry {
  id: string;
  assessment_id: string;
  patient_id: string;

  // Tooth Identification
  tooth_number: number; // 1-32 for permanent, 51-82 for primary (ISO 3950)
  tooth_name?: string;
  is_primary_tooth?: boolean;

  // Tooth Status
  condition: ToothCondition;
  mobility_score?: number; // 0-3

  // Periodontal Measurements (6 points per tooth)
  probing_depth_mb?: number; // Mesial-Buccal
  probing_depth_b?: number;  // Buccal
  probing_depth_db?: number; // Distal-Buccal
  probing_depth_ml?: number; // Mesial-Lingual
  probing_depth_l?: number;  // Lingual
  probing_depth_dl?: number; // Distal-Lingual

  // Recession measurements
  recession_mb?: number;
  recession_b?: number;
  recession_db?: number;
  recession_ml?: number;
  recession_l?: number;
  recession_dl?: number;

  // Bleeding on Probing
  bleeding_on_probing?: boolean;

  // Surface Conditions (MODBL surfaces)
  surface_conditions?: SurfaceConditions;

  // Clinical Notes
  notes?: string;

  // Metadata
  recorded_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * Dental Procedure - Treatment history
 */
export interface DentalProcedure {
  id: string;
  patient_id: string;
  assessment_id?: string;
  provider_id?: string;

  // Procedure Details
  procedure_date: string;
  procedure_name: string;
  cdt_code?: string; // Current Dental Terminology
  snomed_code?: string; // SNOMED CT for FHIR
  icd10_code?: string;

  // Tooth/Area Affected
  tooth_numbers?: number[];
  quadrant?: string; // UR, UL, LR, LL, or "full mouth"
  arch?: string; // upper, lower, both

  // Procedure Details
  procedure_description?: string;
  anesthesia_used?: boolean;
  anesthesia_type?: string;
  materials_used?: string[];

  // Treatment Plan Association
  treatment_plan_id?: string;
  priority?: TreatmentPriority;

  // Clinical Outcome
  procedure_status: string;
  complications?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;

  // Billing & Insurance
  estimated_cost?: number;
  insurance_coverage_percentage?: number;
  patient_responsibility?: number;
  billing_notes?: string;

  // FHIR Mapping
  fhir_procedure_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

/**
 * Phase Procedure - Individual procedure within a phase
 */
export interface PhaseProcedure {
  procedure_name: string;
  cdt_code?: string;
  tooth_numbers?: number[];
  estimated_cost?: number;
  priority?: TreatmentPriority;
  notes?: string;
}

/**
 * Treatment Phase - Part of a multi-phase treatment plan
 */
export interface TreatmentPhase {
  phase_number: number;
  phase_name: string;
  description: string;
  procedures: PhaseProcedure[];
  estimated_duration_weeks?: number;
  estimated_cost?: number;
  start_date?: string;
  completion_date?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

/**
 * Dental Treatment Plan
 */
export interface DentalTreatmentPlan {
  id: string;
  patient_id: string;
  assessment_id?: string;
  provider_id?: string;

  // Plan Details
  plan_name: string;
  plan_date: string;
  status: TreatmentPlanStatus;

  // Treatment Goals
  treatment_goals?: string[];
  expected_duration_months?: number;

  // Phased Treatment Plan
  phases?: TreatmentPhase[];

  // Financial Summary
  total_estimated_cost?: number;
  insurance_coverage?: number;
  patient_out_of_pocket?: number;
  payment_plan_offered?: boolean;
  payment_plan_details?: string;

  // Consent & Approval
  patient_consent_obtained?: boolean;
  patient_consent_date?: string;
  patient_signature_url?: string;

  // Clinical Notes
  alternative_treatments_discussed?: string;
  risks_discussed?: string;
  benefits_discussed?: string;
  prognosis?: string;

  // FHIR Mapping
  fhir_care_plan_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

/**
 * Dental Observation - FHIR-compliant measurements
 */
export interface DentalObservation {
  id: string;
  patient_id: string;
  assessment_id: string;

  // Observation Type
  observation_code: string; // LOINC or custom code
  observation_name: string;
  observation_category?: string; // periodontal, caries-risk, oral-hygiene

  // Value (one of these will be populated)
  value_quantity?: number;
  value_unit?: string;
  value_text?: string;
  value_boolean?: boolean;
  value_codeable_concept?: Record<string, unknown>;

  // Reference Ranges
  reference_range_low?: number;
  reference_range_high?: number;
  interpretation?: string; // normal, high, low, critical

  // Context
  observation_date: string;
  observed_by?: string;

  // FHIR Mapping
  fhir_observation_id?: string;
  fhir_resource?: Record<string, unknown>;

  // Metadata
  created_at: string;
  notes?: string;
}

/**
 * Dental Imaging - X-rays, photos, diagnostics
 */
export interface DentalImaging {
  id: string;
  patient_id: string;
  assessment_id?: string;
  procedure_id?: string;

  // Image Details
  image_type: DentalImageType;
  image_date: string;
  tooth_numbers?: number[];

  // Storage
  storage_url: string;
  thumbnail_url?: string;
  file_size_bytes?: number;
  mime_type?: string;

  // Clinical Information
  indication?: string;
  findings?: string;
  interpretation?: string;
  interpreted_by?: string;
  interpretation_date?: string;

  // DICOM Metadata
  dicom_metadata?: Record<string, unknown>;

  // FHIR Mapping
  fhir_imaging_study_id?: string;
  fhir_diagnostic_report_id?: string;

  // Metadata
  created_at: string;
  created_by?: string;
  notes?: string;
}

/**
 * Dental Referral
 */
export interface DentalReferral {
  id: string;
  patient_id: string;
  assessment_id?: string;
  referring_provider_id?: string;

  // Referral Details
  referral_date: string;
  specialty_needed: DentalProviderRole;
  urgency: TreatmentPriority;
  reason: string;
  clinical_summary?: string;

  // Specialist Information
  specialist_name?: string;
  specialist_organization?: string;
  specialist_phone?: string;
  specialist_fax?: string;
  specialist_email?: string;

  // Status Tracking
  status: ReferralStatus;
  appointment_scheduled_date?: string;
  appointment_completed_date?: string;

  // Follow-up
  specialist_report_received?: boolean;
  specialist_report?: string;
  specialist_recommendations?: string;

  // FHIR Mapping
  fhir_service_request_id?: string;
  fhir_task_id?: string;

  // Metadata
  created_at: string;
  updated_at: string;
  notes?: string;
}

/**
 * Patient-Reported Dental Health (for WellFit Community self-tracking)
 */
export interface PatientDentalHealthTracking {
  id: string;
  patient_id: string;

  // Self-Reported Data
  report_date: string;

  // Symptoms
  tooth_pain?: boolean;
  tooth_pain_severity?: number; // 0-10
  gum_bleeding?: boolean;
  dry_mouth?: boolean;
  bad_breath?: boolean;
  sensitive_teeth?: boolean;
  jaw_pain?: boolean;

  // Hygiene Habits
  brushed_today?: boolean;
  flossed_today?: boolean;
  used_mouthwash?: boolean;

  // Dietary Impact
  difficulty_chewing?: boolean;
  avoided_foods_due_to_teeth?: boolean;
  foods_avoided?: string[];

  // Quality of Life Impact
  self_consciousness_about_smile?: boolean;
  dental_health_affects_nutrition?: boolean;
  dental_health_affects_social_life?: boolean;

  // Last Professional Care
  last_dentist_visit_date?: string;
  months_since_last_cleaning?: number;

  // Notes
  additional_concerns?: string;

  // Metadata
  created_at: string;
}

/**
 * CDT Code Reference (for billing)
 */
export interface CDTCode {
  code: string;
  category: string;
  description: string;
  typical_fee_range_low?: number;
  typical_fee_range_high?: number;
  medicare_covered?: boolean;
  medicaid_covered?: boolean;
  preventive?: boolean;
  active?: boolean;
  effective_date?: string;
  termination_date?: string;
  notes?: string;
}
