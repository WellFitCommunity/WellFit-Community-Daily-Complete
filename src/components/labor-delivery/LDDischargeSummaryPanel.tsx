/**
 * LDDischargeSummaryPanel — AI-generated postpartum discharge summary
 *
 * Purpose: One-click discharge summary for mother + newborn from ai-discharge-summary
 * Used by: PostpartumTab (after delivery is recorded)
 */

import React, { useState } from 'react';
import { generateDischargeSummary } from '../../services/laborDelivery/laborDeliveryAI';
import type { LDDischargeSummary } from '../../services/laborDelivery/laborDeliveryAI';

interface LDDischargeSummaryPanelProps {
  patientId: string;
  tenantId: string;
}

const LDDischargeSummaryPanel: React.FC<LDDischargeSummaryPanelProps> = ({
  patientId,
  tenantId,
}) => {
  const [summary, setSummary] = useState<LDDischargeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const response = await generateDischargeSummary(patientId, tenantId);
    if (response.success && response.data) {
      setSummary(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to generate discharge summary');
    }
    setLoading(false);
  };

  if (!summary) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">AI Discharge Summary</h4>
            <p className="text-xs text-gray-500">Generate mother + newborn discharge instructions</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Discharge Summary'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6 print:border-0" role="article" aria-label="Discharge summary">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <h4 className="text-lg font-bold text-gray-900">AI Discharge Summary</h4>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium min-h-[44px] px-3"
          >
            Print
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
          >
            {loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-xs text-yellow-800 print:hidden">
        AI-generated — requires clinician review before providing to patient.
        Confidence: {(summary.confidenceScore * 100).toFixed(0)}%
      </div>

      {/* Hospital Course */}
      {summary.hospitalCourse && (
        <section className="mb-5">
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Hospital Course</h5>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{summary.hospitalCourse}</p>
        </section>
      )}

      {/* Diagnoses */}
      {summary.diagnoses.length > 0 && (
        <section className="mb-5">
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Diagnoses</h5>
          <ul className="text-sm text-gray-700 space-y-1">
            {summary.diagnoses.map((dx, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{dx.code}</span>
                <span>{dx.display}</span>
                <span className="text-xs text-gray-500">({dx.type})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Medications */}
      {summary.medications.length > 0 && (
        <section className="mb-5">
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Discharge Medications</h5>
          <div className="space-y-2">
            {summary.medications.map((med, i) => (
              <div key={i} className="bg-gray-50 rounded p-3 text-sm">
                <p className="font-medium">{med.name} — {med.dose}</p>
                <p className="text-xs text-gray-600">{med.frequency} | {med.instructions}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Follow-up */}
      {summary.followUpInstructions.length > 0 && (
        <section className="mb-5">
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Follow-Up Instructions</h5>
          <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
            {summary.followUpInstructions.map((inst, i) => (
              <li key={i}>{inst}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Warning Signs */}
      {(summary.warningSignsMother.length > 0 || summary.warningSignsNewborn.length > 0) && (
        <section className="mb-5 bg-red-50 border border-red-200 rounded p-4">
          <h5 className="text-sm font-bold text-red-800 uppercase tracking-wide mb-2">Warning Signs — Call Immediately If</h5>
          {summary.warningSignsMother.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Mother:</p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                {summary.warningSignsMother.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {summary.warningSignsNewborn.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">Newborn:</p>
              <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                {summary.warningSignsNewborn.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Patient Education */}
      {summary.patientEducation.length > 0 && (
        <section className="mb-5">
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-2">Patient Education</h5>
          <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
            {summary.patientEducation.map((ed, i) => <li key={i}>{ed}</li>)}
          </ul>
        </section>
      )}

      <div className="mt-4 pt-3 border-t text-xs text-gray-400">
        Generated {new Date(summary.generatedAt).toLocaleString()}
      </div>
    </div>
  );
};

export default LDDischargeSummaryPanel;
