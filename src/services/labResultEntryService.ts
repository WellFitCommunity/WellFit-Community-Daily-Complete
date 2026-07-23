/**
 * labResultEntryService — THE canonical lab-result writer (L-1)
 *
 * Purpose: single choke-point for persisting a laboratory result. Every ingestion
 * path (manual entry now; ORU worker and PDF extraction later) routes through
 * `saveLabResult` so one write produces the complete, consistent record set:
 *
 *   1. `lab_results` row            — operational/staging store (status 'final')
 *   2. `fhir_observations` row      — clinical truth, category ['laboratory']
 *                                     (patient-facing /health-observations reads this)
 *   3. `fhir_diagnostic_reports` row — feeds the acknowledgment queue
 *                                     (v_unacknowledged_results watches this table)
 *   4. `resultEscalationService.evaluateResult` — rule-matched escalations
 *      (escalation log + specialist SLA tasks)
 *
 * Critical-value alerting: the DB trigger `trg_flag_critical_labs` fires on
 * critical_low/critical_high inserts and writes `care_team_alerts` (repaired
 * 2026-07-23, migration 20260723210000). This service deliberately does NOT
 * duplicate that alert — clinician-selected abnormal_flag drives the trigger,
 * escalation rules provide the independent threshold safety net.
 *
 * All column sets live-verified against production information_schema 2026-07-23.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import { resultEscalationService } from './resultEscalationService';
import type { EscalationRule } from './resultEscalationService';

// =============================================================================
// TYPES
// =============================================================================

/** lab_results.abnormal_flag CHECK values (live) */
export type AbnormalFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';

/** lab_results.test_category CHECK values (live) */
export type TestCategory =
  | 'hematology' | 'chemistry' | 'microbiology' | 'immunology'
  | 'urinalysis' | 'toxicology' | 'molecular' | 'other';

export interface LabResultEntryInput {
  patientId: string;
  /** Medical record number if known; falls back to the patient UUID (lab_results.patient_mrn is NOT NULL) */
  patientMrn?: string;
  /**
   * Normalized rule key, lowercase (e.g. 'potassium') — MUST match
   * result_escalation_rules.test_name for the escalation engine to see it.
   */
  testKey: string;
  /** Human-readable name stored on the record (e.g. 'Potassium') */
  testDisplay: string;
  /** LOINC code when known */
  loincCode?: string;
  testCategory?: TestCategory;
  valueNumeric: number;
  unit: string;
  referenceRange?: string;
  abnormalFlag: AbnormalFlag;
  /** When the specimen was collected; defaults to now */
  collectionDate?: string;
  performingLab?: string;
  notes?: string;
}

export interface LabResultEntryOutcome {
  labResultId: string;
  observationId: string;
  diagnosticReportId: string;
  /** Escalation rules the value triggered (empty = no escalation) */
  escalations: EscalationRule[];
  criticalAlertFired: boolean;
}

/** Common tests offered by the entry UI. testKey aligns with seeded escalation rules. */
export const LAB_TEST_CATALOG: ReadonlyArray<{
  testKey: string; testDisplay: string; loincCode: string; unit: string;
  referenceRange: string; testCategory: TestCategory;
}> = [
  { testKey: 'potassium', testDisplay: 'Potassium', loincCode: '2823-3', unit: 'mmol/L', referenceRange: '3.5-5.1', testCategory: 'chemistry' },
  { testKey: 'sodium', testDisplay: 'Sodium', loincCode: '2951-2', unit: 'mmol/L', referenceRange: '136-145', testCategory: 'chemistry' },
  { testKey: 'creatinine', testDisplay: 'Creatinine', loincCode: '2160-0', unit: 'mg/dL', referenceRange: '0.6-1.3', testCategory: 'chemistry' },
  { testKey: 'glucose', testDisplay: 'Blood Glucose', loincCode: '2345-7', unit: 'mg/dL', referenceRange: '70-100', testCategory: 'chemistry' },
  { testKey: 'hemoglobin', testDisplay: 'Hemoglobin', loincCode: '718-7', unit: 'g/dL', referenceRange: '12.0-17.5', testCategory: 'hematology' },
  { testKey: 'troponin', testDisplay: 'Troponin I', loincCode: '10839-9', unit: 'ng/mL', referenceRange: '<0.04', testCategory: 'chemistry' },
  { testKey: 'inr', testDisplay: 'INR', loincCode: '6301-6', unit: 'ratio', referenceRange: '0.8-1.2', testCategory: 'hematology' },
  { testKey: 'wbc', testDisplay: 'White Blood Cell Count', loincCode: '6690-2', unit: '10^3/uL', referenceRange: '4.5-11.0', testCategory: 'hematology' },
  { testKey: 'platelets', testDisplay: 'Platelet Count', loincCode: '777-3', unit: '10^3/uL', referenceRange: '150-450', testCategory: 'hematology' },
  { testKey: 'bun', testDisplay: 'Blood Urea Nitrogen', loincCode: '3094-0', unit: 'mg/dL', referenceRange: '7-20', testCategory: 'chemistry' },
];

const FLAG_INTERPRETATION: Record<AbnormalFlag, { code: string; display: string }> = {
  normal: { code: 'N', display: 'Normal' },
  low: { code: 'L', display: 'Low' },
  high: { code: 'H', display: 'High' },
  critical_low: { code: 'LL', display: 'Critical low' },
  critical_high: { code: 'HH', display: 'Critical high' },
};

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Resolve the caller's tenant (all three target tables are tenant-RLS'd).
 */
async function resolveCallerTenant(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', userId)
    .single();
  return (data?.tenant_id as string | undefined) ?? null;
}

async function saveLabResult(
  input: LabResultEntryInput
): Promise<ServiceResult<LabResultEntryOutcome>> {
  try {
    const tenantId = await resolveCallerTenant();
    if (!tenantId) {
      return failure('UNAUTHORIZED', 'Could not resolve your tenant — please sign in again.');
    }

    const collection = input.collectionDate ?? new Date().toISOString();
    const issued = new Date().toISOString();
    const interpretation = FLAG_INTERPRETATION[input.abnormalFlag];
    const isCritical =
      input.abnormalFlag === 'critical_low' || input.abnormalFlag === 'critical_high';

    // 1) lab_results — operational store. Critical flags fire the repaired
    //    trg_flag_critical_labs → care_team_alerts inside this insert.
    const { data: labRow, error: labError } = await supabase
      .from('lab_results')
      .insert({
        patient_id: input.patientId,
        patient_mrn: input.patientMrn ?? input.patientId,
        test_name: input.testDisplay,
        test_code: input.loincCode ?? null,
        test_category: input.testCategory ?? 'other',
        value: String(input.valueNumeric),
        value_numeric: input.valueNumeric,
        unit: input.unit,
        reference_range: input.referenceRange ?? null,
        abnormal_flag: input.abnormalFlag,
        collection_date: collection,
        result_date: issued,
        status: 'final',
        performing_lab_name: input.performingLab ?? null,
        notes: input.notes ?? null,
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (labError || !labRow) {
      const err = new Error(labError?.message ?? 'lab_results insert returned no row');
      await auditLogger.error('LAB_RESULT_INSERT_FAILED', err, {
        patientId: input.patientId, testKey: input.testKey,
      });
      return failure('DATABASE_ERROR', 'Failed to save the lab result.');
    }
    const labResultId = labRow.id as string;

    // 2) fhir_observations — clinical/patient-facing truth (category laboratory)
    const { data: obsRow, error: obsError } = await supabase
      .from('fhir_observations')
      .insert({
        fhir_id: `obs-lab-${labResultId}`,
        status: 'final',
        category: ['laboratory'],
        code: input.loincCode ?? input.testKey,
        code_system: input.loincCode ? 'http://loinc.org' : null,
        code_display: input.testDisplay,
        code_text: input.testDisplay,
        patient_id: input.patientId,
        effective_datetime: collection,
        issued,
        value_quantity_value: input.valueNumeric,
        value_quantity_unit: input.unit,
        // interpretation_* are text[] on the live table (probe-verified 2026-07-23)
        interpretation_code: [interpretation.code],
        interpretation_display: [interpretation.display],
        reference_range_text: input.referenceRange ?? null,
        sync_source: 'manual_entry',
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (obsError || !obsRow) {
      const err = new Error(obsError?.message ?? 'fhir_observations insert returned no row');
      await auditLogger.error('LAB_OBSERVATION_INSERT_FAILED', err, {
        patientId: input.patientId, labResultId,
      });
      return failure('DATABASE_ERROR', 'Lab saved, but the clinical observation record failed — report this.');
    }
    const observationId = obsRow.id as string;

    // 3) fhir_diagnostic_reports — the acknowledgment queue (v_unacknowledged_results)
    //    watches this table; every result must land here to demand a clinician ack.
    const { data: drRow, error: drError } = await supabase
      .from('fhir_diagnostic_reports')
      .insert({
        fhir_id: `dr-lab-${labResultId}`,
        status: 'final',
        category: ['laboratory'],
        code: input.loincCode ?? input.testKey,
        code_system: input.loincCode ? 'http://loinc.org' : null,
        code_display: input.testDisplay,
        code_text: input.testDisplay,
        patient_id: input.patientId,
        effective_datetime: collection,
        issued,
        result_observation_ids: [observationId],
        conclusion: `${input.testDisplay}: ${input.valueNumeric} ${input.unit} (${interpretation.display})`,
        report_priority: isCritical ? 'stat' : 'routine',
        sync_source: 'manual_entry',
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (drError || !drRow) {
      const err = new Error(drError?.message ?? 'fhir_diagnostic_reports insert returned no row');
      await auditLogger.error('LAB_DIAGNOSTIC_REPORT_INSERT_FAILED', err, {
        patientId: input.patientId, labResultId,
      });
      return failure('DATABASE_ERROR', 'Lab saved, but the acknowledgment-queue record failed — report this.');
    }
    const diagnosticReportId = drRow.id as string;

    // Link the operational row to its FHIR report
    await supabase
      .from('lab_results')
      .update({ fhir_diagnostic_report_id: `dr-lab-${labResultId}` })
      .eq('id', labResultId);

    // 4) Escalation engine — rule-matched routing (log + specialist SLA task).
    //    Failure here must not undo the persisted result; it is logged loudly.
    let escalations: EscalationRule[] = [];
    const evalResult = await resultEscalationService.evaluateResult(
      input.testKey,
      input.valueNumeric,
      input.unit,
      input.patientId,
      labResultId,
      'lab_results',
      tenantId
    );
    if (evalResult.success) {
      escalations = evalResult.data;
    } else {
      await auditLogger.error(
        'LAB_ESCALATION_EVALUATION_FAILED',
        new Error(evalResult.error.message),
        { labResultId, testKey: input.testKey }
      );
    }

    await auditLogger.info('LAB_RESULT_ENTERED', {
      labResultId, observationId, diagnosticReportId,
      testKey: input.testKey, abnormalFlag: input.abnormalFlag,
      escalationCount: escalations.length,
    });

    return success({
      labResultId,
      observationId,
      diagnosticReportId,
      escalations,
      criticalAlertFired: isCritical,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('LAB_RESULT_ENTRY_FAILED', error, {
      patientId: input.patientId, testKey: input.testKey,
    });
    return failure('UNKNOWN_ERROR', 'Failed to save the lab result.');
  }
}

export const labResultEntryService = {
  saveLabResult,
  resolveCallerTenant,
};
