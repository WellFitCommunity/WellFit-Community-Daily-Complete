/**
 * Aggregate Results — calculate and retrieve aggregate measure results
 *
 * ONC Criteria: 170.315(c)(2), (c)(3)
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { AggregateResult, PatientResultRow, AggregateResultRow } from './types';

/**
 * Calculate aggregate results for a measure
 */
export async function calculateAggregateResults(
  tenantId: string,
  measureId: string,
  reportingPeriodStart: Date,
  reportingPeriodEnd: Date
): Promise<ServiceResult<AggregateResult>> {
  try {
    const { data: results, error } = await supabase
      .from('ecqm_patient_results')
      .select('initial_population, denominator, denominator_exclusion, denominator_exception, numerator, numerator_exclusion')
      .eq('tenant_id', tenantId)
      .eq('measure_id', measureId)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0]);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const patientResults = (results || []) as PatientResultRow[];

    const aggregate: AggregateResult = {
      measureId,
      initialPopulationCount: patientResults.filter((r: PatientResultRow) => r.initial_population).length,
      denominatorCount: patientResults.filter((r: PatientResultRow) => r.denominator).length,
      denominatorExclusionCount: patientResults.filter((r: PatientResultRow) => r.denominator_exclusion).length,
      denominatorExceptionCount: patientResults.filter((r: PatientResultRow) => r.denominator_exception).length,
      numeratorCount: patientResults.filter((r: PatientResultRow) => r.numerator).length,
      numeratorExclusionCount: patientResults.filter((r: PatientResultRow) => r.numerator_exclusion).length,
      performanceRate: null,
      patientCount: patientResults.length
    };

    const eligibleDenominator =
      aggregate.denominatorCount -
      aggregate.denominatorExclusionCount -
      aggregate.denominatorExceptionCount;

    if (eligibleDenominator > 0) {
      aggregate.performanceRate = Math.round(
        (aggregate.numeratorCount / eligibleDenominator) * 10000
      ) / 10000;
    }

    await supabase.from('ecqm_aggregate_results').upsert({
      tenant_id: tenantId,
      measure_id: measureId,
      reporting_period_start: reportingPeriodStart,
      reporting_period_end: reportingPeriodEnd,
      initial_population_count: aggregate.initialPopulationCount,
      denominator_count: aggregate.denominatorCount,
      denominator_exclusion_count: aggregate.denominatorExclusionCount,
      denominator_exception_count: aggregate.denominatorExceptionCount,
      numerator_count: aggregate.numeratorCount,
      numerator_exclusion_count: aggregate.numeratorExclusionCount,
      performance_rate: aggregate.performanceRate,
      patient_count: aggregate.patientCount
    }, {
      onConflict: 'tenant_id,measure_id,reporting_period_start'
    });

    return success(aggregate);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_AGGREGATE_CALCULATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, measureId }
    );
    return failure('OPERATION_FAILED', 'Failed to calculate aggregates');
  }
}

/**
 * Get aggregate results for a tenant
 */
export async function getAggregateResults(
  tenantId: string,
  reportingPeriodStart: Date
): Promise<ServiceResult<AggregateResult[]>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_aggregate_results')
      .select('measure_id, initial_population_count, denominator_count, denominator_exclusion_count, denominator_exception_count, numerator_count, numerator_exclusion_count, performance_rate, patient_count')
      .eq('tenant_id', tenantId)
      .eq('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0])
      .order('measure_id');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const aggregates: AggregateResult[] = ((data || []) as AggregateResultRow[]).map((d: AggregateResultRow) => ({
      measureId: d.measure_id,
      initialPopulationCount: d.initial_population_count,
      denominatorCount: d.denominator_count,
      denominatorExclusionCount: d.denominator_exclusion_count,
      denominatorExceptionCount: d.denominator_exception_count,
      numeratorCount: d.numerator_count,
      numeratorExclusionCount: d.numerator_exclusion_count,
      performanceRate: d.performance_rate,
      patientCount: d.patient_count
    }));

    return success(aggregates);
  } catch (err: unknown) {
    await auditLogger.error(
      'ECQM_AGGREGATES_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch aggregate results');
  }
}
