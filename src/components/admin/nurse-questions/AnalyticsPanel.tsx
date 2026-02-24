/**
 * AnalyticsPanel — Nurse Question Metrics Dashboard
 *
 * Purpose: Displays response time, AI acceptance rate, escalation stats, and volume metrics
 * Used by: NurseQuestionManager orchestrator
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, Brain, AlertTriangle, TrendingUp } from 'lucide-react';
import { NurseQuestionService } from '../../../services/nurseQuestionService';
import type { NurseQuestionMetrics } from '../../../services/nurseQuestionService';
import { auditLogger } from '../../../services/auditLogger';

interface AnalyticsPanelProps {
  /** Trigger a refresh when this changes */
  refreshTrigger?: number;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ refreshTrigger }) => {
  const [metrics, setMetrics] = useState<NurseQuestionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      setLoading(true);
      const result = await NurseQuestionService.fetchMetrics();

      if (cancelled) return;

      if (result.success) {
        setMetrics(result.data);
      } else {
        await auditLogger.error(
          'NURSE_ANALYTICS_LOAD_FAILED',
          new Error(result.error.message),
          { context: 'AnalyticsPanel' }
        );
      }
      setLoading(false);
    };

    loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-xs border p-4">
        <div className="flex items-center space-x-2 text-gray-500">
          <BarChart3 size={18} className="animate-pulse" />
          <span className="text-sm">Loading metrics...</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const aiRate = metrics.ai_acceptance_rate ?? 0;
  const totalEscalated =
    metrics.escalated_to_charge_nurse +
    metrics.escalated_to_supervisor +
    metrics.escalated_to_physician;

  return (
    <div className="bg-white rounded-lg shadow-xs border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 min-h-[44px]"
      >
        <div className="flex items-center space-x-2">
          <BarChart3 size={18} className="text-indigo-600" />
          <span className="font-medium text-gray-900">Question Analytics</span>
          <span className="text-sm text-gray-500">
            ({metrics.questions_last_24h} today, {metrics.questions_last_7d} this week)
          </span>
        </div>
        <span className="text-gray-400 text-sm">
          {expanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {/* Response Time */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Clock size={14} className="text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Avg Response</span>
              </div>
              <p className="text-lg font-bold text-blue-900">
                {metrics.avg_response_hours > 0
                  ? `${metrics.avg_response_hours}h`
                  : 'N/A'}
              </p>
              {metrics.median_response_hours > 0 && (
                <p className="text-xs text-blue-600">
                  Median: {metrics.median_response_hours}h
                </p>
              )}
            </div>

            {/* AI Acceptance */}
            <div className="p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Brain size={14} className="text-purple-600" />
                <span className="text-xs font-medium text-purple-700">AI Acceptance</span>
              </div>
              <p className="text-lg font-bold text-purple-900">{aiRate}%</p>
              <p className="text-xs text-purple-600">
                {metrics.ai_suggestions_accepted ?? 0} of{' '}
                {metrics.total_answered_with_records ?? metrics.answered_count} answers
              </p>
            </div>

            {/* Escalations */}
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <AlertTriangle size={14} className="text-orange-600" />
                <span className="text-xs font-medium text-orange-700">Escalated</span>
              </div>
              <p className="text-lg font-bold text-orange-900">{totalEscalated}</p>
              <p className="text-xs text-orange-600">
                {metrics.escalated_to_charge_nurse} CN, {metrics.escalated_to_supervisor} Sup,{' '}
                {metrics.escalated_to_physician} MD
              </p>
            </div>

            {/* Queue Status */}
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <TrendingUp size={14} className="text-green-600" />
                <span className="text-xs font-medium text-green-700">Queue</span>
              </div>
              <p className="text-lg font-bold text-green-900">
                {metrics.pending_count + metrics.claimed_count}
              </p>
              <p className="text-xs text-green-600">
                {metrics.pending_count} pending, {metrics.claimed_count} claimed
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">By Status</h4>
              <div className="space-y-1">
                <StatRow label="Total" value={metrics.total_questions} />
                <StatRow label="Pending" value={metrics.pending_count} color="text-yellow-600" />
                <StatRow label="Claimed" value={metrics.claimed_count} color="text-blue-600" />
                <StatRow label="Answered" value={metrics.answered_count} color="text-green-600" />
                <StatRow label="Escalated" value={metrics.escalated_count} color="text-orange-600" />
              </div>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">By Urgency</h4>
              <div className="space-y-1">
                <StatRow label="High" value={metrics.high_urgency_count} color="text-red-600" />
                <StatRow label="Medium" value={metrics.medium_urgency_count} color="text-yellow-600" />
                <StatRow label="Low" value={metrics.low_urgency_count} color="text-green-600" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Small stat row helper */
function StatRow({
  label,
  value,
  color = 'text-gray-900',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}

export default AnalyticsPanel;
