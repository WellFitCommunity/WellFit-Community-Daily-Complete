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
