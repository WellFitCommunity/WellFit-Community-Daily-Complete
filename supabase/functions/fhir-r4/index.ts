/**
 * FHIR R4 Server Endpoint
 *
 * Exposes WellFit patient data as FHIR R4 resources for external apps.
 * Implements US Core profiles for USCDI compliance.
 *
 * Supported Resources:
 * - Patient
 * - AllergyIntolerance
 * - Condition
 * - MedicationRequest
 * - Observation
 * - Immunization
 * - Procedure
 * - DiagnosticReport
 * - CarePlan
 * - CareTeam
 * - Goal
 * - DocumentReference
 *
 * @see https://hl7.org/fhir/R4/
 * @see https://www.hl7.org/fhir/us/core/
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { SUPABASE_URL, SB_SECRET_KEY } from '../_shared/env.ts';

const FHIR_VERSION = "4.0.1";
const FHIR_MIME_TYPE = "application/fhir+json";

// Create service role client for data access
const supabase = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const fhirHeaders = {
    ...corsHeaders,
    'Content-Type': FHIR_MIME_TYPE,
    'X-FHIR-Version': FHIR_VERSION
  };

  try {
    // Validate Bearer token (from SMART authorization)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return fhirError('unauthorized', 'Bearer token required', 401, fhirHeaders);
    }

    const token = authHeader.slice(7);

    // Validate the access token
    const tokenValidation = await validateAccessToken(token);
    if (!tokenValidation.valid) {
      return fhirError('unauthorized', 'Invalid or expired token', 401, fhirHeaders);
    }

    const { patientId, scopes } = tokenValidation;

    // Parse the FHIR request path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p && p !== 'fhir-r4');

    // Handle capability statement (metadata)
    if (pathParts.length === 0 || pathParts[0] === 'metadata') {
      return new Response(JSON.stringify(getCapabilityStatement(url.origin)), {
        headers: fhirHeaders
      });
    }

    const resourceType = pathParts[0];
    const resourceId = pathParts[1];

    // Validate scope access
    if (!hasScope(scopes, resourceType, 'read')) {
      return fhirError('forbidden', `Insufficient scope for ${resourceType}`, 403, fhirHeaders);
    }

    // Route to appropriate handler
    switch (resourceType) {
      case 'Patient':
        return await handlePatient(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'AllergyIntolerance':
        return await handleAllergyIntolerance(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'Condition':
        return await handleCondition(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'MedicationRequest':
        return await handleMedicationRequest(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'Observation':
        return await handleObservation(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'Immunization':
        return await handleImmunization(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'Procedure':
        return await handleProcedure(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'DiagnosticReport':
        return await handleDiagnosticReport(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'CarePlan':
        return await handleCarePlan(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'CareTeam':
        return await handleCareTeam(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'Goal':
        return await handleGoal(patientId, resourceId, url.searchParams, fhirHeaders);
      case 'DocumentReference':
        return await handleDocumentReference(patientId, resourceId, url.searchParams, fhirHeaders);
      default:
        return fhirError('not-supported', `Resource type ${resourceType} not supported`, 404, fhirHeaders);
    }

  } catch (err: unknown) {
    const error = err as Error;
    return fhirError('exception', error.message, 500, fhirHeaders);
  }
});

// ============================================================================
// Token Validation
// ============================================================================

interface TokenValidation {
  valid: boolean;
  patientId?: string;
  scopes?: string[];
  appId?: string;
}

async function validateAccessToken(token: string): Promise<TokenValidation> {
  // Look up the token in smart_access_tokens table
  const { data: tokenData, error } = await supabase
    .from('smart_access_tokens')
    .select('patient_id, scopes, app_id, expires_at')
    .eq('access_token', token)
    .single();

  if (error || !tokenData) {
    return { valid: false };
  }

  // Check expiration
  if (new Date(tokenData.expires_at) < new Date()) {
    return { valid: false };
  }

  return {
    valid: true,
    patientId: tokenData.patient_id,
    scopes: tokenData.scopes?.split(' ') || [],
    appId: tokenData.app_id
  };
}

function hasScope(scopes: string[], resourceType: string, action: string): boolean {
  // Check for patient-level scopes
  const patientScope = `patient/${resourceType}.${action}`;
  const patientWildcard = `patient/*.${action}`;
  const userScope = `user/${resourceType}.${action}`;
  const userWildcard = `user/*.${action}`;

  return scopes.some(s =>
    s === patientScope ||
    s === patientWildcard ||
    s === userScope ||
    s === userWildcard
  );
}

// ============================================================================
// FHIR Error Response
// ============================================================================

function fhirError(code: string, message: string, status: number, headers: Record<string, string>) {
  const operationOutcome = {
    resourceType: "OperationOutcome",
    issue: [{
      severity: "error",
      code,
      diagnostics: message
    }]
  };
  return new Response(JSON.stringify(operationOutcome), { status, headers });
}

// ============================================================================
// Capability Statement (Server Metadata)
// ============================================================================

function getCapabilityStatement(baseUrl: string) {
  return {
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    kind: "instance",
    software: {
      name: "WellFit FHIR Server",
      version: "1.0.0"
    },
    implementation: {
      description: "WellFit Community FHIR R4 API",
      url: baseUrl
    },
    fhirVersion: FHIR_VERSION,
    format: ["json"],
    rest: [{
      mode: "server",
      security: {
        cors: true,
        service: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
            code: "SMART-on-FHIR"
          }]
        }],
        extension: [{
          url: "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
          extension: [
            { url: "token", valueUri: `${baseUrl}/smart-authorize` },
            { url: "authorize", valueUri: `${baseUrl}/smart-authorize` }
          ]
        }]
      },
      resource: [
        { type: "Patient", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "AllergyIntolerance", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Condition", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "MedicationRequest", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Observation", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Immunization", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Procedure", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "DiagnosticReport", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "CarePlan", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "CareTeam", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "Goal", interaction: [{ code: "read" }, { code: "search-type" }] },
        { type: "DocumentReference", interaction: [{ code: "read" }, { code: "search-type" }] }
      ]
    }]
  };
}

// ============================================================================
// Resource Handlers
// ============================================================================

async function handlePatient(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  // Only allow access to the authorized patient
  if (resourceId && resourceId !== patientId) {
    return fhirError('forbidden', 'Access denied to this patient', 403, headers);
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', patientId)
    .single();

  if (error || !profile) {
    return fhirError('not-found', 'Patient not found', 404, headers);
  }

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
      family: profile.last_name || "",
      given: [profile.first_name || ""]
    }],
    gender: mapGender(profile.gender),
    birthDate: profile.dob || undefined,
    telecom: [
      ...(profile.phone ? [{ system: "phone", value: profile.phone, use: "home" }] : []),
      ...(profile.email ? [{ system: "email", value: profile.email }] : [])
    ],
    address: profile.address ? [{
      use: "home",
      text: profile.address
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

async function handleAllergyIntolerance(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('allergy_intolerances')
    .select('*')
    .eq('user_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: allergies, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!allergies || allergies.length === 0) {
      return fhirError('not-found', 'AllergyIntolerance not found', 404, headers);
    }
    return new Response(JSON.stringify(mapAllergyToFHIR(allergies[0], patientId)), { headers });
  }

  const entries = (allergies || []).map(a => ({
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

async function handleCondition(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_conditions')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: conditions, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!conditions || conditions.length === 0) {
      return fhirError('not-found', 'Condition not found', 404, headers);
    }
    return new Response(JSON.stringify(mapConditionToFHIR(conditions[0], patientId)), { headers });
  }

  const entries = (conditions || []).map(c => ({
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

async function handleMedicationRequest(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('medications')
    .select('*')
    .eq('user_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: medications, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!medications || medications.length === 0) {
      return fhirError('not-found', 'MedicationRequest not found', 404, headers);
    }
    return new Response(JSON.stringify(mapMedicationToFHIR(medications[0], patientId)), { headers });
  }

  const entries = (medications || []).map(m => ({
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

async function handleObservation(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  const category = params.get('category');

  let query = supabase
    .from('fhir_observations')
    .select('*')
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

  if (resourceId) {
    if (!observations || observations.length === 0) {
      return fhirError('not-found', 'Observation not found', 404, headers);
    }
    return new Response(JSON.stringify(mapObservationToFHIR(observations[0], patientId)), { headers });
  }

  const entries = (observations || []).map(o => ({
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

async function handleImmunization(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_immunizations')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: immunizations, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!immunizations || immunizations.length === 0) {
      return fhirError('not-found', 'Immunization not found', 404, headers);
    }
    return new Response(JSON.stringify(mapImmunizationToFHIR(immunizations[0], patientId)), { headers });
  }

  const entries = (immunizations || []).map(i => ({
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

async function handleProcedure(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_procedures')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: procedures, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!procedures || procedures.length === 0) {
      return fhirError('not-found', 'Procedure not found', 404, headers);
    }
    return new Response(JSON.stringify(mapProcedureToFHIR(procedures[0], patientId)), { headers });
  }

  const entries = (procedures || []).map(p => ({
    resource: mapProcedureToFHIR(p, patientId),
    fullUrl: `Procedure/${p.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

async function handleDiagnosticReport(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_diagnostic_reports')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: reports, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!reports || reports.length === 0) {
      return fhirError('not-found', 'DiagnosticReport not found', 404, headers);
    }
    return new Response(JSON.stringify(mapDiagnosticReportToFHIR(reports[0], patientId)), { headers });
  }

  const entries = (reports || []).map(r => ({
    resource: mapDiagnosticReportToFHIR(r, patientId),
    fullUrl: `DiagnosticReport/${r.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

async function handleCarePlan(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_care_plans')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: carePlans, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!carePlans || carePlans.length === 0) {
      return fhirError('not-found', 'CarePlan not found', 404, headers);
    }
    return new Response(JSON.stringify(mapCarePlanToFHIR(carePlans[0], patientId)), { headers });
  }

  const entries = (carePlans || []).map(cp => ({
    resource: mapCarePlanToFHIR(cp, patientId),
    fullUrl: `CarePlan/${cp.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

async function handleCareTeam(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_care_teams')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: careTeams, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!careTeams || careTeams.length === 0) {
      return fhirError('not-found', 'CareTeam not found', 404, headers);
    }
    return new Response(JSON.stringify(mapCareTeamToFHIR(careTeams[0], patientId)), { headers });
  }

  const entries = (careTeams || []).map(ct => ({
    resource: mapCareTeamToFHIR(ct, patientId),
    fullUrl: `CareTeam/${ct.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

async function handleGoal(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('fhir_goals')
    .select('*')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: goals, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!goals || goals.length === 0) {
      return fhirError('not-found', 'Goal not found', 404, headers);
    }
    return new Response(JSON.stringify(mapGoalToFHIR(goals[0], patientId)), { headers });
  }

  const entries = (goals || []).map(g => ({
    resource: mapGoalToFHIR(g, patientId),
    fullUrl: `Goal/${g.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

async function handleDocumentReference(patientId: string, resourceId: string | undefined, params: URLSearchParams, headers: Record<string, string>) {
  let query = supabase
    .from('clinical_notes')
    .select('*')
    .eq('author_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: documents, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  if (resourceId) {
    if (!documents || documents.length === 0) {
      return fhirError('not-found', 'DocumentReference not found', 404, headers);
    }
    return new Response(JSON.stringify(mapDocumentToFHIR(documents[0], patientId)), { headers });
  }

  const entries = (documents || []).map(d => ({
    resource: mapDocumentToFHIR(d, patientId),
    fullUrl: `DocumentReference/${d.id}`
  }));

  return new Response(JSON.stringify({
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  }), { headers });
}

// ============================================================================
// FHIR Resource Mappers
// ============================================================================

function mapGender(gender: string | null): string {
  if (!gender) return "unknown";
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';
  if (g === 'other') return 'other';
  return 'unknown';
}

function mapAllergyToFHIR(allergy: any, patientId: string) {
  return {
    resourceType: "AllergyIntolerance",
    id: allergy.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"]
    },
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
        code: allergy.clinical_status || "active"
      }]
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
        code: allergy.verification_status || "confirmed"
      }]
    },
    type: allergy.allergen_type === 'intolerance' ? 'intolerance' : 'allergy',
    category: [allergy.allergen_type || "medication"],
    criticality: allergy.criticality || "unable-to-assess",
    code: {
      text: allergy.allergen_name
    },
    patient: { reference: `Patient/${patientId}` },
    recordedDate: allergy.created_at,
    reaction: allergy.reaction_description ? [{
      description: allergy.reaction_description,
      severity: allergy.severity || "moderate"
    }] : undefined
  };
}

function mapConditionToFHIR(condition: any, patientId: string) {
  return {
    resourceType: "Condition",
    id: condition.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"]
    },
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code: condition.clinical_status || "active"
      }]
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        code: condition.verification_status || "confirmed"
      }]
    },
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-category",
        code: "problem-list-item"
      }]
    }],
    code: {
      coding: condition.code ? [{
        system: condition.code_system || "http://hl7.org/fhir/sid/icd-10-cm",
        code: condition.code,
        display: condition.code_display
      }] : undefined,
      text: condition.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: condition.onset_datetime,
    recordedDate: condition.recorded_date
  };
}

function mapMedicationToFHIR(medication: any, patientId: string) {
  return {
    resourceType: "MedicationRequest",
    id: medication.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"]
    },
    status: medication.status || "active",
    intent: "order",
    medicationCodeableConcept: {
      text: medication.medication_name
    },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: medication.created_at,
    dosageInstruction: [{
      text: medication.instructions || medication.dosage,
      timing: medication.frequency ? { code: { text: medication.frequency } } : undefined,
      doseAndRate: medication.dosage ? [{
        doseQuantity: { value: 1, unit: medication.dosage }
      }] : undefined
    }]
  };
}

function mapObservationToFHIR(observation: any, patientId: string) {
  return {
    resourceType: "Observation",
    id: observation.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"]
    },
    status: observation.status || "final",
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/observation-category",
        code: observation.category || "vital-signs"
      }]
    }],
    code: {
      coding: observation.code ? [{
        system: "http://loinc.org",
        code: observation.code,
        display: observation.code_display
      }] : undefined,
      text: observation.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: observation.effective_datetime,
    valueQuantity: observation.value_quantity ? {
      value: observation.value_quantity,
      unit: observation.value_unit,
      system: "http://unitsofmeasure.org"
    } : undefined,
    valueString: observation.value_string
  };
}

function mapImmunizationToFHIR(immunization: any, patientId: string) {
  return {
    resourceType: "Immunization",
    id: immunization.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"]
    },
    status: immunization.status || "completed",
    vaccineCode: {
      coding: immunization.vaccine_code ? [{
        system: "http://hl7.org/fhir/sid/cvx",
        code: immunization.vaccine_code,
        display: immunization.vaccine_display
      }] : undefined,
      text: immunization.vaccine_display
    },
    patient: { reference: `Patient/${patientId}` },
    occurrenceDateTime: immunization.occurrence_datetime,
    lotNumber: immunization.lot_number,
    primarySource: true
  };
}

function mapProcedureToFHIR(procedure: any, patientId: string) {
  return {
    resourceType: "Procedure",
    id: procedure.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure"]
    },
    status: procedure.status || "completed",
    code: {
      coding: procedure.code ? [{
        system: procedure.code_system || "http://www.ama-assn.org/go/cpt",
        code: procedure.code,
        display: procedure.code_display
      }] : undefined,
      text: procedure.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    performedDateTime: procedure.performed_datetime
  };
}

function mapDiagnosticReportToFHIR(report: any, patientId: string) {
  return {
    resourceType: "DiagnosticReport",
    id: report.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab"]
    },
    status: report.status || "final",
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/v2-0074",
        code: report.category || "LAB"
      }]
    }],
    code: {
      coding: report.code ? [{
        system: "http://loinc.org",
        code: report.code,
        display: report.code_display
      }] : undefined,
      text: report.code_display
    },
    subject: { reference: `Patient/${patientId}` },
    effectiveDateTime: report.effective_datetime,
    issued: report.issued,
    conclusion: report.conclusion
  };
}

function mapCarePlanToFHIR(carePlan: any, patientId: string) {
  return {
    resourceType: "CarePlan",
    id: carePlan.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"]
    },
    status: carePlan.status || "active",
    intent: "plan",
    title: carePlan.title,
    description: carePlan.description,
    subject: { reference: `Patient/${patientId}` },
    period: {
      start: carePlan.period_start,
      end: carePlan.period_end
    },
    category: [{
      coding: [{
        system: "http://hl7.org/fhir/us/core/CodeSystem/careplan-category",
        code: "assess-plan"
      }]
    }]
  };
}

function mapCareTeamToFHIR(careTeam: any, patientId: string) {
  return {
    resourceType: "CareTeam",
    id: careTeam.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam"]
    },
    status: careTeam.status || "active",
    name: careTeam.name,
    subject: { reference: `Patient/${patientId}` },
    participant: careTeam.participants || []
  };
}

function mapGoalToFHIR(goal: any, patientId: string) {
  return {
    resourceType: "Goal",
    id: goal.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal"]
    },
    lifecycleStatus: goal.lifecycle_status || "active",
    description: {
      text: goal.description
    },
    subject: { reference: `Patient/${patientId}` },
    startDate: goal.start_date,
    target: goal.target_date ? [{
      dueDate: goal.target_date
    }] : undefined
  };
}

function mapDocumentToFHIR(document: any, patientId: string) {
  return {
    resourceType: "DocumentReference",
    id: document.id,
    meta: {
      profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"]
    },
    status: "current",
    type: {
      coding: [{
        system: "http://loinc.org",
        code: "34108-1",
        display: "Outpatient Note"
      }]
    },
    subject: { reference: `Patient/${patientId}` },
    date: document.created_at,
    content: [{
      attachment: {
        contentType: "text/plain",
        data: btoa(document.content || "")
      }
    }]
  };
}
