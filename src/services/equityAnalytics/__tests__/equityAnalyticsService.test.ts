/**
 * Tests for equityAnalyticsService.
 *
 * Behavioral coverage: the service maps the edge-function response into ServiceResult success/failure
 * correctly, sends the right action + spec, and never fabricates rows. Each test fails if the
 * service logic were removed (deletion test).
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: { error: vi.fn().mockResolvedValue(undefined) },
}));

import { equityAnalyticsService } from '../equityAnalyticsService';
import { supabase } from '../../../lib/supabaseClient';
import type { EquityReport, EquitySpec } from '../types';

const invoke = supabase.functions.invoke as unknown as Mock;

const SPEC: EquitySpec = { source: 'members', measure: 'member_count', dimensions: ['gender'] };

const REPORT: EquityReport = {
  rows: [
    { value: 7, cell_n: 7, low_n: true, gender: 'Female' },
    { value: 34, cell_n: 34, low_n: false, gender: 'Unknown' },
  ],
  meta: {
    source: 'members',
    measure: 'member_count',
    dimensions: ['gender'],
    timeGrain: null,
    tier: 'standard',
    cellCount: 2,
    lowNCellCount: 1,
    smallCellsDropped: false,
    generatedAt: '2026-06-25T00:00:00.000Z',
  },
};

describe('equityAnalyticsService.runQuery', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('returns aggregate report rows on success', async () => {
    invoke.mockResolvedValue({ data: REPORT, error: null });

    const result = await equityAnalyticsService.runQuery(SPEC);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(2);
      // Small cell is FLAGGED, not hidden — core product decision.
      expect(result.data.rows[0]).toMatchObject({ gender: 'Female', cell_n: 7, low_n: true });
      expect(result.data.meta.lowNCellCount).toBe(1);
    }
  });

  it('invokes the equity-analytics function with a query action and the spec', async () => {
    invoke.mockResolvedValue({ data: REPORT, error: null });

    await equityAnalyticsService.runQuery(SPEC);

    expect(invoke).toHaveBeenCalledWith('equity-analytics', {
      body: { action: 'query', spec: SPEC },
    });
  });

  it('returns a failure when the edge function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const result = await equityAnalyticsService.runQuery(SPEC);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(result.error.message).toBe('boom');
    }
  });

  it('returns a failure (not fabricated rows) when the response has no rows', async () => {
    invoke.mockResolvedValue({ data: { meta: {} }, error: null });

    const result = await equityAnalyticsService.runQuery(SPEC);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('OPERATION_FAILED');
    }
  });

  it('maps thrown errors to a failure result', async () => {
    invoke.mockRejectedValue(new Error('network down'));

    const result = await equityAnalyticsService.runQuery(SPEC);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
  });
});

describe('equityAnalyticsService.getCatalog', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('returns the catalog on success', async () => {
    invoke.mockResolvedValue({
      data: { catalog: { members: { key: 'members' } }, tier: 'standard' },
      error: null,
    });

    const result = await equityAnalyticsService.getCatalog();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.catalog.members).toBeDefined();
      expect(result.data.tier).toBe('standard');
    }
    expect(invoke).toHaveBeenCalledWith('equity-analytics', { body: { action: 'catalog' } });
  });

  it('returns NOT_FOUND when no catalog is present', async () => {
    invoke.mockResolvedValue({ data: { tier: 'standard' }, error: null });

    const result = await equityAnalyticsService.getCatalog();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
