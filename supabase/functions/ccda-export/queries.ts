/**
 * C-CDA Export — patient data fetch.
 *
 * Every query uses an EXPLICIT column list (no SELECT *, per
 * .claude/rules/supabase.md §9). Column lists were verified against the live
 * DB via information_schema on 2026-05-29. Three corrections vs. the prior
 * SELECT *-era code, each of which was silently broken before:
 *   1. fhir_observations.value_quantity_value / value_quantity_unit
 *      (code previously read value_quantity / value_unit → always undefined → "0").
 *   2. fhir_observations.category is text[]; filter must use .contains(), not
 *      .eq() (the old .eq('category','vital-signs') matched zero rows).
 *   3. lab_results.result_date (code previously read extracted_at, which does
 *      not exist on the table → lab dates always "Unknown").
 *
 * All queries are scoped to the authenticated user's own records (21st Century
 * Cures Act patient-access path), so RLS + the user filter enforce isolation.
 */

// Type source MUST match _shared/supabaseClient.ts (which createUserClient
// returns) — a different specifier produces a distinct, incompatible
// SupabaseClient type (protected-member mismatch).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type Allergy,
  type CarePlan,
  type Condition,
  type Immunization,
  type LabResult,
  type Medication,
  type Observation,
  type Procedure,
  type Profile,
} from './types.ts';

const PROFILE_COLS = 'user_id, first_name, last_name, dob, phone, email, address, gender';
const MEDICATION_COLS = 'id, user_id, medication_name, dosage, strength, frequency, instructions, status';
const ALLERGY_COLS = 'id, user_id, allergen_name, allergen_type, reaction_description, severity, clinical_status';
const CONDITION_COLS = 'id, patient_id, code, code_display, clinical_status, onset_datetime';
const PROCEDURE_COLS = 'id, patient_id, code, code_display, performed_datetime, status';
const IMMUNIZATION_COLS = 'id, patient_id, vaccine_code, vaccine_display, occurrence_datetime, status, lot_number';
const OBSERVATION_COLS = 'id, patient_id, code, code_display, value_quantity_value, value_quantity_unit, value_string, effective_datetime';
const LAB_RESULT_COLS = 'id, patient_mrn, test_name, value, unit, reference_range, result_date';
const CARE_PLAN_COLS = 'id, patient_id, title, description, status, period_start';

export interface CCDAFetchResult {
  profile: Profile | null;
  medications: Medication[];
  allergies: Allergy[];
  conditions: Condition[];
  procedures: Procedure[];
  immunizations: Immunization[];
  observations: Observation[];
  labResults: LabResult[];
  carePlans: CarePlan[];
}

/**
 * Fetch all USCDI data for the authenticated patient. Each result defaults to
 * an empty array (or null profile) so a single failing query never aborts the
 * whole export — the corresponding C-CDA section simply renders empty.
 */
export async function fetchCcdaData(
  supabase: SupabaseClient,
  userId: string,
): Promise<CCDAFetchResult> {
  const [
    profileRes,
    medicationsRes,
    allergiesRes,
    conditionsRes,
    proceduresRes,
    immunizationsRes,
    observationsRes,
    labResultsRes,
    carePlansRes,
  ] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLS).eq('user_id', userId).single(),
    supabase.from('medications').select(MEDICATION_COLS).eq('user_id', userId).eq('status', 'active'),
    supabase.from('allergy_intolerances').select(ALLERGY_COLS).eq('user_id', userId),
    supabase.from('fhir_conditions').select(CONDITION_COLS).eq('patient_id', userId),
    supabase.from('fhir_procedures').select(PROCEDURE_COLS).eq('patient_id', userId).limit(50),
    supabase.from('fhir_immunizations').select(IMMUNIZATION_COLS).eq('patient_id', userId),
    supabase.from('fhir_observations').select(OBSERVATION_COLS).eq('patient_id', userId).contains('category', ['vital-signs']).limit(50),
    supabase.from('lab_results').select(LAB_RESULT_COLS).eq('patient_mrn', userId).limit(50),
    supabase.from('fhir_care_plans').select(CARE_PLAN_COLS).eq('patient_id', userId).in('status', ['active', 'draft']),
  ]);

  return {
    profile: (profileRes.data as Profile | null) ?? null,
    medications: (medicationsRes.data as Medication[] | null) ?? [],
    allergies: (allergiesRes.data as Allergy[] | null) ?? [],
    conditions: (conditionsRes.data as Condition[] | null) ?? [],
    procedures: (proceduresRes.data as Procedure[] | null) ?? [],
    immunizations: (immunizationsRes.data as Immunization[] | null) ?? [],
    observations: (observationsRes.data as Observation[] | null) ?? [],
    labResults: (labResultsRes.data as LabResult[] | null) ?? [],
    carePlans: (carePlansRes.data as CarePlan[] | null) ?? [],
  };
}
