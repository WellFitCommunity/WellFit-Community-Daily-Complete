/**
 * HEDIS Types — Healthcare Effectiveness Data and Information Set
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 */

import type { MeasureDefinition, AggregateResult } from '../calculation/types';

export interface HedisMeasure extends MeasureDefinition {
  hedis_measure_id: string | null;
  hedis_subdomain: string | null;
  program_types: string[];
  is_inverse_measure: boolean;
  data_source: string;
}

export interface HedisDomainGroup {
  domain: string;
  measures: HedisMeasureWithResults[];
  averagePerformance: number | null;
  measureCount: number;
}

export interface HedisMeasureWithResults {
  measure: HedisMeasure;
  results: AggregateResult | undefined;
  benchmark: number | null;
  gap: number | null;
}

export interface HedisSummary {
  totalMeasures: number;
  measuresWithData: number;
  averagePerformance: number | null;
  domains: HedisDomainGroup[];
  reportingYear: number;
}
