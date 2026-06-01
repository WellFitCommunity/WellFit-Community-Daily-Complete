/**
 * FHIR Integrator — raw FHIR server I/O (fetch patient bundle, push bundle)
 *
 * Extracted from fhirInteroperabilityIntegrator.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — moved verbatim from private methods (no `this` used).
 */

import { auditLogger } from '../auditLogger';
import type {
  UnknownRecord,
  FHIRBundleEntry,
  FHIRPatient,
  FHIRObservationResource,
  FHIRImmunizationResource,
  FHIRCarePlanResource,
  FHIRPatientData,
} from './types';

export async function fetchPatientDataFromFHIR(
  fhirServerUrl: string,
  patientId: string,
  accessToken?: string
): Promise<FHIRPatientData> {
  const headers: Record<string, string> = {
    'Accept': 'application/fhir+json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Fetch patient resource
  const patientResponse = await fetch(`${fhirServerUrl}/Patient/${patientId}`, { headers });
  if (!patientResponse.ok) {
    throw new Error(`Failed to fetch patient: ${patientResponse.statusText}`);
  }
  const patient = (await patientResponse.json()) as FHIRPatient;

  // Fetch observations (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateParam = thirtyDaysAgo.toISOString().split('T')[0];

  const observationsResponse = await fetch(
    `${fhirServerUrl}/Observation?patient=${patientId}&date=ge${dateParam}`,
    { headers }
  );
  // RF-4: a non-OK sub-resource response must not look identical to "no data".
  // We keep the graceful empty fallback (don't fail the whole import on one
  // sub-resource) but log the gap so a server error is observable.
  if (!observationsResponse.ok) {
    await auditLogger.warn('FHIR_SUBRESOURCE_FETCH_FAILED', { resource: 'Observation', status: observationsResponse.status, patientId });
  }
  const observationsJson = observationsResponse.ok ? ((await observationsResponse.json()) as UnknownRecord) : { entry: [] };
  const observations = (observationsJson.entry as unknown as FHIRBundleEntry[]) || [];

  // Fetch Immunizations
  const immunizationsResponse = await fetch(
    `${fhirServerUrl}/Immunization?patient=${patientId}`,
    { headers }
  );
  if (!immunizationsResponse.ok) {
    await auditLogger.warn('FHIR_SUBRESOURCE_FETCH_FAILED', { resource: 'Immunization', status: immunizationsResponse.status, patientId });
  }
  const immunizationsJson = immunizationsResponse.ok ? ((await immunizationsResponse.json()) as UnknownRecord) : { entry: [] };
  const immunizations = (immunizationsJson.entry as unknown as FHIRBundleEntry[]) || [];

  // Fetch CarePlans (only active and on-hold)
  const carePlansResponse = await fetch(
    `${fhirServerUrl}/CarePlan?patient=${patientId}&status=active,on-hold`,
    { headers }
  );
  if (!carePlansResponse.ok) {
    await auditLogger.warn('FHIR_SUBRESOURCE_FETCH_FAILED', { resource: 'CarePlan', status: carePlansResponse.status, patientId });
  }
  const carePlansJson = carePlansResponse.ok ? ((await carePlansResponse.json()) as UnknownRecord) : { entry: [] };
  const carePlans = (carePlansJson.entry as unknown as FHIRBundleEntry[]) || [];

  return {
    patient,
    observations: observations as Array<{ resource?: FHIRObservationResource }>,
    immunizations: immunizations as Array<{ resource?: FHIRImmunizationResource }>,
    carePlans: carePlans as Array<{ resource?: FHIRCarePlanResource }>
  };
}

export async function pushBundleToFHIR(
  fhirServerUrl: string,
  bundle: UnknownRecord,
  accessToken?: string,
  existingPatientId?: string
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json'
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const bundleEntry = bundle.entry as unknown as Array<{ resource?: UnknownRecord }> | undefined;

  // If we have an existing patient ID, update the bundle references
  if (existingPatientId && bundleEntry) {
    bundle.entry = bundleEntry.map((entry) => {
      const resource = entry.resource as UnknownRecord | undefined;
      const resourceType = (resource?.resourceType as string | undefined) || '';
      if (resource && resourceType === 'Patient') {
        resource.id = existingPatientId;
      }
      return entry;
    }) as unknown as UnknownRecord['entry'];
  }

  // POST bundle to FHIR server
  const response = await fetch(fhirServerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(bundle)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FHIR server error: ${response.status} - ${errorText}`);
  }
}
