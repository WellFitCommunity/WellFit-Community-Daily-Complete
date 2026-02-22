/**
 * FHIR R4 Server — Type Definitions
 *
 * All interfaces for database record types, token validation,
 * and shared constants used across the FHIR R4 edge function modules.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const FHIR_VERSION = "4.0.1";
export const FHIR_MIME_TYPE = "application/fhir+json";

// =============================================================================
// DATABASE RECORD INTERFACES
// =============================================================================

export interface AllergyRecord {
  id: string;
  clinical_status?: string;
  verification_status?: string;
  allergen_type?: string;
  allergen_name: string;
  criticality?: string;
  created_at: string;
  reaction_description?: string;
  severity?: string;
}

export interface ConditionRecord {
  id: string;
  clinical_status?: string;
  verification_status?: string;
  code?: string;
  code_system?: string;
  code_display?: string;
  onset_datetime?: string;
  recorded_date?: string;
}

export interface MedicationRecord {
  id: string;
  medication_name: string;
  status?: string;
  created_at: string;
  instructions?: string;
  dosage?: string;
  frequency?: string;
}

export interface ObservationRecord {
  id: string;
  status?: string;
  category?: string;
  code?: string;
  code_display?: string;
  effective_datetime?: string;
  value_quantity?: number;
  value_unit?: string;
  value_string?: string;
}

export interface ImmunizationRecord {
  id: string;
  status?: string;
  vaccine_code?: string;
  vaccine_display?: string;
  occurrence_datetime?: string;
  lot_number?: string;
}

export interface ProcedureRecord {
  id: string;
  status?: string;
  code?: string;
  code_system?: string;
  code_display?: string;
  performed_datetime?: string;
}

export interface DiagnosticReportRecord {
  id: string;
  status?: string;
  category?: string;
  code?: string;
  code_display?: string;
  effective_datetime?: string;
  issued?: string;
  conclusion?: string;
}

export interface CarePlanRecord {
  id: string;
  status?: string;
  title?: string;
  description?: string;
  period_start?: string;
  period_end?: string;
}

export interface CareTeamRecord {
  id: string;
  status?: string;
  name?: string;
  participants?: unknown[];
}

export interface GoalRecord {
  id: string;
  lifecycle_status?: string;
  description?: string;
  start_date?: string;
  target_date?: string;
}

export interface DocumentRecord {
  id: string;
  created_at: string;
  content?: string;
}

// =============================================================================
// TOKEN VALIDATION
// =============================================================================

export interface TokenValidation {
  valid: boolean;
  patientId?: string;
  scopes?: string[];
  appId?: string;
}

// =============================================================================
// PROFILE (for Patient handler)
// =============================================================================

export interface ProfileRecord {
  user_id: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
}
