/**
 * eCQM Calculation Service Tests
 *
 * Tests for Electronic Clinical Quality Measures calculation service.
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
    })),
  },
}));

// Mock auditLogger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  getMeasureDefinitions,
  getMeasureDefinition,
  calculateAggregateResults,
  getAggregateResults,
  type MeasureDefinition,
  type AggregateResult,
} from '../ecqmCalculationService';
import { supabase } from '../../../lib/supabaseClient';

describe('ECQMCalculationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMeasureDefinitions', () => {
    it('should return active measure definitions', async () => {
      const mockMeasures: MeasureDefinition[] = [
        {
          id: '1',
          measure_id: 'CMS122v12',
          cms_id: 'CMS122',
          version: 'v12',
          title: 'Diabetes: Hemoglobin A1c Poor Control',
          description: 'Percentage of patients with diabetes with HbA1c > 9%',
          measure_type: 'process',
          measure_scoring: 'proportion',
          initial_population_description: 'Adults with diabetes',
          denominator_description: 'Initial population',
          numerator_description: 'HbA1c > 9%',
          reporting_year: 2026,
          applicable_settings: ['ambulatory'],
          clinical_focus: 'Diabetes',
          is_active: true,
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockMeasures, error: null }),
          }),
        }),
      } as never);

      const result = await getMeasureDefinitions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].measure_id).toBe('CMS122v12');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      } as never);

      const result = await getMeasureDefinitions();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });

    it('should return empty array when no measures found', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as never);

      const result = await getMeasureDefinitions();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('getMeasureDefinition', () => {
    it('should return a specific measure definition', async () => {
      const mockMeasure: MeasureDefinition = {
        id: '1',
        measure_id: 'CMS122v12',
        cms_id: 'CMS122',
        version: 'v12',
        title: 'Diabetes: Hemoglobin A1c Poor Control',
        description: 'Test',
        measure_type: 'process',
        measure_scoring: 'proportion',
        initial_population_description: 'Test',
        denominator_description: 'Test',
        numerator_description: 'Test',
        reporting_year: 2026,
        applicable_settings: ['ambulatory'],
        clinical_focus: 'Diabetes',
        is_active: true,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMeasure, error: null }),
          }),
        }),
      } as never);

      const result = await getMeasureDefinition('CMS122v12');

      expect(result.success).toBe(true);
      expect(result.data?.measure_id).toBe('CMS122v12');
    });

    it('should return failure when measure not found', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      } as never);

      const result = await getMeasureDefinition('INVALID');

      expect(result.success).toBe(false);
    });
  });

  describe('calculateAggregateResults', () => {
    it('should calculate aggregate results for a measure', async () => {
      const mockPatientResults = [
        { initial_population: true, denominator: true, denominator_exclusion: false, denominator_exception: false, numerator: true, numerator_exclusion: false },
        { initial_population: true, denominator: true, denominator_exclusion: false, denominator_exception: false, numerator: false, numerator_exclusion: false },
      ];

      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockPatientResults, error: null }),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'agg-1' }, error: null }),
            }),
          }),
        } as never);

      const result = await calculateAggregateResults(
        'tenant-123',
        'CMS122v12',
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(result.success).toBe(true);
      expect(result.data?.measureId).toBe('CMS122v12');
    });

    it('should handle database errors', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      } as never);

      const result = await calculateAggregateResults(
        'tenant-123',
        'CMS122v12',
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DATABASE_ERROR');
    });
  });

  describe('getAggregateResults', () => {
    it('should return aggregate results for tenant and period', async () => {
      const mockAggregates = [
        {
          measure_id: 'CMS122v12',
          initial_population_count: 100,
          denominator_count: 100,
          denominator_exclusion_count: 5,
          denominator_exception_count: 0,
          numerator_count: 85,
          numerator_exclusion_count: 0,
          performance_rate: 0.8947,
          patient_count: 100,
        },
      ];

      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockAggregates, error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getAggregateResults('tenant-123', new Date('2026-01-01'));

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].performanceRate).toBe(0.8947);
    });

    it('should handle no results found', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      } as never);

      const result = await getAggregateResults('tenant-123', new Date('2026-01-01'));

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('Performance Rate Calculation Logic', () => {
    it('should calculate correct performance rate excluding exclusions', async () => {
      // 3 in denominator, 1 exclusion, 2 in numerator = 2/(3-1) = 100%
      const mockPatientResults = [
        { initial_population: true, denominator: true, denominator_exclusion: false, denominator_exception: false, numerator: true, numerator_exclusion: false },
        { initial_population: true, denominator: true, denominator_exclusion: false, denominator_exception: false, numerator: true, numerator_exclusion: false },
        { initial_population: true, denominator: true, denominator_exclusion: true, denominator_exception: false, numerator: false, numerator_exclusion: false },
      ];

      vi.mocked(supabase.from)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockPatientResults, error: null }),
              }),
            }),
          }),
        } as never)
        .mockReturnValueOnce({
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'agg-1' }, error: null }),
            }),
          }),
        } as never);

      const result = await calculateAggregateResults(
        'tenant-123',
        'CMS122v12',
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(result.success).toBe(true);
      expect(result.data?.numeratorCount).toBe(2);
      expect(result.data?.denominatorExclusionCount).toBe(1);
      expect(result.data?.performanceRate).toBe(1); // 2/(3-1) = 1.0
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockRejectedValue(new Error('Network timeout')),
          }),
        }),
      } as never);

      const result = await getMeasureDefinitions();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FETCH_FAILED');
    });
  });
});
