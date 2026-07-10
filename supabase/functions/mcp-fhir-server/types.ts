// =====================================================
// MCP FHIR Server - Type Definitions
// Purpose: All interfaces and type definitions for the FHIR MCP server
// =====================================================

/**
 * A generic FHIR resource with required id and optional resourceType.
 * The index signature allows additional FHIR properties.
 */
export interface FHIRResource {
  resourceType?: string;
  id: string;
  [key: string]: unknown;
}

/**
 * Database row shape for the `profiles` table, used when mapping
 * to a FHIR Patient resource via toFHIRPatient().
 */
export interface ProfileRecord {
  id: string;
  mrn?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Database row shape for practitioner lookup (used in care team enrichment).
 */
export interface PractitionerRecord {
  id: string;
  name?: string;
  specialty?: string;
  phone?: string;
  email?: string;
}

/**
 * A single participant entry within a care team's `participants` JSONB column.
 */
export interface CareTeamParticipant {
  practitioner_id?: string;
  role?: string;
  display?: string;
}

/**
 * Structured patient clinical summary (CCD-style).
 */
export interface PatientSummary {
  patient_id: string;
  generated_at: string;
  sections: Record<string, unknown>;
}

/**
 * Union of all possible tool return types.
 */
export type ToolResult = FHIRResource | FHIRResource[] | PatientSummary | Record<string, unknown>;

/**
 * Options for the patient bundle export.
 */
export interface PatientBundleOptions {
  startDate?: string;
  endDate?: string;
  includeAI?: boolean;
}

/**
 * Filters for FHIR resource search.
 */
export interface ResourceSearchFilters {
  patientId?: string;
  status?: string;
  category?: string;
  code?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

/**
 * Parameters for the FHIR audit log entry.
 */
export interface FHIRAuditParams {
  userId?: string;
  tenantId?: string;
  operation: string;
  resourceType?: string;
  resourceId?: string;
  success: boolean;
  executionTimeMs: number;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// DB row shapes for the fhir_* tables — the columns each list handler reads.
// Names verified against the live FHIR R4 schema 2026-07-10. Used to type the
// rows returned by dynamic-column .select() calls (which de-type the result).
// ---------------------------------------------------------------------------

export interface FhirMedicationRow {
  id: string;
  medication_display: string | null;
  dosage_text: string | null;
  dosage_timing_frequency: number | null;
  dosage_route_display: string | null;
  status: string | null;
  requester_display: string | null;
  authored_on: string | null;
  validity_period_end: string | null;
}

export interface FhirConditionRow {
  id: string;
  code: string | null;
  code_display: string | null;
  code_system: string | null;
  clinical_status: string | null;
  verification_status: string | null;
  severity_display: string | null;
  onset_datetime: string | null;
  recorded_date: string | null;
}

export interface FhirObservationRow {
  id: string;
  code: string | null;
  code_display: string | null;
  value_codeable_concept_display: string | null;
  value_string: string | null;
  effective_datetime: string | null;
}

export interface FhirCareTeamRow {
  id: string;
  name: string | null;
  category: string | null;
  status: string | null;
}

export interface FhirCareTeamMemberRow {
  care_team_id: string;
  role_display: string | null;
  member_display: string | null;
  member_user_id: string | null;
  is_primary_contact: boolean | null;
}

/** Row shape for passive_sdoh_detections — the real "active SDOH flags" source
 *  (there is no sdoh_flags table). Verified against live schema 2026-07-10. */
export interface SdohDetectionRow {
  id: string;
  sdoh_category: string | null;
  risk_level: string | null;
  ai_summary: string | null;
  detected_at: string | null;
}
