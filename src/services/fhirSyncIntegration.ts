/**
 * FHIR Sync Integration
 * Extends existing FHIR sync to include new resources:
 * MedicationRequest, Condition, DiagnosticReport, Procedure
 */

import { supabase } from '../lib/supabaseClient';
import _FHIRService from './fhirResourceService';
import type {
  MedicationRequest,
  Condition,
  DiagnosticReport,
  Procedure,
} from '../types/fhir';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function firstArrayItem(value: unknown): unknown | undefined {
  return Array.isArray(value) ? value[0] : undefined;
}

function getCodingArray(obj: UnknownRecord | null, key: string): unknown[] {
  const val = obj ? obj[key] : undefined;
  return Array.isArray(val) ? val : [];
}

function getFirstCoding(obj: UnknownRecord | null): UnknownRecord | null {
  const coding = getCodingArray(obj, 'coding');
  const first = firstArrayItem(coding);
  return asRecord(first);
}

function mapCategoryCodes(category: unknown, fallback: string[]): string[] {
  if (!Array.isArray(category)) return fallback;

  const codes: string[] = [];
  for (const item of category) {
    const cat = asRecord(item);
    const firstCoding = getFirstCoding(cat);
    const code = asString(firstCoding?.code);
    if (code) codes.push(code);
  }

  return codes.length > 0 ? codes : fallback;
}

// ============================================================================
// RESOURCE SYNC HANDLERS
// ============================================================================

export class FHIRSyncIntegration {
  /**
   * Sync MedicationRequest resources from external FHIR server
   */
  static async syncMedicationRequestsFromFHIR(
    connectionId: string,
    patientId: string,
    externalPatientId: string,
    fhirServerUrl: string,
    accessToken: string
  ): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      // Fetch MedicationRequests from external FHIR server
      const response = await fetch(
        `${fhirServerUrl}/MedicationRequest?patient=${externalPatientId}&status=active`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/fhir+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const bundleUnknown: unknown = await response.json();
      const bundle = asRecord(bundleUnknown);

      const entryUnknown = bundle?.entry;
      if (Array.isArray(entryUnknown)) {
        for (const entryItem of entryUnknown) {
          const entry = asRecord(entryItem);
          const fhirMedReq = asRecord(entry?.resource);

          if (!fhirMedReq) continue;

          try {
            const medConcept = asRecord(fhirMedReq.medicationCodeableConcept);
            const medCoding = getFirstCoding(medConcept);

            const dosageInstruction = Array.isArray(fhirMedReq.dosageInstruction)
              ? fhirMedReq.dosageInstruction
              : [];

            const firstDosage = asRecord(firstArrayItem(dosageInstruction));
            const dosageText = asString(firstDosage?.text);

            const medId = asString(fhirMedReq.id) ?? '';

            // Map FHIR resource to our schema
            const medReq: Partial<MedicationRequest> = {
              patient_id: patientId,
              status: (asString(fhirMedReq.status) ?? 'unknown') as MedicationRequest['status'],
              intent: (asString(fhirMedReq.intent) ?? 'order') as MedicationRequest['intent'],
              medication_code: asString(medCoding?.code) ?? '',
              medication_display:
                asString(medCoding?.display) ||
                asString(medConcept?.text) ||
                'Unknown medication',
              medication_code_system: asString(medCoding?.system),
              dosage_text: dosageText,
              authored_on: asString(fhirMedReq.authoredOn) || new Date().toISOString(),
              external_id: medId,
              sync_source: connectionId,
              last_synced_at: new Date().toISOString(),
            };

            // Upsert (update if exists by external_id, insert if not)
            const { error } = await supabase.from('fhir_medication_requests').upsert(
              medReq,
              {
                onConflict: 'external_id',
                ignoreDuplicates: false,
              }
            );

            if (error) {
              errors.push(`MedReq ${medId}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err: unknown) {
            const medId = asString(fhirMedReq.id) ?? 'unknown';
            errors.push(`MedReq ${medId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error: unknown) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
      };
    }
  }

  /**
   * Sync Condition resources from external FHIR server
   */
  static async syncConditionsFromFHIR(
    connectionId: string,
    patientId: string,
    externalPatientId: string,
    fhirServerUrl: string,
    accessToken: string
  ): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const response = await fetch(
        `${fhirServerUrl}/Condition?patient=${externalPatientId}&clinical-status=active`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/fhir+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const bundleUnknown: unknown = await response.json();
      const bundle = asRecord(bundleUnknown);

      const entryUnknown = bundle?.entry;
      if (Array.isArray(entryUnknown)) {
        for (const entryItem of entryUnknown) {
          const entry = asRecord(entryItem);
          const fhirCondition = asRecord(entry?.resource);

          if (!fhirCondition) continue;

          try {
            const clinicalStatus = asRecord(fhirCondition.clinicalStatus);
            const clinicalCoding = getFirstCoding(clinicalStatus);
            const clinicalCode = asString(clinicalCoding?.code) ?? 'unknown';

            const verificationStatus = asRecord(fhirCondition.verificationStatus);
            const verificationCoding = getFirstCoding(verificationStatus);
            const verificationCode = asString(verificationCoding?.code) ?? 'confirmed';

            const codeObj = asRecord(fhirCondition.code);
            const codeCoding = getFirstCoding(codeObj);

            const externalId = asString(fhirCondition.id) ?? '';

            const categoryCodes = mapCategoryCodes(fhirCondition.category, ['problem-list-item']);
            const firstCategoryCode = categoryCodes[0] ?? 'problem-list-item';

            const condition: Partial<Condition> = {
              patient_id: patientId,
              clinical_status: clinicalCode as Condition['clinical_status'],
              verification_status: verificationCode as Condition['verification_status'],
              code_system: asString(codeCoding?.system) || 'http://snomed.info/sct',
              code: asString(codeCoding?.code) ?? '',
              code_code: asString(codeCoding?.code) ?? '', // Backwards compat
              category: categoryCodes,
              category_code: firstCategoryCode, // Backwards compat
              code_display:
                asString(codeCoding?.display) || asString(codeObj?.text) || 'Unknown condition',
              onset_datetime: asString(fhirCondition.onsetDateTime),
              recorded_date: asString(fhirCondition.recordedDate) || new Date().toISOString(),
              external_id: externalId,
              sync_source: connectionId,
              last_synced_at: new Date().toISOString(),
            };

            const { error } = await supabase
              .from('fhir_conditions')
              .upsert(condition, {
                onConflict: 'external_id',
                ignoreDuplicates: false,
              });

            if (error) {
              errors.push(`Condition ${externalId}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err: unknown) {
            const conditionId = asString(fhirCondition.id) ?? 'unknown';
            errors.push(`Condition ${conditionId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error: unknown) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
      };
    }
  }

  /**
   * Sync DiagnosticReport resources from external FHIR server
   */
  static async syncDiagnosticReportsFromFHIR(
    connectionId: string,
    patientId: string,
    externalPatientId: string,
    fhirServerUrl: string,
    accessToken: string
  ): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const response = await fetch(
        `${fhirServerUrl}/DiagnosticReport?patient=${externalPatientId}&status=final`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/fhir+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const bundleUnknown: unknown = await response.json();
      const bundle = asRecord(bundleUnknown);

      const entryUnknown = bundle?.entry;
      if (Array.isArray(entryUnknown)) {
        for (const entryItem of entryUnknown) {
          const entry = asRecord(entryItem);
          const fhirReport = asRecord(entry?.resource);

          if (!fhirReport) continue;

          try {
            const categoryArray = Array.isArray(fhirReport.category) ? fhirReport.category : [];
            const firstCategory = asRecord(firstArrayItem(categoryArray));
            const categoryCoding = getCodingArray(firstCategory, 'coding');

            const categoryCodes: string[] = [];
            for (const c of categoryCoding) {
              const coding = asRecord(c);
              const code = asString(coding?.code);
              if (code) categoryCodes.push(code);
            }

            const reportCode = asRecord(fhirReport.code);
            const reportCoding = getFirstCoding(reportCode);

            const externalId = asString(fhirReport.id) ?? '';

            const report: Partial<DiagnosticReport> = {
              patient_id: patientId,
              status: (asString(fhirReport.status) ?? 'final') as DiagnosticReport['status'],
              category: categoryCodes.length > 0 ? categoryCodes : ['LAB'],
              category_code: (categoryCodes[0] ?? 'LAB') as DiagnosticReport['category_code'], // Backwards compat
              code_system: asString(reportCoding?.system) || 'http://loinc.org',
              code: asString(reportCoding?.code) ?? '',
              code_code: asString(reportCoding?.code) ?? '', // Backwards compat
              code_display:
                asString(reportCoding?.display) || asString(reportCode?.text) || 'Unknown report',
              effective_datetime: asString(fhirReport.effectiveDateTime),
              issued: asString(fhirReport.issued) || new Date().toISOString(),
              conclusion: asString(fhirReport.conclusion),
              external_id: externalId,
              sync_source: connectionId,
              last_synced_at: new Date().toISOString(),
            };

            const { error } = await supabase
              .from('fhir_diagnostic_reports')
              .upsert(report, {
                onConflict: 'external_id',
                ignoreDuplicates: false,
              });

            if (error) {
              errors.push(`DiagnosticReport ${externalId}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err: unknown) {
            const reportId = asString(fhirReport.id) ?? 'unknown';
            errors.push(`DiagnosticReport ${reportId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error: unknown) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
      };
    }
  }

  /**
   * Sync Procedure resources from external FHIR server
   */
  static async syncProceduresFromFHIR(
    connectionId: string,
    patientId: string,
    externalPatientId: string,
    fhirServerUrl: string,
    accessToken: string
  ): Promise<{ success: boolean; count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const response = await fetch(
        `${fhirServerUrl}/Procedure?patient=${externalPatientId}&status=completed`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/fhir+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`FHIR server returned ${response.status}`);
      }

      const bundleUnknown: unknown = await response.json();
      const bundle = asRecord(bundleUnknown);

      const entryUnknown = bundle?.entry;
      if (Array.isArray(entryUnknown)) {
        for (const entryItem of entryUnknown) {
          const entry = asRecord(entryItem);
          const fhirProcedure = asRecord(entry?.resource);

          if (!fhirProcedure) continue;

          try {
            const procCode = asRecord(fhirProcedure.code);
            const procCoding = getFirstCoding(procCode);

            const externalId = asString(fhirProcedure.id) ?? '';

            const procedure: Partial<Procedure> = {
              patient_id: patientId,
              status: (asString(fhirProcedure.status) ?? 'completed') as Procedure['status'],
              code_system: asString(procCoding?.system) || 'http://snomed.info/sct',
              code: asString(procCoding?.code) ?? '',
              code_display:
                asString(procCoding?.display) ||
                asString(procCode?.text) ||
                'Unknown procedure',
              performed_datetime: asString(fhirProcedure.performedDateTime),
              performed_period_start: asString(asRecord(fhirProcedure.performedPeriod)?.start),
              performed_period_end: asString(asRecord(fhirProcedure.performedPeriod)?.end),
              external_id: externalId,
              sync_source: connectionId,
              last_synced_at: new Date().toISOString(),
            };

            const { error } = await supabase
              .from('fhir_procedures')
              .upsert(procedure, {
                onConflict: 'external_id',
                ignoreDuplicates: false,
              });

            if (error) {
              errors.push(`Procedure ${externalId}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err: unknown) {
            const procId = asString(fhirProcedure.id) ?? 'unknown';
            errors.push(`Procedure ${procId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error: unknown) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error'],
      };
    }
  }

  /**
   * Sync all new resources for a patient
   */
  static async syncAllNewResourcesForPatient(
    connectionId: string,
    patientId: string,
    externalPatientId: string,
    fhirServerUrl: string,
    accessToken: string
  ): Promise<{
    success: boolean;
    summary: {
      medicationRequests: number;
      conditions: number;
      diagnosticReports: number;
      procedures: number;
    };
    errors: string[];
  }> {
    const allErrors: string[] = [];

    const medReqResult = await this.syncMedicationRequestsFromFHIR(
      connectionId,
      patientId,
      externalPatientId,
      fhirServerUrl,
      accessToken
    );
    allErrors.push(...medReqResult.errors);

    const conditionResult = await this.syncConditionsFromFHIR(
      connectionId,
      patientId,
      externalPatientId,
      fhirServerUrl,
      accessToken
    );
    allErrors.push(...conditionResult.errors);

    const reportResult = await this.syncDiagnosticReportsFromFHIR(
      connectionId,
      patientId,
      externalPatientId,
      fhirServerUrl,
      accessToken
    );
    allErrors.push(...reportResult.errors);

    const procedureResult = await this.syncProceduresFromFHIR(
      connectionId,
      patientId,
      externalPatientId,
      fhirServerUrl,
      accessToken
    );
    allErrors.push(...procedureResult.errors);

    return {
      success: allErrors.length === 0,
      summary: {
        medicationRequests: medReqResult.count,
        conditions: conditionResult.count,
        diagnosticReports: reportResult.count,
        procedures: procedureResult.count,
      },
      errors: allErrors,
    };
  }

  // ============================================================================
  // INTERNAL DATA → FHIR MAPPING
  // ============================================================================

  /**
   * Sync a single self_report to FHIR Observations
   * Maps vitals (BP, HR, SpO2, blood sugar, weight) to FHIR Observation resources
   *
   * @param reportId - UUID of the self_report to sync
   * @returns Observation ID if created successfully
   */
  static async syncSelfReportToFHIR(
    reportId: string
  ): Promise<{ success: boolean; observationId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('sync_self_report_to_fhir_observation', {
        report_id: reportId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, observationId: typeof data === 'string' ? data : undefined };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown sync error',
      };
    }
  }

  /**
   * Batch sync all unsynced self_reports to FHIR Observations
   * Processes up to 1000 reports per call
   *
   * @returns Count of synced and failed reports
   */
  static async syncAllSelfReportsToFHIR(): Promise<{
    success: boolean;
    syncedCount: number;
    errorCount: number;
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.rpc('sync_all_self_reports_to_fhir');

      if (error) {
        return { success: false, syncedCount: 0, errorCount: 0, error: error.message };
      }

      const first = Array.isArray(data) ? data[0] : undefined;
      const result = asRecord(first) || { synced_count: 0, error_count: 0 };

      const syncedCount = typeof result.synced_count === 'number' ? result.synced_count : 0;
      const errorCount = typeof result.error_count === 'number' ? result.error_count : 0;

      return {
        success: errorCount === 0,
        syncedCount,
        errorCount,
      };
    } catch (err: unknown) {
      return {
        success: false,
        syncedCount: 0,
        errorCount: 0,
        error: err instanceof Error ? err.message : 'Unknown sync error',
      };
    }
  }

  // ============================================================================
  // FHIR EXPORT FUNCTIONALITY
  // ============================================================================

  /**
   * Export patient data as a FHIR Bundle
   * Returns a complete Bundle with all patient resources
   *
   * @param patientId - UUID of the patient
   * @returns FHIR Bundle containing all patient resources
   */
  static async exportPatientBundle(patientId: string): Promise<{
    success: boolean;
    bundle?: FHIRBundle;
    error?: string;
  }> {
    try {
      // Fetch all resources for the patient in parallel
      const [observations, conditions, medications, procedures, carePlans, immunizations] =
        await Promise.all([
          supabase
            .from('fhir_observations')
            .select('*')
            .eq('patient_id', patientId)
            .order('effective_datetime', { ascending: false }),
          supabase
            .from('fhir_conditions')
            .select('*')
            .eq('patient_id', patientId)
            .order('recorded_date', { ascending: false }),
          supabase
            .from('fhir_medication_requests')
            .select('*')
            .eq('patient_id', patientId)
            .order('authored_on', { ascending: false }),
          supabase
            .from('fhir_procedures')
            .select('*')
            .eq('patient_id', patientId)
            .order('performed_datetime', { ascending: false }),
          supabase
            .from('fhir_care_plans')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          supabase
            .from('fhir_immunizations')
            .select('*')
            .eq('patient_id', patientId)
            .order('occurrence_datetime', { ascending: false }),
        ]);

      // Build FHIR Bundle entries
      const entries: FHIRBundleEntry[] = [];

      // Add Observations
      if (observations.data) {
        for (const obs of observations.data as UnknownRecord[]) {
          entries.push({
            fullUrl: `urn:uuid:${String(obs.id)}`,
            resource: mapToFHIRObservation(obs),
          });
        }
      }

      // Add Conditions
      if (conditions.data) {
        for (const cond of conditions.data as UnknownRecord[]) {
          entries.push({
            fullUrl: `urn:uuid:${String(cond.id)}`,
            resource: mapToFHIRCondition(cond),
          });
        }
      }

      // Add MedicationRequests
      if (medications.data) {
        for (const med of medications.data as UnknownRecord[]) {
          entries.push({
            fullUrl: `urn:uuid:${String(med.id)}`,
            resource: mapToFHIRMedicationRequest(med),
          });
        }
      }

      // Add Procedures
      if (procedures.data) {
        for (const proc of procedures.data as UnknownRecord[]) {
          entries.push({
            fullUrl: `urn:uuid:${String(proc.id)}`,
            resource: mapToFHIRProcedure(proc),
          });
        }
      }

      // Add CarePlans
      if (carePlans.data) {
        for (const plan of carePlans.data as UnknownRecord[]) {
          entries.push({
            fullUrl: `urn:uuid:${String(plan.id)}`,
            resource: mapToFHIRCarePlan(plan),
          });
        }
      }

      // Add Immunizations
      if (immunizations.data) {
        for (const imm of immunizations.data as UnknownRecord[]) {
          entries.push({
            fullUrl: `urn:uuid:${String(imm.id)}`,
            resource: mapToFHIRImmunization(imm),
          });
        }
      }

      const bundle: FHIRBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        total: entries.length,
        entry: entries,
      };

      return { success: true, bundle };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown export error',
      };
    }
  }

  /**
   * Export patient data as NDJSON for Bulk FHIR Export
   * Returns separate NDJSON strings for each resource type
   *
   * @param patientId - UUID of the patient
   * @returns NDJSON strings keyed by resource type
   */
  static async exportPatientNDJSON(patientId: string): Promise<{
    success: boolean;
    resources?: Record<string, string>;
    error?: string;
  }> {
    const bundleResult = await this.exportPatientBundle(patientId);
    if (!bundleResult.success || !bundleResult.bundle) {
      return { success: false, error: bundleResult.error };
    }

    // Group entries by resource type
    const grouped: Record<string, unknown[]> = {};
    for (const entry of bundleResult.bundle.entry || []) {
      const type = entry.resource?.resourceType;
      if (type) {
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(entry.resource);
      }
    }

    // Convert to NDJSON
    const resources: Record<string, string> = {};
    for (const [type, items] of Object.entries(grouped)) {
      resources[type] = items.map((item) => JSON.stringify(item)).join('\n');
    }

    return { success: true, resources };
  }
}

// ============================================================================
// FHIR BUNDLE TYPES
// ============================================================================

interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'searchset' | 'transaction' | 'batch';
  timestamp: string;
  total: number;
  entry: FHIRBundleEntry[];
}

interface FHIRBundleEntry {
  fullUrl: string;
  resource: FHIRResource;
}

interface FHIRResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

// ============================================================================
// FHIR RESOURCE MAPPERS
// ============================================================================

function mapToFHIRObservation(obs: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'Observation',
    id: typeof obs.fhir_id === 'string' ? obs.fhir_id : undefined,
    status: typeof obs.status === 'string' ? obs.status : undefined,
    category: [
      {
        coding: Array.isArray(obs.category)
          ? (obs.category as unknown[]).map((cat) => ({
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: typeof cat === 'string' ? cat : String(cat),
            }))
          : [],
      },
    ],
    code: {
      coding: [
        {
          system: typeof obs.code_system === 'string' ? obs.code_system : undefined,
          code: typeof obs.code === 'string' ? obs.code : undefined,
          display: typeof obs.code_display === 'string' ? obs.code_display : undefined,
        },
      ],
    },
    subject: { reference: `Patient/${String(obs.patient_id)}` },
    effectiveDateTime: obs.effective_datetime,
    valueQuantity: obs.value_quantity_value
      ? {
          value: obs.value_quantity_value,
          unit: obs.value_quantity_unit,
          system: 'http://unitsofmeasure.org',
          code:
            typeof obs.value_quantity_code === 'string'
              ? obs.value_quantity_code
              : (typeof obs.value_quantity_unit === 'string' ? obs.value_quantity_unit : undefined),
        }
      : undefined,
    component: obs.components,
  };
}

function mapToFHIRCondition(cond: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'Condition',
    id: typeof cond.fhir_id === 'string' ? cond.fhir_id : undefined,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: typeof cond.clinical_status === 'string' ? cond.clinical_status : undefined,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: typeof cond.verification_status === 'string' ? cond.verification_status : undefined,
        },
      ],
    },
    category: Array.isArray(cond.category)
      ? (cond.category as unknown[]).map((cat) => ({
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: typeof cat === 'string' ? cat : String(cat),
            },
          ],
        }))
      : undefined,
    code: {
      coding: [
        {
          system: typeof cond.code_system === 'string' ? cond.code_system : undefined,
          code: typeof cond.code === 'string' ? cond.code : undefined,
          display: typeof cond.code_display === 'string' ? cond.code_display : undefined,
        },
      ],
    },
    subject: { reference: `Patient/${String(cond.patient_id)}` },
    onsetDateTime: cond.onset_datetime,
    recordedDate: cond.recorded_date,
  };
}

function mapToFHIRMedicationRequest(med: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'MedicationRequest',
    id: typeof med.fhir_id === 'string' ? med.fhir_id : undefined,
    status: med.status,
    intent: med.intent || 'order',
    medicationCodeableConcept: {
      coding: [
        {
          system:
            typeof med.medication_code_system === 'string'
              ? med.medication_code_system
              : 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: typeof med.medication_code === 'string' ? med.medication_code : undefined,
          display: typeof med.medication_display === 'string' ? med.medication_display : undefined,
        },
      ],
    },
    subject: { reference: `Patient/${String(med.patient_id)}` },
    authoredOn: med.authored_on,
    dosageInstruction: med.dosage_text ? [{ text: med.dosage_text as string }] : undefined,
  };
}

function mapToFHIRProcedure(proc: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'Procedure',
    id: typeof proc.fhir_id === 'string' ? proc.fhir_id : undefined,
    status: proc.status,
    code: {
      coding: [
        {
          system: typeof proc.code_system === 'string' ? proc.code_system : undefined,
          code: typeof proc.code === 'string' ? proc.code : undefined,
          display: typeof proc.code_display === 'string' ? proc.code_display : undefined,
        },
      ],
    },
    subject: { reference: `Patient/${String(proc.patient_id)}` },
    performedDateTime: proc.performed_datetime,
    performedPeriod:
      proc.performed_period_start || proc.performed_period_end
        ? {
            start: proc.performed_period_start,
            end: proc.performed_period_end,
          }
        : undefined,
  };
}

function mapToFHIRCarePlan(plan: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'CarePlan',
    id: typeof plan.fhir_id === 'string' ? plan.fhir_id : undefined,
    status: typeof plan.status === 'string' ? plan.status : 'active',
    intent: typeof plan.intent === 'string' ? plan.intent : 'plan',
    title: plan.title,
    description: plan.description,
    subject: { reference: `Patient/${String(plan.patient_id)}` },
    period: {
      start: plan.period_start,
      end: plan.period_end,
    },
    created: plan.created_at,
  };
}

function mapToFHIRImmunization(imm: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'Immunization',
    id: typeof imm.fhir_id === 'string' ? imm.fhir_id : undefined,
    status: typeof imm.status === 'string' ? imm.status : 'completed',
    vaccineCode: {
      coding: [
        {
          system:
            typeof imm.vaccine_code_system === 'string'
              ? imm.vaccine_code_system
              : 'http://hl7.org/fhir/sid/cvx',
          code: typeof imm.vaccine_code === 'string' ? imm.vaccine_code : undefined,
          display: typeof imm.vaccine_display === 'string' ? imm.vaccine_display : undefined,
        },
      ],
    },
    patient: { reference: `Patient/${String(imm.patient_id)}` },
    occurrenceDateTime: imm.occurrence_datetime,
    lotNumber: imm.lot_number,
  };
}

export default FHIRSyncIntegration;
