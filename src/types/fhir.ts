/**
 * FHIR R4 Resource Types
 * Enterprise-grade type definitions for FHIR resources
 */

// ============================================================================
// BASE FHIR TYPES
// ============================================================================

export interface FHIRResource {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
  sync_source?: string;
  external_id?: string;
}

export interface CodeableConcept {
  system?: string;
  code: string;
  display: string;
  text?: string;
}

export interface Reference {
  type?: string;
  id?: string;
  display?: string;
}

export interface Period {
  start?: string;
  end?: string;
}

export interface Quantity {
  value: number;
  unit: string;
  code?: string;
  system?: string;
}

// ============================================================================
// MEDICATION REQUEST
// ============================================================================

export interface MedicationRequest extends FHIRResource {
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  patient_id: string;

  // Medication
  medication_code_system?: string;
  medication_code: string;
  medication_display: string;
  medication_text?: string;

  // Dosage
  dosage_text?: string;
  dosage_timing_frequency?: number;
  dosage_timing_period?: number;
  dosage_timing_period_unit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  dosage_route_code?: string;
  dosage_route_display?: string;
  dosage_route?: string; // Backwards compatibility - simplified field
  dosage_dose_quantity?: number;
  dosage_dose_unit?: string;
  dosage_dose_code?: string;
  dosage_additional_instruction?: string[];
  dosage_patient_instruction?: string;
  dosage_as_needed_boolean?: boolean;
  dosage_as_needed_reason?: string;

  // Supply
  dispense_quantity?: number;
  dispense_unit?: string;
  dispense_quantity_unit?: string; // Backwards compatibility - simplified field
  dispense_number_of_repeats?: number; // Backwards compatibility - simplified field
  dispense_expected_supply_duration?: number;
  dispense_expected_supply_duration_unit?: string;
  number_of_repeats_allowed?: number;

  // Validity
  validity_period_start?: string;
  validity_period_end?: string;

  // Dates
  authored_on: string;

  // Requester
  requester_type?: string;
  requester_id?: string;
  requester_display?: string;
  requester_practitioner_id?: string; // FK to fhir_practitioners

  // Performer
  performer_type?: string;
  performer_id?: string;
  performer_display?: string;

  // Reason
  reason_code?: string[];
  reason_reference?: string[];

  // Priority
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';

  // Category
  category?: string[];

  // Notes
  note?: string;

  // Substitution
  substitution_allowed?: boolean;
  substitution_reason_code?: string;

  // References
  prior_prescription_id?: string;
  based_on_type?: string;
  based_on_id?: string;
  reported_boolean?: boolean;
  reported_reference_type?: string;
  reported_reference_id?: string;
  encounter_id?: string;
  insurance_id?: string;
}

export interface CreateMedicationRequest extends Partial<MedicationRequest> {
  patient_id: string;
  medication_code: string;
  medication_display: string;
  status: MedicationRequest['status'];
  intent: MedicationRequest['intent'];
}

// ============================================================================
// CONDITION
// ============================================================================

export interface Condition extends FHIRResource {
  clinical_status: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
  verification_status: 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' | 'refuted' | 'entered-in-error';

  // Category - FHIR R4 (array) for EHR interoperability
  category?: string[];
  category_coding_system?: string[];

  // Category - Simplified (backwards compatibility for legacy/community-only deployments)
  category_code?: string;
  category_display?: string;
  category_system?: string;

  // Severity
  severity_code?: string;
  severity_display?: string;
  severity_system?: string;

  // Code (required) - FHIR R4 name
  code_system: string;
  code: string;
  code_display: string;
  code_text?: string;

  // Code - Simplified alias (backwards compatibility)
  code_code?: string;

  // Body Site
  body_site_code?: string;
  body_site_display?: string;
  body_site_system?: string;

  // Patient
  patient_id: string;
  encounter_id?: string;

  // Onset
  onset_datetime?: string;
  onset_age_value?: number;
  onset_age_unit?: string;
  onset_period_start?: string;
  onset_period_end?: string;
  onset_range_low?: number;
  onset_range_high?: number;
  onset_string?: string;

  // Abatement
  abatement_datetime?: string;
  abatement_age_value?: number;
  abatement_age_unit?: string;
  abatement_period_start?: string;
  abatement_period_end?: string;
  abatement_range_low?: number;
  abatement_range_high?: number;
  abatement_string?: string;

  // Recorded
  recorded_date?: string;
  recorder_type?: string;
  recorder_id?: string;
  recorder_display?: string;

  // Asserter
  asserter_type?: string;
  asserter_id?: string;
  asserter_display?: string;

  // Stage
  stage_summary_code?: string;
  stage_summary_display?: string;
  stage_type_code?: string;
  stage_type_display?: string;

  // Evidence
  evidence_code?: string[];
  evidence_detail_ids?: string[];

  // Notes
  note?: string;

  // Metadata
  is_primary?: boolean;
  rank?: number;
}

export interface CreateCondition extends Partial<Condition> {
  patient_id: string;
  code_system: string;
  code: string;
  code_display: string;
  clinical_status: Condition['clinical_status'];
  verification_status: Condition['verification_status'];
}

// ============================================================================
// DIAGNOSTIC REPORT
// ============================================================================

export interface DiagnosticReport extends FHIRResource {
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';

  // Category - FHIR R4 (array)
  category: string[];
  category_coding_system?: string[];
  // Category - Backwards compatibility (simplified)
  category_code?: string;
  category_display?: string;
  category_system?: string;

  // Code - FHIR R4
  code_system: string;
  code: string;
  code_display: string;
  code_text?: string;
  // Code - Backwards compatibility (simplified)
  code_code?: string;

  // Patient
  patient_id: string;
  encounter_id?: string;

  // Timing
  effective_datetime?: string;
  effective_period_start?: string;
  effective_period_end?: string;
  issued: string;

  // Performers
  performer_type?: string[];
  performer_id?: string[];
  performer_display?: string[];

  // Results Interpreter
  results_interpreter_type?: string[];
  results_interpreter_id?: string[];
  results_interpreter_display?: string[];

  // Specimen
  specimen_id?: string;
  specimen_type?: string;
  specimen_display?: string;

  // Results
  result_observation_ids?: string[];

  // Imaging
  imaging_study_id?: string;

  // Media
  media_comment?: string[];
  media_link_url?: string[];

  // Conclusion
  conclusion?: string;
  conclusion_code?: string[];
  conclusion_code_display?: string[];

  // Presented Form
  presented_form_content_type?: string;
  presented_form_url?: string;
  presented_form_title?: string;
  presented_form_creation?: string;

  // Based On
  based_on_type?: string[];
  based_on_id?: string[];

  // Study
  study_uid?: string;
  series_uid?: string;

  // Specimen Details
  specimen_received_time?: string;
  specimen_collection_time?: string;

  // Metadata
  report_version?: string;
  report_priority?: 'routine' | 'urgent' | 'asap' | 'stat';
}

export interface CreateDiagnosticReport extends Partial<DiagnosticReport> {
  patient_id: string;
  code_system: string;
  code: string;
  code_display: string;
  status: DiagnosticReport['status'];
  category: string[];
}

// ============================================================================
// PROCEDURE
// ============================================================================

export interface Procedure extends FHIRResource {
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';

  // Status Reason
  status_reason_code?: string;
  status_reason_display?: string;

  // Category
  category_code?: string;
  category_display?: string;
  category_system?: string;

  // Code
  code_system: string;
  code: string;
  code_display: string;
  code_text?: string;

  // Patient
  patient_id: string;
  encounter_id?: string;

  // Performed
  performed_datetime?: string;
  performed_period_start?: string;
  performed_period_end?: string;
  performed_string?: string;
  performed_age_value?: number;
  performed_age_unit?: string;

  // Recorder
  recorder_type?: string;
  recorder_id?: string;
  recorder_display?: string;

  // Asserter
  asserter_type?: string;
  asserter_id?: string;
  asserter_display?: string;

  // Performers
  performer_function_code?: string[];
  performer_function_display?: string[];
  performer_actor_type?: string[];
  performer_actor_id?: string[];
  performer_actor_display?: string[];
  performer_on_behalf_of_id?: string[];
  primary_performer_practitioner_id?: string; // FK to fhir_practitioners (primary performer)

  // Location
  location_id?: string;
  location_display?: string;

  // Reason
  reason_code?: string[];
  reason_code_display?: string[];
  reason_reference_type?: string[];
  reason_reference_id?: string[];

  // Body Site
  body_site_code?: string;
  body_site_display?: string;
  body_site_system?: string;
  body_site_text?: string;

  // Outcome
  outcome_code?: string;
  outcome_display?: string;
  outcome_text?: string;

  // Report
  report_type?: string[];
  report_id?: string[];

  // Complications
  complication_code?: string[];
  complication_display?: string[];
  complication_detail_id?: string[];

  // Follow Up
  follow_up_code?: string[];
  follow_up_display?: string[];

  // Notes
  note?: string;

  // Used
  used_reference_type?: string[];
  used_reference_id?: string[];
  used_code?: string[];
  used_display?: string[];

  // Based On
  based_on_type?: string[];
  based_on_id?: string[];

  // Part Of
  part_of_type?: string;
  part_of_id?: string;

  // Billing
  billing_code?: string;
  billing_modifier?: string[];
  billing_charge_amount?: number;
  billing_units?: number;
}

export interface CreateProcedure extends Partial<Procedure> {
  patient_id: string;
  code_system: string;
  code: string;
  code_display: string;
  status: Procedure['status'];
}

// ============================================================================
// OBSERVATION
// ============================================================================

export interface ObservationComponent {
  code: string;
  display: string;
  value: number;
  unit: string;
}

export interface Observation extends FHIRResource {
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

  // Category - FHIR R4 (array)
  category: string[];
  category_coding_system?: string[];

  // Code (required) - LOINC preferred
  code_system: string;
  code: string;
  code_display: string;
  code_text?: string;

  // Patient
  patient_id: string;
  encounter_id?: string;

  // Timing
  effective_datetime?: string;
  effective_period_start?: string;
  effective_period_end?: string;
  issued?: string;

  // Performers
  performer_type?: string[];
  performer_id?: string[];
  performer_display?: string[];
  primary_performer_practitioner_id?: string; // FK to fhir_practitioners (primary performer)

  // Value[x] - Multiple value types supported
  value_quantity_value?: number;
  value_quantity_unit?: string;
  value_quantity_code?: string;
  value_quantity_system?: string;

  value_codeable_concept_code?: string;
  value_codeable_concept_display?: string;
  value_codeable_concept_system?: string;

  value_string?: string;
  value_boolean?: boolean;
  value_integer?: number;
  value_range_low?: number;
  value_range_high?: number;
  value_ratio_numerator?: number;
  value_ratio_denominator?: number;
  value_sampled_data?: any;
  value_time?: string;
  value_datetime?: string;
  value_period_start?: string;
  value_period_end?: string;

  // Data Absent Reason
  data_absent_reason_code?: string;
  data_absent_reason_display?: string;

  // Interpretation
  interpretation_code?: string[];
  interpretation_display?: string[];
  interpretation_system?: string[];

  // Notes
  note?: string;

  // Body Site
  body_site_code?: string;
  body_site_display?: string;
  body_site_system?: string;

  // Method
  method_code?: string;
  method_display?: string;
  method_system?: string;

  // Specimen
  specimen_id?: string;
  specimen_display?: string;

  // Device
  device_id?: string;
  device_display?: string;

  // Reference Range
  reference_range_low?: number;
  reference_range_high?: number;
  reference_range_type_code?: string;
  reference_range_type_display?: string;
  reference_range_applies_to_code?: string[];
  reference_range_age_low?: number;
  reference_range_age_high?: number;
  reference_range_text?: string;

  // Components (for complex observations like BP)
  components?: ObservationComponent[];

  // References
  has_member_ids?: string[];
  derived_from_ids?: string[];
  based_on_type?: string[];
  based_on_id?: string[];
  part_of_type?: string[];
  part_of_id?: string[];
  focus_type?: string;
  focus_id?: string;

  // Legacy
  check_in_id?: number;
}

export interface CreateObservation extends Partial<Observation> {
  patient_id: string;
  status: Observation['status'];
  category: string[];
  code: string;
  code_display: string;
  code_system?: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface FHIRApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface FHIRSearchParams {
  patient?: string;
  status?: string;
  code?: string;
  category?: string;
  date?: string;
  encounter?: string;
  _count?: number;
  _sort?: string;
}

// ============================================================================
// IMMUNIZATION
// ============================================================================

export interface FHIRImmunization extends FHIRResource {
  // External System Integration
  external_id?: string;
  external_system?: string;

  // FHIR Meta
  version_id?: string;
  last_updated?: string;

  // Required Fields (US Core)
  patient_id: string;
  status: 'completed' | 'entered-in-error' | 'not-done';
  vaccine_code: string; // CVX code
  vaccine_display: string;
  occurrence_datetime?: string;
  primary_source: boolean;

  // Status Reason (required if status != completed)
  status_reason_code?: string;
  status_reason_display?: string;

  // Vaccine Details
  lot_number?: string;
  expiration_date?: string;
  manufacturer?: string;

  // Administration Details
  site_code?: string; // Body site
  site_display?: string;
  route_code?: string; // Route of administration
  route_display?: string;
  dose_quantity_value?: number;
  dose_quantity_unit?: string;

  // Performer (who gave the vaccine)
  performer_actor_reference?: string;
  performer_actor_display?: string;
  performer_function_code?: string;
  performer_function_display?: string;
  performer_practitioner_id?: string; // FK to fhir_practitioners

  // Location
  location_reference?: string;
  location_display?: string;

  // Reason for Immunization
  reason_code?: string[];
  reason_display?: string[];

  // Reactions (adverse events)
  reaction_date?: string;
  reaction_detail_reference?: string;
  reaction_reported?: boolean;

  // Protocol Applied (vaccine dose number in series)
  protocol_dose_number_positive_int?: number;
  protocol_series_doses_positive_int?: number;
  protocol_target_disease?: string[];
  protocol_target_disease_display?: string[];

  // Funding Source
  funding_source_code?: string;
  funding_source_display?: string;

  // Education (patient education given)
  education_document_type?: string;
  education_reference?: string;
  education_publication_date?: string;
  education_presentation_date?: string;

  // Notes
  note?: string;

  // Audit Fields
  created_by?: string;
  updated_by?: string;
}

// Common CVX Vaccine Codes for Seniors
export const SENIOR_VACCINE_CODES = {
  FLU: '141', // Influenza, seasonal, injectable
  COVID: '213', // COVID-19
  SHINGLES: '121', // Zoster (Shingles) - Shingrix
  PCV13: '152', // Pneumococcal conjugate PCV13
  PPSV23: '33', // Pneumococcal polysaccharide PPSV23
  TDAP: '115', // Tdap
  TD: '113', // Td (tetanus, diphtheria)
  HEPATITIS_B: '43', // Hepatitis B
  HEPATITIS_A: '83', // Hepatitis A
  MMR: '03', // MMR
} as const;

// Vaccine Display Names
export const VACCINE_NAMES: Record<string, string> = {
  '141': 'Influenza (Flu Shot)',
  '213': 'COVID-19 Vaccine',
  '121': 'Shingles (Shingrix)',
  '152': 'Pneumococcal PCV13',
  '33': 'Pneumococcal PPSV23',
  '115': 'Tdap (Tetanus, Diphtheria, Pertussis)',
  '113': 'Td (Tetanus, Diphtheria)',
  '43': 'Hepatitis B',
  '83': 'Hepatitis A',
  '03': 'MMR (Measles, Mumps, Rubella)',
};

// Administration Routes
export const IMMUNIZATION_ROUTES = {
  IM: { code: 'IM', display: 'Intramuscular' },
  NASINHL: { code: 'NASINHL', display: 'Nasal inhalation' },
  PO: { code: 'PO', display: 'Oral' },
  SC: { code: 'SC', display: 'Subcutaneous' },
  TD: { code: 'TD', display: 'Transdermal' },
} as const;

// Administration Sites
export const IMMUNIZATION_SITES = {
  LA: { code: 'LA', display: 'Left arm' },
  RA: { code: 'RA', display: 'Right arm' },
  LT: { code: 'LT', display: 'Left thigh' },
  RT: { code: 'RT', display: 'Right thigh' },
  LD: { code: 'LD', display: 'Left deltoid' },
  RD: { code: 'RD', display: 'Right deltoid' },
} as const;

// ============================================================================
// CARE PLAN
// ============================================================================

export interface FHIRCarePlan extends FHIRResource {
  // External System Integration
  external_id?: string;
  external_system?: string;

  // FHIR Meta
  version_id?: string;
  last_updated?: string;

  // Required Fields (US Core)
  patient_id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'option';
  category: string[]; // e.g., ['assess-plan'], ['careteam']
  category_display?: string[];

  // Title and Description
  title?: string;
  description?: string;

  // Subject (usually same as patient)
  subject_reference?: string;
  subject_display?: string;

  // Period (when plan is in effect)
  period_start?: string;
  period_end?: string;

  // Created Date
  created?: string;
  author_reference?: string; // Practitioner/Organization who created plan
  author_display?: string;
  author_practitioner_id?: string; // FK to fhir_practitioners

  // Care Team
  care_team_reference?: string;
  care_team_display?: string;

  // Addresses (conditions this plan addresses)
  addresses_condition_references?: string[];
  addresses_condition_displays?: string[];

  // Supporting Info
  supporting_info_references?: string[];
  supporting_info_displays?: string[];

  // Goals
  goal_references?: string[];
  goal_displays?: string[];

  // Activities
  activities?: CarePlanActivity[];

  // Notes
  note?: string;

  // Audit Fields
  created_by?: string;
  updated_by?: string;
}

export interface CarePlanActivity {
  id?: string;
  status?: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error';

  // Activity Detail
  detail?: {
    kind?: 'Appointment' | 'CommunicationRequest' | 'DeviceRequest' | 'MedicationRequest' | 'NutritionOrder' | 'Task' | 'ServiceRequest' | 'VisionPrescription';
    code?: string;
    code_display?: string;
    status?: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error';
    description?: string;
    scheduled_timing?: string;
    scheduled_period_start?: string;
    scheduled_period_end?: string;
    location_display?: string;
    performer_display?: string[];
    product_display?: string;
    daily_amount_value?: number;
    daily_amount_unit?: string;
    quantity_value?: number;
    quantity_unit?: string;
    goal_references?: string[];
  };

  // Outcome
  outcome_reference?: string[];
  outcome_display?: string[];

  // Progress
  progress?: string[];

  // Reference to external activity
  reference?: string;
  reference_display?: string;
}

// Care Plan Categories (US Core)
export const CARE_PLAN_CATEGORIES = {
  ASSESS_PLAN: 'assess-plan',
  CARETEAM: 'careteam',
  ENCOUNTER_PLAN: 'encounter-plan',
  LONGITUDINAL_CARE_PLAN: 'longitudinal-care-plan',
} as const;

export const CARE_PLAN_CATEGORY_NAMES: Record<string, string> = {
  'assess-plan': 'Assessment and Plan of Treatment',
  'careteam': 'Care Team',
  'encounter-plan': 'Encounter Plan',
  'longitudinal-care-plan': 'Longitudinal Care Plan',
};

// Activity Detail Kinds
export const ACTIVITY_KINDS = {
  APPOINTMENT: 'Appointment',
  COMMUNICATION: 'CommunicationRequest',
  DEVICE: 'DeviceRequest',
  MEDICATION: 'MedicationRequest',
  NUTRITION: 'NutritionOrder',
  TASK: 'Task',
  SERVICE: 'ServiceRequest',
  VISION: 'VisionPrescription',
} as const;

// Common Activity Codes for Senior Care
export const SENIOR_CARE_ACTIVITIES = {
  MEDICATION_REVIEW: { code: '182836005', display: 'Review of medication' },
  VITAL_SIGNS_MONITORING: { code: '113011001', display: 'Vital signs monitoring' },
  NUTRITION_COUNSELING: { code: '61310001', display: 'Nutrition education' },
  EXERCISE_THERAPY: { code: '229065009', display: 'Exercise therapy' },
  FALL_PREVENTION: { code: '718227007', display: 'Fall prevention education' },
  CHRONIC_DISEASE_MGMT: { code: '408580007', display: 'Chronic disease management' },
  SMOKING_CESSATION: { code: '225323000', display: 'Smoking cessation education' },
  DIABETES_EDUCATION: { code: '281090004', display: 'Diabetes self-management education' },
  HYPERTENSION_MGMT: { code: '386800008', display: 'Hypertension management' },
  DEPRESSION_SCREENING: { code: '171207006', display: 'Depression screening' },
  COGNITIVE_ASSESSMENT: { code: '113024003', display: 'Cognitive assessment' },
  SOCIAL_SUPPORT: { code: '410155007', display: 'Social support' },
} as const;
// ============================================================================
// PRACTITIONER & PRACTITIONER ROLE
// ============================================================================

export interface FHIRPractitioner extends FHIRResource {
  // Link to auth.users
  user_id?: string;

  // External System Integration
  external_id?: string;
  external_system?: string;

  // FHIR Meta
  version_id?: string;
  last_updated?: string;

  // Required US Core Fields
  active: boolean;

  // Identifiers (NPI is REQUIRED for US Core)
  npi?: string; // National Provider Identifier (10 digits)
  state_license_number?: string;
  dea_number?: string; // Drug Enforcement Administration
  taxonomy_code?: string; // Healthcare Provider Taxonomy Code

  // Name (REQUIRED for US Core)
  family_name: string; // Last name
  given_names: string[]; // First, middle names
  prefix?: string[]; // Dr., Mr., Ms., Prof.
  suffix?: string[]; // MD, PhD, RN, BSN
  full_name?: string; // Generated full name

  // Demographics
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birth_date?: string;

  // Contact
  telecom?: FHIRContactPoint[]; // Phone, email, fax
  email?: string;
  phone?: string;

  // Addresses
  addresses?: FHIRAddress[];

  // Photo
  photo_url?: string;

  // Qualifications (degrees, licenses, certifications)
  qualifications?: FHIRPractitionerQualification[];

  // Specialties
  specialties?: string[]; // ['Family Medicine', 'Geriatrics']
  specialty_codes?: string[]; // SNOMED CT or NUCC codes

  // Languages
  communication_languages?: string[]; // ['en', 'es']

  // Biography
  bio?: string;

  // Availability
  availability_hours?: Record<string, { start: string; end: string }>;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface FHIRPractitionerQualification {
  identifier?: {
    value: string;
    system?: string;
  };
  code?: {
    text: string;
    coding?: {
      system: string;
      code: string;
      display: string;
    }[];
  };
  issuer?: string;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface FHIRPractitionerRole extends FHIRResource {
  practitioner_id: string; // Reference to Practitioner
  organization_id?: string; // Reference to Organization
  location_id?: string; // Reference to Location

  active: boolean;

  // Role/Position
  code: string[]; // ['doctor', 'researcher', 'educator']
  code_display?: string[];

  // Specialty in this role
  specialty?: string[];
  specialty_display?: string[];

  // Period
  period_start: string;
  period_end?: string;

  // Contact in this role
  telecom?: FHIRContactPoint[];

  // Availability
  available_time?: any; // FHIR AvailableTime structure
  not_available?: any; // FHIR NotAvailable structure

  // Endpoints
  endpoint_references?: string[];
}

export interface FHIRContactPoint {
  system: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: {
    start?: string;
    end?: string;
  };
}

// ============================================================================
// ALLERGY INTOLERANCE (US Core Required)
// ============================================================================

export interface FHIRAllergyIntolerance extends FHIRResource {
  patient_id: string;
  allergen_type: 'medication' | 'food' | 'environment' | 'biologic';
  allergen_name: string;
  allergen_code?: string;
  allergen_code_system?: string; // RxNorm for medications, SNOMED CT for others

  // Status fields
  clinical_status: 'active' | 'inactive' | 'resolved';
  verification_status: 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';

  // Severity and criticality
  criticality?: 'low' | 'high' | 'unable-to-assess';
  type?: 'allergy' | 'intolerance'; // True allergy vs. intolerance
  category?: ('food' | 'medication' | 'environment' | 'biologic')[]; // Can have multiple

  // Reaction details
  reaction?: Array<{
    substance?: CodeableConcept;
    manifestation: CodeableConcept[]; // e.g., "Hives", "Anaphylaxis", "Rash"
    description?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    exposureRoute?: CodeableConcept; // oral, topical, inhalation, injection
    onset?: string; // When reaction occurred
    note?: string;
  }>;

  // Timing
  onset_datetime?: string; // When allergy first identified
  onset_age?: number; // Age when allergy started
  onset_period?: Period;
  onset_range?: { low: Quantity; high: Quantity };
  onset_string?: string; // "childhood", "adulthood"

  last_occurrence_date?: string; // Most recent reaction

  // Recording details
  recorded_by?: string; // Reference to Practitioner
  recorded_date?: string;
  asserter?: string; // Who reported (patient, family, provider)

  // Additional context
  notes?: string;
  evidence?: {
    code?: CodeableConcept[];
    detail?: Reference[]; // References to Observation, DocumentReference
  }[];
}

export interface CreateAllergyIntolerance extends Partial<FHIRAllergyIntolerance> {
  patient_id: string;
  allergen_type: 'medication' | 'food' | 'environment' | 'biologic';
  allergen_name: string;
  clinical_status: 'active' | 'inactive' | 'resolved';
  verification_status: 'unconfirmed' | 'confirmed' | 'refuted' | 'entered-in-error';
}

// ============================================================================
// ENCOUNTER (US Core Required)
// ============================================================================

export interface FHIREncounter extends FHIRResource {
  patient_id: string;

  // Status and class (required)
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  status_history?: Array<{
    status: string;
    period: Period;
  }>;

  // Class (inpatient, outpatient, emergency, etc.)
  class_code: string; // 'IMP' (inpatient), 'AMB' (ambulatory), 'EMER' (emergency), etc.
  class_display: string;
  class_system?: string; // Default: http://terminology.hl7.org/CodeSystem/v3-ActCode

  class_history?: Array<{
    class_code: string;
    class_display: string;
    period: Period;
  }>;

  // Type of encounter (office visit, hospital admission, etc.)
  type?: CodeableConcept[]; // Multiple types allowed

  // Service type (e.g., cardiology, orthopedic surgery)
  service_type?: CodeableConcept;

  // Priority (routine, urgent, emergency)
  priority?: CodeableConcept;

  // Participants (providers involved)
  participant?: Array<{
    type?: CodeableConcept[]; // Role: primary performer, admitter, consultant, etc.
    period?: Period;
    individual_id?: string; // Reference to Practitioner
    individual_display?: string;
  }>;

  // Appointment reference
  appointment?: Reference[];

  // Period
  period_start?: string;
  period_end?: string;

  // Length of encounter in minutes
  length_minutes?: number;

  // Reason for encounter
  reason_code?: CodeableConcept[]; // ICD-10, SNOMED CT
  reason_reference?: Reference[]; // References to Condition, Procedure, Observation

  // Diagnosis
  diagnosis?: Array<{
    condition_id?: string; // Reference to Condition
    condition_display?: string;
    use_code?: string; // 'AD' (admission), 'DD' (discharge), 'CC' (chief complaint)
    use_display?: string;
    rank?: number; // 1 = primary diagnosis
  }>;

  // Account/billing
  account_id?: string;

  // Hospitalization details (for inpatient encounters)
  hospitalization?: {
    pre_admission_identifier?: string;
    origin?: Reference; // Where patient came from
    admit_source?: CodeableConcept; // ER, physician referral, transfer
    re_admission?: CodeableConcept; // If this is a re-admission
    diet_preference?: CodeableConcept[];
    special_courtesy?: CodeableConcept[]; // VIP, board member, etc.
    special_arrangement?: CodeableConcept[]; // Wheelchair, interpreter, etc.
    destination?: Reference; // Where patient went after
    discharge_disposition?: CodeableConcept; // Home, SNF, expired, etc.
  };

  // Location history
  location?: Array<{
    location_id?: string;
    location_display?: string;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physical_type?: CodeableConcept; // Room, bed, ward
    period_start?: string;
    period_end?: string;
  }>;

  // Service provider organization
  service_provider_id?: string;
  service_provider_display?: string;

  // Part of (for sub-encounters)
  part_of_encounter_id?: string;
}

export interface CreateFHIREncounter extends Partial<FHIREncounter> {
  patient_id: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class_code: string;
  class_display: string;
}

// ============================================================================
// DOCUMENT REFERENCE (US Core Required - for clinical notes)
// ============================================================================

export interface FHIRDocumentReference extends FHIRResource {
  patient_id: string;

  // Master identifier
  master_identifier?: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;

  // Status
  status: 'current' | 'superseded' | 'entered-in-error';
  doc_status?: 'preliminary' | 'final' | 'amended' | 'entered-in-error'; // Status of document

  // Type of document (required for US Core)
  type_code: string; // LOINC code
  type_display: string;
  type_system?: string; // Default: http://loinc.org

  // Category (e.g., clinical note, discharge summary, lab report)
  category?: CodeableConcept[];

  // Subject (patient)
  subject_id: string;
  subject_display?: string;

  // Date document was created
  date?: string; // When document was created

  // Author(s)
  author?: Array<{
    reference: string; // Practitioner, Patient, Organization
    display?: string;
  }>;

  // Authenticator (who verified)
  authenticator?: Reference;

  // Custodian (organization responsible)
  custodian?: Reference;

  // Related documents
  related_to?: Array<{
    reference: string;
    display?: string;
  }>;

  // Description
  description?: string;

  // Security label (confidentiality)
  security_label?: CodeableConcept[];

  // Content (the actual document)
  content: Array<{
    attachment: {
      content_type: string; // 'text/plain', 'application/pdf', 'text/html', etc.
      language?: string; // 'en-US'
      data?: string; // Base64 encoded data
      url?: string; // URL to retrieve document
      size?: number; // Size in bytes
      hash?: string; // SHA-1 hash
      title?: string; // Label for display
      creation?: string; // When attachment created
    };
    format?: CodeableConcept; // Format code (urn:ihe:pcc:* for C-CDA, etc.)
  }>;

  // Context (clinical context)
  context?: {
    encounter_id?: string; // Associated encounter
    event?: CodeableConcept[]; // Type of care event (e.g., colonoscopy, appendectomy)
    period?: Period; // Time of service
    facility_type?: CodeableConcept; // Hospital, clinic, etc.
    practice_setting?: CodeableConcept; // Cardiology, family practice, etc.
    source_patient_info?: Reference; // Patient info at time of document creation
    related?: Reference[]; // Related clinical resources
  };
}

export interface CreateDocumentReference extends Partial<FHIRDocumentReference> {
  patient_id: string;
  status: 'current' | 'superseded' | 'entered-in-error';
  type_code: string;
  type_display: string;
  content: Array<{
    attachment: {
      content_type: string;
      data?: string;
      url?: string;
    };
  }>;
}

// ============================================================================
// INNOVATIVE: SOCIAL DETERMINANTS OF HEALTH (SDOH) - US Core 6.0+
// WellFit differentiator: Built-in SDOH screening for health equity
// ============================================================================

export interface FHIRSDOHObservation extends FHIRResource {
  patient_id: string;
  status: 'final' | 'preliminary' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error';

  // SDOH Category (LOINC-based)
  category: 'food-insecurity' | 'housing-instability' | 'transportation' | 'financial-strain' | 'social-isolation' | 'education' | 'employment' | 'utility-needs' | 'safety' | 'health-literacy';

  // Standard LOINC codes for SDOH screening
  loinc_code: string; // e.g., 88122-7 (food insecurity), 71802-3 (housing instability)
  loinc_display: string;

  // Response (typically Yes/No or scale)
  value_code?: string; // 'LA33-6' (Yes), 'LA32-8' (No)
  value_display?: string;
  value_text?: string; // Free text response
  value_boolean?: boolean;
  value_integer?: number; // For scaled responses (1-5, etc.)

  // Risk level (auto-calculated or provider-assessed)
  risk_level?: 'low' | 'moderate' | 'high' | 'critical';

  // When assessed
  effective_datetime: string;

  // Who assessed
  performer_id?: string; // Reference to Practitioner
  performer_display?: string;

  // Related intervention or referral
  intervention_provided?: boolean;
  referral_made?: boolean;
  referral_to?: string; // Organization name (food bank, housing assistance, etc.)

  // Follow-up
  follow_up_needed?: boolean;
  follow_up_date?: string;

  notes?: string;
}

export interface CreateSDOHObservation extends Partial<FHIRSDOHObservation> {
  patient_id: string;
  status: 'final' | 'preliminary';
  category: 'food-insecurity' | 'housing-instability' | 'transportation' | 'financial-strain' | 'social-isolation' | 'education' | 'employment' | 'utility-needs' | 'safety' | 'health-literacy';
  loinc_code: string;
  loinc_display: string;
  effective_datetime: string;
}

// Standard SDOH screening questions (LOINC codes)
export const SDOH_SCREENING_CODES = {
  // Food Insecurity
  FOOD_INSECURITY: {
    code: '88122-7',
    display: 'Within the past 12 months we worried whether our food would run out before we got money to buy more',
    category: 'food-insecurity'
  },
  FOOD_RAN_OUT: {
    code: '88123-5',
    display: 'Within the past 12 months the food we bought just didn\'t last and we didn\'t have money to get more',
    category: 'food-insecurity'
  },

  // Housing Instability
  HOUSING_UNSTABLE: {
    code: '71802-3',
    display: 'Housing status',
    category: 'housing-instability'
  },
  HOUSING_QUALITY: {
    code: '93033-5',
    display: 'Are you worried about losing your housing?',
    category: 'housing-instability'
  },

  // Transportation
  TRANSPORT_BARRIER: {
    code: '93030-1',
    display: 'Has lack of transportation kept you from medical appointments, meetings, work, or from getting things needed for daily living?',
    category: 'transportation'
  },

  // Financial Strain
  FINANCIAL_STRAIN: {
    code: '93031-9',
    display: 'In the past year, have you or any family members you live with been unable to get any of the following when it was really needed?',
    category: 'financial-strain'
  },
  UTILITY_SHUTOFF: {
    code: '93032-7',
    display: 'Has the electric, gas, oil, or water company threatened to shut off services in your home?',
    category: 'utility-needs'
  },

  // Social Isolation
  SOCIAL_ISOLATION: {
    code: '93029-3',
    display: 'How often do you feel lonely or isolated from those around you?',
    category: 'social-isolation'
  },
  SOCIAL_SUPPORT: {
    code: '93038-4',
    display: 'How often do you see or talk to people that you care about and feel close to?',
    category: 'social-isolation'
  },

  // Safety
  INTIMATE_PARTNER_VIOLENCE: {
    code: '76501-6',
    display: 'Within the past year, have you been afraid of your partner or ex-partner?',
    category: 'safety'
  },

  // Education & Employment
  EDUCATION_LEVEL: {
    code: '82589-3',
    display: 'Highest level of education',
    category: 'education'
  },
  EMPLOYMENT_STATUS: {
    code: '67875-5',
    display: 'Employment status current',
    category: 'employment'
  },
} as const;

// ============================================================================
// INNOVATIVE: MEDICATION AFFORDABILITY & ALTERNATIVES
// WellFit differentiator: Real-time cost comparison + therapeutic alternatives
// ============================================================================

export interface MedicationAffordabilityCheck extends FHIRResource {
  patient_id: string;
  medication_name: string;
  rxnorm_code?: string;
  ndc_code?: string; // National Drug Code

  // Prescription details
  quantity: number;
  days_supply: number;
  dosage_form: string; // tablet, capsule, liquid, etc.
  strength: string; // e.g., "10 mg"

  // Cost data
  average_retail_price?: number; // Without insurance
  insurance_copay?: number; // With patient's insurance
  goodrx_price?: number; // GoodRx discount
  costplus_price?: number; // Mark Cuban Cost Plus Drugs
  medicare_price?: number; // Medicare Part D

  // Affordability assessment
  is_affordable: boolean; // Based on patient's income or response
  affordability_barrier?: 'high' | 'moderate' | 'low';
  patient_expressed_concern?: boolean;

  // Therapeutic alternatives (generic, biosimilar, or different class)
  alternatives?: Array<{
    medication_name: string;
    rxnorm_code?: string;
    type: 'generic' | 'biosimilar' | 'therapeutic-equivalent' | 'different-class';
    average_retail_price?: number;
    estimated_savings: number; // How much cheaper
    clinical_note?: string; // "Equally effective for hypertension"
  }>;

  // Manufacturer assistance programs
  patient_assistance_available?: boolean;
  manufacturer_coupon_url?: string;

  // Provider recommendation
  provider_recommendation?: 'continue-brand' | 'switch-generic' | 'switch-alternative' | 'apply-assistance';
  recommendation_reason?: string;

  checked_date: string;
  checked_by?: string; // Practitioner or system
}

// ============================================================================
// INNOVATIVE: CARE COORDINATION HUB
// WellFit differentiator: Real-time patient journey tracking across all touchpoints
// ============================================================================

export interface CareCoordinationEvent extends FHIRResource {
  patient_id: string;

  // Event details
  event_type: 'appointment' | 'admission' | 'discharge' | 'transfer' | 'referral' | 'medication-change' | 'lab-order' | 'imaging-order' | 'procedure' | 'telehealth' | 'home-visit' | 'care-plan-update' | 'ems-transport' | 'readmission';
  event_timestamp: string;
  event_status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';

  // Location/Setting
  care_setting: 'inpatient' | 'outpatient' | 'emergency' | 'home' | 'skilled-nursing' | 'telehealth' | 'ambulance';
  location_name?: string;

  // Participants
  primary_provider_id?: string;
  primary_provider_name?: string;
  care_team_members?: Array<{
    provider_id: string;
    provider_name: string;
    role: string; // 'physician', 'nurse', 'case-manager', etc.
  }>;

  // Clinical context
  encounter_id?: string;
  diagnosis_codes?: string[]; // ICD-10
  chief_complaint?: string;

  // Care coordination flags
  handoff_occurred?: boolean; // Was there a handoff between providers?
  handoff_quality?: 'complete' | 'incomplete' | 'missing-info';
  care_gap_identified?: boolean; // Did we find a gap in care?
  care_gap_description?: string;

  // Patient engagement
  patient_notified?: boolean;
  patient_attended?: boolean; // For appointments
  patient_satisfaction?: number; // 1-5 scale

  // Outcomes
  action_items?: string[]; // Follow-up tasks
  next_appointment_scheduled?: boolean;
  next_appointment_date?: string;

  // Integration tracking
  ehr_synced?: boolean;
  external_system_id?: string; // ID in Epic, Cerner, etc.

  notes?: string;
}

// ============================================================================
// INNOVATIVE: HEALTH EQUITY ANALYTICS
// WellFit differentiator: Built-in bias detection & disparities tracking
// ============================================================================

export interface HealthEquityMetrics extends FHIRResource {
  patient_id: string;

  // Demographic factors (de-identified for analytics)
  age_group: '0-17' | '18-44' | '45-64' | '65-74' | '75+';
  race_ethnicity?: string; // Self-reported, optional
  preferred_language?: string;
  insurance_type: 'medicare' | 'medicaid' | 'commercial' | 'uninsured' | 'va' | 'tricare';

  // SDOH composite score (from SDOH screening)
  sdoh_risk_score?: number; // 0-100 (higher = more barriers)
  sdoh_barriers_count?: number; // How many SDOH issues

  // Access metrics
  avg_days_to_appointment?: number; // Time to get appointment
  no_show_rate?: number; // Percentage of missed appointments
  telehealth_adoption?: boolean;
  transportation_barrier?: boolean;

  // Clinical outcomes (aggregated)
  chronic_conditions_controlled?: boolean; // BP, A1C, etc. at goal
  preventive_care_up_to_date?: boolean; // Vaccines, screenings
  medication_adherence_rate?: number; // 0-100%

  // Healthcare utilization
  er_visits_last_year?: number;
  hospital_admissions_last_year?: number;
  readmissions_30_day?: number;
  primary_care_visits_last_year?: number;

  // Disparities flags (compared to population average)
  has_access_disparity?: boolean; // Longer wait times than average
  has_outcome_disparity?: boolean; // Worse outcomes than average
  has_utilization_disparity?: boolean; // More ER, less primary care

  // Interventions provided
  equity_interventions?: Array<{
    intervention_type: 'transportation-assistance' | 'interpreter-services' | 'patient-navigator' | 'financial-assistance' | 'community-referral' | 'care-coordination' | 'telehealth-enabled';
    intervention_date: string;
    outcome?: string;
  }>;

  calculated_date: string;
}

// ============================================================================
// GOAL (US Core Required)
// ============================================================================

export interface FHIRGoal extends FHIRResource {
  patient_id: string;

  // Lifecycle status (required)
  lifecycle_status: 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error' | 'rejected';

  // Achievement status
  achievement_status?: CodeableConcept; // in-progress, improving, worsening, no-change, achieved, sustaining, not-achieved, no-progress, not-attainable

  // Category
  category?: CodeableConcept[]; // dietary, safety, behavioral, nursing, physiotherapy, etc.

  // Priority
  priority?: CodeableConcept; // high-priority, medium-priority, low-priority

  // Description (required for US Core)
  description_code?: string; // SNOMED CT or LOINC
  description_display: string; // "Lose 10 pounds", "Lower A1C to <7%"
  description_text?: string;

  // Subject (patient)
  subject_id: string;
  subject_display?: string;

  // Start date
  start_date?: string;
  start_codeable_concept?: CodeableConcept;

  // Target (measurable outcome)
  target?: Array<{
    measure?: CodeableConcept; // What to measure (A1C, weight, blood pressure)
    detail_quantity?: Quantity; // Target value (e.g., 140 mmHg)
    detail_range?: { low: Quantity; high: Quantity };
    detail_codeable_concept?: CodeableConcept;
    due_date?: string; // When to achieve by
    due_duration?: { value: number; unit: string };
  }>;

  // Status date
  status_date?: string;
  status_reason?: string;

  // Expressser (who stated the goal)
  expressed_by_id?: string; // Practitioner or Patient
  expressed_by_display?: string;

  // Addresses (conditions this goal addresses)
  addresses?: Array<{
    reference: string; // Condition, Observation, MedicationStatement
    display?: string;
  }>;

  // Notes
  note?: string;

  // Outcome
  outcome_code?: CodeableConcept[];
  outcome_reference?: Reference[]; // Observations measuring progress

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateGoal extends Partial<FHIRGoal> {
  patient_id: string;
  lifecycle_status: 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error' | 'rejected';
  description_display: string;
}

// ============================================================================
// LOCATION (US Core Required)
// ============================================================================

export interface FHIRLocation extends FHIRResource {
  // Status
  status: 'active' | 'suspended' | 'inactive';

  // Operational status
  operational_status?: CodeableConcept; // housekeeping, closed, contaminated, etc.

  // Name (required)
  name: string;
  alias?: string[]; // Alternate names

  // Description
  description?: string;

  // Mode
  mode?: 'instance' | 'kind'; // Specific location vs. class of locations

  // Type (required for US Core)
  type?: CodeableConcept[]; // Room, bed, ward, clinic, etc.

  // Telecom
  telecom?: FHIRContactPoint[];

  // Address
  address?: FHIRAddress;

  // Physical form
  physical_type?: CodeableConcept; // Building, room, vehicle, house, etc.

  // Position (GPS coordinates)
  position?: {
    longitude: number;
    latitude: number;
    altitude?: number;
  };

  // Managing organization
  managing_organization_id?: string;
  managing_organization_display?: string;

  // Part of (parent location)
  part_of_location_id?: string;
  part_of_location_display?: string;

  // Hours of operation
  hours_of_operation?: Array<{
    days_of_week?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
    all_day?: boolean;
    opening_time?: string; // HH:MM
    closing_time?: string; // HH:MM
  }>;

  // Availability exceptions
  availability_exceptions?: string; // "Closed on holidays"

  // Endpoint (technical endpoints for system access)
  endpoint_references?: string[];

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateLocation extends Partial<FHIRLocation> {
  status: 'active' | 'suspended' | 'inactive';
  name: string;
}

// ============================================================================
// ORGANIZATION (US Core Required)
// ============================================================================

export interface FHIROrganization extends FHIRResource {
  // Identifiers
  npi?: string; // National Provider Identifier (Type 2)
  tax_id?: string; // EIN
  ccn?: string; // CMS Certification Number (for hospitals)

  // Active status
  active: boolean;

  // Type (required for US Core)
  type?: CodeableConcept[]; // prov (healthcare provider), dept (department), etc.

  // Name (required)
  name: string;
  alias?: string[]; // Other names

  // Telecom
  telecom?: FHIRContactPoint[];

  // Address
  address?: FHIRAddress[];

  // Part of (parent organization)
  part_of_id?: string;
  part_of_display?: string;

  // Contact (administrative contacts)
  contact?: Array<{
    purpose?: CodeableConcept; // billing, admin, hr, etc.
    name?: {
      family?: string;
      given?: string[];
      prefix?: string[];
      suffix?: string[];
    };
    telecom?: FHIRContactPoint[];
    address?: FHIRAddress;
  }>;

  // Endpoint (technical endpoints)
  endpoint_references?: string[];

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateOrganization extends Partial<FHIROrganization> {
  active: boolean;
  name: string;
}

// ============================================================================
// MEDICATION (US Core Required)
// ============================================================================

export interface FHIRMedication extends FHIRResource {
  // Code (required - RxNorm preferred)
  code_system?: string; // http://www.nlm.nih.gov/research/umls/rxnorm
  code: string; // RxNorm code
  code_display: string; // Medication name
  code_text?: string;

  // Status
  status?: 'active' | 'inactive' | 'entered-in-error';

  // Manufacturer
  manufacturer_id?: string;
  manufacturer_display?: string;

  // Form (tablet, capsule, liquid, etc.)
  form?: CodeableConcept;

  // Amount (concentration)
  amount_numerator?: Quantity;
  amount_denominator?: Quantity;

  // Ingredient
  ingredient?: Array<{
    item_codeable_concept?: CodeableConcept;
    item_reference?: string; // Reference to another Medication or Substance
    is_active?: boolean;
    strength_numerator?: Quantity;
    strength_denominator?: Quantity;
  }>;

  // Batch info
  batch?: {
    lot_number?: string;
    expiration_date?: string;
  };

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateMedication extends Partial<FHIRMedication> {
  code: string;
  code_display: string;
}

// ============================================================================
// PROVENANCE (US Core Required for data integrity)
// ============================================================================

export interface FHIRProvenance extends FHIRResource {
  // Target (required - what this provenance is about)
  target_references: string[]; // References to resources (Patient, Observation, etc.)
  target_types?: string[]; // Resource types

  // Occurred (when the activity occurred)
  occurred_period_start?: string;
  occurred_period_end?: string;
  occurred_datetime?: string;

  // Recorded (when provenance was recorded) - REQUIRED
  recorded: string;

  // Policy (authorization policy)
  policy?: string[];

  // Location (where activity occurred)
  location_id?: string;
  location_display?: string;

  // Reason (why activity occurred)
  reason?: CodeableConcept[];

  // Activity (what was done) - REQUIRED
  activity?: CodeableConcept; // created, updated, deleted, etc.

  // Agent (who was involved) - REQUIRED
  agent: Array<{
    type?: CodeableConcept; // author, informant, custodian, assembler, etc.
    role?: CodeableConcept[]; // Functional role
    who_id: string; // Practitioner, Patient, Organization, Device
    who_display?: string;
    on_behalf_of_id?: string; // Organization
    on_behalf_of_display?: string;
  }>;

  // Entity (what was involved)
  entity?: Array<{
    role: 'derivation' | 'revision' | 'quotation' | 'source' | 'removal';
    what_id: string; // Reference to resource
    what_display?: string;
    agent?: Array<{
      type?: CodeableConcept;
      role?: CodeableConcept[];
      who_id: string;
      who_display?: string;
    }>;
  }>;

  // Signature (digital signature)
  signature?: Array<{
    type: CodeableConcept[]; // verification, validation, etc.
    when: string;
    who_id: string;
    who_display?: string;
    on_behalf_of_id?: string;
    target_format?: string; // mime type
    sig_format?: string; // mime type of signature
    data?: string; // base64 signature
  }>;

  // Audit
  created_by?: string;
}

export interface CreateProvenance extends Partial<FHIRProvenance> {
  target_references: string[];
  recorded: string;
  agent: Array<{
    who_id: string;
    type?: CodeableConcept;
  }>;
}

// ============================================================================
// ROLE CODE SYSTEM (1-18)
// ============================================================================

export const ROLE_CODES = {
  ADMIN: 1,
  SUPER_ADMIN: 2,
  STAFF: 3,
  SENIOR: 4,
  DOCTOR: 5,
  NURSE_PRACTITIONER: 6,
  REGISTERED_NURSE: 7,
  LICENSED_PRACTICAL_NURSE: 8,
  CARE_MANAGER: 9,
  SOCIAL_WORKER: 10,
  PHARMACIST: 11,
  LAB_TECH: 12,
  PHYSICAL_THERAPIST: 13,
  OCCUPATIONAL_THERAPIST: 14,
  DIETITIAN: 15,
  CASE_MANAGER: 16,
  PHYSICIAN_ASSISTANT: 17,
  CAREGIVER: 18,
} as const;

export const ROLE_NAMES: Record<number, string> = {
  1: 'admin',
  2: 'super_admin',
  3: 'staff',
  4: 'senior',
  5: 'doctor',
  6: 'nurse_practitioner',
  7: 'registered_nurse',
  8: 'licensed_practical_nurse',
  9: 'care_manager',
  10: 'social_worker',
  11: 'pharmacist',
  12: 'lab_tech',
  13: 'physical_therapist',
  14: 'occupational_therapist',
  15: 'dietitian',
  16: 'case_manager',
  17: 'physician_assistant',
  18: 'caregiver',
};

export const ROLE_DISPLAY_NAMES: Record<number, string> = {
  1: 'Administrator',
  2: 'Super Administrator',
  3: 'Staff',
  4: 'Senior/Patient',
  5: 'Doctor/Physician',
  6: 'Nurse Practitioner',
  7: 'Registered Nurse (RN)',
  8: 'Licensed Practical Nurse (LPN)',
  9: 'Care Manager',
  10: 'Social Worker',
  11: 'Pharmacist',
  12: 'Laboratory Technician',
  13: 'Physical Therapist (PT)',
  14: 'Occupational Therapist (OT)',
  15: 'Dietitian/Nutritionist',
  16: 'Case Manager',
  17: 'Physician Assistant (PA)',
  18: 'Caregiver',
};

// Healthcare provider roles (5-18, excluding patient/admin roles)
export const PRACTITIONER_ROLE_CODES = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

// Common medical specialties
export const MEDICAL_SPECIALTIES = {
  FAMILY_MEDICINE: 'Family Medicine',
  INTERNAL_MEDICINE: 'Internal Medicine',
  GERIATRICS: 'Geriatrics',
  CARDIOLOGY: 'Cardiology',
  ENDOCRINOLOGY: 'Endocrinology',
  NEUROLOGY: 'Neurology',
  PSYCHIATRY: 'Psychiatry',
  ORTHOPEDICS: 'Orthopedics',
  PHYSICAL_MEDICINE: 'Physical Medicine and Rehabilitation',
  PALLIATIVE_CARE: 'Palliative Care',
  HOSPICE_CARE: 'Hospice and Palliative Medicine',
} as const;

// Nursing specialties
export const NURSING_SPECIALTIES = {
  GERIATRIC_NURSING: 'Geriatric Nursing',
  ACUTE_CARE: 'Acute Care',
  CRITICAL_CARE: 'Critical Care',
  EMERGENCY: 'Emergency Nursing',
  WOUND_CARE: 'Wound Care',
  DIABETES_EDUCATION: 'Diabetes Education',
} as const;
