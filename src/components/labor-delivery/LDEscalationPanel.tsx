/**
 * LDEscalationPanel — AI-powered labor escalation scoring display
 *
 * Purpose: Shows escalation score, category, recommendations from ai-care-escalation-scorer
 * Used by: LaborTab (after fetal monitoring or labor event is recorded)
 */

import React, { useState } from 'react';
import { requestEscalationScore } from '../../services/laborDelivery/laborDeliveryAI';
import type { LDEscalationResult } from '../../services/laborDelivery/laborDeliveryAI';

interface LDEscalationPanelProps {
  patientId: string;
  assessorId: string;
  triggerReason?: string;
}

const CATEGORY_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  none: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', label: 'No Escalation Needed' },
  monitor: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', label: 'Monitor Closely' },
  notify: { bg: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-800', label: 'Notify Provider' },
  escalate: { bg: 'bg-orange-50 border-orange-300', text: 'text-orange-800', label: 'Escalate Now' },
  emergency: { bg: 'bg-red-50 border-red-400', text: 'text-red-800', label: 'EMERGENCY' },
};

const LDEscalationPanel: React.FC<LDEscalationPanelProps> = ({
  patientId,
  assessorId,
  triggerReason,
}) => {
  const [result, setResult] = useState<LDEscalationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAssessment = async () => {
    setLoading(true);
    setError(null);
    const response = await requestEscalationScore(patientId, assessorId, triggerReason);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to generate escalation assessment');
    }
    setLoading(false);
  };

  if (!result) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">AI Escalation Assessment</h4>
            <p className="text-xs text-gray-500">Analyze current labor status for escalation needs</p>
          </div>
          <button
            onClick={runAssessment}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run AI Assessment'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const config = CATEGORY_CONFIG[result.escalationCategory] ?? CATEGORY_CONFIG.none;

  return (
    <div className={`rounded-lg border-2 p-5 ${config.bg}`} role="region" aria-label="Escalation assessment">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold">AI Escalation Assessment</h4>
          <p className={`text-2xl font-black mt-1 ${config.text}`}>{config.label}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black">{result.overallEscalationScore}<span className="text-sm font-normal">/100</span></p>
          <p className="text-xs text-gray-500">Confidence: {(result.confidenceLevel * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Clinical Summary */}
      <p className="text-sm text-gray-700 mb-4">{result.clinicalSummary}</p>

      {/* Key flags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {result.requiresPhysicianReview && (
          <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">
            Physician Review Required
          </span>
        )}
        {result.requiresRapidResponse && (
          <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            Rapid Response
          </span>
        )}
        <span className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full">
          Reassess in {result.hoursToReassess}h
        </span>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h5>
          <div className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="bg-white bg-opacity-60 rounded p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    rec.urgency === 'immediate' ? 'bg-red-200 text-red-800' :
                    rec.urgency === 'urgent' ? 'bg-orange-200 text-orange-800' :
                    rec.urgency === 'soon' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {rec.urgency.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">{rec.timeframe}</span>
                </div>
                <p className="font-medium">{rec.action}</p>
                <p className="text-xs text-gray-600 mt-1">{rec.responsible} — {rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {result.requiredNotifications.length > 0 && (
        <div className="text-xs text-gray-600">
          <span className="font-semibold">Notify:</span> {result.requiredNotifications.join(', ')}
        </div>
      )}

      {/* Re-run */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={runAssessment}
          disabled={loading}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Re-assess'}
        </button>
      </div>
    </div>
  );
};

export default LDEscalationPanel;
