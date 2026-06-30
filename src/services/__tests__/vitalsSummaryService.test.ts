/**
 * vitalsSummaryService tests
 *
 * Behavioral coverage for the weekly-average vitals rollup:
 * - weekly bucketing (avg / min / max / count)
 * - out-of-range counting against clinical bounds
 * - statistical outlier flagging
 * - empty window + DB error paths
 * - pure helpers (weekStartOf, isOutOfRange, outlierIndices)
 *
 * Tracker: docs/trackers/ble-vitals-enrollment-tracker.md (Session C)
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: { result: { data: [] as unknown, error: null as unknown } },
}));

type Builder = {
  select: () => Builder;
  eq: () => Builder;
  gte: () => Builder;
  order: () => Builder;
  limit: () => Builder;
  then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => unknown;
};

vi.mock('../../lib/supabaseClient', () => {
  const makeBuilder = (): Builder => {
    const b: Builder = {
      select: () => b,
      eq: () => b,
      gte: () => b,
      order: () => b,
      limit: () => b,
      then: (resolve) => resolve(state.result),
    };
    return b;
  };
  return { supabase: { from: () => makeBuilder() } };
});

vi.mock('../auditLogger', () => ({
  auditLogger: { error: vi.fn(), ai: vi.fn(), info: vi.fn() },
}));

import {
  getWeeklyVitalsSummary,
  weekStartOf,
  isOutOfRange,
  outlierIndices,
  bucketByWeek,
  type ReadingPoint,
} from '../vitalsSummaryService';

function setRows(rows: unknown[]): void {
  state.result = { data: rows, error: null };
}

beforeEach(() => {
  state.result = { data: [], error: null };
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe('weekStartOf', () => {
  it('returns the Monday of the week at midnight', () => {
    // 2026-06-25 is a Thursday → Monday is 2026-06-22
    const monday = weekStartOf(new Date('2026-06-25T14:30:00'));
    expect(monday.getDay()).toBe(1);
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(5); // June
    expect(monday.getDate()).toBe(22);
    expect(monday.getHours()).toBe(0);
  });

  it('keeps a Sunday in the same Mon–Sun week (not the next)', () => {
    // 2026-06-28 is a Sunday → still maps back to Monday 2026-06-22
    const monday = weekStartOf(new Date('2026-06-28T09:00:00'));
    expect(monday.getDate()).toBe(22);
  });
});

describe('isOutOfRange', () => {
  it('flags systolic above the clinical high bound', () => {
    expect(isOutOfRange('blood_pressure', 150)).toBe(true);
    expect(isOutOfRange('blood_pressure', 120)).toBe(false);
  });

  it('flags SpO2 below the low bound only (no high bound)', () => {
    expect(isOutOfRange('oxygen_saturation', 90)).toBe(true);
    expect(isOutOfRange('oxygen_saturation', 99)).toBe(false);
  });

  it('never flags weight (no absolute clinical range)', () => {
    expect(isOutOfRange('weight', 5)).toBe(false);
    expect(isOutOfRange('weight', 900)).toBe(false);
  });
});

describe('outlierIndices', () => {
  it('returns empty below the minimum sample size', () => {
    expect(outlierIndices([100, 300, 100]).size).toBe(0);
  });

  it('flags a value more than 2 SD from the mean', () => {
    const flagged = outlierIndices([100, 101, 99, 100, 250]);
    expect(flagged.has(4)).toBe(true);
    expect(flagged.has(0)).toBe(false);
  });

  it('returns empty when all values are identical (SD = 0)', () => {
    expect(outlierIndices([100, 100, 100, 100, 100]).size).toBe(0);
  });
});

describe('bucketByWeek', () => {
  it('averages readings within each ISO week and counts out-of-range', () => {
    const readings: ReadingPoint[] = [
      { measuredAt: '2026-06-22T08:00:00', value: 120, unit: 'mmHg', outOfRange: false, isOutlier: false },
      { measuredAt: '2026-06-24T08:00:00', value: 130, unit: 'mmHg', outOfRange: false, isOutlier: false },
      { measuredAt: '2026-06-29T08:00:00', value: 150, unit: 'mmHg', outOfRange: true, isOutlier: false },
    ];
    const buckets = bucketByWeek(readings);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].avg).toBe(125); // (120+130)/2
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].outOfRangeCount).toBe(0);
    expect(buckets[1].avg).toBe(150);
    expect(buckets[1].outOfRangeCount).toBe(1);
  });
});

// ── Service: getWeeklyVitalsSummary ──────────────────────────────────────────

describe('getWeeklyVitalsSummary', () => {
  it('rejects an empty patient id', async () => {
    const res = await getWeeklyVitalsSummary('', 'blood_pressure');
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('INVALID_INPUT');
  });

  it('summarizes readings into weekly buckets with out-of-range surfaced', async () => {
    setRows([
      { value: 118, unit: 'mmHg', measured_at: '2026-06-22T08:00:00Z' },
      { value: 122, unit: 'mmHg', measured_at: '2026-06-23T08:00:00Z' },
      { value: 155, unit: 'mmHg', measured_at: '2026-06-29T08:00:00Z' },
    ]);

    const res = await getWeeklyVitalsSummary('patient-1', 'blood_pressure', '3m');
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.totalCount).toBe(3);
    expect(res.data.unit).toBe('mmHg');
    expect(res.data.buckets.length).toBeGreaterThanOrEqual(2);
    // 155 systolic is above the 140 high bound
    expect(res.data.outOfRange).toHaveLength(1);
    expect(res.data.outOfRange[0].value).toBe(155);
  });

  it('flags a clear spike as a statistical outlier', async () => {
    setRows([
      { value: 95, unit: '%', measured_at: '2026-06-01T08:00:00Z' },
      { value: 96, unit: '%', measured_at: '2026-06-02T08:00:00Z' },
      { value: 97, unit: '%', measured_at: '2026-06-03T08:00:00Z' },
      { value: 96, unit: '%', measured_at: '2026-06-04T08:00:00Z' },
      { value: 70, unit: '%', measured_at: '2026-06-05T08:00:00Z' },
    ]);

    const res = await getWeeklyVitalsSummary('patient-1', 'oxygen_saturation', '3m');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.outliers.length).toBeGreaterThanOrEqual(1);
    expect(res.data.outliers.some((o) => o.value === 70)).toBe(true);
  });

  it('returns an empty summary when there are no readings', async () => {
    setRows([]);
    const res = await getWeeklyVitalsSummary('patient-1', 'weight', '1m');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.totalCount).toBe(0);
    expect(res.data.buckets).toHaveLength(0);
    expect(res.data.unit).toBe('lbs'); // falls back to default unit
  });

  it('ignores rows with a null value', async () => {
    setRows([
      { value: null, unit: 'mg/dL', measured_at: '2026-06-01T08:00:00Z' },
      { value: 110, unit: 'mg/dL', measured_at: '2026-06-02T08:00:00Z' },
    ]);
    const res = await getWeeklyVitalsSummary('patient-1', 'blood_glucose', '1m');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.totalCount).toBe(1);
  });

  it('returns a DATABASE_ERROR failure when the query errors', async () => {
    state.result = { data: null, error: { message: 'permission denied' } };
    const res = await getWeeklyVitalsSummary('patient-1', 'blood_pressure', '3m');
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('DATABASE_ERROR');
  });
});
