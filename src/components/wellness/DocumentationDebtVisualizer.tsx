// ============================================================================
// Documentation Debt Visualizer
// ============================================================================
// Purpose: Show providers their paperwork burden decreasing with AI assistance
// Design: Before/After comparison, time saved, revenue captured
// ============================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

interface DocumentationDebtVisualizerProps {
  userId?: string;
  showDetailed?: boolean;
}

interface DocumentationStats {
  totalSoapNotes: number;
  totalScribeSessions: number;
  totalDurationMinutes: number;
  estimatedTimeSavedMinutes: number;
  billingCodesCapture: number;
  estimatedRevenueImpact: number;
  weeklyAvgBeforeMinutes: number;
  weeklyAvgWithRileyMinutes: number;
}

export const DocumentationDebtVisualizer: React.FC<DocumentationDebtVisualizerProps> = ({
  userId,
  showDetailed = false,
}) => {
  const [stats, setStats] = useState<DocumentationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    const loadStats = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Calculate date range
        const now = new Date();
        let startDate: Date;
        if (timeframe === 'week') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (timeframe === 'month') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else {
          startDate = new Date('2020-01-01');
        }

        // Fetch scribe sessions
        const { data: sessions, error } = await supabase
          .from('scribe_sessions')
          .select('id, recording_duration_seconds, suggested_cpt_codes, suggested_icd10_codes, ai_note_subjective')
          .eq('provider_id', userId)
          .gte('created_at', startDate.toISOString());

        if (error) throw error;

        // Calculate stats
        const totalSessions = sessions?.length || 0;
        const totalDurationSeconds = sessions?.reduce((sum, s) => sum + (s.recording_duration_seconds || 0), 0) || 0;
        const totalDurationMinutes = Math.round(totalDurationSeconds / 60);

        // Count SOAP notes generated (has ai_note_subjective)
        const soapNotes = sessions?.filter(s => s.ai_note_subjective)?.length || 0;

        // Count billing codes
        const billingCodes = sessions?.reduce((sum, s) => {
          const cptCount = Array.isArray(s.suggested_cpt_codes) ? s.suggested_cpt_codes.length : 0;
          const icdCount = Array.isArray(s.suggested_icd10_codes) ? s.suggested_icd10_codes.length : 0;
          return sum + cptCount + icdCount;
        }, 0) || 0;

        // Estimate time saved: Average SOAP note takes 15 min manually, Riley saves ~12 min per note
        const estimatedTimeSaved = soapNotes * 12;

        // Estimate revenue impact: Assume $50 average per captured code that might have been missed
        // Conservative: assume 20% of codes would have been missed
        const estimatedRevenue = Math.round(billingCodes * 0.2 * 50);

        // Weekly averages (industry average: 8.5 hrs/week on documentation)
        const weeklyAvgBefore = 8.5 * 60; // 510 minutes
        const weeklyAvgWithRiley = Math.max(weeklyAvgBefore - (estimatedTimeSaved / (timeframe === 'week' ? 1 : timeframe === 'month' ? 4 : 12)), weeklyAvgBefore * 0.4);

        setStats({
          totalSoapNotes: soapNotes,
          totalScribeSessions: totalSessions,
          totalDurationMinutes,
          estimatedTimeSavedMinutes: estimatedTimeSaved,
          billingCodesCapture: billingCodes,
          estimatedRevenueImpact: estimatedRevenue,
          weeklyAvgBeforeMinutes: weeklyAvgBefore,
          weeklyAvgWithRileyMinutes: weeklyAvgWithRiley,
        });
      } catch (error) {
        auditLogger.error('DOCUMENTATION_DEBT_LOAD_FAILED', error instanceof Error ? error : new Error('Load failed'));
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [userId, timeframe]);

  // Format time for display
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
        <div className="h-6 bg-gray-200 rounded-sm w-32 mb-4"></div>
        <div className="h-20 bg-gray-200 rounded-sm"></div>
      </div>
    );
  }

  if (!stats || stats.totalScribeSessions === 0) {
    return (
      <div className="bg-linear-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <div>
            <h4 className="font-semibold text-gray-900">Documentation Tracker</h4>
            <p className="text-sm text-gray-600">
              Use Riley to see your time savings here!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate percentage reduction
  const reductionPercent = Math.round(
    ((stats.weeklyAvgBeforeMinutes - stats.weeklyAvgWithRileyMinutes) / stats.weeklyAvgBeforeMinutes) * 100
  );

  return (
    <div className="bg-linear-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h4 className="font-semibold text-gray-900">Documentation Savings</h4>
        </div>
        {showDetailed && (
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as 'week' | 'month' | 'all')}
            className="text-xs border border-gray-300 rounded-sm px-2 py-1"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        )}
      </div>

      {/* Time Comparison Bars */}
      <div className="space-y-2 mb-4">
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Before Riley</span>
            <span>{formatTime(stats.weeklyAvgBeforeMinutes)}/week</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>With Riley</span>
            <span>{formatTime(Math.round(stats.weeklyAvgWithRileyMinutes))}/week</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(stats.weeklyAvgWithRileyMinutes / stats.weeklyAvgBeforeMinutes) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            {formatTime(stats.estimatedTimeSavedMinutes)}
          </div>
          <div className="text-xs text-gray-600">Time Saved</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalSoapNotes}
          </div>
          <div className="text-xs text-gray-600">SOAP Notes</div>
        </div>
      </div>

      {/* Impact Message */}
      <div className="mt-4 pt-3 border-t border-purple-200 text-center">
        <p className="text-sm text-purple-800">
          <span className="font-bold">{reductionPercent}% less paperwork</span>
          {stats.estimatedTimeSavedMinutes >= 60 && (
            <span className="block text-xs text-purple-600 mt-1">
              That's {Math.round(stats.estimatedTimeSavedMinutes / 60)} more hours with your family!
            </span>
          )}
        </p>
      </div>

      {/* Billing Impact (if significant) */}
      {stats.estimatedRevenueImpact > 100 && showDetailed && (
        <div className="mt-3 bg-green-100 rounded-lg p-3 border border-green-300">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <div>
              <div className="text-sm font-semibold text-green-800">
                Est. ${stats.estimatedRevenueImpact.toLocaleString()} captured
              </div>
              <div className="text-xs text-green-700">
                {stats.billingCodesCapture} billing codes suggested
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentationDebtVisualizer;
