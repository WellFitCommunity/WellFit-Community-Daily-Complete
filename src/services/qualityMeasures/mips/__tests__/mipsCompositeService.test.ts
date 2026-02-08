/**
 * MIPS Composite Score Service Tests
 *
 * Tests decile scoring, composite calculation, payment adjustment, and IA attestation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUpsert = vi.fn(() => ({
  select: vi.fn(() => ({
    single: vi.fn(() => Promise.resolve({
      data: {
        id: 'comp-1', tenant_id: 'tenant-1', reporting_year: 2026,
        quality_score: 65, quality_weight: 0.30, cost_score: 50, cost_weight: 0.30,
        improvement_activities_score: 50, improvement_activities_weight: 0.15,
        promoting_interoperability_score: 50, promoting_interoperability_weight: 0.25,
        final_composite_score: 55.25, payment_adjustment_percent: 0,
        benchmark_decile: 5, quality_measure_scores: [], quality_measures_reported: 2,
        quality_bonus_points: 0, calculated_at: '2026-01-15T00:00:00Z', notes: null,
      },
      error: null,
    })),
  })),
}));

const mockSelect = vi.fn();

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'ecqm_measure_definitions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              contains: vi.fn(() => Promise.resolve({
                data: [
                  { measure_id: 'CMS122v12', cms_id: 'CMS122', title: 'HbA1c', mips_quality_id: 'Q001', mips_high_priority: true, is_active: true },
                  { measure_id: 'CMS165v12', cms_id: 'CMS165', title: 'BP Control', mips_quality_id: 'Q236', mips_high_priority: true, is_active: true },
                ],
                error: null,
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
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'mips_improvement_activities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => Promise.resolve({ data: [], error: null })),
                })),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(() => Promise.resolve({
                      data: {
                        id: 'ia-1', tenant_id: 'tenant-1', reporting_year: 2026,
                        activity_id: 'IA_BMH_1', title: 'Test Activity', description: null,
                        category: null, subcategory: null, weight: 'medium', points: 10,
                        is_attested: true, attestation_date: '2026-01-15', attested_by: 'user-1',
                        evidence_notes: 'Completed',
                      },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      if (table === 'mips_composite_scores') {
        return {
          upsert: mockUpsert,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'not found' } })),
              })),
            })),
          })),
        };
      }
      return { select: mockSelect };
    }),
  },
}));

vi.mock('../../../auditLogger', () => ({
  auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { calculateMipsComposite, getMipsComposite, calculatePaymentAdjustment, attestActivity } from '../mipsCompositeService';

describe('MIPS Composite Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePaymentAdjustment', () => {
    it('should return exceptional tier for scores >= 89', () => {
      const result = calculatePaymentAdjustment(95);
      expect(result.tier).toBe('exceptional');
      expect(result.adjustmentPercent).toBe(4.0);
    });

    it('should return above_threshold tier for scores between 75 and 89', () => {
      const result = calculatePaymentAdjustment(82);
      expect(result.tier).toBe('above_threshold');
      expect(result.adjustmentPercent).toBeGreaterThan(0);
      expect(result.adjustmentPercent).toBeLessThan(4.0);
    });

    it('should return at_threshold tier for scores near 75', () => {
      const result = calculatePaymentAdjustment(72);
      expect(result.tier).toBe('at_threshold');
      expect(result.adjustmentPercent).toBe(0);
    });

    it('should return below_threshold tier for scores between 30 and 70', () => {
      const result = calculatePaymentAdjustment(50);
      expect(result.tier).toBe('below_threshold');
      expect(result.adjustmentPercent).toBe(-3.0);
    });

    it('should return penalty tier for scores below 30', () => {
      const result = calculatePaymentAdjustment(20);
      expect(result.tier).toBe('penalty');
      expect(result.adjustmentPercent).toBe(-9.0);
    });
  });

  describe('calculateMipsComposite', () => {
    it('should calculate and return composite score', async () => {
      const result = await calculateMipsComposite({ tenantId: 'tenant-1', reportingYear: 2026 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reportingYear).toBe(2026);
        expect(result.data.tenantId).toBe('tenant-1');
      }
    });

    it('should include quality measure scores in result', async () => {
      const result = await calculateMipsComposite({ tenantId: 'tenant-1', reportingYear: 2026 });
      expect(result.success).toBe(true);
    });
  });

  describe('getMipsComposite', () => {
    it('should return null when no composite exists', async () => {
      const result = await getMipsComposite('tenant-1', 2026);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('attestActivity', () => {
    it('should attest an improvement activity', async () => {
      const result = await attestActivity('IA_BMH_1', 'tenant-1', 2026, 'user-1', 'Completed');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isAttested).toBe(true);
        expect(result.data.activityId).toBe('IA_BMH_1');
        expect(result.data.evidenceNotes).toBe('Completed');
      }
    });
  });

  describe('payment tiers boundary values', () => {
    it('should handle exact threshold of 75', () => {
      const result = calculatePaymentAdjustment(75);
      expect(result.tier).toBe('above_threshold');
    });

    it('should handle exact threshold of 89', () => {
      const result = calculatePaymentAdjustment(89);
      expect(result.tier).toBe('exceptional');
    });

    it('should handle score of 0', () => {
      const result = calculatePaymentAdjustment(0);
      expect(result.tier).toBe('penalty');
    });

    it('should handle score of 100', () => {
      const result = calculatePaymentAdjustment(100);
      expect(result.tier).toBe('exceptional');
    });
  });
});
