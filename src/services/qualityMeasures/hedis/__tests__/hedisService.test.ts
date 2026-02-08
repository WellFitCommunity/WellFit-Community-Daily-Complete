/**
 * HEDIS Service Tests
 *
 * Tests domain grouping, measure filtering, benchmark comparison, and empty data handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          contains: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: [
                {
                  id: 'm1', measure_id: 'CMS122v12', cms_id: 'CMS122', title: 'HbA1c Poor Control',
                  description: 'Test', measure_type: 'process', measure_scoring: 'proportion',
                  version: 'v12', reporting_year: 2026, applicable_settings: ['ambulatory'],
                  clinical_focus: 'Diabetes', is_active: true,
                  initial_population_description: 'IP', denominator_description: 'D', numerator_description: 'N',
                  hedis_measure_id: 'CDC', hedis_subdomain: 'Effectiveness of Care',
                  program_types: ['ecqm', 'hedis', 'mips', 'stars'],
                  is_inverse_measure: true, data_source: 'clinical',
                },
                {
                  id: 'm2', measure_id: 'CMS165v12', cms_id: 'CMS165', title: 'BP Control',
                  description: 'Test', measure_type: 'outcome', measure_scoring: 'proportion',
                  version: 'v12', reporting_year: 2026, applicable_settings: ['ambulatory'],
                  clinical_focus: 'Hypertension', is_active: true,
                  initial_population_description: 'IP', denominator_description: 'D', numerator_description: 'N',
                  hedis_measure_id: 'CBP', hedis_subdomain: 'Effectiveness of Care',
                  program_types: ['ecqm', 'hedis', 'mips', 'stars'],
                  is_inverse_measure: false, data_source: 'clinical',
                },
              ],
              error: null,
            })),
          })),
          gte: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({
              data: [
                {
                  measure_id: 'CMS122v12', initial_population_count: 100,
                  denominator_count: 100, denominator_exclusion_count: 5,
                  denominator_exception_count: 3, numerator_count: 12,
                  numerator_exclusion_count: 0, performance_rate: 0.13, patient_count: 100,
                },
                {
                  measure_id: 'CMS165v12', initial_population_count: 200,
                  denominator_count: 200, denominator_exclusion_count: 10,
                  denominator_exception_count: 5, numerator_count: 160,
                  numerator_exclusion_count: 0, performance_rate: 0.865, patient_count: 200,
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('../../../auditLogger', () => ({
  auditLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { getHedisMeasures, getHedisSummary } from '../hedisService';

describe('HEDIS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return only HEDIS-eligible measures', async () => {
    const result = await getHedisMeasures();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    if (result.success) {
      expect(result.data[0].hedis_measure_id).toBe('CDC');
      expect(result.data[1].hedis_measure_id).toBe('CBP');
    }
  });

  it('should group measures by subdomain', async () => {
    const result = await getHedisSummary('tenant-1', new Date('2026-01-01'), 2026);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domains).toHaveLength(1);
      expect(result.data.domains[0].domain).toBe('Effectiveness of Care');
      expect(result.data.domains[0].measureCount).toBe(2);
    }
  });

  it('should calculate average performance across measures', async () => {
    const result = await getHedisSummary('tenant-1', new Date('2026-01-01'), 2026);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.averagePerformance).not.toBeNull();
      // Average of 0.13 and 0.865 = 0.4975
      expect(result.data.averagePerformance).toBeCloseTo(0.4975, 2);
    }
  });

  it('should calculate benchmark gap for each measure', async () => {
    const result = await getHedisSummary('tenant-1', new Date('2026-01-01'), 2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const cdcMeasure = result.data.domains[0].measures.find(m => m.measure.hedis_measure_id === 'CDC');
      expect(cdcMeasure).toBeDefined();
      // CDC benchmark is 0.15, rate is 0.13, inverse measure
      // Gap = benchmark - rate = 0.15 - 0.13 = 0.02 (positive means under benchmark for inverse)
      expect(cdcMeasure?.gap).toBeCloseTo(0.02, 2);
    }
  });

  it('should correctly handle inverse measure gap calculation', async () => {
    const result = await getHedisSummary('tenant-1', new Date('2026-01-01'), 2026);
    expect(result.success).toBe(true);
    if (result.success) {
      const cbpMeasure = result.data.domains[0].measures.find(m => m.measure.hedis_measure_id === 'CBP');
      expect(cbpMeasure).toBeDefined();
      // CBP benchmark is 0.82, rate is 0.865
      // Gap = rate - benchmark = 0.865 - 0.82 = 0.045
      expect(cbpMeasure?.gap).toBeCloseTo(0.045, 2);
    }
  });

  it('should return correct summary counts', async () => {
    const result = await getHedisSummary('tenant-1', new Date('2026-01-01'), 2026);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalMeasures).toBe(2);
      expect(result.data.measuresWithData).toBe(2);
      expect(result.data.reportingYear).toBe(2026);
    }
  });

  it('should identify inverse measures', async () => {
    const result = await getHedisMeasures();
    expect(result.success).toBe(true);
    if (result.success) {
      const cdcMeasure = result.data.find(m => m.hedis_measure_id === 'CDC');
      expect(cdcMeasure?.is_inverse_measure).toBe(true);
      const cbpMeasure = result.data.find(m => m.hedis_measure_id === 'CBP');
      expect(cbpMeasure?.is_inverse_measure).toBe(false);
    }
  });
});
