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
