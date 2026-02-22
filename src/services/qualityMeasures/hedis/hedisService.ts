/**
 * HEDIS Service — Healthcare Effectiveness Data and Information Set
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 *
 * Filters existing eCQM measures by program_types to provide HEDIS-specific
 * views including domain grouping and benchmark comparison.
 * Reuses ecqm_aggregate_results — no separate results table needed.
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { AggregateResult } from '../calculation/types';
import type {
  HedisMeasure,
  HedisDomainGroup,
  HedisMeasureWithResults,
  HedisSummary,
} from './hedisTypes';

/** NCQA benchmark defaults (national 90th percentile approximations) */
const HEDIS_BENCHMARKS: Record<string, number> = {
  CDC: 0.15,   // HbA1c poor control — inverse, lower is better
  CBP: 0.82,   // Controlling BP
  PNU: 0.88,   // Pneumococcal
  FVO: 0.78,   // Flu vaccine
  COL: 0.80,   // Colorectal screening
  BCS: 0.83,   // Breast cancer screening
};

/**
 * Get all active HEDIS measures from ecqm_measure_definitions
 */
export async function getHedisMeasures(): Promise<ServiceResult<HedisMeasure[]>> {
  try {
    const { data, error } = await supabase
      .from('ecqm_measure_definitions')
      .select('id, measure_id, cms_id, version, title, description, measure_type, measure_scoring, initial_population_description, denominator_description, numerator_description, reporting_year, applicable_settings, clinical_focus, is_active, program_types, hedis_measure_id, hedis_subdomain, is_inverse_measure')
      .eq('is_active', true)
      .contains('program_types', ['hedis'])
      .order('hedis_subdomain', { ascending: true });

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success((data || []) as HedisMeasure[]);
  } catch (err: unknown) {
    await auditLogger.error(
      'HEDIS_MEASURES_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure('FETCH_FAILED', 'Failed to fetch HEDIS measures');
  }
}

/**
 * Get HEDIS measures grouped by subdomain with aggregate results
 */
export async function getHedisSummary(
  tenantId: string,
  reportingPeriodStart: Date,
  reportingYear: number
): Promise<ServiceResult<HedisSummary>> {
  try {
    const measuresResult = await getHedisMeasures();
    if (!measuresResult.success || !measuresResult.data) {
      return failure('FETCH_FAILED', 'Failed to load HEDIS measures');
    }

    const measures = measuresResult.data;

    // Fetch aggregate results for these measures
    const measureIds = measures.map(m => m.measure_id);
    const { data: aggData, error: aggError } = await supabase
      .from('ecqm_aggregate_results')
      .select('measure_id, initial_population_count, denominator_count, denominator_exclusion_count, denominator_exception_count, numerator_count, numerator_exclusion_count, performance_rate, patient_count')
      .eq('tenant_id', tenantId)
      .gte('reporting_period_start', reportingPeriodStart.toISOString().split('T')[0])
      .in('measure_id', measureIds);

    if (aggError) {
      return failure('DATABASE_ERROR', aggError.message);
    }

    const aggregates: AggregateResult[] = (aggData || []).map(row => ({
      measureId: row.measure_id as string,
      initialPopulationCount: row.initial_population_count as number,
      denominatorCount: row.denominator_count as number,
      denominatorExclusionCount: row.denominator_exclusion_count as number,
      denominatorExceptionCount: row.denominator_exception_count as number,
      numeratorCount: row.numerator_count as number,
      numeratorExclusionCount: row.numerator_exclusion_count as number,
      performanceRate: row.performance_rate as number | null,
      patientCount: row.patient_count as number,
    }));

    // Build measures with results
    const measuresWithResults: HedisMeasureWithResults[] = measures.map(measure => {
      const results = aggregates.find(a => a.measureId === measure.measure_id);
      const benchmarkValue = measure.hedis_measure_id
        ? HEDIS_BENCHMARKS[measure.hedis_measure_id] ?? null
        : null;

      const gap = results?.performanceRate !== null && results?.performanceRate !== undefined && benchmarkValue !== null
        ? measure.is_inverse_measure
          ? benchmarkValue - results.performanceRate  // inverse: gap is how much over benchmark
          : results.performanceRate - benchmarkValue   // normal: gap is how much under benchmark
        : null;

      return { measure, results, benchmark: benchmarkValue, gap };
    });

    // Group by subdomain
    const domainMap = new Map<string, HedisMeasureWithResults[]>();
    for (const mwr of measuresWithResults) {
      const domain = mwr.measure.hedis_subdomain || 'Uncategorized';
      const existing = domainMap.get(domain) || [];
      existing.push(mwr);
      domainMap.set(domain, existing);
    }

    const domains: HedisDomainGroup[] = Array.from(domainMap.entries()).map(([domain, items]) => {
      const rates = items
        .filter(i => i.results?.performanceRate !== null && i.results?.performanceRate !== undefined)
        .map(i => i.results?.performanceRate as number);

      const averagePerformance = rates.length > 0
        ? rates.reduce((sum, r) => sum + r, 0) / rates.length
        : null;

      return {
        domain,
        measures: items,
        averagePerformance,
        measureCount: items.length,
      };
    });

    // Overall summary
    const allRates = measuresWithResults
      .filter(m => m.results?.performanceRate !== null && m.results?.performanceRate !== undefined)
      .map(m => m.results?.performanceRate as number);

    const summary: HedisSummary = {
      totalMeasures: measures.length,
      measuresWithData: allRates.length,
      averagePerformance: allRates.length > 0
        ? allRates.reduce((sum, r) => sum + r, 0) / allRates.length
        : null,
      domains,
      reportingYear,
    };

    await auditLogger.info('HEDIS_SUMMARY_LOADED', {
      tenantId,
      measureCount: measures.length,
      domainCount: domains.length,
    });

    return success(summary);
  } catch (err: unknown) {
    await auditLogger.error(
      'HEDIS_SUMMARY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to generate HEDIS summary');
  }
}

export const HedisService = {
  getHedisMeasures,
  getHedisSummary,
};
