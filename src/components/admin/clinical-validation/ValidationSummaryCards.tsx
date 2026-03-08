/**
 * ValidationSummaryCards — Summary metric cards for validation dashboard
 *
 * Displays: codes validated, codes rejected, rejection rate %,
 *           top hallucinated code, avg response time
 */

import React from 'react';
import { EAMetricCard } from '../../envision-atlus/EAMetricCard';
import type { ValidationSummary } from './ClinicalValidationDashboard.types';

interface ValidationSummaryCardsProps {
  summary: ValidationSummary;
}

export const ValidationSummaryCards: React.FC<ValidationSummaryCardsProps> = ({ summary }) => {
  // Determine risk level based on rejection rate
  const rejectionRisk = summary.rejectionRate > 10
    ? 'critical' as const
    : summary.rejectionRate > 5
      ? 'high' as const
      : summary.rejectionRate > 1
        ? 'elevated' as const
        : 'normal' as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <EAMetricCard
        label="Codes Validated"
        value={summary.totalCodesChecked.toLocaleString()}
        sublabel={`${summary.totalRuns} AI runs`}
        riskLevel="normal"
      />

      <EAMetricCard
        label="Codes Rejected"
        value={summary.totalCodesRejected.toLocaleString()}
        sublabel={`${summary.totalCodesSuppressed} auto-suppressed`}
        riskLevel={summary.totalCodesRejected > 0 ? 'elevated' : 'normal'}
      />

      <EAMetricCard
        label="Rejection Rate"
        value={`${summary.rejectionRate.toFixed(1)}%`}
        sublabel="Flagged as invalid"
        riskLevel={rejectionRisk}
      />

      <EAMetricCard
        label="Top Hallucinated"
        value={summary.topHallucinatedCode ?? 'None'}
        sublabel={summary.topHallucinatedCode ? `${summary.topHallucinatedCount} occurrences` : 'No rejections'}
        riskLevel={summary.topHallucinatedCount > 3 ? 'high' : 'normal'}
      />

      <EAMetricCard
        label="Avg Response Time"
        value={`${summary.avgResponseTimeMs}ms`}
        sublabel="Validation latency"
        riskLevel={summary.avgResponseTimeMs > 2000 ? 'high' : 'normal'}
      />
    </div>
  );
};

export default ValidationSummaryCards;
