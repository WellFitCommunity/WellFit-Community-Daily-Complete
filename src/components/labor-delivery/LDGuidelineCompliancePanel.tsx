/**
 * LDGuidelineCompliancePanel — ACOG prenatal guideline compliance checker
 *
 * Purpose: One-click ACOG/USPSTF guideline compliance check for pregnancy
 * Used by: PrenatalTab or LDOverview (shows gaps + overdue screenings)
 */

import React, { useState } from 'react';
import { checkGuidelineCompliance } from '../../services/laborDelivery/laborDeliveryAI_tier2';
import type { LDGuidelineComplianceResult } from '../../services/laborDelivery/laborDeliveryAI_tier2';

interface LDGuidelineCompliancePanelProps {
  patientId: string;
  tenantId: string;
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-800' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  low: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  overdue: { bg: 'bg-red-100', text: 'text-red-800', label: 'Overdue' },
  never_done: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Never Done' },
  current: { bg: 'bg-green-100', text: 'text-green-800', label: 'Current' },
  not_applicable: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'N/A' },
};

const LDGuidelineCompliancePanel: React.FC<LDGuidelineCompliancePanelProps> = ({
  patientId,
  tenantId,
}) => {
  const [result, setResult] = useState<LDGuidelineComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    const response = await checkGuidelineCompliance(patientId, tenantId);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to check guideline compliance');
    }
    setLoading(false);
  };

  if (!result) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">ACOG Guideline Compliance</h4>
            <p className="text-xs text-gray-500">Check prenatal care against ACOG/USPSTF guidelines</p>
          </div>
          <button
            onClick={handleCheck}
            disabled={loading}
            className="bg-teal-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Run Compliance Check'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const { summary, adherenceGaps, preventiveScreenings, recommendations } = result;

  return (
    <div className="bg-white rounded-lg border p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-bold text-gray-900">ACOG Guideline Compliance</h4>
          <p className="text-xs text-gray-500">
            {summary.totalGuidelines} guidelines checked — Confidence: {(result.confidence * 100).toFixed(0)}%
          </p>
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="text-sm text-teal-600 hover:text-teal-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
        >
          {loading ? 'Rechecking...' : 'Recheck'}
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
        AI-generated — requires clinician review. Does not replace clinical judgment.
      </div>

      {/* Summary Badges */}
      <div className="flex flex-wrap gap-3">
        {summary.criticalGaps > 0 && (
          <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full">
            {summary.criticalGaps} Critical Gap{summary.criticalGaps > 1 ? 's' : ''}
          </span>
        )}
        {summary.highPriorityGaps > 0 && (
          <span className="bg-orange-100 text-orange-800 text-sm font-bold px-3 py-1 rounded-full">
            {summary.highPriorityGaps} High Priority
          </span>
        )}
        {summary.overdueScreenings > 0 && (
          <span className="bg-red-100 text-red-800 text-sm font-bold px-3 py-1 rounded-full">
            {summary.overdueScreenings} Overdue Screening{summary.overdueScreenings > 1 ? 's' : ''}
          </span>
        )}
        {summary.criticalGaps === 0 && summary.overdueScreenings === 0 && (
          <span className="bg-green-100 text-green-800 text-sm font-bold px-3 py-1 rounded-full">
            Compliant
          </span>
        )}
      </div>

      {/* Adherence Gaps */}
      {adherenceGaps.length > 0 && (
        <section>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Adherence Gaps</h5>
          <div className="space-y-2">
            {adherenceGaps.map((gap, i) => {
              const config = PRIORITY_CONFIG[gap.priority] ?? PRIORITY_CONFIG.low;
              return (
                <div key={i} className={`${config.bg} rounded p-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${config.text}`}>{gap.priority.toUpperCase()}</span>
                    <span className="text-xs text-gray-500">{gap.gapType.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{gap.description}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Expected: {gap.expectedCare} | Current: {gap.currentState}
                  </p>
                  <p className="text-xs text-gray-700 mt-1 font-medium">{gap.recommendation}</p>
                  {gap.guideline && (
                    <p className="text-xs text-gray-400 mt-1">
                      Source: {gap.guideline.organization} ({gap.guideline.year})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Preventive Screenings */}
      {preventiveScreenings.length > 0 && (
        <section>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Prenatal Screenings</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {preventiveScreenings.map((screening, i) => {
              const config = STATUS_CONFIG[screening.status] ?? STATUS_CONFIG.not_applicable;
              return (
                <div key={i} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{screening.screeningName}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{screening.guidelineSource}</p>
                  <p className="text-xs text-gray-600">{screening.recommendation}</p>
                  {screening.nextDue && (
                    <p className="text-xs text-gray-400 mt-1">Due: {screening.nextDue}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <section>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">
            Recommendations ({recommendations.length})
          </h5>
          <div className="space-y-2">
            {recommendations.slice(0, 5).map((rec, i) => (
              <div key={i} className="bg-gray-50 rounded p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {rec.evidenceLevel}
                  </span>
                  <span className="text-xs text-gray-500">{rec.category}</span>
                </div>
                <p className="font-medium text-gray-800">{rec.recommendation}</p>
                <p className="text-xs text-gray-600 mt-1">{rec.rationale}</p>
                {rec.guideline && (
                  <p className="text-xs text-gray-400 mt-1">
                    {rec.guideline.guidelineName} — {rec.guideline.organization}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default LDGuidelineCompliancePanel;
