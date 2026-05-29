/**
 * C-CDA Export — shared types and template constants.
 *
 * Column names on these interfaces are verified against the live DB
 * (information_schema, 2026-05-29) — see queries.ts for the explicit
 * SELECT lists. Three interfaces were corrected this session to match the
 * real schema (the prior names were silently undefined under SELECT *):
 *   - Observation: value_quantity_value / value_quantity_unit  (was value_quantity / value_unit)
 *   - LabResult:   result_date                                  (was extracted_at — column does not exist)
 */

export interface Profile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  gender?: string;
}

export interface Medication {
  id: string;
  user_id: string;
  medication_name?: string;
  dosage?: string;
  strength?: string;
  frequency?: string;
  instructions?: string;
  status: string;
}

export interface Allergy {
  id: string;
  user_id: string;
  allergen_name?: string;
  allergen_type?: string;
  reaction_description?: string;
  severity?: string;
  clinical_status?: string;
}

export interface Condition {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  clinical_status?: string;
  onset_datetime?: string;
}

export interface Procedure {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  performed_datetime?: string;
  status?: string;
}

export interface Immunization {
  id: string;
  patient_id: string;
  vaccine_code?: string;
  vaccine_display?: string;
  occurrence_datetime?: string;
  status?: string;
  lot_number?: string;
}

export interface Observation {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  /** Live column is value_quantity_value (NOT value_quantity). */
  value_quantity_value?: number;
  value_string?: string;
  /** Live column is value_quantity_unit (NOT value_unit). */
  value_quantity_unit?: string;
  effective_datetime?: string;
}

export interface LabResult {
  id: string;
  patient_mrn: string;
  test_name?: string;
  value?: string | number;
  unit?: string;
  reference_range?: string;
  /** Live column is result_date (NOT extracted_at — that column does not exist). */
  result_date?: string;
}

export interface CarePlan {
  id: string;
  patient_id: string;
  title?: string;
  description?: string;
  status?: string;
  period_start?: string;
}

export interface CCDAData {
  profile: Profile | null;
  medications: Medication[];
  allergies: Allergy[];
  conditions: Condition[];
  procedures: Procedure[];
  immunizations: Immunization[];
  observations: Observation[];
  labResults: LabResult[];
  carePlans: CarePlan[];
  documentId: string;
  createdAt: string;
}

export const CCDA_VERSION = "2.1";

export const TEMPLATE_OID = {
  CCD: "2.16.840.1.113883.10.20.22.1.2",
  ALLERGIES: "2.16.840.1.113883.10.20.22.2.6.1",
  MEDICATIONS: "2.16.840.1.113883.10.20.22.2.1.1",
  PROBLEMS: "2.16.840.1.113883.10.20.22.2.5.1",
  PROCEDURES: "2.16.840.1.113883.10.20.22.2.7.1",
  IMMUNIZATIONS: "2.16.840.1.113883.10.20.22.2.2.1",
  VITAL_SIGNS: "2.16.840.1.113883.10.20.22.2.4.1",
  RESULTS: "2.16.840.1.113883.10.20.22.2.3.1",
  PLAN_OF_CARE: "2.16.840.1.113883.10.20.22.2.10",
} as const;
