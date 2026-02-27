// =====================================================
// MCP FHIR Server - Resource Query Functions
// Purpose: Patient bundle export and resource search operations
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { FHIRResource, PatientBundleOptions, ResourceSearchFilters } from "./types.ts";
import { FHIR_TABLES, SUPPORTED_RESOURCES, getFHIRColumns } from "./tools.ts";
import { createFHIRBundle, toFHIRPatient } from "./bundleBuilder.ts";

/**
 * Exports a complete FHIR Bundle for a patient, including demographics
 * and all requested resource types. Optionally includes AI risk assessments.
 *
 * @param sb - The Supabase client (service role)
 * @param patientId - The patient UUID
 * @param resources - Array of FHIR resource type names to include
 * @param options - Date filters and AI inclusion flag
 * @returns A FHIR Bundle containing all matched resources
 */
export async function getPatientBundle(
  sb: SupabaseClient,
  patientId: string,
  resources: string[] = SUPPORTED_RESOURCES,
  options: PatientBundleOptions = {}
): Promise<Record<string, unknown>> {
  const bundleResources: FHIRResource[] = [];

  // Get patient demographics
  const { data: patient, error: patientError } = await sb
    .from('profiles')
    .select('id, mrn, first_name, last_name, middle_name, gender, date_of_birth, phone, email, address_line1, address_line2, city, state, zip_code, created_at, updated_at')
    .eq('id', patientId)
    .single();

  if (patientError) {
    throw new Error(`Patient not found: ${patientError.message}`);
  }

  bundleResources.push(toFHIRPatient(patient));

  // Query each requested resource type
  for (const resourceType of resources) {
    if (resourceType === 'Patient') continue; // Already added

    const table = FHIR_TABLES[resourceType];
    if (!table) continue;

    let query = sb.from(table).select(getFHIRColumns(table)).eq('patient_id', patientId);

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    const { data, error } = await query.limit(100);

    if (!error && data) {
      for (const record of data) {
        bundleResources.push({
          resourceType,
          ...record
        });
      }
    }
  }

  // Include AI assessments if requested
  if (options.includeAI) {
    const { data: aiData } = await sb
      .from('ai_risk_assessments')
      .select('id, risk_type, risk_score, factors, created_at')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (aiData) {
      for (const assessment of aiData) {
        bundleResources.push({
          resourceType: 'RiskAssessment',
          id: assessment.id,
          subject: { reference: `Patient/${patientId}` },
          prediction: [{
            outcome: { text: assessment.risk_type },
            probabilityDecimal: assessment.risk_score
          }],
          basis: assessment.factors?.map((f: string) => ({ display: f })) || [],
          meta: { lastUpdated: assessment.created_at }
        });
      }
    }
  }

  return createFHIRBundle(bundleResources);
}

/**
 * Searches FHIR resources of a given type with optional filters.
 * Returns a FHIR searchset Bundle.
 *
 * @param sb - The Supabase client (service role)
 * @param resourceType - The FHIR resource type to search
 * @param filters - Optional search filters (patient, status, date range, etc.)
 * @returns A FHIR Bundle of type 'searchset' containing matched resources
 */
export async function searchResources(
  sb: SupabaseClient,
  resourceType: string,
  filters: ResourceSearchFilters
): Promise<Record<string, unknown>> {
  const table = FHIR_TABLES[resourceType];
  if (!table) {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }

  let query = sb.from(table).select(getFHIRColumns(table));

  if (filters.patientId) {
    query = query.eq('patient_id', filters.patientId);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.code) {
    query = query.or(`code.eq.${filters.code},code_system.eq.${filters.code}`);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query.limit(filters.limit || 50);

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return createFHIRBundle(
    (data || []).map(r => ({ resourceType, ...r })),
    'searchset'
  );
}
