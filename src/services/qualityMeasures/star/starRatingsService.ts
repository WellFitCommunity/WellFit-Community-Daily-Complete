/**
 * Star Ratings Service — CMS Star Ratings (1-5)
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 *
 * Applies cut-point thresholds per measure to determine star ratings.
 * Aggregates by domain with configurable weights for overall star calculation.
 * Supports inverse measures (lower-is-better) and year-over-year trend tracking.
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { AggregateResult } from '../calculation/types';
import type {
  StarRatingScore,
  StarRatingRow,
  MeasureStarDetail,
  StarCutPoints,
  StarDomainSummary,
  CalculateStarOptions,
} from './starTypes';

/**
 * Default domain weights for Part C star ratings
 */
const DEFAULT_DOMAIN_WEIGHTS: Record<string, number> = {
  'Staying Healthy': 0.35,
  'Managing Chronic Conditions': 0.40,
  'Member Experience': 0.15,
  'Complaints and Access': 0.10,
};

/**
 * Calculate star rating for a single measure using cut points
 * Handles both normal and inverse measures
 */
export function calculateMeasureStar(
  performanceRate: number | null,
  cutPoints: StarCutPoints,
  isInverse: boolean
): number {
  if (performanceRate === null) return 0;

  if (isInverse) {
    // Inverse: lower is better. Cut points are descending.
    // e.g., {"1": 1.00, "2": 0.60, "3": 0.40, "4": 0.25, "5": 0.15}
    // Rate of 0.10 → 5 stars, rate of 0.50 → 2 stars
    if (performanceRate <= cutPoints['5']) return 5;
    if (performanceRate <= cutPoints['4']) return 4;
    if (performanceRate <= cutPoints['3']) return 3;
    if (performanceRate <= cutPoints['2']) return 2;
    return 1;
  }

  // Normal: higher is better. Cut points are ascending.
  // e.g., {"1": 0.00, "2": 0.50, "3": 0.65, "4": 0.75, "5": 0.85}
  if (performanceRate >= cutPoints['5']) return 5;
  if (performanceRate >= cutPoints['4']) return 4;
  if (performanceRate >= cutPoints['3']) return 3;
  if (performanceRate >= cutPoints['2']) return 2;
  return 1;
}

/**
 * Calculate domain-level and overall star ratings for a tenant
 */
export async function calculateStarRatings(
  options: CalculateStarOptions
): Promise<ServiceResult<StarRatingScore>> {
  try {
    const { tenantId, reportingYear, ratingType = 'part_c' } = options;

    // 1. Get star-eligible measures with cut points
    const { data: measures, error: measErr } = await supabase
      .from('ecqm_measure_definitions')
      .select('*')
      .eq('is_active', true)
      .contains('program_types', ['stars'])
      .not('star_cut_points', 'is', null);

    if (measErr) return failure('DATABASE_ERROR', measErr.message);

    if (!measures || measures.length === 0) {
      return failure('NOT_FOUND', 'No star-eligible measures configured');
    }

    // 2. Get aggregate results
    const measureIds = measures.map((m: Record<string, unknown>) => m.measure_id as string);
    const periodStart = `${reportingYear}-01-01`;

    const { data: aggData, error: aggErr } = await supabase
      .from('ecqm_aggregate_results')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('reporting_period_start', periodStart)
      .in('measure_id', measureIds);

    if (aggErr) return failure('DATABASE_ERROR', aggErr.message);

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

    // 3. Score each measure
    const measureDetails: MeasureStarDetail[] = measures.map((m: Record<string, unknown>) => {
      const agg = aggregates.find(a => a.measureId === m.measure_id);
      const cutPoints = m.star_cut_points as StarCutPoints;
      const isInverse = (m.is_inverse_measure as boolean) || false;
      const rate = agg?.performanceRate ?? null;

      return {
        measureId: m.measure_id as string,
        cmsId: m.cms_id as string,
        title: m.title as string,
        domain: (m.star_domain as string) || 'Uncategorized',
        performanceRate: rate,
        starRating: calculateMeasureStar(rate, cutPoints, isInverse),
        cutPoints,
        isInverse,
        weight: (m.star_weight as number) || 1.0,
      };
    });

    // 4. Aggregate by domain
    const domainMap = new Map<string, MeasureStarDetail[]>();
    for (const detail of measureDetails) {
      const existing = domainMap.get(detail.domain) || [];
      existing.push(detail);
      domainMap.set(detail.domain, existing);
    }

    const domainScores: Record<string, number> = {};
    const domainWeights: Record<string, number> = {};

    for (const [domain, details] of domainMap.entries()) {
      const ratedDetails = details.filter(d => d.starRating > 0);
      if (ratedDetails.length === 0) {
        domainScores[domain] = 0;
      } else {
        const weightedSum = ratedDetails.reduce(
          (sum, d) => sum + d.starRating * d.weight, 0
        );
        const totalWeight = ratedDetails.reduce((sum, d) => sum + d.weight, 0);
        domainScores[domain] = totalWeight > 0
          ? Math.round((weightedSum / totalWeight) * 10) / 10
          : 0;
      }
      domainWeights[domain] = DEFAULT_DOMAIN_WEIGHTS[domain] ?? 0.25;
    }

    // 5. Calculate overall star rating (weighted average of domain scores)
    let overallNumerator = 0;
    let overallDenominator = 0;
    for (const [domain, score] of Object.entries(domainScores)) {
      if (score > 0) {
        const weight = domainWeights[domain] ?? 0.25;
        overallNumerator += score * weight;
        overallDenominator += weight;
      }
    }

    const rawOverall = overallDenominator > 0
      ? overallNumerator / overallDenominator
      : null;

    // Round to nearest 0.5
    const overallStarRating = rawOverall !== null
      ? Math.round(rawOverall * 2) / 2
      : null;

    // 6. Get previous year for trend
    const { data: prevData } = await supabase
      .from('star_rating_scores')
      .select('overall_star_rating')
      .eq('tenant_id', tenantId)
      .eq('reporting_year', reportingYear - 1)
      .eq('rating_type', ratingType)
      .single();

    const previousYearRating = prevData?.overall_star_rating as number | null ?? null;
    let trendDirection: 'up' | 'down' | 'stable' | null = null;
    if (overallStarRating !== null && previousYearRating !== null) {
      if (overallStarRating > previousYearRating) trendDirection = 'up';
      else if (overallStarRating < previousYearRating) trendDirection = 'down';
      else trendDirection = 'stable';
    }

    // 7. Count summaries
    const totalMeasuresRated = measureDetails.filter(d => d.starRating > 0).length;
    const measuresAt4Plus = measureDetails.filter(d => d.starRating >= 4).length;
    const measuresBelow3 = measureDetails.filter(d => d.starRating > 0 && d.starRating < 3).length;

    // 8. Upsert to star_rating_scores
    const { data: saved, error: saveErr } = await supabase
      .from('star_rating_scores')
      .upsert({
        tenant_id: tenantId,
        reporting_year: reportingYear,
        rating_type: ratingType,
        domain_scores: domainScores,
        domain_weights: domainWeights,
        overall_star_rating: overallStarRating,
        measure_star_details: measureDetails,
        previous_year_rating: previousYearRating,
        trend_direction: trendDirection,
        total_measures_rated: totalMeasuresRated,
        measures_at_4_plus: measuresAt4Plus,
        measures_below_3: measuresBelow3,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,reporting_year,rating_type' })
      .select()
      .single();

    if (saveErr) return failure('DATABASE_ERROR', saveErr.message);

    const result = mapStarRow(saved as StarRatingRow);

    await auditLogger.info('STAR_RATINGS_CALCULATED', {
      tenantId,
      reportingYear,
      overallStarRating,
      totalMeasuresRated,
    });

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'STAR_RATINGS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId: options.tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to calculate star ratings');
  }
}

/**
 * Get current star ratings for a tenant/year
 */
export async function getStarRatings(
  tenantId: string,
  reportingYear: number,
  ratingType: 'part_c' | 'part_d' = 'part_c'
): Promise<ServiceResult<StarRatingScore | null>> {
  try {
    const { data, error } = await supabase
      .from('star_rating_scores')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('reporting_year', reportingYear)
      .eq('rating_type', ratingType)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data) return success(null);

    return success(mapStarRow(data as StarRatingRow));
  } catch (err: unknown) {
    await auditLogger.error(
      'STAR_RATINGS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch star ratings');
  }
}

/**
 * Get domain summaries from existing star rating data
 */
export function getDomainSummaries(score: StarRatingScore): StarDomainSummary[] {
  const domainMap = new Map<string, MeasureStarDetail[]>();

  for (const detail of score.measureStarDetails) {
    const existing = domainMap.get(detail.domain) || [];
    existing.push(detail);
    domainMap.set(detail.domain, existing);
  }

  return Array.from(domainMap.entries()).map(([domain, measures]) => ({
    domain,
    score: score.domainScores[domain] ?? 0,
    weight: score.domainWeights[domain] ?? 0,
    measureCount: measures.length,
    measures,
  }));
}

/** Map DB row to domain type */
function mapStarRow(row: StarRatingRow): StarRatingScore {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reportingYear: row.reporting_year,
    ratingType: row.rating_type,
    domainScores: row.domain_scores || {},
    domainWeights: row.domain_weights || {},
    overallStarRating: row.overall_star_rating,
    measureStarDetails: row.measure_star_details || [],
    previousYearRating: row.previous_year_rating,
    trendDirection: row.trend_direction,
    totalMeasuresRated: row.total_measures_rated,
    measuresAt4Plus: row.measures_at_4_plus,
    measuresBelow3: row.measures_below_3,
    calculatedAt: row.calculated_at,
    notes: row.notes,
  };
}

export const StarRatingsService = {
  calculateStarRatings,
  getStarRatings,
  calculateMeasureStar,
  getDomainSummaries,
};
