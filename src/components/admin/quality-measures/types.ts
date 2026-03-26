/**
 * Quality Measures Dashboard Types
 */

import type { MeasureDefinition, AggregateResult } from '../../../services/qualityMeasures/ecqmCalculationService';

export interface QualityMeasuresDashboardProps {
  tenantId?: string;
  className?: string;
}

export interface MeasureWithResults extends MeasureDefinition {
  results?: AggregateResult;
  trend?: 'up' | 'down' | 'stable';
  previousRate?: number;
}

export interface ReportingPeriod {
  start: Date;
  end: Date;
  label: string;
}

export const REPORTING_PERIODS: ReportingPeriod[] = [
  {
    start: new Date('2026-01-01'),
    end: new Date('2026-12-31'),
    label: '2026 Full Year'
  },
  {
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31'),
    label: '2025 Full Year'
  },
  {
    start: new Date('2026-01-01'),
    end: new Date('2026-03-31'),
    label: 'Q1 2026'
  }
];

export const PERFORMANCE_THRESHOLDS = {
  excellent: 0.90,
  good: 0.75,
  fair: 0.50,
  poor: 0.25
};
