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

/**
 * Evaluate a single patient against a measure
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
