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
}

export default FHIRSyncIntegration;
