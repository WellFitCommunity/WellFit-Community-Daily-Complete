/**
 * LDSDOHPanel — SDOH detection from prenatal visit notes
 *
 * Purpose: Scan prenatal notes for social determinants of health flags
 * Used by: PrenatalTab (after a prenatal visit is recorded with notes)
 */

import React, { useState } from 'react';
import { scanPrenatalNotesForSDOH } from '../../services/laborDelivery/laborDeliveryAI_tier2';
import type { LDSDOHResult } from '../../services/laborDelivery/laborDeliveryAI_tier2';

interface LDSDOHPanelProps {
  patientId: string;
  tenantId: string;
  noteText: string;
  sourceId: string;
}

const RISK_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-red-800' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800' },
  moderate: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  low: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const LDSDOHPanel: React.FC<LDSDOHPanelProps> = ({
  patientId,
  tenantId,
  noteText,
  sourceId,
}) => {
  const [result, setResult] = useState<LDSDOHResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    const response = await scanPrenatalNotesForSDOH(patientId, tenantId, noteText, sourceId);
    if (response.success && response.data) {
      setResult(response.data);
      setScanned(true);
    } else {
      setError(response.error?.message ?? 'SDOH scan failed');
    }
    setLoading(false);
  };

  // Don't show panel if no notes to scan
  if (!noteText || noteText.trim().length < 10) return null;

  if (!scanned) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">SDOH Screening</h4>
            <p className="text-xs text-gray-500">Scan prenatal notes for social determinant indicators</p>
          </div>
          <button
            onClick={handleScan}
            disabled={loading}
            className="bg-violet-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Scan for SDOH'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  if (result && result.totalDetections === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded p-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-green-800">SDOH Screening Complete</h4>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">No Concerns Detected</span>
        </div>
        <p className="text-xs text-green-600 mt-1">
          No social determinant indicators found in this prenatal note.
        </p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-lg font-bold text-gray-900">SDOH Findings</h4>
          <p className="text-xs text-gray-500">
            {result.totalDetections} indicator{result.totalDetections > 1 ? 's' : ''} detected
          </p>
        </div>
        {result.hasHighRiskFindings && (
          <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full">
            High Risk Findings
          </span>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
        AI-detected indicators require clinician verification. Consider adding Z-codes to the encounter for billing.
      </div>

      <div className="space-y-3">
        {result.detections.map((detection, i) => {
          const riskConfig = RISK_STYLE[detection.riskLevel] ?? RISK_STYLE.low;
          return (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${riskConfig.bg} ${riskConfig.text}`}>
                  {detection.riskLevel.toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  {detection.category.replace(/_/g, ' ')}
                </span>
                {detection.zCodeMapping && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                    {detection.zCodeMapping}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">
                  {(detection.confidenceScore * 100).toFixed(0)}% confidence
                </span>
              </div>

              <p className="text-sm text-gray-700">{detection.aiSummary}</p>

              {detection.recommendedActions.length > 0 && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Recommended Actions:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {detection.recommendedActions.map((action, j) => (
                      <li key={j} className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          action.priority === 'critical' ? 'bg-red-100 text-red-700' :
                          action.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {action.priority}
                        </span>
                        <span>{action.action}</span>
                        <span className="text-gray-400">({action.timeframe})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LDSDOHPanel;
