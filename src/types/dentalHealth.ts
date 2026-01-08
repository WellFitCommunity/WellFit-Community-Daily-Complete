/**
 * =====================================================
 * DENTAL HEALTH MODULE - TYPE DEFINITIONS
 * =====================================================
 * Purpose: TypeScript types for comprehensive dental health tracking
 * Integration: Chronic disease management, FHIR mapping, CDT billing
 * =====================================================
 */

// =====================================================
// ENUMS
// =====================================================

export type DentalProviderRole =
  | 'dentist'
  | 'dental_hygienist'
  | 'orthodontist'
  | 'periodontist'
  | 'endodontist'
  | 'oral_surgeon'
  | 'prosthodontist'
  | 'pediatric_dentist';

export type DentalVisitType =
  | 'initial_exam'
  | 'routine_cleaning'
  | 'comprehensive_exam'
  | 'emergency'
  | 'follow_up'
  | 'consultation'
  | 'procedure'
  | 'screening';

export type DentalAssessmentStatus =
  | 'draft'
  | 'completed'
  | 'reviewed'
  | 'approved'
  | 'cancelled';

export type ToothCondition =
  | 'healthy'
  | 'cavity'
  | 'filling'
  | 'crown'
  | 'bridge'
  | 'implant'
  | 'root_canal'
  | 'extraction'
  | 'missing'
  | 'fractured'
  | 'abscessed'
  | 'impacted';

export type PeriodontalStatus =
  | 'healthy'
  | 'gingivitis'
  | 'mild_periodontitis'
  | 'moderate_periodontitis'
  | 'severe_periodontitis'
  | 'advanced_periodontitis';

export type TreatmentPriority =
  | 'emergency'
  | 'urgent'
  | 'routine'
  | 'elective'
  | 'preventive';

export type DentalImageType =
  | 'periapical'
  | 'bitewing'
  | 'panoramic'
  | 'cephalometric'
  | 'intraoral_photo'
  | 'cbct'
  | 'occlusal';

export type DentalProcedureStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type ReferralStatus =
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'declined';

export type TreatmentPlanStatus =
  | 'proposed'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

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

// =====================================================
// REQUEST/RESPONSE TYPES FOR API
// =====================================================

/**
 * Create Dental Assessment Request
 */
export interface CreateDentalAssessmentRequest {
  patient_id: string;
  visit_type: DentalVisitType;
  visit_date?: string;
  chief_complaint?: string;
  pain_level?: number;
  clinical_notes?: string;
  // ... other optional fields from DentalAssessment
}

/**
 * Update Dental Assessment Request
 */
export interface UpdateDentalAssessmentRequest {
  id: string;
  status?: DentalAssessmentStatus;
  clinical_notes?: string;
  treatment_recommendations?: string;
  periodontal_status?: PeriodontalStatus;
  // ... other updatable fields
}

/**
 * Create Tooth Chart Entry Request
 */
export interface CreateToothChartEntryRequest {
  assessment_id: string;
  patient_id: string;
  tooth_number: number;
  condition: ToothCondition;
  probing_depths?: {
    mb?: number;
    b?: number;
    db?: number;
    ml?: number;
    l?: number;
    dl?: number;
  };
  surface_conditions?: SurfaceConditions;
  notes?: string;
}

/**
 * Create Dental Procedure Request
 */
export interface CreateDentalProcedureRequest {
  patient_id: string;
  assessment_id?: string;
  procedure_name: string;
  cdt_code?: string;
  procedure_date?: string;
  tooth_numbers?: number[];
  procedure_description?: string;
  estimated_cost?: number;
  priority?: TreatmentPriority;
}

/**
 * Create Treatment Plan Request
 */
export interface CreateTreatmentPlanRequest {
  patient_id: string;
  assessment_id?: string;
  plan_name: string;
  treatment_goals?: string[];
  phases?: TreatmentPhase[];
  total_estimated_cost?: number;
}

/**
 * Create Patient Tracking Entry Request
 */
export interface CreatePatientTrackingRequest {
  tooth_pain?: boolean;
  tooth_pain_severity?: number;
  gum_bleeding?: boolean;
  dry_mouth?: boolean;
  brushed_today?: boolean;
  flossed_today?: boolean;
  used_mouthwash?: boolean;
  additional_concerns?: string;
}

/**
 * Dashboard Summary Response
 */
export interface DentalHealthDashboardSummary {
  patient_id: string;
  patient_name: string;

  // Latest Assessment
  latest_assessment?: DentalAssessment;
  last_visit_date?: string;
  next_recommended_visit?: string;

  // Health Status
  overall_oral_health_rating?: number;
  periodontal_status?: PeriodontalStatus;
  active_conditions_count: number;

  // Treatment
  active_treatment_plans_count: number;
  pending_procedures_count: number;
  completed_procedures_this_year: number;

  // Referrals & Follow-ups
  pending_referrals_count: number;
  overdue_followups_count: number;

  // Patient Self-Tracking
  recent_self_reports: PatientDentalHealthTracking[];
  current_symptoms: string[];

  // Alerts
  risk_alerts: DentalRiskAlert[];
}

/**
 * Dental Risk Alert
 */
export interface DentalRiskAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string; // e.g., "periodontal", "infection", "chronic-disease-link"
  message: string;
  recommended_action: string;
  related_condition?: string;
}

/**
 * Tooth Chart Summary (for visualization)
 */
export interface ToothChartSummary {
  patient_id: string;
  assessment_id: string;
  teeth: ToothChartEntry[];
  overall_periodontal_health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  total_healthy_teeth: number;
  total_cavities: number;
  total_missing: number;
  total_restored: number;
  average_probing_depth?: number;
  bleeding_points_count?: number;
}

/**
 * Procedure History Summary
 */
export interface ProcedureHistorySummary {
  patient_id: string;
  total_procedures: number;
  preventive_procedures: number;
  restorative_procedures: number;
  surgical_procedures: number;
  last_cleaning_date?: string;
  last_exam_date?: string;
  upcoming_scheduled_count: number;
  total_cost_ytd: number;
}

// =====================================================
// API RESPONSE WRAPPER
// =====================================================

export interface DentalApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =====================================================
// CONSTANTS & HELPERS
// =====================================================

/**
 * Universal Numbering System - Tooth names mapping
 */
export const TOOTH_NAMES: Record<number, string> = {
  // Upper Right (Quadrant 1)
  1: 'Upper Right 3rd Molar',
  2: 'Upper Right 2nd Molar',
  3: 'Upper Right 1st Molar',
  4: 'Upper Right 2nd Premolar',
  5: 'Upper Right 1st Premolar',
  6: 'Upper Right Canine',
  7: 'Upper Right Lateral Incisor',
  8: 'Upper Right Central Incisor',
  // Upper Left (Quadrant 2)
  9: 'Upper Left Central Incisor',
  10: 'Upper Left Lateral Incisor',
  11: 'Upper Left Canine',
  12: 'Upper Left 1st Premolar',
  13: 'Upper Left 2nd Premolar',
  14: 'Upper Left 1st Molar',
  15: 'Upper Left 2nd Molar',
  16: 'Upper Left 3rd Molar',
  // Lower Left (Quadrant 3)
  17: 'Lower Left 3rd Molar',
  18: 'Lower Left 2nd Molar',
  19: 'Lower Left 1st Molar',
  20: 'Lower Left 2nd Premolar',
  21: 'Lower Left 1st Premolar',
  22: 'Lower Left Canine',
  23: 'Lower Left Lateral Incisor',
  24: 'Lower Left Central Incisor',
  // Lower Right (Quadrant 4)
  25: 'Lower Right Central Incisor',
  26: 'Lower Right Lateral Incisor',
  27: 'Lower Right Canine',
  28: 'Lower Right 1st Premolar',
  29: 'Lower Right 2nd Premolar',
  30: 'Lower Right 1st Molar',
  31: 'Lower Right 2nd Molar',
  32: 'Lower Right 3rd Molar',
};

/**
 * Primary teeth mapping (ISO 3950 notation for deciduous teeth)
 */
export const PRIMARY_TOOTH_NAMES: Record<number, string> = {
  // Upper Right (Quadrant 5)
  51: 'Upper Right 2nd Primary Molar',
  52: 'Upper Right 1st Primary Molar',
  53: 'Upper Right Primary Canine',
  54: 'Upper Right Lateral Primary Incisor',
  55: 'Upper Right Central Primary Incisor',
  // Upper Left (Quadrant 6)
  61: 'Upper Left Central Primary Incisor',
  62: 'Upper Left Lateral Primary Incisor',
  63: 'Upper Left Primary Canine',
  64: 'Upper Left 1st Primary Molar',
  65: 'Upper Left 2nd Primary Molar',
  // Lower Left (Quadrant 7)
  71: 'Lower Left 2nd Primary Molar',
  72: 'Lower Left 1st Primary Molar',
  73: 'Lower Left Primary Canine',
  74: 'Lower Left Lateral Primary Incisor',
  75: 'Lower Left Central Primary Incisor',
  // Lower Right (Quadrant 8)
  81: 'Lower Right Central Primary Incisor',
  82: 'Lower Right Lateral Primary Incisor',
  83: 'Lower Right Primary Canine',
  84: 'Lower Right 1st Primary Molar',
  85: 'Lower Right 2nd Primary Molar',
};

/**
 * Get tooth name from number
 */
export function getToothName(toothNumber: number, isPrimary: boolean = false): string {
  return isPrimary
    ? PRIMARY_TOOTH_NAMES[toothNumber] || `Primary Tooth #${toothNumber}`
    : TOOTH_NAMES[toothNumber] || `Tooth #${toothNumber}`;
}

/**
 * Calculate quadrant from tooth number
 */
export function getQuadrant(toothNumber: number): string {
  if (toothNumber >= 1 && toothNumber <= 8) return 'UR'; // Upper Right
  if (toothNumber >= 9 && toothNumber <= 16) return 'UL'; // Upper Left
  if (toothNumber >= 17 && toothNumber <= 24) return 'LL'; // Lower Left
  if (toothNumber >= 25 && toothNumber <= 32) return 'LR'; // Lower Right
  if (toothNumber >= 51 && toothNumber <= 55) return 'UR'; // Upper Right Primary
  if (toothNumber >= 61 && toothNumber <= 65) return 'UL'; // Upper Left Primary
  if (toothNumber >= 71 && toothNumber <= 75) return 'LL'; // Lower Left Primary
  if (toothNumber >= 81 && toothNumber <= 85) return 'LR'; // Lower Right Primary
  return 'Unknown';
}

/**
 * Severity mapping for periodontal status
 */
export const PERIODONTAL_SEVERITY: Record<PeriodontalStatus, number> = {
  healthy: 0,
  gingivitis: 1,
  mild_periodontitis: 2,
  moderate_periodontitis: 3,
  severe_periodontitis: 4,
  advanced_periodontitis: 5,
};

/**
 * Display labels for enums
 */
export const DENTAL_LABELS = {
  visitType: {
    initial_exam: 'Initial Examination',
    routine_cleaning: 'Routine Cleaning',
    comprehensive_exam: 'Comprehensive Examination',
    emergency: 'Emergency Visit',
    follow_up: 'Follow-up Appointment',
    consultation: 'Consultation',
    procedure: 'Procedure',
    screening: 'Screening',
  },
  periodontalStatus: {
    healthy: 'Healthy Gums',
    gingivitis: 'Gingivitis',
    mild_periodontitis: 'Mild Periodontitis',
    moderate_periodontitis: 'Moderate Periodontitis',
    severe_periodontitis: 'Severe Periodontitis',
    advanced_periodontitis: 'Advanced Periodontitis',
  },
  toothCondition: {
    healthy: 'Healthy',
    cavity: 'Cavity/Caries',
    filling: 'Filling',
    crown: 'Crown',
    bridge: 'Bridge',
    implant: 'Implant',
    root_canal: 'Root Canal',
    extraction: 'Extracted',
    missing: 'Missing',
    fractured: 'Fractured',
    abscessed: 'Abscessed',
    impacted: 'Impacted',
  },
  priority: {
    emergency: 'Emergency',
    urgent: 'Urgent',
    routine: 'Routine',
    elective: 'Elective',
    preventive: 'Preventive',
  },
};
