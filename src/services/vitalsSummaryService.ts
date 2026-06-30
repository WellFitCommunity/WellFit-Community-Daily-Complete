/**
 * vitalsSummaryService — Weekly-average vital rollups for the doctor view
 *
 * Turns raw BLE device readings (stored in `wearable_vital_signs`) into a
 * clinician-friendly weekly summary: one average per ISO week instead of dozens
 * of raw rows, with out-of-range counts and statistical outliers surfaced
 * separately so a provider can review a month/quarter/half-year at a glance.
 *
 * Scope: the four senior-priority BLE devices ONLY — blood pressure cuff,
 * glucometer, pulse oximeter, smart scale. Continuous wearables (Apple Watch,
 * Fitbit) are explicitly out of scope (BLE Vitals + RPM tracker §scope).
 *
 * Storage note: the table is named `wearable_vital_signs` for legacy reasons,
 * but per the BLE tracker it is the canonical sink for these BLE device
 * readings (composite one-row-per-reading shape).
 *
 * @module vitalsSummaryService
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

/** The four senior BLE device verticals (matches `wearable_vital_signs.vital_type`). */
export type VitalKind =
  | 'blood_pressure'
  | 'blood_glucose'
  | 'oxygen_saturation'
  | 'weight';

/** Summary windows the doctor can pick. */
export type SummaryWindow = '1m' | '3m' | '6m';

/** One ISO-week bucket of readings. */
export interface WeeklyBucket {
  /** ISO date (yyyy-mm-dd) of the Monday that starts the week. */
  weekStart: string;
  /** Short human label, e.g. "Jun 23". */
  weekLabel: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  /** How many readings in this week fell outside the clinical range. */
  outOfRangeCount: number;
}

/** A single reading, annotated for clinical review. */
export interface ReadingPoint {
  measuredAt: string;
  value: number;
  unit: string;
  /** Outside the clinical range for this vital (e.g. systolic > 140). */
  outOfRange: boolean;
  /** Statistical outlier vs this patient's own distribution (modified Z-score). */
  isOutlier: boolean;
}

/** Full weekly summary for one vital over one window. */
export interface VitalsSummary {
  vitalType: VitalKind;
  label: string;
  unit: string;
  window: SummaryWindow;
  buckets: WeeklyBucket[];
  readings: ReadingPoint[];
  /** Readings outside the clinical range (always surfaced to the doctor). */
  outOfRange: ReadingPoint[];
  /** Statistical outliers (surfaced separately from out-of-range). */
  outliers: ReadingPoint[];
  totalCount: number;
}

// =============================================================================
// CLINICAL CONFIG
// =============================================================================

const WINDOW_DAYS: Record<SummaryWindow, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
};

/**
 * Clinical out-of-range bounds, aligned to the reference lines already shown on
 * the RPM trend charts (RpmPatientDetail). Blood pressure is evaluated on the
 * stored systolic value. Weight has no absolute clinical range (it is relative
 * to the individual), so only outlier detection applies.
 */
const CLINICAL_RANGES: Record<VitalKind, { low?: number; high?: number }> = {
  blood_pressure: { low: 90, high: 140 },
  blood_glucose: { low: 70, high: 200 },
  oxygen_saturation: { low: 92 },
  weight: {},
};

const VITAL_LABELS: Record<VitalKind, string> = {
  blood_pressure: 'Blood Pressure (systolic)',
  blood_glucose: 'Blood Glucose',
  oxygen_saturation: 'Oxygen Saturation',
  weight: 'Weight',
};

const DEFAULT_UNITS: Record<VitalKind, string> = {
  blood_pressure: 'mmHg',
  blood_glucose: 'mg/dL',
  oxygen_saturation: '%',
  weight: 'lbs',
};

/** Number of readings required before outlier (>2 SD) detection is meaningful. */
const MIN_FOR_OUTLIERS = 4;

// =============================================================================
// PURE HELPERS (exported for testing)
// =============================================================================

/** Monday 00:00 (local) of the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = out.getDay(); // 0=Sun..6=Sat
  const deltaToMonday = (dow + 6) % 7; // Mon=0, Sun=6
  out.setDate(out.getDate() - deltaToMonday);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** The clinical low/high bounds for a vital (empty object = no absolute range). */
export function clinicalRangeFor(kind: VitalKind): { low?: number; high?: number } {
  return CLINICAL_RANGES[kind];
}

/** True when `value` is outside the clinical range for `kind`. */
export function isOutOfRange(kind: VitalKind, value: number): boolean {
  const range = CLINICAL_RANGES[kind];
  if (typeof range.low === 'number' && value < range.low) return true;
  if (typeof range.high === 'number' && value > range.high) return true;
  return false;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Indices of statistical outliers using the Iglewicz–Hoaglin modified Z-score
 * (median absolute deviation based, threshold 3.5). Chosen over a plain
 * standard-deviation rule because a single large spike inflates the SD enough
 * to mask itself in the small samples typical of senior home monitoring.
 */
export function outlierIndices(values: number[]): Set<number> {
  const flagged = new Set<number>();
  if (values.length < MIN_FOR_OUTLIERS) return flagged;

  const med = median([...values].sort((a, b) => a - b));
  const absDevs = values.map((v) => Math.abs(v - med));
  const mad = median([...absDevs].sort((a, b) => a - b));

  // Primary: MAD-based modified Z-score.
  if (mad !== 0) {
    values.forEach((v, i) => {
      if (Math.abs((0.6745 * (v - med)) / mad) > 3.5) flagged.add(i);
    });
    return flagged;
  }

  // Fallback when MAD is 0 (majority of values identical): use mean abs dev.
  const meanAbsDev = absDevs.reduce((s, d) => s + d, 0) / absDevs.length;
  if (meanAbsDev === 0) return flagged; // all values identical
  values.forEach((v, i) => {
    if (Math.abs((v - med) / (1.253314 * meanAbsDev)) > 3.5) flagged.add(i);
  });
  return flagged;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Bucket annotated readings into ISO weeks with avg/min/max/out-of-range. */
export function bucketByWeek(readings: ReadingPoint[]): WeeklyBucket[] {
  const groups = new Map<string, ReadingPoint[]>();
  for (const r of readings) {
    const start = weekStartOf(new Date(r.measuredAt));
    const key = start.toISOString().slice(0, 10);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([weekStart, rows]) => {
      const vals = rows.map((r) => r.value);
      const sum = vals.reduce((s, v) => s + v, 0);
      return {
        weekStart,
        weekLabel: new Date(`${weekStart}T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        avg: round1(sum / vals.length),
        min: vals.reduce((acc, v) => Math.min(acc, v), Infinity),
        max: vals.reduce((acc, v) => Math.max(acc, v), -Infinity),
        count: rows.length,
        outOfRangeCount: rows.filter((r) => r.outOfRange).length,
      };
    });
}

// =============================================================================
// DB ROW SHAPE
// =============================================================================

interface VitalRow {
  value: number | null;
  unit: string | null;
  measured_at: string;
}

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Build a weekly-average summary for one patient + vital over a window.
 *
 * Reads under the caller's session (RLS enforces tenant + role: clinicians get
 * `is_tenant_admin()` read access to this table per governance §B4). Never
 * throws — returns a ServiceResult.
 */
export async function getWeeklyVitalsSummary(
  patientId: string,
  vitalType: VitalKind,
  window: SummaryWindow = '3m'
): Promise<ServiceResult<VitalsSummary>> {
  if (!patientId) {
    return failure('INVALID_INPUT', 'A patient id is required.');
  }

  const cutoff = new Date(
    Date.now() - WINDOW_DAYS[window] * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const { data, error } = await supabase
      .from('wearable_vital_signs')
      .select('value, unit, measured_at')
      .eq('user_id', patientId)
      .eq('vital_type', vitalType)
      .gte('measured_at', cutoff)
      .order('measured_at', { ascending: true })
      .limit(2000);

    if (error) {
      await auditLogger.error(
        'VITALS_SUMMARY_QUERY_FAILED',
        new Error(error.message),
        { vitalType, window }
      );
      return failure('DATABASE_ERROR', 'Unable to load vitals.', error);
    }

    const rows = (data ?? []) as VitalRow[];
    const unit = rows.find((r) => r.unit)?.unit ?? DEFAULT_UNITS[vitalType];

    // Keep only numeric, physiologically present readings.
    const numericRows = rows.filter(
      (r): r is VitalRow & { value: number } =>
        typeof r.value === 'number' && Number.isFinite(r.value)
    );

    const outlierSet = outlierIndices(numericRows.map((r) => r.value));

    const readings: ReadingPoint[] = numericRows.map((r, i) => ({
      measuredAt: r.measured_at,
      value: r.value,
      unit: r.unit ?? unit,
      outOfRange: isOutOfRange(vitalType, r.value),
      isOutlier: outlierSet.has(i),
    }));

    const summary: VitalsSummary = {
      vitalType,
      label: VITAL_LABELS[vitalType],
      unit,
      window,
      buckets: bucketByWeek(readings),
      readings,
      outOfRange: readings.filter((r) => r.outOfRange),
      outliers: readings.filter((r) => r.isOutlier),
      totalCount: readings.length,
    };

    return success(summary);
  } catch (err: unknown) {
    await auditLogger.error(
      'VITALS_SUMMARY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { vitalType, window }
    );
    return failure('OPERATION_FAILED', 'Unable to summarize vitals.', err);
  }
}

/** The four BLE vitals, for building selectors in the UI. */
export const SUPPORTED_VITALS: ReadonlyArray<{ kind: VitalKind; label: string }> =
  (Object.keys(VITAL_LABELS) as VitalKind[]).map((kind) => ({
    kind,
    label: VITAL_LABELS[kind],
  }));

export const vitalsSummaryService = {
  getWeeklyVitalsSummary,
  SUPPORTED_VITALS,
};
