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
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { FHIR_VERSION, FHIR_MIME_TYPE } from './types.ts';
import { validateAccessToken, hasScope } from './auth.ts';
import { getCapabilityStatement } from './capability.ts';
import {
  fhirError,
  handlePatient,
  handleAllergyIntolerance,
  handleCondition,
  handleMedicationRequest,
  handleObservation,
  handleImmunization,
} from './handlers.ts';
import {
  handleProcedure,
  handleDiagnosticReport,
  handleCarePlan,
  handleCareTeam,
  handleGoal,
  handleDocumentReference,
} from './handlers-extended.ts';

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
    if (!hasScope(scopes!, resourceType, 'read')) {
      return fhirError('forbidden', `Insufficient scope for ${resourceType}`, 403, fhirHeaders);
    }

    // Route to appropriate handler
    switch (resourceType) {
      case 'Patient':
        return await handlePatient(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'AllergyIntolerance':
        return await handleAllergyIntolerance(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'Condition':
        return await handleCondition(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'MedicationRequest':
        return await handleMedicationRequest(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'Observation':
        return await handleObservation(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'Immunization':
        return await handleImmunization(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'Procedure':
        return await handleProcedure(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'DiagnosticReport':
        return await handleDiagnosticReport(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'CarePlan':
        return await handleCarePlan(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'CareTeam':
        return await handleCareTeam(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'Goal':
        return await handleGoal(patientId!, resourceId, url.searchParams, fhirHeaders);
      case 'DocumentReference':
        return await handleDocumentReference(patientId!, resourceId, url.searchParams, fhirHeaders);
      default:
        return fhirError('not-supported', `Resource type ${resourceType} not supported`, 404, fhirHeaders);
    }

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return fhirError('exception', errorMessage, 500, fhirHeaders);
  }
});
