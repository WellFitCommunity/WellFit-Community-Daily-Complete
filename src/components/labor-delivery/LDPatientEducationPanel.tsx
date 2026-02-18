/**
 * LDPatientEducationPanel — AI-generated patient education content
 *
 * Purpose: Topic dropdown → generate education material for L&D patients
 * Used by: PrenatalTab (labor prep only), PostpartumTab (all 4 topics)
 */

import React, { useState } from 'react';
import {
  generateLDPatientEducation,
  LD_EDUCATION_TOPICS,
} from '../../services/laborDelivery/laborDeliveryAI_tier3';
import type { LDEducationTopicKey } from '../../services/laborDelivery/laborDeliveryAI_tier3';
import type { LDPatientEducationContent } from '../../types/laborDeliveryAI';

interface LDPatientEducationPanelProps {
  patientId?: string;
  availableTopics: LDEducationTopicKey[];
}

const LDPatientEducationPanel: React.FC<LDPatientEducationPanelProps> = ({
  patientId,
  availableTopics,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<LDEducationTopicKey | ''>('');
  const [content, setContent] = useState<LDPatientEducationContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!selectedTopic) return;

    const topicConfig = LD_EDUCATION_TOPICS[selectedTopic];
    setLoading(true);
    setError(null);
    setContent(null);

    const response = await generateLDPatientEducation(
      topicConfig.label,
      topicConfig.condition,
      patientId,
      'text'
    );

    if (response.success && response.data) {
      setContent(response.data);
    } else {
      setError(response.error?.message ?? 'Failed to generate education content');
    }
    setLoading(false);
  };

  const handleTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as LDEducationTopicKey | '';
    setSelectedTopic(value);
    setContent(null);
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg border p-4" role="region" aria-label="Patient education">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Patient Education</h4>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={selectedTopic}
          onChange={handleTopicChange}
          className="flex-1 border rounded px-3 py-2 text-sm min-h-[44px]"
          aria-label="Education topic"
        >
          <option value="">Select a topic...</option>
          {availableTopics.map((key) => (
            <option key={key} value={key}>
              {LD_EDUCATION_TOPICS[key].label}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={loading || !selectedTopic}
          className="bg-sky-600 text-white px-4 py-2 rounded font-medium min-h-[44px] hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      {content && (
        <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
          <h5 className="text-base font-bold text-gray-900 mb-2">{content.title}</h5>
          <div className="text-sm text-gray-700 whitespace-pre-line">{content.content}</div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Generated {new Date(content.generatedAt).toLocaleString()}</span>
            <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded font-medium">
              Review Required
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LDPatientEducationPanel;
