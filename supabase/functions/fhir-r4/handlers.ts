/**
 * FHIR R4 Server — Core Resource Handlers
 *
 * Handlers for: Patient, AllergyIntolerance, Condition,
 * MedicationRequest, Observation, Immunization.
 *
 * Each handler queries the appropriate Supabase table, applies patient
 * scoping, and returns FHIR-formatted responses (single resource or Bundle).
 */

import type {
  AllergyRecord,
  ConditionRecord,
  MedicationRecord,
  ObservationRecord,
  ImmunizationRecord,
  ProfileRecord,
} from './types.ts';
import {
  mapGender,
  mapAllergyToFHIR,
  mapConditionToFHIR,
  mapMedicationToFHIR,
  mapObservationToFHIR,
  mapImmunizationToFHIR,
} from './mappers.ts';
import { supabase, fhirError } from './utils.ts';

// Re-export fhirError so index.ts can import it from here for backward compat
export { fhirError } from './utils.ts';

// =============================================================================
// Patient
// =============================================================================

export async function handlePatient(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  // Only allow access to the authorized patient
  if (resourceId && resourceId !== patientId) {
    return fhirError('forbidden', 'Access denied to this patient', 403, headers);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, last_name, gender, dob, phone, email, address')
    .eq('user_id', patientId)
    .single();

  if (error || !profile) {
    return fhirError('not-found', 'Patient not found', 404, headers);
  }

  const typedProfile = profile as ProfileRecord;

  const patient = {
    resourceType: "Patient",
    id: patientId,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
    },
    identifier: [{
      system: "urn:wellfit:patient",
      value: patientId
    }],
    name: [{
      use: "official",
      family: typedProfile.last_name || "",
      given: [typedProfile.first_name || ""]
    }],
    gender: mapGender(typedProfile.gender ?? null),
    birthDate: typedProfile.dob || undefined,
    telecom: [
      ...(typedProfile.phone ? [{ system: "phone", value: typedProfile.phone, use: "home" }] : []),
      ...(typedProfile.email ? [{ system: "email", value: typedProfile.email }] : [])
    ],
    address: typedProfile.address ? [{
      use: "home",
      text: typedProfile.address
    }] : []
  };

  if (resourceId) {
    return new Response(JSON.stringify(patient), { headers });
  }

  // Return as Bundle for search
  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: 1,
    entry: [{ resource: patient, fullUrl: `Patient/${patientId}` }]
  }), { headers });
}

// =============================================================================
// AllergyIntolerance
// =============================================================================

export async function handleAllergyIntolerance(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('allergy_intolerances')
    .select('id, clinical_status, verification_status, allergen_type, allergen_name, criticality, created_at, reaction_description, severity')
    .eq('user_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: allergies, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedAllergies = (allergies || []) as AllergyRecord[];

  if (resourceId) {
    if (typedAllergies.length === 0) {
      return fhirError('not-found', 'AllergyIntolerance not found', 404, headers);
    }
    return new Response(JSON.stringify(mapAllergyToFHIR(typedAllergies[0], patientId)), { headers });
  }

  const entries = typedAllergies.map((a: AllergyRecord) => ({
    resource: mapAllergyToFHIR(a, patientId),
    fullUrl: `AllergyIntolerance/${a.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

// =============================================================================
// Condition
// =============================================================================

export async function handleCondition(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_conditions')
    .select('id, clinical_status, verification_status, code, code_system, code_display, onset_datetime, recorded_date')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: conditions, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedConditions = (conditions || []) as ConditionRecord[];

  if (resourceId) {
    if (typedConditions.length === 0) {
      return fhirError('not-found', 'Condition not found', 404, headers);
    }
    return new Response(JSON.stringify(mapConditionToFHIR(typedConditions[0], patientId)), { headers });
  }

  const entries = typedConditions.map((c: ConditionRecord) => ({
    resource: mapConditionToFHIR(c, patientId),
    fullUrl: `Condition/${c.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

// =============================================================================
// MedicationRequest
// =============================================================================

export async function handleMedicationRequest(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('medications')
    .select('id, medication_name, status, created_at, instructions, dosage, frequency')
    .eq('user_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: medications, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedMedications = (medications || []) as MedicationRecord[];

  if (resourceId) {
    if (typedMedications.length === 0) {
      return fhirError('not-found', 'MedicationRequest not found', 404, headers);
    }
    return new Response(JSON.stringify(mapMedicationToFHIR(typedMedications[0], patientId)), { headers });
  }

  const entries = typedMedications.map((m: MedicationRecord) => ({
    resource: mapMedicationToFHIR(m, patientId),
    fullUrl: `MedicationRequest/${m.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

// =============================================================================
// Observation
// =============================================================================

export async function handleObservation(
  patientId: string,
  resourceId: string | undefined,
  params: URLSearchParams,
  headers: Record<string, string>
) {
  const category = params.get('category');

  let query = supabase
    .from('fhir_observations')
    .select('id, status, category, code, code_display, effective_datetime, value_quantity, value_unit, value_string')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: observations, error } = await query.order('effective_datetime', { ascending: false }).limit(100);

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedObservations = (observations || []) as ObservationRecord[];

  if (resourceId) {
    if (typedObservations.length === 0) {
      return fhirError('not-found', 'Observation not found', 404, headers);
    }
    return new Response(JSON.stringify(mapObservationToFHIR(typedObservations[0], patientId)), { headers });
  }

  const entries = typedObservations.map((o: ObservationRecord) => ({
    resource: mapObservationToFHIR(o, patientId),
    fullUrl: `Observation/${o.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

// =============================================================================
// Immunization
// =============================================================================

export async function handleImmunization(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_immunizations')
    .select('id, status, vaccine_code, vaccine_display, occurrence_datetime, lot_number')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: immunizations, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedImmunizations = (immunizations || []) as ImmunizationRecord[];

  if (resourceId) {
    if (typedImmunizations.length === 0) {
      return fhirError('not-found', 'Immunization not found', 404, headers);
    }
    return new Response(JSON.stringify(mapImmunizationToFHIR(typedImmunizations[0], patientId)), { headers });
  }

  const entries = typedImmunizations.map((i: ImmunizationRecord) => ({
    resource: mapImmunizationToFHIR(i, patientId),
    fullUrl: `Immunization/${i.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}
