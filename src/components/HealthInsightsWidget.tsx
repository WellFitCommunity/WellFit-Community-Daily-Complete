// Health Insights Widget - Powered by Claude AI + Smart Suggestions
import React, { useState, useEffect } from 'react';
import claudeService from '../services/claudeService';
import { getSmartSuggestions, getLocalSuggestions, SmartSuggestion } from '../services/smartSuggestionsService';

interface HealthInsightsProps {
  healthData: {
    mood?: string;
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    blood_sugar?: number | null;
    blood_oxygen?: number | null;
    heart_rate?: number | null;
    weight?: number | null;
    symptoms?: string | null;
    physical_activity?: string | null;
  };
  onClose?: () => void;
}

const HealthInsightsWidget: React.FC<HealthInsightsProps> = ({ healthData, onClose }) => {
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [_suggestionSource, setSuggestionSource] = useState<'haiku' | 'fallback' | 'local'>('local');

  useEffect(() => {
    if (hasHealthData(healthData)) {
      generateInsights().catch(() => {
        setInsights('Unable to generate insights at this time. Please try again later.');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthData]);

  const hasHealthData = (data: HealthInsightsProps['healthData']): boolean => {
    return !!(data.mood || data.bp_systolic || data.blood_sugar || data.blood_oxygen || data.heart_rate || data.symptoms);
  };

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      // Generate health insights (existing logic)
      let interpretation = '';
      try {
        const serviceStatus = claudeService.getServiceStatus?.();
        if (serviceStatus && !serviceStatus.isHealthy) {
          throw new Error('Claude AI service not available');
        }
        interpretation = await claudeService.interpretHealthData(healthData);
      } catch {
        interpretation = generateFallbackInsights(healthData);
      }
      setInsights(interpretation);

      // Get SMART suggestions using Haiku (new hybrid approach)
      if (healthData.mood) {
        try {
          const smartResponse = await getSmartSuggestions(healthData.mood, {
            symptoms: healthData.symptoms || undefined,
            notes: healthData.physical_activity || undefined,
          });
          setSuggestions(smartResponse.suggestions);
          setSuggestionSource(smartResponse.source);
        } catch {
          // Fall back to local suggestions if Edge Function fails
          const localSuggestions = getLocalSuggestions(healthData.mood, 3);
          setSuggestions(localSuggestions);
          setSuggestionSource('local');
        }
      } else {
        // No mood selected, use generic suggestions
        setSuggestions([
          { text: 'Keep tracking your health daily', type: 'practical' },
          { text: 'Stay hydrated throughout the day', type: 'practical' },
          { text: 'Get adequate rest tonight', type: 'comfort' },
        ]);
        setSuggestionSource('local');
      }

    } catch {
      // Use fallback insights when AI is unavailable
      setInsights(generateFallbackInsights(healthData));
      setSuggestions([
        { text: 'Keep tracking your health daily', type: 'practical' },
        { text: 'Stay hydrated', type: 'practical' },
        { text: 'Get adequate rest', type: 'comfort' },
      ]);
      setSuggestionSource('local');
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackInsights = (data: HealthInsightsProps['healthData']): string => {
    const insights = [];

    if (data.mood) {
      if (['Great', 'Good'].includes(data.mood)) {
        insights.push("Your mood is positive today - that's wonderful!");
      } else if (['Okay'].includes(data.mood)) {
        insights.push("Your mood is neutral today. Consider some activities that make you feel good.");
      } else {
        insights.push("I notice you're not feeling your best today. Remember it's okay to have difficult days.");
      }
    }

    if (data.bp_systolic && data.bp_diastolic) {
      if (data.bp_systolic < 120 && data.bp_diastolic < 80) {
        insights.push("Your blood pressure looks normal - keep up the good work!");
      } else if (data.bp_systolic >= 140 || data.bp_diastolic >= 90) {
        insights.push("Your blood pressure is elevated. Consider discussing this with your doctor.");
      }
    }

    if (data.blood_sugar) {
      if (data.blood_sugar >= 70 && data.blood_sugar <= 140) {
        insights.push("Your blood sugar is in a healthy range.");
      } else {
        insights.push("Your blood sugar may need attention. Consult with your healthcare provider.");
      }
    }

    return insights.length > 0
      ? insights.join(' ')
      : "Thank you for tracking your health today. Keep up the good work!";
  };

  if (!hasHealthData(healthData)) {
    return null;
  }

  return (
    <div className="bg-linear-to-br from-blue-50 to-green-50 border-2 border-blue-200 rounded-2xl p-5 mt-6 shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-blue-800 flex items-center">
          <span className="text-2xl mr-2">🤖</span>
          Your Health Insights
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-800 text-2xl p-1 hover:bg-blue-100 rounded-full transition-colors"
            aria-label="Close health insights"
          >
            ×
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center space-x-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-blue-700 text-lg">Looking at your health data...</span>
        </div>
      ) : (
        <>
          <p className="text-gray-800 text-base mb-4 leading-relaxed bg-white/50 rounded-lg p-3">
            {insights}
          </p>

          {suggestions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
                <span className="text-2xl mr-2">💡</span>
                Things that might help you today:
              </h4>
              <ul className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.id || index}
                    className="flex items-start bg-linear-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-100 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <span className="text-3xl mr-3 shrink-0">
                      {suggestion.type === 'breathing' && '🌬️'}
                      {suggestion.type === 'physical' && '🚶'}
                      {suggestion.type === 'social' && '👥'}
                      {suggestion.type === 'mindfulness' && '🧘'}
                      {suggestion.type === 'practical' && '✅'}
                      {suggestion.type === 'comfort' && '💚'}
                      {suggestion.type === 'gratitude' && '🙏'}
                      {suggestion.type === 'creative' && '🎨'}
                      {!suggestion.type && '💫'}
                    </span>
                    <span className="text-gray-800 text-base leading-relaxed">
                      {suggestion.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-blue-200">
            <p className="text-sm text-gray-600 flex items-center">
              <span className="mr-2">ℹ️</span>
              These are helpful tips, not medical advice. Talk to your doctor about any health concerns.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default HealthInsightsWidget;