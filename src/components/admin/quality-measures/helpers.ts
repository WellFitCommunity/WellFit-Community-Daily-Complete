/**
 * Quality Measures Dashboard Helpers
 */

import { PERFORMANCE_THRESHOLDS } from './types';

export function getPerformanceColor(rate: number | null, isInverseMeasure: boolean = false): string {
  if (rate === null) return 'text-slate-400';

  const effectiveRate = isInverseMeasure ? 1 - rate : rate;

  if (effectiveRate >= PERFORMANCE_THRESHOLDS.excellent) return 'text-green-400';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.good) return 'text-emerald-400';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.fair) return 'text-yellow-400';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.poor) return 'text-orange-400';
  return 'text-red-400';
}

export function getPerformanceBgColor(rate: number | null, isInverseMeasure: boolean = false): string {
  if (rate === null) return 'bg-slate-800';

  const effectiveRate = isInverseMeasure ? 1 - rate : rate;

  if (effectiveRate >= PERFORMANCE_THRESHOLDS.excellent) return 'bg-green-900/30';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.good) return 'bg-emerald-900/30';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.fair) return 'bg-yellow-900/30';
  if (effectiveRate >= PERFORMANCE_THRESHOLDS.poor) return 'bg-orange-900/30';
  return 'bg-red-900/30';
}

export function formatPercentage(rate: number | null): string {
  if (rate === null) return 'N/A';
  return `${(rate * 100).toFixed(1)}%`;
}

export function isInverseMeasure(measureId: string): boolean {
  return measureId === 'CMS122v12';
}
