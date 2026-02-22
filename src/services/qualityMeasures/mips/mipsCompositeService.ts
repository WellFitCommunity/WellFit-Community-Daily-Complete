/**
 * MIPS Composite Score Service — Merit-based Incentive Payment System
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 *
 * Calculates 4-category MIPS composite scores:
 *   Quality (30%) + Cost (30%) + Improvement Activities (15%) + Promoting Interoperability (25%)
 * Stores results in mips_composite_scores table.
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { AggregateResult } from '../calculation/types';
import type {
  MipsCompositeScore,
  MipsCompositeRow,
  MipsQualityMeasureScore,
  MipsImprovementActivity,
  MipsImprovementActivityRow,
  MipsPaymentAdjustment,
  CalculateMipsOptions,
} from './mipsTypes';

/** MIPS performance threshold for 2026 */
const PERFORMANCE_THRESHOLD = 75;

/** Benchmark decile boundaries (national) */
const DECILE_BOUNDARIES = [15, 25, 35, 45, 55, 65, 75, 85, 92];

/**
 * Calculate benchmark decile from a performance rate (0-1 scale)
 */
function calculateDecile(rate: number | null): number | null {
  if (rate === null) return null;
  const pctRate = rate * 100;
  for (let i = DECILE_BOUNDARIES.length - 1; i >= 0; i--) {
    if (pctRate >= DECILE_BOUNDARIES[i]) return i + 2;
  }
  return 1;
}

/**
 * Convert decile to quality points (max 10 per measure)
 */
function decileToPoints(decile: number | null, isHighPriority: boolean): number {
  if (decile === null) return 0;
  const base = Math.min(decile, 10);
  const bonus = isHighPriority ? 2 : 0;
  return Math.min(base + bonus, 10);
}

/**
 * Calculate MIPS payment adjustment from composite score
 */
export function calculatePaymentAdjustment(compositeScore: number): MipsPaymentAdjustment {
  if (compositeScore >= 89) {
    return { compositeScore, adjustmentPercent: 4.0, tier: 'exceptional' };
  }
  if (compositeScore >= PERFORMANCE_THRESHOLD) {
    const pct = ((compositeScore - PERFORMANCE_THRESHOLD) / (89 - PERFORMANCE_THRESHOLD)) * 4.0;
    return { compositeScore, adjustmentPercent: Math.round(pct * 100) / 100, tier: 'above_threshold' };
  }
  if (compositeScore >= PERFORMANCE_THRESHOLD - 5) {
    return { compositeScore, adjustmentPercent: 0, tier: 'at_threshold' };
  }
  if (compositeScore >= 30) {
    return { compositeScore, adjustmentPercent: -3.0, tier: 'below_threshold' };
  }
  return { compositeScore, adjustmentPercent: -9.0, tier: 'penalty' };
}

/**
 * Calculate MIPS quality category score from aggregate results
 */
export async function calculateMipsComposite(
  options: CalculateMipsOptions
): Promise<ServiceResult<MipsCompositeScore>> {
  try {
    const { tenantId, reportingYear } = options;

    // 1. Get MIPS-eligible measures
    const { data: measures, error: measErr } = await supabase
      .from('ecqm_measure_definitions')
      .select('id, measure_id, cms_id, version, title, description, measure_type, measure_scoring, initial_population_description, denominator_description, numerator_description, reporting_year, applicable_settings, clinical_focus, is_active, program_types, mips_quality_id, mips_high_priority, is_inverse_measure')
      .eq('is_active', true)
      .contains('program_types', ['mips']);

    if (measErr) return failure('DATABASE_ERROR', measErr.message);

    // 2. Get aggregate results
    const measureIds = (measures || []).map((m: Record<string, unknown>) => m.measure_id as string);
    const periodStart = `${reportingYear}-01-01`;

    const { data: aggData, error: aggErr } = await supabase
      .from('ecqm_aggregate_results')
      .select('measure_id, initial_population_count, denominator_count, denominator_exclusion_count, denominator_exception_count, numerator_count, numerator_exclusion_count, performance_rate, patient_count')
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

    // 3. Score each quality measure
    const qualityMeasureScores: MipsQualityMeasureScore[] = (measures || []).map((m: Record<string, unknown>) => {
      const agg = aggregates.find(a => a.measureId === m.measure_id);
      const isHighPriority = (m.mips_high_priority as boolean) || false;
      const rate = agg?.performanceRate ?? null;
      const decile = calculateDecile(rate);
      const points = decileToPoints(decile, isHighPriority);

      return {
        measureId: m.measure_id as string,
        cmsId: m.cms_id as string,
        title: m.title as string,
        performanceRate: rate,
        benchmarkDecile: decile,
        points,
        maxPoints: 10,
        isHighPriority,
        isBonus: false,
      };
    });

    const totalPoints = qualityMeasureScores.reduce((sum, s) => sum + s.points, 0);
    const maxPoints = qualityMeasureScores.length * 10;
    const qualityScore = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 0;

    // 4. Calculate IA score from attested activities
    const { data: iaData } = await supabase
      .from('mips_improvement_activities')
      .select('id, tenant_id, reporting_year, activity_id, title, description, category, subcategory, weight, points, is_attested, attestation_date, attested_by, evidence_notes')
      .eq('tenant_id', tenantId)
      .eq('reporting_year', reportingYear)
      .eq('is_attested', true);

    const iaPoints = (iaData || []).reduce(
      (sum: number, ia: Record<string, unknown>) => sum + (ia.points as number || 0),
      0
    );
    const iaScore = Math.min((iaPoints / 40) * 100, 100); // 40 points = 100%

    // 5. Weighted composite (cost + PI are external — default to 50 for now)
    const qualityWeight = 0.30;
    const costWeight = 0.30;
    const iaWeight = 0.15;
    const piWeight = 0.25;

    const costScore = 50;   // Placeholder — requires claims data
    const piScore = 50;     // Placeholder — requires PI attestation

    const finalComposite = Math.round(
      (qualityScore * qualityWeight) +
      (costScore * costWeight) +
      (iaScore * iaWeight) +
      (piScore * piWeight)
    * 100) / 100;

    const adjustment = calculatePaymentAdjustment(finalComposite);

    // 6. Upsert to mips_composite_scores
    const { data: saved, error: saveErr } = await supabase
      .from('mips_composite_scores')
      .upsert({
        tenant_id: tenantId,
        reporting_year: reportingYear,
        quality_score: qualityScore,
        quality_weight: qualityWeight,
        cost_score: costScore,
        cost_weight: costWeight,
        improvement_activities_score: iaScore,
        improvement_activities_weight: iaWeight,
        promoting_interoperability_score: piScore,
        promoting_interoperability_weight: piWeight,
        final_composite_score: finalComposite,
        payment_adjustment_percent: adjustment.adjustmentPercent,
        benchmark_decile: calculateDecile(finalComposite / 100),
        quality_measure_scores: qualityMeasureScores,
        quality_measures_reported: qualityMeasureScores.length,
        quality_bonus_points: 0,
        calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,reporting_year' })
      .select()
      .single();

    if (saveErr) return failure('DATABASE_ERROR', saveErr.message);

    const result = mapCompositeRow(saved as MipsCompositeRow);

    await auditLogger.info('MIPS_COMPOSITE_CALCULATED', {
      tenantId,
      reportingYear,
      finalComposite,
      adjustmentPercent: adjustment.adjustmentPercent,
    });

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'MIPS_COMPOSITE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId: options.tenantId }
    );
    return failure('OPERATION_FAILED', 'Failed to calculate MIPS composite score');
  }
}

/**
 * Get the current MIPS composite score for a tenant/year
 */
export async function getMipsComposite(
  tenantId: string,
  reportingYear: number
): Promise<ServiceResult<MipsCompositeScore | null>> {
  try {
    const { data, error } = await supabase
      .from('mips_composite_scores')
      .select('id, tenant_id, reporting_year, quality_score, quality_weight, cost_score, cost_weight, improvement_activities_score, improvement_activities_weight, promoting_interoperability_score, promoting_interoperability_weight, final_composite_score, payment_adjustment_percent, benchmark_decile, quality_measure_scores, quality_measures_reported, quality_bonus_points, calculated_at, calculated_by, notes')
      .eq('tenant_id', tenantId)
      .eq('reporting_year', reportingYear)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data) return success(null);

    return success(mapCompositeRow(data as MipsCompositeRow));
  } catch (err: unknown) {
    await auditLogger.error(
      'MIPS_COMPOSITE_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch MIPS composite score');
  }
}

/**
 * Get improvement activities for a tenant/year
 */
export async function getImprovementActivities(
  tenantId: string,
  reportingYear: number
): Promise<ServiceResult<MipsImprovementActivity[]>> {
  try {
    const { data, error } = await supabase
      .from('mips_improvement_activities')
      .select('id, tenant_id, reporting_year, activity_id, title, description, category, subcategory, weight, points, is_attested, attestation_date, attested_by, evidence_notes')
      .eq('tenant_id', tenantId)
      .eq('reporting_year', reportingYear)
      .order('activity_id');

    if (error) return failure('DATABASE_ERROR', error.message);

    return success((data || []).map(mapIARow));
  } catch (err: unknown) {
    await auditLogger.error(
      'MIPS_IA_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch improvement activities');
  }
}

/**
 * Attest to an improvement activity
 */
export async function attestActivity(
  activityId: string,
  tenantId: string,
  reportingYear: number,
  attestedBy: string,
  evidenceNotes?: string
): Promise<ServiceResult<MipsImprovementActivity>> {
  try {
    const { data, error } = await supabase
      .from('mips_improvement_activities')
      .update({
        is_attested: true,
        attestation_date: new Date().toISOString().split('T')[0],
        attested_by: attestedBy,
        evidence_notes: evidenceNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('reporting_year', reportingYear)
      .eq('activity_id', activityId)
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message);

    await auditLogger.info('MIPS_IA_ATTESTED', {
      tenantId, activityId, reportingYear, attestedBy,
    });

    return success(mapIARow(data as MipsImprovementActivityRow));
  } catch (err: unknown) {
    await auditLogger.error(
      'MIPS_IA_ATTEST_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, activityId }
    );
    return failure('UPDATE_FAILED', 'Failed to attest improvement activity');
  }
}

/** Map DB row to domain type */
function mapCompositeRow(row: MipsCompositeRow): MipsCompositeScore {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reportingYear: row.reporting_year,
    qualityScore: row.quality_score,
    qualityWeight: row.quality_weight,
    costScore: row.cost_score,
    costWeight: row.cost_weight,
    improvementActivitiesScore: row.improvement_activities_score,
    improvementActivitiesWeight: row.improvement_activities_weight,
    promotingInteroperabilityScore: row.promoting_interoperability_score,
    promotingInteroperabilityWeight: row.promoting_interoperability_weight,
    finalCompositeScore: row.final_composite_score,
    paymentAdjustmentPercent: row.payment_adjustment_percent,
    benchmarkDecile: row.benchmark_decile,
    qualityMeasureScores: row.quality_measure_scores || [],
    qualityMeasuresReported: row.quality_measures_reported,
    qualityBonusPoints: row.quality_bonus_points,
    calculatedAt: row.calculated_at,
    notes: row.notes,
  };
}

/** Map IA DB row to domain type */
function mapIARow(row: MipsImprovementActivityRow): MipsImprovementActivity {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reportingYear: row.reporting_year,
    activityId: row.activity_id,
    title: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    weight: row.weight,
    points: row.points,
    isAttested: row.is_attested,
    attestationDate: row.attestation_date,
    attestedBy: row.attested_by,
    evidenceNotes: row.evidence_notes,
  };
}

export const MipsCompositeService = {
  calculateMipsComposite,
  getMipsComposite,
  getImprovementActivities,
  attestActivity,
  calculatePaymentAdjustment,
};
