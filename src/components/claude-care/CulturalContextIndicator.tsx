// ============================================================================
// Cultural Context Indicator - Display cultural considerations for patient
// ============================================================================

import React from 'react';
import { PatientCulturalContext, LANGUAGE_NAMES } from '../../types/claudeCareAssistant';

interface Props {
  culturalContext: PatientCulturalContext;
}

const CulturalContextIndicator: React.FC<Props> = ({ culturalContext }) => {
  const getCommunicationStyleIcon = (style: string): string => {
    const icons: Record<string, string> = {
      direct: '💬',
      indirect: '🤝',
      formal: '👔',
      casual: '😊',
    };
    return icons[style] || '💬';
  };

  const getHealthLiteracyColor = (level: string): string => {
    const colors: Record<string, string> = {
      low: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-green-100 text-green-800',
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">🌍</span>
        <h3 className="text-lg font-semibold text-gray-900">Cultural Context</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Primary Language */}
        <div className="bg-white rounded-md p-3 shadow-sm">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-lg">🗣️</span>
            <span className="text-xs font-semibold text-gray-600 uppercase">Language</span>
          </div>
          <p className="text-sm font-medium text-gray-900">
            {LANGUAGE_NAMES[culturalContext.primaryLanguage]}
          </p>
        </div>

        {/* Communication Style */}
        {culturalContext.preferredCommunicationStyle && (
          <div className="bg-white rounded-md p-3 shadow-sm">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-lg">
                {getCommunicationStyleIcon(culturalContext.preferredCommunicationStyle)}
              </span>
              <span className="text-xs font-semibold text-gray-600 uppercase">
                Communication
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {culturalContext.preferredCommunicationStyle}
            </p>
          </div>
        )}

        {/* Health Literacy */}
        {culturalContext.healthLiteracyLevel && (
          <div className="bg-white rounded-md p-3 shadow-sm">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-lg">📚</span>
              <span className="text-xs font-semibold text-gray-600 uppercase">
                Health Literacy
              </span>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded font-semibold ${getHealthLiteracyColor(
                culturalContext.healthLiteracyLevel
              )}`}
            >
              {culturalContext.healthLiteracyLevel.toUpperCase()}
            </span>
          </div>
        )}

        {/* Cultural Background */}
        {culturalContext.culturalBackground && (
          <div className="bg-white rounded-md p-3 shadow-sm">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-lg">🎭</span>
              <span className="text-xs font-semibold text-gray-600 uppercase">Background</span>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {culturalContext.culturalBackground}
            </p>
          </div>
        )}
      </div>

      {/* Religious/Cultural Considerations */}
      {culturalContext.religiousCulturalConsiderations &&
        culturalContext.religiousCulturalConsiderations.length > 0 && (
          <div className="bg-white rounded-md p-3 shadow-sm">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-lg">🙏</span>
              <span className="text-xs font-semibold text-gray-600 uppercase">
                Important Considerations
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {culturalContext.religiousCulturalConsiderations.map((consideration, index) => (
                <span
                  key={index}
                  className="text-xs bg-purple-100 text-purple-800 px-3 py-1 rounded-full"
                >
                  {consideration}
                </span>
              ))}
            </div>
          </div>
        )}

      {/* Info Note */}
      <div className="text-xs text-gray-600 bg-white rounded-md p-3">
        <p className="flex items-start">
          <svg
            className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Use this cultural context to provide respectful, culturally competent care.
            Consider language barriers, communication preferences, and cultural sensitivities
            in all interactions.
          </span>
        </p>
      </div>
    </div>
  );
};

export default CulturalContextIndicator;
