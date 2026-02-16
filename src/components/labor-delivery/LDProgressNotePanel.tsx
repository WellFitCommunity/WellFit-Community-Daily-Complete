/**
 * LDProgressNotePanel — AI-generated labor progress notes (SOAP format)
 *
 * Purpose: One-click progress note generation from ai-progress-note-synthesizer
 * Used by: LaborTab
 */

import React, { useState } from 'react';
import { generateLaborProgressNote } from '../../services/laborDelivery/laborDeliveryAI';
import type { LDProgressNote } from '../../services/laborDelivery/laborDeliveryAI';

interface LDProgressNotePanelProps {
  patientId: string;
  providerId: string;
}

const LDProgressNotePanel: React.FC<LDProgressNotePanelProps> = ({ patientId, providerId }) => {
  const [note, setNote] = useState<LDProgressNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    const response = await generateLaborProgressNote(patientId, providerId);
    if (response.success && response.data) {
      setNote(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to generate progress note');
    }
    setLoading(false);
  };

  if (!note) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">AI Progress Note</h4>
            <p className="text-xs text-gray-500">Generate SOAP note from recent labor data</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-teal-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Progress Note'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6 print:border-0" role="article" aria-label="Progress note">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-gray-900">AI-Generated Progress Note</h4>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="text-sm text-gray-600 hover:text-gray-800 font-medium min-h-[44px] px-3 print:hidden"
          >
            Print
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium min-h-[44px] px-3 print:hidden disabled:opacity-50"
          >
            {loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-xs text-yellow-800 print:hidden">
        AI-generated — requires clinician review and co-signature before finalization
      </div>

      <div className="space-y-4">
        <div>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Subjective</h5>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{note.subjective}</p>
        </div>
        <div>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Objective</h5>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{note.objective}</p>
        </div>
        <div>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Assessment</h5>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{note.assessment}</p>
        </div>
        <div>
          <h5 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Plan</h5>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{note.plan}</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t text-xs text-gray-400">
        Generated {new Date(note.generatedAt).toLocaleString()} | Model: {note.model}
      </div>
    </div>
  );
};

export default LDProgressNotePanel;
