/**
 * Patient Evaluation — evaluate a patient against a measure
 *
 * ONC Criteria: 170.315(c)(1)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { PatientMeasureResult, PatientMeasureData } from './types';
import { evaluateMeasureCriteria } from './measureEvaluators';
import { isCqlAvailable, executeCql, loadElmLibrary, cqlResultToMeasureResult } from './cqlEngine';
import type { CqlPatientBundle } from './cqlEngine.types';

/**
 * Evaluate a single patient against a measure.
 *
 * Strategy: CQL-first with hand-coded fallback.
 * 1. Check if CQL packages are available
 * 2. Try to load ELM library for the measure
 * 3. If both available, execute CQL
 * 4. Otherwise, fall back to hand-coded evaluators
 */
export async function evaluatePatientForMeasure(
  tenantId: string,
  patientId: string,
  measureId: string,
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date
): Promise<ServiceResult<PatientMeasureResult>> {
  try {
    const patientData = await getPatientDataForMeasure(
      tenantId,
      patientId,
      measureId,
      reportingPeriodStart,
      reportingPeriodEnd
    );

    if (!patientData.success) {
      return failure('VALIDATION_ERROR', patientData.error?.message || 'Failed to get patient data');
    }

    // Attempt CQL-based evaluation
    const cqlReady = await isCqlAvailable();
    if (cqlReady) {
      const elmLibrary = await loadElmLibrary(measureId);
      if (elmLibrary) {
        const bundle = patientDataToFhirBundle(patientId, patientData.data);
        const cqlResult = await executeCql({ elmLibrary, patientBundle: bundle });

        if (cqlResult.success && cqlResult.data && cqlResult.data.patientResults.length > 0) {
          const mapped = cqlResultToMeasureResult(measureId, patientId, cqlResult.data.patientResults[0]);
          return success(mapped);
        }

        // CQL execution failed — log and fall back
        await auditLogger.warn('CQL_EVALUATION_FALLBACK', {
          measureId,
          patientId,
          reason: 'CQL execution returned no results; using hand-coded evaluator',
        });
      }
    }

    // Fallback: hand-coded evaluators
    const result = evaluateMeasureCriteria(
      measureId,
      patientData.data,
      reportingPeriodStart,
      reportingPeriodEnd
    );

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_PATIENT_EVALUATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId, measureId }
    );
    return failure('OPERATION_FAILED', 'Failed to evaluate patient');
  }
}

/**
 * Convert PatientMeasureData to a minimal FHIR Bundle for CQL execution
 */
function patientDataToFhirBundle(patientId: string, data: PatientMeasureData): CqlPatientBundle {
  const entries: CqlPatientBundle['entry'] = [];

  // Patient resource
  entries.push({
    resource: {
      resourceType: 'Patient',
      id: patientId,
      birthDate: data.patient.date_of_birth,
      gender: data.patient.gender === 'M' ? 'male' : data.patient.gender === 'F' ? 'female' : 'unknown',
    },
  });

  // Conditions
  data.conditions.forEach(c => {
    entries.push({
      resource: {
        resourceType: 'Condition',
        id: c.id,
        code: { coding: [{ system: c.code_system, code: c.code }] },
        onsetDateTime: c.onset_date,
        clinicalStatus: { coding: [{ code: c.status }] },
        subject: { reference: `Patient/${patientId}` },
      },
    });
  });

  // Observations
  data.observations.forEach(o => {
    entries.push({
      resource: {
        resourceType: 'Observation',
        id: o.id,
        code: { coding: [{ code: o.code }] },
        valueQuantity: { value: o.value, unit: o.unit },
        effectiveDateTime: o.effective_date,
        subject: { reference: `Patient/${patientId}` },
      },
    });
  });

  // Encounters
  data.encounters.forEach(e => {
    entries.push({
      resource: {
        resourceType: 'Encounter',
        id: e.id,
        type: [{ coding: [{ code: e.encounter_type }] }],
        period: { start: e.encounter_date },
        subject: { reference: `Patient/${patientId}` },
      },
    });
  });

  // Procedures
  data.procedures.forEach(p => {
    entries.push({
      resource: {
        resourceType: 'Procedure',
        id: p.id,
        code: { coding: [{ code: p.code }] },
        performedDateTime: p.performed_date,
        subject: { reference: `Patient/${patientId}` },
      },
    });
  });

  // MedicationRequests
  data.medications.forEach(m => {
    entries.push({
      resource: {
        resourceType: 'MedicationRequest',
        id: m.id,
        medicationCodeableConcept: { coding: [{ code: m.medication_code }] },
        status: m.status,
        authoredOn: m.authored_on,
        subject: { reference: `Patient/${patientId}` },
      },
    });
  });

  return { resourceType: 'Bundle', type: 'collection', entry: entries };
}

/**
 * Get patient data needed for measure calculation
 */
export async function getPatientDataForMeasure(
  tenantId: string,
  patientId: string,
  measureId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<ServiceResult<PatientMeasureData>> {
  try {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, date_of_birth, gender, tenant_id')
      .eq('id', patientId)
      .eq('tenant_id', tenantId)
      .single();

    if (patientError) {
      return failure('DATABASE_ERROR', patientError.message);
    }

    const { data: encounters } = await supabase
      .from('encounters')
      .select('id, encounter_date, encounter_type, primary_diagnosis')
      .eq('patient_id', patientId)
      .gte('encounter_date', periodStart.toISOString())
      .lte('encounter_date', periodEnd.toISOString());

    const { data: conditions } = await supabase
      .from('conditions')
      .select('id, code, code_system, onset_date, status')
      .eq('patient_id', patientId)
      .eq('status', 'active');

    const { data: observations } = await supabase
      .from('observations')
      .select('id, code, value, unit, effective_date')
      .eq('patient_id', patientId)
      .gte('effective_date', periodStart.toISOString())
      .lte('effective_date', periodEnd.toISOString());

    const { data: medications } = await supabase
      .from('medication_requests')
      .select('id, medication_code, status, authored_on')
      .eq('patient_id', patientId)
      .eq('status', 'active');

    const { data: procedures } = await supabase
      .from('procedures')
      .select('id, code, performed_date, status')
      .eq('patient_id', patientId)
      .gte('performed_date', periodStart.toISOString())
      .lte('performed_date', periodEnd.toISOString());

    const birthDate = new Date(patient.date_of_birth);
    const age = Math.floor(
      (periodEnd.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    return success({
      patient: { ...patient, age },
      encounters: encounters || [],
      conditions: conditions || [],
      observations: observations || [],
      medications: medications || [],
      procedures: procedures || []
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_PATIENT_DATA_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId, measureId }
    );
    return failure('VALIDATION_ERROR', 'Failed to fetch patient data');
  }
}
