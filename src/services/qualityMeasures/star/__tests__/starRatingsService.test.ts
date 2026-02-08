/**
 * Star Ratings Service Tests
 *
 * Tests cut-point application, inverse measures, domain scoring, and trend detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'ecqm_measure_definitions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              contains: vi.fn(() => ({
                not: vi.fn(() => Promise.resolve({
                  data: [
                    {
                      measure_id: 'CMS122v12', cms_id: 'CMS122', title: 'HbA1c',
                      star_domain: 'Managing Chronic Conditions', star_weight: 1.0,
                      star_cut_points: { '1': 1.00, '2': 0.60, '3': 0.40, '4': 0.25, '5': 0.15 },
                      is_inverse_measure: true, is_active: true,
                      program_types: ['stars'],
                    },
                    {
                      measure_id: 'CMS165v12', cms_id: 'CMS165', title: 'BP Control',
                      star_domain: 'Managing Chronic Conditions', star_weight: 1.0,
                      star_cut_points: { '1': 0.00, '2': 0.50, '3': 0.65, '4': 0.75, '5': 0.85 },
                      is_inverse_measure: false, is_active: true,
                      program_types: ['stars'],
                    },
                    {
                      measure_id: 'CMS130v12', cms_id: 'CMS130', title: 'Colorectal Screening',
                      star_domain: 'Staying Healthy', star_weight: 1.0,
                      star_cut_points: { '1': 0.00, '2': 0.45, '3': 0.60, '4': 0.72, '5': 0.82 },
                      is_inverse_measure: false, is_active: true,
                      program_types: ['stars'],
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'ecqm_aggregate_results') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                in: vi.fn(() => Promise.resolve({
                  data: [
                    { measure_id: 'CMS122v12', initial_population_count: 100, denominator_count: 100, denominator_exclusion_count: 5, denominator_exception_count: 3, numerator_count: 12, numerator_exclusion_count: 0, performance_rate: 0.13, patient_count: 100 },
                    { measure_id: 'CMS165v12', initial_population_count: 200, denominator_count: 200, denominator_exclusion_count: 10, denominator_exception_count: 5, numerator_count: 160, numerator_exclusion_count: 0, performance_rate: 0.865, patient_count: 200 },
                    { measure_id: 'CMS130v12', initial_population_count: 150, denominator_count: 150, denominator_exclusion_count: 8, denominator_exception_count: 2, numerator_count: 110, numerator_exclusion_count: 0, performance_rate: 0.786, patient_count: 150 },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'star_rating_scores') {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({
                data: {
                  id: 'star-1', tenant_id: 'tenant-1', reporting_year: 2026,
                  rating_type: 'part_c',
                  domain_scores: { 'Managing Chronic Conditions': 4.5, 'Staying Healthy': 4.0 },
                  domain_weights: { 'Managing Chronic Conditions': 0.40, 'Staying Healthy': 0.35 },
                  overall_star_rating: 4.5, measure_star_details: [],
                  previous_year_rating: 4.0, trend_direction: 'up',
                  total_measures_rated: 3, measures_at_4_plus: 2, measures_below_3: 0,
                  calculated_at: '2026-01-15T00:00:00Z', calculated_by: null, notes: null,
                },
                error: null,
              })),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({
                    data: {
                      id: 'star-prev', overall_star_rating: 4.0,
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          })),
        };
      }
      return { select: vi.fn() };
    }),
  },
}));

vi.mock('../../../auditLogger', () => ({
  auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { calculateMeasureStar, calculateStarRatings, getDomainSummaries } from '../starRatingsService';
import type { StarRatingScore } from '../starTypes';

describe('Star Ratings Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateMeasureStar — normal measures', () => {
    const normalCutPoints = { '1': 0, '2': 0.50, '3': 0.65, '4': 0.75, '5': 0.85 };

    it('should return 5 stars for rates >= cut point 5', () => {
      expect(calculateMeasureStar(0.90, normalCutPoints, false)).toBe(5);
    });

    it('should return 4 stars for rates between cut point 4 and 5', () => {
      expect(calculateMeasureStar(0.80, normalCutPoints, false)).toBe(4);
    });

    it('should return 3 stars for rates between cut point 3 and 4', () => {
      expect(calculateMeasureStar(0.70, normalCutPoints, false)).toBe(3);
    });

    it('should return 2 stars for rates between cut point 2 and 3', () => {
      expect(calculateMeasureStar(0.55, normalCutPoints, false)).toBe(2);
    });

    it('should return 1 star for rates below cut point 2', () => {
      expect(calculateMeasureStar(0.30, normalCutPoints, false)).toBe(1);
    });

    it('should return 0 for null performance rate', () => {
      expect(calculateMeasureStar(null, normalCutPoints, false)).toBe(0);
    });
  });

  describe('calculateMeasureStar — inverse measures', () => {
    const inverseCutPoints = { '1': 1.00, '2': 0.60, '3': 0.40, '4': 0.25, '5': 0.15 };

    it('should return 5 stars when rate is very low (below cut point 5)', () => {
      expect(calculateMeasureStar(0.10, inverseCutPoints, true)).toBe(5);
    });

    it('should return 4 stars for rates between cut point 5 and 4', () => {
      expect(calculateMeasureStar(0.20, inverseCutPoints, true)).toBe(4);
    });

    it('should return 3 stars for rates between cut point 4 and 3', () => {
      expect(calculateMeasureStar(0.35, inverseCutPoints, true)).toBe(3);
    });

    it('should return 2 stars for rates between cut point 3 and 2', () => {
      expect(calculateMeasureStar(0.50, inverseCutPoints, true)).toBe(2);
    });

    it('should return 1 star for very high rates (above cut point 2)', () => {
      expect(calculateMeasureStar(0.80, inverseCutPoints, true)).toBe(1);
    });
  });

  describe('calculateStarRatings', () => {
    it('should calculate and return star rating score', async () => {
      const result = await calculateStarRatings({ tenantId: 'tenant-1', reportingYear: 2026 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reportingYear).toBe(2026);
        expect(result.data.ratingType).toBe('part_c');
        expect(result.data.overallStarRating).toBe(4.5);
      }
    });

    it('should detect upward trend when current rating exceeds previous', async () => {
      const result = await calculateStarRatings({ tenantId: 'tenant-1', reportingYear: 2026 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trendDirection).toBe('up');
      }
    });
  });

  describe('getDomainSummaries', () => {
    it('should group measures into correct domains', () => {
      const mockScore: StarRatingScore = {
        id: 'test', tenantId: 'tenant-1', reportingYear: 2026, ratingType: 'part_c',
        domainScores: { 'Managing Chronic Conditions': 4.5, 'Staying Healthy': 4.0 },
        domainWeights: { 'Managing Chronic Conditions': 0.40, 'Staying Healthy': 0.35 },
        overallStarRating: 4.5,
        measureStarDetails: [
          { measureId: 'CMS122v12', cmsId: 'CMS122', title: 'HbA1c', domain: 'Managing Chronic Conditions', performanceRate: 0.13, starRating: 5, cutPoints: { '1': 1, '2': 0.6, '3': 0.4, '4': 0.25, '5': 0.15 }, isInverse: true, weight: 1 },
          { measureId: 'CMS165v12', cmsId: 'CMS165', title: 'BP', domain: 'Managing Chronic Conditions', performanceRate: 0.865, starRating: 5, cutPoints: { '1': 0, '2': 0.5, '3': 0.65, '4': 0.75, '5': 0.85 }, isInverse: false, weight: 1 },
          { measureId: 'CMS130v12', cmsId: 'CMS130', title: 'Colorectal', domain: 'Staying Healthy', performanceRate: 0.786, starRating: 4, cutPoints: { '1': 0, '2': 0.45, '3': 0.6, '4': 0.72, '5': 0.82 }, isInverse: false, weight: 1 },
        ],
        previousYearRating: 4.0, trendDirection: 'up',
        totalMeasuresRated: 3, measuresAt4Plus: 2, measuresBelow3: 0,
        calculatedAt: '2026-01-15', notes: null,
      };

      const summaries = getDomainSummaries(mockScore);
      expect(summaries).toHaveLength(2);

      const chronic = summaries.find(d => d.domain === 'Managing Chronic Conditions');
      expect(chronic?.measureCount).toBe(2);
      expect(chronic?.score).toBe(4.5);

      const healthy = summaries.find(d => d.domain === 'Staying Healthy');
      expect(healthy?.measureCount).toBe(1);
      expect(healthy?.score).toBe(4.0);
    });
  });
});
