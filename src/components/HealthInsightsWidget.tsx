// Health Insights Widget - Powered by Claude AI + Smart Suggestions
import React, { useState, useEffect } from 'react';
import claudeService from '../services/claudeService';
import { getSmartSuggestions, getLocalSuggestions, SmartSuggestion } from '../services/smartSuggestionsService';

interface HistoricalReport {
  created_at: string;
  mood?: string;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  blood_sugar?: number | null;
  blood_oxygen?: number | null;
  heart_rate?: number | null;
  weight?: number | null;
}

interface TrendData {
  metric: string;
  label: string;
  current: number | null;
  avg7d: number | null;
  avg30d: number | null;
  direction: 'up' | 'down' | 'stable' | 'unknown';
}

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
  historicalReports?: HistoricalReport[];
  onClose?: () => void;
}

/**
 * Compute averages from historical reports within a given number of days
 */
function computeAvg(reports: HistoricalReport[], field: keyof HistoricalReport, days: number): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const values = reports
    .filter((r) => new Date(r.created_at) >= cutoff)
    .map((r) => r[field])
    .filter((v): v is number => typeof v === 'number' && v > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Determine trend direction by comparing recent 3-day avg to prior 7-day avg
 */
function getTrendDirection(reports: HistoricalReport[], field: keyof HistoricalReport): TrendData['direction'] {
  const recent = computeAvg(reports, field, 3);
  const prior = computeAvg(reports, field, 14);
  if (recent === null || prior === null) return 'unknown';
  const delta = (recent - prior) / prior;
  if (delta > 0.05) return 'up';
  if (delta < -0.05) return 'down';
  return 'stable';
}

function computeTrends(current: HealthInsightsProps['healthData'], reports: HistoricalReport[]): TrendData[] {
  const metrics: { metric: keyof HistoricalReport; label: string; currentVal: number | null | undefined }[] = [
    { metric: 'bp_systolic', label: 'Blood Pressure (systolic)', currentVal: current.bp_systolic },
    { metric: 'bp_diastolic', label: 'Blood Pressure (diastolic)', currentVal: current.bp_diastolic },
    { metric: 'blood_sugar', label: 'Blood Sugar', currentVal: current.blood_sugar },
    { metric: 'blood_oxygen', label: 'Blood Oxygen', currentVal: current.blood_oxygen },
    { metric: 'weight', label: 'Weight', currentVal: current.weight },
    { metric: 'heart_rate', label: 'Heart Rate', currentVal: current.heart_rate },
  ];

  return metrics
    .map(({ metric, label, currentVal }) => ({
      metric,
      label,
      current: currentVal ?? null,
      avg7d: computeAvg(reports, metric, 7),
      avg30d: computeAvg(reports, metric, 30),
      direction: getTrendDirection(reports, metric),
    }))
    .filter((t) => t.current !== null || t.avg7d !== null);
}

const DIRECTION_ICONS: Record<TrendData['direction'], string> = {
  up: '📈',
  down: '📉',
  stable: '➡️',
  unknown: '—',
};

const HealthInsightsWidget: React.FC<HealthInsightsProps> = ({ healthData, historicalReports, onClose }) => {
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [_suggestionSource, setSuggestionSource] = useState<'haiku' | 'fallback' | 'local'>('local');
  const [trends, setTrends] = useState<TrendData[]>([]);

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
      // Compute trends from historical data
      const computedTrends = historicalReports && historicalReports.length > 0
        ? computeTrends(healthData, historicalReports)
        : [];
      setTrends(computedTrends);

      // Build enriched health data with trend context for AI
      const enrichedData: Record<string, unknown> = { ...healthData };
      if (computedTrends.length > 0) {
        enrichedData.trends = computedTrends
          .filter((t) => t.avg7d !== null)
          .map((t) => ({
            metric: t.label,
            current: t.current,
            sevenDayAverage: t.avg7d !== null ? Math.round(t.avg7d * 10) / 10 : null,
            thirtyDayAverage: t.avg30d !== null ? Math.round(t.avg30d * 10) / 10 : null,
            direction: t.direction,
          }));
      }

      // Generate health insights with trend-enriched data
      let interpretation = '';
      try {
        const serviceStatus = claudeService.getServiceStatus?.();
        if (serviceStatus && !serviceStatus.isHealthy) {
          throw new Error('Claude AI service not available');
        }
        interpretation = await claudeService.interpretHealthData(enrichedData);
      } catch {
        interpretation = generateFallbackInsights(healthData, computedTrends);
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
      setInsights(generateFallbackInsights(healthData, trends));
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

  const generateFallbackInsights = (data: HealthInsightsProps['healthData'], trendData: TrendData[] = []): string => {
    const parts = [];

    if (data.mood) {
      if (['Great', 'Good'].includes(data.mood)) {
        parts.push("Your mood is positive today - that's wonderful!");
      } else if (['Okay'].includes(data.mood)) {
        parts.push("Your mood is neutral today. Consider some activities that make you feel good.");
      } else {
        parts.push("I notice you're not feeling your best today. Remember it's okay to have difficult days.");
      }
    }

    if (data.bp_systolic && data.bp_diastolic) {
      if (data.bp_systolic < 120 && data.bp_diastolic < 80) {
        parts.push("Your blood pressure looks normal - keep up the good work!");
      } else if (data.bp_systolic >= 140 || data.bp_diastolic >= 90) {
        parts.push("Your blood pressure is elevated. Consider discussing this with your doctor.");
      }
    }

    if (data.blood_sugar) {
      if (data.blood_sugar >= 70 && data.blood_sugar <= 140) {
        parts.push("Your blood sugar is in a healthy range.");
      } else {
        parts.push("Your blood sugar may need attention. Consult with your healthcare provider.");
      }
    }

    // Add trend-based insights from historical data
    for (const trend of trendData) {
      if (trend.direction === 'up' && trend.avg7d !== null) {
        parts.push(`Your ${trend.label.toLowerCase()} has been trending upward (7-day avg: ${Math.round(trend.avg7d)}).`);
      } else if (trend.direction === 'down' && trend.avg7d !== null) {
        parts.push(`Your ${trend.label.toLowerCase()} has been trending downward (7-day avg: ${Math.round(trend.avg7d)}).`);
      }
    }

    return parts.length > 0
      ? parts.join(' ')
      : "Thank you for tracking your health today. Keep up the good work!";
  };

  if (!hasHealthData(healthData)) {
    return null;
  }

  return (
    <div className="bg-white border-2 border-[#003865] rounded-2xl p-5 mt-6 shadow-lg">
      {/* AI Badge + Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-[#003865] text-white text-sm font-semibold px-3 py-1 rounded-full mb-2">
            <span>🤖</span> AI-Assisted Insights
          </div>
          <h3 className="text-xl font-bold text-[#003865] flex items-center">
            Your Health Insights
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl p-1 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close health insights"
          >
            ×
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center space-x-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#003865]"></div>
          <span className="text-[#003865] text-lg font-medium">Looking at your health data...</span>
        </div>
      ) : (
        <>
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
            <p className="text-gray-900 text-lg leading-relaxed">
              {insights}
            </p>
          </div>

          {/* Health Trends from Historical Data */}
          {trends.length > 0 && (
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-[#003865] mb-3 flex items-center">
                <span className="text-2xl mr-2">📊</span>
                Your Health Trends
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trends.map((trend) => (
                  <div
                    key={trend.metric}
                    className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-3"
                  >
                    <span className="text-2xl">{DIRECTION_ICONS[trend.direction]}</span>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-gray-900 truncate">{trend.label}</div>
                      <div className="text-sm text-gray-700">
                        {trend.current !== null && <span>Now: {Math.round(trend.current)}</span>}
                        {trend.avg7d !== null && (
                          <span className="ml-2">7d avg: {Math.round(trend.avg7d)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold text-[#003865] mb-3 flex items-center">
                <span className="text-2xl mr-2">💡</span>
                Things that might help you today:
              </h4>
              <ul className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion.id || index}
                    className="flex items-start bg-gray-50 rounded-xl p-4 border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow"
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
                    <span className="text-gray-900 text-lg leading-relaxed">
                      {suggestion.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-300">
            <p className="text-base text-gray-700 flex items-center">
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