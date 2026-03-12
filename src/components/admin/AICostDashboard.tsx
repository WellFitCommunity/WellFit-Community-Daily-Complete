/**
 * AI Cost Dashboard
 *
 * P2 Optimization: Visibility into AI spending and optimization effectiveness
 *
 * Features:
 * - Real-time MCP cost tracking
 * - Batch inference queue monitoring
 * - Cache hit rate visualization
 * - Model usage distribution
 * - Cost savings analysis
 * - Optimization recommendations
 *
 * HIPAA Compliant: No PHI displayed
 *
 * Decomposed into sub-modules under ./ai-cost-dashboard/
 */

import React from 'react';
import {
  MetricCard,
  RecommendationCard,
  useAICostMetrics,
  ModelUsageSection,
  BatchQueueSection,
  CostTrendsSection,
} from './ai-cost-dashboard';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../envision-atlus';

// ============================================================================
// Main Component
// ============================================================================

const AICostDashboard: React.FC = () => {
  const {
    loading,
    costMetrics,
    queueStats,
    batchStats,
    costTrends,
    modelDistribution,
    recommendations,
    dateRange,
    setDateRange,
    autoRefresh,
    setAutoRefresh,
    loadMetrics,
  } = useAICostMetrics();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded-sm w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-800 rounded-sm" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-slate-800 rounded-sm" />
            <div className="h-64 bg-slate-800 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  const totalSavings = (costMetrics?.savedCost ?? 0) + (batchStats?.totalCostSaved ?? 0);
  const savingsPercentage = costMetrics?.totalCost
    ? ((totalSavings / (costMetrics.totalCost + totalSavings)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Cost Dashboard</h1>
          <p className="text-slate-400">Monitor and optimize AI spending</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
            className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded-sm border-slate-600"
            />
            Auto-refresh
          </label>
          <button
            onClick={loadMetrics}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total API Calls"
          value={(costMetrics?.totalCalls ?? 0).toLocaleString()}
          subValue={`${costMetrics?.cachedCalls ?? 0} from cache`}
        />
        <MetricCard
          label="Total Cost"
          value={`$${(costMetrics?.totalCost ?? 0).toFixed(2)}`}
          subValue="This period"
        />
        <MetricCard
          label="Total Savings"
          value={`$${totalSavings.toFixed(2)}`}
          subValue={`${savingsPercentage.toFixed(0)}% saved`}
          trend="up"
          trendPositive
        />
        <MetricCard
          label="Cache Hit Rate"
          value={`${(costMetrics?.cacheHitRate ?? 0).toFixed(1)}%`}
          subValue="Higher is better"
          trend={(costMetrics?.cacheHitRate ?? 0) > 50 ? 'up' : 'down'}
          trendPositive={(costMetrics?.cacheHitRate ?? 0) > 50}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Model Usage & Queue */}
        <div className="space-y-6">
          <ModelUsageSection modelDistribution={modelDistribution} />
          <BatchQueueSection queueStats={queueStats} batchStats={batchStats} />
        </div>

        {/* Center Column - Cost Trends */}
        <div className="col-span-2 space-y-6">
          <CostTrendsSection costTrends={costTrends} />

          {/* Optimization Recommendations */}
          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Optimization Recommendations</h2>
            </EACardHeader>
            <EACardContent>
              {recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <RecommendationCard key={idx} recommendation={rec} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <span className="text-4xl">{'\u2705'}</span>
                  <p className="mt-2">AI costs are well optimized!</p>
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-300">MCP Optimizer Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <span className="text-slate-300">Batch Queue Running</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-slate-300">Prompt Caching Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICostDashboard;
