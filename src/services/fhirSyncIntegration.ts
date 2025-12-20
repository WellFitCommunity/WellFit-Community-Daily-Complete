/**
 * FHIR Sync Integration
 * Extends existing FHIR sync to include new resources:
 * MedicationRequest, Condition, DiagnosticReport, Procedure
 */

import { supabase } from '../lib/supabaseClient';
import FHIRService from './fhirResourceService';
import type {
  MedicationRequest,
  Condition,
  DiagnosticReport,
  Procedure,
} from '../types/fhir';

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

      const bundle = await response.json();

      if (bundle.entry && Array.isArray(bundle.entry)) {
        for (const entry of bundle.entry) {
          const fhirMedReq = entry.resource;

          try {
            // Map FHIR resource to our schema
            const medReq: Partial<MedicationRequest> = {
              patient_id: patientId,
              status: fhirMedReq.status || 'unknown',
              intent: fhirMedReq.intent || 'order',
              medication_code: fhirMedReq.medicationCodeableConcept?.coding?.[0]?.code || '',
              medication_display:
                fhirMedReq.medicationCodeableConcept?.coding?.[0]?.display ||
                fhirMedReq.medicationCodeableConcept?.text ||
                'Unknown medication',
              medication_code_system:
                fhirMedReq.medicationCodeableConcept?.coding?.[0]?.system,
              dosage_text: fhirMedReq.dosageInstruction?.[0]?.text,
              authored_on: fhirMedReq.authoredOn || new Date().toISOString(),
              external_id: fhirMedReq.id,
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
              errors.push(`MedReq ${fhirMedReq.id}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err) {
            errors.push(`MedReq ${fhirMedReq.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error) {
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

      const bundle = await response.json();

      if (bundle.entry && Array.isArray(bundle.entry)) {
        for (const entry of bundle.entry) {
          const fhirCondition = entry.resource;

          try {
            const condition: Partial<Condition> = {
              patient_id: patientId,
              clinical_status: fhirCondition.clinicalStatus?.coding?.[0]?.code as any,
              verification_status:
                fhirCondition.verificationStatus?.coding?.[0]?.code as any || 'confirmed',
              code_system: fhirCondition.code?.coding?.[0]?.system || 'http://snomed.info/sct',
              code: fhirCondition.code?.coding?.[0]?.code || '',
              code_code: fhirCondition.code?.coding?.[0]?.code || '', // Backwards compat
              category: fhirCondition.category?.map((c: any) => c.coding?.[0]?.code) || ['problem-list-item'],
              category_code: fhirCondition.category?.[0]?.coding?.[0]?.code || 'problem-list-item', // Backwards compat
              code_display:
                fhirCondition.code?.coding?.[0]?.display || fhirCondition.code?.text || 'Unknown condition',
              onset_datetime: fhirCondition.onsetDateTime,
              recorded_date: fhirCondition.recordedDate || new Date().toISOString(),
              external_id: fhirCondition.id,
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
              errors.push(`Condition ${fhirCondition.id}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err) {
            errors.push(`Condition ${fhirCondition.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error) {
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

      const bundle = await response.json();

      if (bundle.entry && Array.isArray(bundle.entry)) {
        for (const entry of bundle.entry) {
          const fhirReport = entry.resource;

          try {
            const report: Partial<DiagnosticReport> = {
              patient_id: patientId,
              status: fhirReport.status as any || 'final',
              category: fhirReport.category?.[0]?.coding?.map((c: any) => c.code) || ['LAB'],
              category_code: fhirReport.category?.[0]?.coding?.[0]?.code || 'LAB', // Backwards compat
              code_system: fhirReport.code?.coding?.[0]?.system || 'http://loinc.org',
              code: fhirReport.code?.coding?.[0]?.code || '',
              code_code: fhirReport.code?.coding?.[0]?.code || '', // Backwards compat
              code_display:
                fhirReport.code?.coding?.[0]?.display || fhirReport.code?.text || 'Unknown report',
              effective_datetime: fhirReport.effectiveDateTime,
              issued: fhirReport.issued || new Date().toISOString(),
              conclusion: fhirReport.conclusion,
              external_id: fhirReport.id,
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
              errors.push(`DiagnosticReport ${fhirReport.id}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err) {
            errors.push(`DiagnosticReport ${fhirReport.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error) {
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

      const bundle = await response.json();

      if (bundle.entry && Array.isArray(bundle.entry)) {
        for (const entry of bundle.entry) {
          const fhirProcedure = entry.resource;

          try {
            const procedure: Partial<Procedure> = {
              patient_id: patientId,
              status: fhirProcedure.status as any || 'completed',
              code_system: fhirProcedure.code?.coding?.[0]?.system || 'http://snomed.info/sct',
              code: fhirProcedure.code?.coding?.[0]?.code || '',
              code_display:
                fhirProcedure.code?.coding?.[0]?.display ||
                fhirProcedure.code?.text ||
                'Unknown procedure',
              performed_datetime: fhirProcedure.performedDateTime,
              performed_period_start: fhirProcedure.performedPeriod?.start,
              performed_period_end: fhirProcedure.performedPeriod?.end,
              external_id: fhirProcedure.id,
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
              errors.push(`Procedure ${fhirProcedure.id}: ${error.message}`);
            } else {
              count++;
            }
          } catch (err) {
            errors.push(`Procedure ${fhirProcedure.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      return { success: errors.length === 0, count, errors };
    } catch (error) {
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

      return { success: true, observationId: data };
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

      const result = data?.[0] || { synced_count: 0, error_count: 0 };
      return {
        success: result.error_count === 0,
        syncedCount: result.synced_count,
        errorCount: result.error_count,
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
        for (const obs of observations.data) {
          entries.push({
            fullUrl: `urn:uuid:${obs.id}`,
            resource: mapToFHIRObservation(obs),
          });
        }
      }

      // Add Conditions
      if (conditions.data) {
        for (const cond of conditions.data) {
          entries.push({
            fullUrl: `urn:uuid:${cond.id}`,
            resource: mapToFHIRCondition(cond),
          });
        }
      }

      // Add MedicationRequests
      if (medications.data) {
        for (const med of medications.data) {
          entries.push({
            fullUrl: `urn:uuid:${med.id}`,
            resource: mapToFHIRMedicationRequest(med),
          });
        }
      }

      // Add Procedures
      if (procedures.data) {
        for (const proc of procedures.data) {
          entries.push({
            fullUrl: `urn:uuid:${proc.id}`,
            resource: mapToFHIRProcedure(proc),
          });
        }
      }

      // Add CarePlans
      if (carePlans.data) {
        for (const plan of carePlans.data) {
          entries.push({
            fullUrl: `urn:uuid:${plan.id}`,
            resource: mapToFHIRCarePlan(plan),
          });
        }
      }

      // Add Immunizations
      if (immunizations.data) {
        for (const imm of immunizations.data) {
          entries.push({
            fullUrl: `urn:uuid:${imm.id}`,
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
    id: obs.fhir_id as string,
    status: obs.status as string,
    category: [
      {
        coding: (obs.category as string[])?.map((cat) => ({
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: cat,
        })),
      },
    ],
    code: {
      coding: [
        {
          system: obs.code_system,
          code: obs.code,
          display: obs.code_display,
        },
      ],
    },
    subject: { reference: `Patient/${obs.patient_id}` },
    effectiveDateTime: obs.effective_datetime,
    valueQuantity: obs.value_quantity_value
      ? {
          value: obs.value_quantity_value,
          unit: obs.value_quantity_unit,
          system: 'http://unitsofmeasure.org',
          code: obs.value_quantity_code || obs.value_quantity_unit,
        }
      : undefined,
    component: obs.components,
  };
}

function mapToFHIRCondition(cond: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'Condition',
    id: cond.fhir_id as string,
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: cond.clinical_status,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: cond.verification_status,
        },
      ],
    },
    category: (cond.category as string[])?.map((cat) => ({
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: cat,
        },
      ],
    })),
    code: {
      coding: [
        {
          system: cond.code_system,
          code: cond.code,
          display: cond.code_display,
        },
      ],
    },
    subject: { reference: `Patient/${cond.patient_id}` },
    onsetDateTime: cond.onset_datetime,
    recordedDate: cond.recorded_date,
  };
}

function mapToFHIRMedicationRequest(med: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'MedicationRequest',
    id: med.fhir_id as string,
    status: med.status,
    intent: med.intent || 'order',
    medicationCodeableConcept: {
      coding: [
        {
          system: med.medication_code_system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: med.medication_code,
          display: med.medication_display,
        },
      ],
    },
    subject: { reference: `Patient/${med.patient_id}` },
    authoredOn: med.authored_on,
    dosageInstruction: med.dosage_text ? [{ text: med.dosage_text }] : undefined,
  };
}

function mapToFHIRProcedure(proc: Record<string, unknown>): FHIRResource {
  return {
    resourceType: 'Procedure',
    id: proc.fhir_id as string,
    status: proc.status,
    code: {
      coding: [
        {
          system: proc.code_system,
          code: proc.code,
          display: proc.code_display,
        },
      ],
    },
    subject: { reference: `Patient/${proc.patient_id}` },
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
    id: plan.fhir_id as string,
    status: plan.status || 'active',
    intent: plan.intent || 'plan',
    title: plan.title,
    description: plan.description,
    subject: { reference: `Patient/${plan.patient_id}` },
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
    id: imm.fhir_id as string,
    status: imm.status || 'completed',
    vaccineCode: {
      coding: [
        {
          system: imm.vaccine_code_system || 'http://hl7.org/fhir/sid/cvx',
          code: imm.vaccine_code,
          display: imm.vaccine_display,
        },
      ],
    },
    patient: { reference: `Patient/${imm.patient_id}` },
    occurrenceDateTime: imm.occurrence_datetime,
    lotNumber: imm.lot_number,
  };
}

export default FHIRSyncIntegration;
