/**
 * FHIR R4 Server — Extended Resource Handlers
 *
 * Handlers for: Procedure, DiagnosticReport, CarePlan,
 * CareTeam, Goal, DocumentReference.
 *
 * Each handler queries the appropriate Supabase table, applies patient
 * scoping, and returns FHIR-formatted responses (single resource or Bundle).
 */

import type {
  ProcedureRecord,
  DiagnosticReportRecord,
  CarePlanRecord,
  CareTeamRecord,
  GoalRecord,
  DocumentRecord,
} from './types.ts';
import {
  mapProcedureToFHIR,
  mapDiagnosticReportToFHIR,
  mapCarePlanToFHIR,
  mapCareTeamToFHIR,
  mapGoalToFHIR,
  mapDocumentToFHIR,
} from './mappers.ts';
import { supabase, fhirError } from './utils.ts';

// =============================================================================
// Procedure
// =============================================================================

export async function handleProcedure(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_procedures')
    .select('id, status, code, code_system, code_display, performed_datetime')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: procedures, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedProcedures = (procedures || []) as ProcedureRecord[];

  if (resourceId) {
    if (typedProcedures.length === 0) {
      return fhirError('not-found', 'Procedure not found', 404, headers);
    }
    return new Response(JSON.stringify(mapProcedureToFHIR(typedProcedures[0], patientId)), { headers });
  }

  const entries = typedProcedures.map((p: ProcedureRecord) => ({
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

// =============================================================================
// DiagnosticReport
// =============================================================================

export async function handleDiagnosticReport(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_diagnostic_reports')
    .select('id, status, category, code, code_display, effective_datetime, issued, conclusion')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: reports, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedReports = (reports || []) as DiagnosticReportRecord[];

  if (resourceId) {
    if (typedReports.length === 0) {
      return fhirError('not-found', 'DiagnosticReport not found', 404, headers);
    }
    return new Response(JSON.stringify(mapDiagnosticReportToFHIR(typedReports[0], patientId)), { headers });
  }

  const entries = typedReports.map((r: DiagnosticReportRecord) => ({
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

// =============================================================================
// CarePlan
// =============================================================================

export async function handleCarePlan(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_care_plans')
    .select('id, status, title, description, period_start, period_end')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: carePlans, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedCarePlans = (carePlans || []) as CarePlanRecord[];

  if (resourceId) {
    if (typedCarePlans.length === 0) {
      return fhirError('not-found', 'CarePlan not found', 404, headers);
    }
    return new Response(JSON.stringify(mapCarePlanToFHIR(typedCarePlans[0], patientId)), { headers });
  }

  const entries = typedCarePlans.map((cp: CarePlanRecord) => ({
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

// =============================================================================
// CareTeam
// =============================================================================

export async function handleCareTeam(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_care_teams')
    .select('id, status, name, participants')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: careTeams, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedCareTeams = (careTeams || []) as CareTeamRecord[];

  if (resourceId) {
    if (typedCareTeams.length === 0) {
      return fhirError('not-found', 'CareTeam not found', 404, headers);
    }
    return new Response(JSON.stringify(mapCareTeamToFHIR(typedCareTeams[0], patientId)), { headers });
  }

  const entries = typedCareTeams.map((ct: CareTeamRecord) => ({
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

// =============================================================================
// Goal
// =============================================================================

export async function handleGoal(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('fhir_goals')
    .select('id, lifecycle_status, description, start_date, target_date')
    .eq('patient_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: goals, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedGoals = (goals || []) as GoalRecord[];

  if (resourceId) {
    if (typedGoals.length === 0) {
      return fhirError('not-found', 'Goal not found', 404, headers);
    }
    return new Response(JSON.stringify(mapGoalToFHIR(typedGoals[0], patientId)), { headers });
  }

  const entries = typedGoals.map((g: GoalRecord) => ({
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

// =============================================================================
// DocumentReference
// =============================================================================

export async function handleDocumentReference(
  patientId: string,
  resourceId: string | undefined,
  _params: URLSearchParams,
  headers: Record<string, string>
) {
  let query = supabase
    .from('clinical_notes')
    .select('id, created_at, content')
    .eq('author_id', patientId);

  if (resourceId) {
    query = query.eq('id', resourceId);
  }

  const { data: documents, error } = await query;

  if (error) {
    return fhirError('exception', error.message, 500, headers);
  }

  const typedDocuments = (documents || []) as DocumentRecord[];

  if (resourceId) {
    if (typedDocuments.length === 0) {
      return fhirError('not-found', 'DocumentReference not found', 404, headers);
    }
    return new Response(JSON.stringify(mapDocumentToFHIR(typedDocuments[0], patientId)), { headers });
  }

  const entries = typedDocuments.map((d: DocumentRecord) => ({
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
