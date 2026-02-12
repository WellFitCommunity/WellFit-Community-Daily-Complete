/**
 * FHIR R4 Clinical Resource Types
 *
 * Condition, DiagnosticReport, Procedure, Observation, AllergyIntolerance.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

import type { FHIRResource, CodeableConcept, Reference, Period, Quantity } from './base';

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
  value_sampled_data?: Record<string, unknown>;
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
