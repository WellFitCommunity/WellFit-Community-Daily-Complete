/**
 * LDContraindicationPanel — AI contraindication checking for L&D medications
 *
 * Purpose: Manual trigger to check if a medication is contraindicated given patient's
 *   allergies, conditions, labs, and pregnancy status
 * Used by: MedicationAdminForm (below drug interaction alert)
 */

import React, { useState } from 'react';
import { checkLDContraindication } from '../../services/laborDelivery/laborDeliveryAI_tier3';
import type { LDContraindicationResult, LDContraindicationAssessment } from '../../types/laborDeliveryAI';

interface LDContraindicationPanelProps {
  patientId: string;
  providerId: string;
  medicationName: string;
  indication?: string;
}

const ASSESSMENT_CONFIG: Record<LDContraindicationAssessment, {
  bg: string; border: string; text: string; label: string; badge: string;
}> = {
  safe: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', label: 'Safe', badge: 'bg-green-100 text-green-800' },
  caution: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', label: 'Caution', badge: 'bg-yellow-100 text-yellow-800' },
  warning: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', label: 'Warning', badge: 'bg-orange-100 text-orange-800' },
  contraindicated: { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', label: 'Contraindicated', badge: 'bg-red-100 text-red-800' },
};

const LDContraindicationPanel: React.FC<LDContraindicationPanelProps> = ({
  patientId,
  providerId,
  medicationName,
  indication,
}) => {
  const [result, setResult] = useState<LDContraindicationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setLoading(true);
    setError(null);
    const response = await checkLDContraindication(patientId, providerId, medicationName, indication);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to check contraindications');
    }
    setLoading(false);
  };

  if (!result) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">AI Contraindication Check</h4>
            <p className="text-xs text-gray-500">
              Check <strong>{medicationName}</strong> against patient allergies, conditions &amp; pregnancy
            </p>
          </div>
          <button
            onClick={check}
            disabled={loading}
            className="bg-amber-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check Contraindications'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const config = ASSESSMENT_CONFIG[result.assessment];

  return (
    <div className={`rounded-lg border-2 p-5 ${config.bg} ${config.border}`} role="region" aria-label="Contraindication check">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">Contraindication Check</h4>
          <p className="text-sm text-gray-600">{medicationName}</p>
        </div>
        <span className={`text-lg font-black px-4 py-1 rounded-full ${config.badge}`}>
          {config.label}
        </span>
      </div>

      {/* Clinical summary */}
      {result.clinicalSummary && (
        <p className="text-sm text-gray-700 mb-4">{result.clinicalSummary}</p>
      )}

      {/* Findings list */}
      {result.findings.length > 0 && (
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-2">
            Findings ({result.findings.length})
          </h5>
          <div className="space-y-2">
            {result.findings.map((finding, i) => (
              <div key={i} className="bg-white bg-opacity-60 rounded p-3 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                    {finding.type}
                  </span>
                  <span className="text-xs text-gray-500">{finding.severity}</span>
                </div>
                <p className="font-medium">{finding.description}</p>
                {finding.recommendation && (
                  <p className="text-xs text-gray-600 mt-1">{finding.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clinical review flag */}
      {result.requiresClinicalReview && (
        <div className="bg-amber-100 border border-amber-300 rounded p-3 mb-4 text-sm text-amber-800">
          <span className="font-bold">Clinical Review Required</span> — This assessment indicates
          potential concerns. A physician must review before proceeding.
        </div>
      )}

      {/* Re-check */}
      <div className="flex justify-end">
        <button
          onClick={check}
          disabled={loading}
          className="text-sm text-amber-600 hover:text-amber-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Re-check'}
        </button>
      </div>
    </div>
  );
};

export default LDContraindicationPanel;
