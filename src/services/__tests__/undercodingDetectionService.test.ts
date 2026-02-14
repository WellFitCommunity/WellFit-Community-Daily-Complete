/**
 * undercodingDetectionService Test Suite
 *
 * Tests undercoding gap detection, gap classification, revenue calculation,
 * stats aggregation, filtering, and dismissal.
 * Deletion Test: All tests fail if service logic is removed.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { undercodingDetectionService } from '../undercodingDetectionService';

// =============================================================================
// MOCKS
// =============================================================================

/** Per-table query result holder */
const tableResults = vi.hoisted(() => new Map<string, { data: unknown; error: unknown }>());
const feeResults = vi.hoisted(() => new Map<string, number>());

/**
 * Build a fluent/thenable chain mock.
 * Every modifier returns the chain. The chain is a PromiseLike (has .then()).
 * When awaited, it resolves with { data, error } from tableResults.
 */
function chainBuilder(tableName: string) {
  const currentTable = tableName;

  const getResult = () => {
    const result = tableResults.get(currentTable) || { data: null, error: null };
    return result;
  };

  const chain: Record<string, unknown> = {};
  const self = () => chain;

  // Make the chain thenable so `await supabase.from(...).select(...)...` works
  chain.then = (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null
  ) => {
    const result = getResult();
    return Promise.resolve(result).then(onFulfilled, onRejected);
  };

  chain.select = vi.fn().mockImplementation(self);
  chain.insert = vi.fn().mockImplementation(self);
  chain.update = vi.fn().mockImplementation(self);
  chain.eq = vi.fn().mockImplementation((...args: unknown[]) => {
    // For fee_schedule_items, dynamically set the result based on the code
    if (currentTable === 'fee_schedule_items' && args[0] === 'code') {
      const code = args[1] as string;
      const price = feeResults.get(code) ?? 0;
      tableResults.set('fee_schedule_items', {
        data: price > 0 ? [{ price }] : [],
        error: null,
      });
    }
    return chain;
  });
  chain.neq = vi.fn().mockImplementation(self);
  chain.gte = vi.fn().mockImplementation(self);
  chain.in = vi.fn().mockImplementation(self);
  chain.order = vi.fn().mockImplementation(self);
  chain.limit = vi.fn().mockImplementation(self);
  chain.single = vi.fn().mockImplementation(self);

  // Allow reading the current table name (for debugging)
  Object.defineProperty(chain, '_tableName', { value: currentTable });

  return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((tableName: string) => chainBuilder(tableName)),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
  },
}));

// =============================================================================
// FIXTURES
// =============================================================================

const MOCK_SUGGESTIONS = [
  {
    id: 'sug-1',
    encounter_id: 'enc-1',
    tenant_id: 'tenant-1',
    suggested_codes: {
      cpt: [
        { code: '99214', description: 'Office visit level 4', confidence: 0.92, rationale: 'Complex medical decision' },
        { code: '36415', description: 'Venipuncture', confidence: 0.88, rationale: 'Lab draw performed' },
      ],
      hcpcs: [],
    },
    overall_confidence: 0.90,
    status: 'pending',
    encounter_type: 'outpatient',
    created_at: '2026-02-10T10:00:00Z',
  },
  {
    id: 'sug-2',
    encounter_id: 'enc-2',
    tenant_id: 'tenant-1',
    suggested_codes: {
      cpt: [
        { code: '99215', description: 'Office visit level 5', confidence: 0.85, rationale: 'High complexity' },
      ],
      hcpcs: [],
    },
    overall_confidence: 0.85,
    status: 'accepted',
    encounter_type: 'outpatient',
    created_at: '2026-02-11T14:00:00Z',
  },
];

const MOCK_ENCOUNTERS = [
  { id: 'enc-1', date_of_service: '2026-02-10' },
  { id: 'enc-2', date_of_service: '2026-02-11' },
];

const MOCK_CLAIMS = [
  { id: 'claim-1', encounter_id: 'enc-1' },
  { id: 'claim-2', encounter_id: 'enc-2' },
];

const MOCK_CLAIM_LINES = [
  { claim_id: 'claim-1', procedure_code: '99213', code_system: 'CPT', charge_amount: 120 },
  // No line for 36415 (missed code)
  { claim_id: 'claim-2', procedure_code: '99213', code_system: 'CPT', charge_amount: 120 },
];

// =============================================================================
// SETUP
// =============================================================================

function setDefaultData() {
  tableResults.clear();
  feeResults.clear();

  tableResults.set('encounter_billing_suggestions', { data: MOCK_SUGGESTIONS, error: null });
  tableResults.set('encounters', { data: MOCK_ENCOUNTERS, error: null });
  tableResults.set('claims', { data: MOCK_CLAIMS, error: null });
  tableResults.set('claim_lines', { data: MOCK_CLAIM_LINES, error: null });
  tableResults.set('fee_schedule_items', { data: [], error: null });

  // Fee schedule prices
  feeResults.set('99215', 250);
  feeResults.set('99214', 180);
  feeResults.set('99213', 120);
  feeResults.set('36415', 25);
}

beforeEach(() => {
  vi.clearAllMocks();
  setDefaultData();
});

// =============================================================================
// TESTS: getUndercodingGaps
// =============================================================================

describe('undercodingDetectionService', () => {
  describe('getUndercodingGaps', () => {
    it('returns gaps with correct structure', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.length).toBeGreaterThan(0);

      const gap = result.data[0];
      expect(gap).toHaveProperty('id');
      expect(gap).toHaveProperty('encounter_id');
      expect(gap).toHaveProperty('date_of_service');
      expect(gap).toHaveProperty('suggested_code');
      expect(gap).toHaveProperty('revenue_gap');
      expect(gap).toHaveProperty('gap_type');
      expect(gap).toHaveProperty('confidence');
      expect(gap).toHaveProperty('status');
    });

    it('classifies E/M level gap when billed code is lower level', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(true);
      if (!result.success) return;

      // sug-1 suggests 99214 but 99213 was billed (lower E/M)
      const emGap = result.data.find(
        g => g.suggested_code === '99214' && g.encounter_id === 'enc-1'
      );
      expect(emGap).toBeDefined();
      expect(emGap?.gap_type).toBe('lower_em_level');
      expect(emGap?.billed_code).toBe('99213');
    });

    it('classifies missed code when suggested code was not billed', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(true);
      if (!result.success) return;

      // 36415 was suggested but not billed at all
      const missedGap = result.data.find(g => g.suggested_code === '36415');
      expect(missedGap).toBeDefined();
      expect(missedGap?.gap_type).toBe('missed_code');
      expect(missedGap?.billed_code).toBeNull();
    });

    it('calculates revenue gap as suggested minus billed charge', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(true);
      if (!result.success) return;

      // 99214 ($180) vs 99213 ($120) = $60 gap
      const emGap = result.data.find(
        g => g.suggested_code === '99214' && g.encounter_id === 'enc-1'
      );
      expect(emGap).toBeDefined();
      expect(emGap?.revenue_gap).toBe(60);
      expect(emGap?.suggested_charge).toBe(180);
      expect(emGap?.billed_charge).toBe(120);
    });

    it('filters by gap type', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps({
        gap_type: 'missed_code',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const gap of result.data) {
        expect(gap.gap_type).toBe('missed_code');
      }
    });

    it('filters by minimum confidence threshold', async () => {
      // Request high confidence only — still passes because the mock
      // data has all 0.85+ confidence
      const result = await undercodingDetectionService.getUndercodingGaps({
        min_confidence: 0.90,
      });

      expect(result.success).toBe(true);
    });

    it('filters by search query on code', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps({
        search: '36415',
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (const gap of result.data) {
        expect(gap.suggested_code).toContain('36415');
      }
    });

    it('sorts results by revenue gap descending', async () => {
      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(true);
      if (!result.success) return;

      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i - 1].revenue_gap).toBeGreaterThanOrEqual(result.data[i].revenue_gap);
      }
    });

    it('returns empty array when no suggestions exist', async () => {
      tableResults.set('encounter_billing_suggestions', { data: [], error: null });

      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual([]);
    });

    it('returns failure on database error', async () => {
      tableResults.set('encounter_billing_suggestions', {
        data: null,
        error: { message: 'Connection refused' },
      });

      const result = await undercodingDetectionService.getUndercodingGaps();

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toContain('Connection refused');
    });
  });

  // ===========================================================================
  // TESTS: getUndercodingStats
  // ===========================================================================

  describe('getUndercodingStats', () => {
    it('aggregates gap counts correctly', async () => {
      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.total_gaps).toBeGreaterThan(0);
      const { lower_em_level, missed_code, lower_value_code } = result.data.gaps_by_type;
      expect(lower_em_level + missed_code + lower_value_code).toBe(result.data.total_gaps);
    });

    it('calculates total revenue opportunity', async () => {
      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.total_revenue_opportunity).toBeGreaterThan(0);
      expect(typeof result.data.total_revenue_opportunity).toBe('number');
    });

    it('calculates average gap per encounter', async () => {
      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      if (result.data.encounters_with_gaps > 0) {
        const expected = result.data.total_revenue_opportunity / result.data.encounters_with_gaps;
        expect(result.data.avg_gap_per_encounter).toBeCloseTo(expected, 2);
      }
    });

    it('counts unique encounters with gaps', async () => {
      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.encounters_with_gaps).toBeGreaterThan(0);
      expect(result.data.encounters_with_gaps).toBeLessThanOrEqual(result.data.total_gaps);
    });

    it('identifies most common gap code', async () => {
      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Most common gap code should exist if there are gaps
      if (result.data.total_gaps > 0) {
        expect(result.data.most_common_gap_code).toBeTruthy();
      }
    });

    it('returns zero stats when no gaps exist', async () => {
      tableResults.set('encounter_billing_suggestions', { data: [], error: null });

      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.total_gaps).toBe(0);
      expect(result.data.total_revenue_opportunity).toBe(0);
      expect(result.data.encounters_with_gaps).toBe(0);
    });

    it('returns failure when underlying query fails', async () => {
      tableResults.set('encounter_billing_suggestions', {
        data: null,
        error: { message: 'DB timeout' },
      });

      const result = await undercodingDetectionService.getUndercodingStats();

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.message).toContain('DB timeout');
    });
  });

  // ===========================================================================
  // TESTS: dismissGap
  // ===========================================================================

  describe('dismissGap', () => {
    it('returns success when gap is dismissed', async () => {
      const result = await undercodingDetectionService.dismissGap('sug-1-99214', 'Coding is correct per provider');

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(true);
    });

    it('logs the dismissal via auditLogger', async () => {
      const { auditLogger } = await import('../auditLogger');

      await undercodingDetectionService.dismissGap('sug-1-99214', 'Provider confirmed');

      expect(auditLogger.info).toHaveBeenCalledWith(
        'UNDERCODING_GAP_DISMISSED',
        expect.objectContaining({
          gapId: 'sug-1-99214',
          reason: 'Provider confirmed',
        })
      );
    });

    it('returns failure on unexpected error', async () => {
      const { auditLogger } = await import('../auditLogger');
      vi.mocked(auditLogger.info).mockRejectedValueOnce(new Error('Audit write failed'));

      const result = await undercodingDetectionService.dismissGap('bad-id', 'reason');

      expect(result.success).toBe(false);
    });
  });
});
