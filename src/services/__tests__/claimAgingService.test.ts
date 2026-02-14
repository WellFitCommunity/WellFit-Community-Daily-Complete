/**
 * claimAgingService Test Suite
 *
 * Tests aging claim queries, stats aggregation, and claim history retrieval.
 * Deletion Test: All tests fail if service logic is removed.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimAgingService } from '../claimAgingService';

// =============================================================================
// MOCK SETUP
// =============================================================================

/** Tracks the most recent query chain calls for assertions */
const mockChainState = vi.hoisted(() => ({
  selectArg: '' as string,
  inArgs: [] as unknown[],
  eqArgs: [] as unknown[],
  orderArgs: [] as unknown[],
  resolveData: null as unknown,
  resolveError: null as { message: string } | null,
}));

function chainBuilder() {
  const chain: Record<string, unknown> = {};
  const getResult = () => ({
    data: mockChainState.resolveData,
    error: mockChainState.resolveError,
  });

  // Make chain thenable so Supabase-style await works on any terminal method
  chain.then = vi.fn().mockImplementation(
    (resolve: (val: unknown) => unknown) => Promise.resolve(getResult()).then(resolve)
  );

  chain.select = vi.fn().mockImplementation((arg: string) => {
    mockChainState.selectArg = arg;
    return chain;
  });
  chain.in = vi.fn().mockImplementation((...args: unknown[]) => {
    mockChainState.inArgs = args;
    return chain;
  });
  chain.eq = vi.fn().mockImplementation((...args: unknown[]) => {
    mockChainState.eqArgs = args;
    return chain;
  });
  chain.order = vi.fn().mockImplementation((...args: unknown[]) => {
    mockChainState.orderArgs = args;
    return chain;
  });
  chain.single = vi.fn().mockImplementation(() =>
    Promise.resolve(getResult())
  );

  return chain;
}

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => chainBuilder()),
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

const NOW = Date.now();
const DAYS_MS = 1000 * 60 * 60 * 24;

/** Creates a date string N days ago */
function daysAgo(n: number): string {
  return new Date(NOW - n * DAYS_MS).toISOString();
}

const MOCK_CLAIM_ROWS = [
  {
    id: 'claim-1',
    encounter_id: 'enc-1',
    status: 'submitted',
    total_charge: 1500.00,
    control_number: 'CTL-001',
    created_at: daysAgo(15),
    updated_at: daysAgo(10),
    billing_payers: { name: 'Aetna' },
  },
  {
    id: 'claim-2',
    encounter_id: 'enc-2',
    status: 'rejected',
    total_charge: 2500.50,
    control_number: 'CTL-002',
    created_at: daysAgo(45),
    updated_at: daysAgo(40),
    billing_payers: { name: 'BlueCross' },
  },
  {
    id: 'claim-3',
    encounter_id: null,
    status: 'generated',
    total_charge: 800.00,
    control_number: null,
    created_at: daysAgo(95),
    updated_at: daysAgo(95),
    billing_payers: null,
  },
];

const MOCK_STATS_ROWS = [
  { id: 'claim-a', total_charge: 100, created_at: daysAgo(10) },   // 0-30
  { id: 'claim-b', total_charge: 200, created_at: daysAgo(25) },   // 0-30
  { id: 'claim-c', total_charge: 300, created_at: daysAgo(45) },   // 31-60
  { id: 'claim-d', total_charge: 400, created_at: daysAgo(75) },   // 61-90
  { id: 'claim-e', total_charge: 500, created_at: daysAgo(100) },  // 90+
];

const MOCK_HISTORY = [
  {
    id: 'hist-1',
    from_status: 'generated',
    to_status: 'submitted',
    note: 'Submitted to clearinghouse',
    created_at: daysAgo(10),
  },
  {
    id: 'hist-2',
    from_status: 'submitted',
    to_status: 'rejected',
    note: 'Missing modifier',
    created_at: daysAgo(5),
  },
];

// =============================================================================
// TESTS
// =============================================================================

describe('claimAgingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChainState.resolveData = null;
    mockChainState.resolveError = null;
    mockChainState.selectArg = '';
    mockChainState.inArgs = [];
    mockChainState.eqArgs = [];
    mockChainState.orderArgs = [];
  });

  // ---------- getAgingClaims ----------
  describe('getAgingClaims', () => {
    it('returns correctly structured aging claims with computed aging_days', async () => {
      mockChainState.resolveData = MOCK_CLAIM_ROWS;

      const result = await claimAgingService.getAgingClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].claim_id).toBe('claim-1');
        expect(result.data[0].payer_name).toBe('Aetna');
        expect(result.data[0].aging_days).toBeGreaterThanOrEqual(14);
        expect(result.data[0].aging_days).toBeLessThanOrEqual(16);
        expect(result.data[0].total_charge).toBe(1500.00);
        expect(result.data[0].control_number).toBe('CTL-001');
      }
    });

    it('handles null payer (no billing_payers join)', async () => {
      mockChainState.resolveData = MOCK_CLAIM_ROWS;

      const result = await claimAgingService.getAgingClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        const noPayerClaim = result.data.find(c => c.claim_id === 'claim-3');
        expect(noPayerClaim?.payer_name).toBeNull();
      }
    });

    it('filters by payer search client-side', async () => {
      mockChainState.resolveData = MOCK_CLAIM_ROWS;

      const result = await claimAgingService.getAgingClaims({
        payerSearch: 'blue',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].payer_name).toBe('BlueCross');
      }
    });

    it('filters by control number search client-side', async () => {
      mockChainState.resolveData = MOCK_CLAIM_ROWS;

      const result = await claimAgingService.getAgingClaims({
        controlNumberSearch: 'CTL-001',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].control_number).toBe('CTL-001');
      }
    });

    it('returns empty array when no claims exist', async () => {
      mockChainState.resolveData = [];

      const result = await claimAgingService.getAgingClaims();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on database error', async () => {
      mockChainState.resolveError = { message: 'Connection refused' };

      const result = await claimAgingService.getAgingClaims();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
        expect(result.error.message).toBe('Failed to fetch aging claims');
      }
    });
  });

  // ---------- getAgingStats ----------
  describe('getAgingStats', () => {
    it('computes aging buckets correctly', async () => {
      mockChainState.resolveData = MOCK_STATS_ROWS;

      const result = await claimAgingService.getAgingStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bucket_0_30).toBe(2);
        expect(result.data.bucket_31_60).toBe(1);
        expect(result.data.bucket_61_90).toBe(1);
        expect(result.data.bucket_90_plus).toBe(1);
        expect(result.data.total_outstanding).toBe(5);
        expect(result.data.total_amount).toBe(1500);
      }
    });

    it('returns zeroes when no claims exist', async () => {
      mockChainState.resolveData = [];

      const result = await claimAgingService.getAgingStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bucket_0_30).toBe(0);
        expect(result.data.bucket_31_60).toBe(0);
        expect(result.data.bucket_61_90).toBe(0);
        expect(result.data.bucket_90_plus).toBe(0);
        expect(result.data.total_outstanding).toBe(0);
        expect(result.data.total_amount).toBe(0);
      }
    });

    it('handles null total_charge safely', async () => {
      mockChainState.resolveData = [
        { id: 'claim-null', total_charge: null, created_at: daysAgo(5) },
      ];

      const result = await claimAgingService.getAgingStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total_amount).toBe(0);
        expect(result.data.bucket_0_30).toBe(1);
      }
    });

    it('returns failure on database error', async () => {
      mockChainState.resolveError = { message: 'Stats query failed' };

      const result = await claimAgingService.getAgingStats();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------- getClaimHistory ----------
  describe('getClaimHistory', () => {
    it('returns ordered status history entries', async () => {
      mockChainState.resolveData = MOCK_HISTORY;

      const result = await claimAgingService.getClaimHistory('claim-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].from_status).toBe('generated');
        expect(result.data[0].to_status).toBe('submitted');
        expect(result.data[0].note).toBe('Submitted to clearinghouse');
        expect(result.data[1].from_status).toBe('submitted');
        expect(result.data[1].to_status).toBe('rejected');
      }
    });

    it('returns empty array when no history exists', async () => {
      mockChainState.resolveData = [];

      const result = await claimAgingService.getClaimHistory('claim-new');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });

    it('returns failure on database error', async () => {
      mockChainState.resolveError = { message: 'History fetch failed' };

      const result = await claimAgingService.getClaimHistory('claim-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------- Return type contract ----------
  describe('ServiceResult contract', () => {
    it('getAgingClaims returns ServiceResult with success/data/error fields', async () => {
      mockChainState.resolveData = [];
      const result = await claimAgingService.getAgingClaims();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('getAgingStats returns ServiceResult with success/data/error fields', async () => {
      mockChainState.resolveData = [];
      const result = await claimAgingService.getAgingStats();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('getClaimHistory returns ServiceResult with success/data/error fields', async () => {
      mockChainState.resolveData = [];
      const result = await claimAgingService.getClaimHistory('any-id');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });
});
