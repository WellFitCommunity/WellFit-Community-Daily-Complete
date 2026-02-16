/**
 * LDShiftHandoffPanel — L&D shift handoff report generator
 *
 * Purpose: One-click structured handoff from active L&D data
 * Used by: LaborTab (nurse-to-nurse or provider-to-provider handoff)
 */

import React, { useState } from 'react';
import { generateLDShiftHandoff } from '../../services/laborDelivery/laborDeliveryAI_tier2';
import type { LDShiftHandoffResult } from '../../services/laborDelivery/laborDeliveryAI_tier2';

interface LDShiftHandoffPanelProps {
  patientId: string;
  tenantId: string;
  pregnancyId: string;
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'border-l-4 border-l-red-500 bg-red-50',
  notable: 'border-l-4 border-l-yellow-500 bg-yellow-50',
  routine: 'border-l-4 border-l-gray-300 bg-gray-50',
};

const URGENCY_STYLE: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-600', text: 'text-white' },
  urgent: { bg: 'bg-orange-500', text: 'text-white' },
  routine: { bg: 'bg-green-100', text: 'text-green-800' },
};

const LDShiftHandoffPanel: React.FC<LDShiftHandoffPanelProps> = ({
  patientId,
  tenantId,
  pregnancyId,
}) => {
  const [result, setResult] = useState<LDShiftHandoffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const response = await generateLDShiftHandoff(patientId, tenantId, pregnancyId);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to generate shift handoff');
    }
    setLoading(false);
  };

  if (!result) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">L&D Shift Handoff</h4>
            <p className="text-xs text-gray-500">Generate structured nurse-to-nurse handoff report</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-amber-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Handoff'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const urgencyConfig = URGENCY_STYLE[result.urgencyLevel] ?? URGENCY_STYLE.routine;

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4 print:border-0" role="article" aria-label="Shift handoff report">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <h4 className="text-lg font-bold text-gray-900">L&D Shift Handoff</h4>
          <p className="text-sm text-gray-600">{result.patientSummary}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${urgencyConfig.bg} ${urgencyConfig.text}`}>
            {result.urgencyLevel.toUpperCase()}
          </span>
          <button
            onClick={() => window.print()}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium min-h-[44px] px-3"
          >
            Print
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-sm text-amber-600 hover:text-amber-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
          >
            {loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* Handoff Sections */}
      <div className="space-y-3">
        {result.sections.map((section, i) => (
          <div key={i} className={`rounded p-4 ${PRIORITY_STYLE[section.priority] ?? PRIORITY_STYLE.routine}`}>
            <h5 className="text-sm font-bold text-gray-800 mb-1">{section.title}</h5>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{section.content}</p>
          </div>
        ))}
      </div>

      {/* Pending Actions */}
      {result.pendingActions.length > 0 && (
        <section className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h5 className="text-sm font-bold text-yellow-800 mb-2">Pending Actions</h5>
          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
            {result.pendingActions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="text-xs text-gray-400 pt-2 border-t">
        Generated {new Date(result.generatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default LDShiftHandoffPanel;
