/**
 * LDPPDEarlyWarningPanel — Postpartum depression early warning via composite scoring
 *
 * Purpose: Auto-calculate PPD risk from EPDS + holistic risk dimensions
 * Used by: PostpartumTab (appears when postpartum assessment exists)
 */

import React, { useState, useEffect } from 'react';
import { calculatePPDRisk } from '../../services/laborDelivery/laborDeliveryAI_tier3';
import type { LDPPDRiskResult } from '../../types/laborDeliveryAI';

interface LDPPDEarlyWarningPanelProps {
  patientId: string;
  hasPostpartumAssessment: boolean;
}

const RISK_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  low: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', label: 'Low Risk' },
  moderate: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', label: 'Moderate Risk' },
  high: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', label: 'High Risk' },
  critical: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', label: 'Critical Risk' },
};

const LDPPDEarlyWarningPanel: React.FC<LDPPDEarlyWarningPanelProps> = ({
  patientId,
  hasPostpartumAssessment,
}) => {
  const [result, setResult] = useState<LDPPDRiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = async () => {
    setLoading(true);
    setError(null);
    const response = await calculatePPDRisk(patientId);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to calculate PPD risk');
    }
    setLoading(false);
  };

  // Auto-trigger when a postpartum assessment exists
  useEffect(() => {
    if (hasPostpartumAssessment && !result && !loading) {
      calculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPostpartumAssessment]);

  if (!hasPostpartumAssessment) {
    return null;
  }

  if (!result) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">PPD Early Warning System</h4>
            <p className="text-xs text-gray-500">Multi-dimensional postpartum depression risk assessment</p>
          </div>
          <button
            onClick={calculate}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Calculate PPD Risk'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const config = RISK_CONFIG[result.riskLevel] ?? RISK_CONFIG.low;

  return (
    <div className={`rounded-lg border-2 p-5 ${config.bg} ${config.border}`} role="region" aria-label="PPD risk assessment">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">PPD Early Warning</h4>
          <p className={`text-2xl font-black mt-1 ${config.text}`}>{config.label}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black">{result.compositeScore}<span className="text-sm font-normal">/10</span></p>
          {result.epdsScore !== null && (
            <p className="text-xs text-gray-500">EPDS: {result.epdsScore}/30</p>
          )}
        </div>
      </div>

      {/* Risk gauge bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
        <div
          className={`h-3 rounded-full transition-all ${
            result.riskLevel === 'critical' ? 'bg-red-600' :
            result.riskLevel === 'high' ? 'bg-orange-500' :
            result.riskLevel === 'moderate' ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${Math.min(result.compositeScore * 10, 100)}%` }}
        />
      </div>

      {/* Contributing factors */}
      <div className="mb-4">
        <h5 className="text-sm font-semibold text-gray-700 mb-2">Contributing Factors</h5>
        <div className="space-y-2">
          {result.contributingFactors.map((factor, i) => (
            <div key={i} className="bg-white bg-opacity-60 rounded p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{factor.dimension}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100">
                  {factor.score.toFixed(1)}/10 (wt: {(factor.weight * 100).toFixed(0)}%)
                </span>
              </div>
              <p className="text-xs text-gray-600">{factor.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Intervention flag */}
      {result.requiresIntervention && (
        <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
          <p className="text-sm font-bold text-red-800">Intervention Required</p>
          <ul className="list-disc list-inside text-sm text-red-700 mt-1">
            {result.recommendedActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Re-calculate */}
      <div className="flex justify-end">
        <button
          onClick={calculate}
          disabled={loading}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>
    </div>
  );
};

export default LDPPDEarlyWarningPanel;
