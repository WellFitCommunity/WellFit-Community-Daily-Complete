/**
 * Batch Calculation — process measure calculations for multiple patients
 *
 * ONC Criteria: 170.315(c)(1), (c)(2)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { CalculationOptions, CalculationJob, AggregateResult } from './types';
import { evaluatePatientForMeasure } from './patientEvaluation';
import { calculateAggregateResults } from './aggregateResults';

/**
 * Calculate measures for multiple patients (batch)
 */
export async function calculateMeasures(
  options: CalculationOptions
): Promise<ServiceResult<{ jobId: string }>> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd, patientIds } = options;

  try {
    const { data: job, error: jobError } = await supabase
      .from('ecqm_calculation_jobs')
      .insert({
        tenant_id: tenantId,
        measure_ids: measureIds,
        reporting_period_start: reportingPeriodStart,
        reporting_period_end: reportingPeriodEnd,
        patient_ids: patientIds,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      return failure('DATABASE_ERROR', jobError.message);
    }

    await auditLogger.info('ECQM_CALCULATION_JOB_CREATED', {
      tenantId,
      jobId: job.id,
      measureIds,
      reportingPeriodStart,
      reportingPeriodEnd
    });

    processCalculationJob(job.id, options).catch(err => {
      auditLogger.error(
        'ECQM_CALCULATION_JOB_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { jobId: job.id }
      );
    });

    return success({ jobId: job.id });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_CALCULATION_START_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureIds }
    );
    return failure('OPERATION_FAILED', 'Failed to start calculation');
  }
}

/**
 * Process a calculation job
 */
async function processCalculationJob(
  jobId: string,
  options: CalculationOptions
): Promise<void> {
  const { tenantId, measureIds, reportingPeriodStart, reportingPeriodEnd, patientIds } = options;

  try {
    await supabase
      .from('ecqm_calculation_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', jobId);

    let patientsQuery = supabase
      .from('patients')
      .select('id')
      .eq('tenant_id', tenantId);

    if (patientIds && patientIds.length > 0) {
      patientsQuery = patientsQuery.in('id', patientIds);
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) {
      throw new Error(patientsError.message);
    }

    const totalPatients = patients?.length || 0;
    let processedPatients = 0;

    await supabase
      .from('ecqm_calculation_jobs')
      .update({ patients_total: totalPatients })
      .eq('id', jobId);

    for (const patient of patients || []) {
      for (const measureId of measureIds) {
        const result = await evaluatePatientForMeasure(
          tenantId,
          patient.id,
          measureId,
          reportingPeriodStart,
          reportingPeriodEnd
        );

        if (result.success && result.data) {
          await supabase.from('ecqm_patient_results').upsert({
            tenant_id: tenantId,
            measure_id: measureId,
            patient_id: patient.id,
            reporting_period_start: reportingPeriodStart,
            reporting_period_end: reportingPeriodEnd,
            initial_population: result.data.initialPopulation,
            denominator: result.data.denominator,
            denominator_exclusion: result.data.denominatorExclusion,
            denominator_exception: result.data.denominatorException,
            numerator: result.data.numerator,
            numerator_exclusion: result.data.numeratorExclusion,
            measure_observation: result.data.measureObservation,
            data_elements_used: result.data.dataElementsUsed
          }, {
            onConflict: 'tenant_id,measure_id,patient_id,reporting_period_start'
          });
        }
      }

      processedPatients++;

      if (processedPatients % 10 === 0) {
        await supabase
          .from('ecqm_calculation_jobs')
          .update({
            patients_processed: processedPatients,
            progress_percentage: Math.round((processedPatients / totalPatients) * 100)
          })
          .eq('id', jobId);
      }
    }

    const aggregates: AggregateResult[] = [];
    for (const measureId of measureIds) {
      const aggResult = await calculateAggregateResults(
        tenantId,
        measureId,
        reportingPeriodStart,
        reportingPeriodEnd
      );
      if (aggResult.success && aggResult.data) {
        aggregates.push(aggResult.data);
      }
    }

    await supabase
      .from('ecqm_calculation_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        patients_processed: processedPatients,
        progress_percentage: 100,
        result_summary: aggregates
      })
      .eq('id', jobId);

    await auditLogger.info('ECQM_CALCULATION_JOB_COMPLETED', {
      jobId,
      tenantId,
      patientsProcessed: processedPatients,
      measuresCalculated: measureIds.length
    });
  } catch (err: unknown) {
    await supabase
      .from('ecqm_calculation_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err)
      })
      .eq('id', jobId);

    throw err;
  }
}

/**
 * Get calculation job status
 */
export async function getCalculationJobStatus(jobId: string): Promise<ServiceResult<CalculationJob | null>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_calculation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data) return success(null);

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      measureIds: data.measure_ids,
      status: data.status,
      progressPercentage: data.progress_percentage,
      patientsProcessed: data.patients_processed,
      patientsTotal: data.patients_total,
      resultSummary: data.result_summary,
      errorMessage: data.error_message
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_JOB_STATUS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { jobId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch job status');
  }
}
