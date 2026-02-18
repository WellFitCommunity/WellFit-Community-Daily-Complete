/**
 * LDBirthPlanPanel — AI-generated birth plan with 8 customizable sections
 *
 * Purpose: Generate a comprehensive birth plan from pregnancy context
 * Used by: PrenatalTab
 */

import React, { useState } from 'react';
import { generateBirthPlan } from '../../services/laborDelivery/laborDeliveryAI_tier3';
import type { LDBirthPlan } from '../../types/laborDeliveryAI';

interface LDBirthPlanPanelProps {
  patientId: string;
  providerId: string;
}

const SECTION_ICONS: Record<string, string> = {
  labor_environment: '🏥',
  pain_management: '💊',
  delivery_preferences: '🤱',
  newborn_care: '👶',
  feeding_plan: '🍼',
  support_team: '👥',
  emergency_preferences: '🚨',
  postpartum_wishes: '🌸',
};

const LDBirthPlanPanel: React.FC<LDBirthPlanPanelProps> = ({
  patientId,
  providerId,
}) => {
  const [plan, setPlan] = useState<LDBirthPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    const response = await generateBirthPlan(patientId, providerId);
    if (response.success && response.data) {
      setPlan(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to generate birth plan');
    }
    setLoading(false);
  };

  if (!plan) {
    return (
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-700">AI Birth Plan Generator</h4>
            <p className="text-xs text-gray-500">
              Create a personalized birth plan based on pregnancy data
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="bg-rose-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Birth Plan'}
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  const sectionEntries = Object.entries(plan.sections) as Array<
    [string, { title: string; content: string; preferences: string[] }]
  >;

  return (
    <div className="bg-rose-50 border-2 border-rose-200 rounded-lg p-5" role="region" aria-label="Birth plan">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-lg font-bold text-gray-900">AI Birth Plan</h4>
          <p className="text-xs text-gray-500">
            Generated {new Date(plan.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="text-sm text-rose-600 hover:text-rose-800 font-medium min-h-[44px] px-3"
          >
            Print
          </button>
          <button
            onClick={generate}
            disabled={loading}
            className="text-sm text-rose-600 hover:text-rose-800 font-medium min-h-[44px] px-3 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Regenerate'}
          </button>
        </div>
      </div>

      {/* 8-section grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {sectionEntries.map(([key, section]) => (
          <div key={key} className="bg-white rounded-lg p-4 border border-rose-100">
            <h5 className="text-sm font-bold text-gray-800 mb-2">
              {SECTION_ICONS[key] ?? '📋'} {section.title}
            </h5>
            {section.content && (
              <p className="text-sm text-gray-700 mb-2">{section.content}</p>
            )}
            {section.preferences.length > 0 && (
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {section.preferences.map((pref, i) => (
                  <li key={i}>{pref}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Review disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800">
        <span className="font-bold">Clinical Review Required:</span> This birth plan was generated
        by AI and must be reviewed with the patient and their provider before finalization.
        Confidence: {(plan.confidenceScore * 100).toFixed(0)}%
      </div>
    </div>
  );
};

export default LDBirthPlanPanel;
