// Health Insights Widget - Powered by Claude AI
import React, { useState, useEffect } from 'react';
import claudeService from '../services/claudeService';

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
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (hasHealthData(healthData)) {
      generateInsights();
    }
  }, [healthData]);

  const hasHealthData = (data: any): boolean => {
    return data.mood || data.bp_systolic || data.blood_sugar || data.blood_oxygen || data.heart_rate || data.symptoms;
  };

  const generateInsights = async () => {
    setIsLoading(true);
    try {
      const interpretation = await claudeService.interpretHealthData(healthData);
      setInsights(interpretation);

      // Generate health suggestions
      const healthSuggestions = await claudeService.generateHealthSuggestions({}, {
        mood: healthData.mood,
        lastActivity: healthData.physical_activity,
        checkInCount: 1
      });
      setSuggestions(healthSuggestions.slice(0, 3));

    } catch (error) {
      console.error('Error generating health insights:', error);
      setInsights(generateFallbackInsights(healthData));
      setSuggestions(['Keep tracking your health daily', 'Stay hydrated', 'Get adequate rest']);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackInsights = (data: any): string => {
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
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-blue-800 flex items-center">
          🤖 Health Insights
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-800 text-xl"
          >
            ×
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-blue-700">Analyzing your health data...</span>
        </div>
      ) : (
        <>
          <p className="text-blue-800 mb-3 leading-relaxed">
            {insights}
          </p>

          {suggestions.length > 0 && (
            <div className="mt-3">
              <h4 className="font-medium text-blue-800 mb-2">💡 Suggestions for you:</h4>
              <ul className="space-y-1">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="text-blue-700 text-sm flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              💡 This is AI-generated guidance. Always consult your healthcare provider for medical advice.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default HealthInsightsWidget;