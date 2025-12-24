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
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { mcpOptimizer } from '../../services/mcp/mcpCostOptimizer';
import { batchInference } from '../../services/ai/batchInference';
import type { QueueStats } from '../../services/ai/batchInference';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../envision-atlus';
import { auditLogger } from '../../services/auditLogger';

// ============================================================================
// Types
// ============================================================================

interface CostMetrics {
  totalCalls: number;
  cachedCalls: number;
  totalCost: number;
  savedCost: number;
  haikuCalls: number;
  sonnetCalls: number;
  cacheHitRate: number;
}

interface CostTrend {
  date: string;
  cost: number;
  savings: number;
  calls: number;
}

interface ModelDistribution {
  model: string;
  calls: number;
  cost: number;
  percentage: number;
}

interface OptimizationRecommendation {
  type: 'cost' | 'performance' | 'batch';
  title: string;
  description: string;
  potentialSavings: number;
  priority: 'high' | 'medium' | 'low';
}

// ============================================================================
// Helper Components
// ============================================================================

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPositive?: boolean;
}> = ({ label, value, subValue, trend, trendPositive }) => {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  const trendColor = trend
    ? trendPositive
      ? 'text-green-400'
      : 'text-red-400'
    : '';

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white flex items-center gap-2">
        {value}
        {trend && (
          <span className={`text-sm ${trendColor}`}>
            {trendIcon}
          </span>
        )}
      </div>
      {subValue && (
        <div className="text-sm text-slate-500 mt-1">{subValue}</div>
      )}
    </div>
  );
};

const ProgressBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color?: string;
}> = ({ label, value, max, color = 'bg-teal-500' }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{
  recommendation: OptimizationRecommendation;
}> = ({ recommendation }) => {
  const priorityColors = {
    high: 'border-red-500 bg-red-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-blue-500 bg-blue-500/10',
  };

  const typeIcons = {
    cost: '💰',
    performance: '⚡',
    batch: '📦',
  };

  return (
    <div className={`p-4 rounded-lg border ${priorityColors[recommendation.priority]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{typeIcons[recommendation.type]}</span>
        <div className="flex-1">
          <div className="font-medium text-white">{recommendation.title}</div>
          <div className="text-sm text-slate-400 mt-1">
            {recommendation.description}
          </div>
          {recommendation.potentialSavings > 0 && (
            <div className="text-sm text-green-400 mt-2">
              Potential savings: ${recommendation.potentialSavings.toFixed(2)}/month
            </div>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          recommendation.priority === 'high' ? 'bg-red-500/20 text-red-400' :
          recommendation.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-blue-500/20 text-blue-400'
        }`}>
          {recommendation.priority}
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const AICostDashboard: React.FC = () => {
  const supabase = useSupabaseClient();

  // State
  const [loading, setLoading] = useState(true);
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [batchStats, setBatchStats] = useState<{
    totalRequestsProcessed: number;
    totalCostSaved: number;
    currentQueueSize: number;
    processingCount: number;
  } | null>(null);
  const [costTrends, setCostTrends] = useState<CostTrend[]>([]);
  const [modelDistribution, setModelDistribution] = useState<ModelDistribution[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load historical trends from database
  const loadHistoricalTrends = useCallback(async () => {
    try {
      const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data, error } = await supabase
        .from('mcp_cost_metrics')
        .select('created_at, total_cost, saved_cost, total_calls')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (data && !error) {
        // Group by date
        const grouped: Record<string, CostTrend> = {};
        for (const row of data) {
          const date = new Date(row.created_at).toLocaleDateString();
          if (!grouped[date]) {
            grouped[date] = { date, cost: 0, savings: 0, calls: 0 };
          }
          grouped[date].cost += row.total_cost || 0;
          grouped[date].savings += row.saved_cost || 0;
          grouped[date].calls += row.total_calls || 0;
        }
        setCostTrends(Object.values(grouped));
      }
    } catch {
      // Non-critical - use empty trends
      setCostTrends([]);
    }
  }, [dateRange, supabase]);

  // Load metrics
  const loadMetrics = useCallback(async () => {
    try {
      // Get MCP optimizer metrics
      const mcpMetrics = mcpOptimizer.getMetrics();
      const cacheHitRate = mcpOptimizer.getCacheHitRate();

      setCostMetrics({
        ...mcpMetrics,
        cacheHitRate,
      });

      // Get batch inference stats
      const batchCumulativeStats = batchInference.getCumulativeStats();
      setBatchStats(batchCumulativeStats);

      // Get queue stats
      const queueStatsData = batchInference.getQueueStats();
      setQueueStats(queueStatsData);

      // Calculate model distribution
      const totalCalls = mcpMetrics.haikuCalls + mcpMetrics.sonnetCalls;
      if (totalCalls > 0) {
        // Estimate costs based on typical token usage
        const haikuCostEstimate = mcpMetrics.haikuCalls * 0.001; // ~$0.001 per call
        const sonnetCostEstimate = mcpMetrics.sonnetCalls * 0.003; // ~$0.003 per call

        setModelDistribution([
          {
            model: 'Claude Haiku',
            calls: mcpMetrics.haikuCalls,
            cost: haikuCostEstimate,
            percentage: (mcpMetrics.haikuCalls / totalCalls) * 100,
          },
          {
            model: 'Claude Sonnet',
            calls: mcpMetrics.sonnetCalls,
            cost: sonnetCostEstimate,
            percentage: (mcpMetrics.sonnetCalls / totalCalls) * 100,
          },
        ]);
      }

      // Load historical trends from database
      await loadHistoricalTrends();

      // Generate recommendations
      generateRecommendations(mcpMetrics, cacheHitRate, batchCumulativeStats);

      setLoading(false);
    } catch (error) {
      auditLogger.error('AI_COST_DASHBOARD_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
      setLoading(false);
    }
  }, [loadHistoricalTrends]);

  const generateRecommendations = (
    metrics: Omit<CostMetrics, 'cacheHitRate'>,
    cacheHitRate: number,
    batchStats: { totalCostSaved: number; currentQueueSize: number }
  ) => {
    const recs: OptimizationRecommendation[] = [];

    // Cache hit rate recommendation
    if (cacheHitRate < 30) {
      recs.push({
        type: 'cost',
        title: 'Low Cache Hit Rate',
        description: `Your cache hit rate is ${cacheHitRate.toFixed(1)}%. Increasing prompt consistency could improve caching effectiveness.`,
        potentialSavings: metrics.totalCost * 0.3,
        priority: 'high',
      });
    } else if (cacheHitRate >= 30 && cacheHitRate < 60) {
      recs.push({
        type: 'cost',
        title: 'Moderate Cache Hit Rate',
        description: `Cache hit rate at ${cacheHitRate.toFixed(1)}%. Consider increasing cache duration for stable queries.`,
        potentialSavings: metrics.totalCost * 0.15,
        priority: 'medium',
      });
    }

    // Model selection recommendation
    const haikuRatio = metrics.haikuCalls / (metrics.haikuCalls + metrics.sonnetCalls || 1);
    if (haikuRatio < 0.5) {
      recs.push({
        type: 'cost',
        title: 'Optimize Model Selection',
        description: 'Many simple tasks could use Claude Haiku instead of Sonnet, reducing costs by 60%.',
        potentialSavings: metrics.sonnetCalls * 0.002,
        priority: 'medium',
      });
    }

    // Batch processing recommendation
    if (batchStats.currentQueueSize > 100) {
      recs.push({
        type: 'batch',
        title: 'Large Batch Queue',
        description: `${batchStats.currentQueueSize} requests queued. Consider increasing batch processing frequency.`,
        potentialSavings: batchStats.currentQueueSize * 0.001,
        priority: 'medium',
      });
    }

    // Savings acknowledgment
    if (batchStats.totalCostSaved > 10) {
      recs.push({
        type: 'cost',
        title: 'Batch Savings Active',
        description: `Batch processing has saved $${batchStats.totalCostSaved.toFixed(2)} through efficient batching.`,
        potentialSavings: 0,
        priority: 'low',
      });
    }

    // Performance recommendation
    if (metrics.totalCalls > 1000 && cacheHitRate > 70) {
      recs.push({
        type: 'performance',
        title: 'Excellent Cache Performance',
        description: 'High cache hit rate is significantly reducing API latency and costs.',
        potentialSavings: 0,
        priority: 'low',
      });
    }

    setRecommendations(recs);
  };

  // Auto-refresh
  useEffect(() => {
    loadMetrics();

    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [loadMetrics, autoRefresh]);

  // Log dashboard view
  useEffect(() => {
    auditLogger.info('AI_COST_DASHBOARD_VIEW', { dateRange });
  }, [dateRange]);

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
          {/* Model Distribution */}
          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Model Usage</h2>
            </EACardHeader>
            <EACardContent>
              {modelDistribution.map((model) => (
                <div key={model.model} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{model.model}</span>
                    <span className="text-slate-400">{model.calls.toLocaleString()} calls</span>
                  </div>
                  <ProgressBar
                    label=""
                    value={model.percentage}
                    max={100}
                    color={model.model.includes('Haiku') ? 'bg-green-500' : 'bg-blue-500'}
                  />
                  <div className="text-sm text-slate-500">
                    Est. cost: ${model.cost.toFixed(2)}
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400">
                  <span className="text-green-400">Haiku</span> is 60% cheaper than{' '}
                  <span className="text-blue-400">Sonnet</span> for simple tasks.
                </p>
              </div>
            </EACardContent>
          </EACard>

          {/* Batch Queue Status */}
          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Batch Queue</h2>
            </EACardHeader>
            <EACardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {queueStats?.totalQueued ?? 0}
                  </div>
                  <div className="text-sm text-slate-400">Queued</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-teal-400">
                    {batchStats?.processingCount ?? 0}
                  </div>
                  <div className="text-sm text-slate-400">Processing</div>
                </div>
              </div>

              {queueStats && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300 font-medium">By Type:</div>
                  {Object.entries(queueStats.byType)
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-slate-400">{type.replace(/_/g, ' ')}</span>
                        <span className="text-white">{count}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Total Processed</span>
                  <span className="text-white">
                    {(batchStats?.totalRequestsProcessed ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-400">Batch Savings</span>
                  <span className="text-green-400">
                    ${(batchStats?.totalCostSaved ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </EACardContent>
          </EACard>
        </div>

        {/* Center Column - Cost Trends */}
        <div className="col-span-2 space-y-6">
          {/* Cost Trend Chart (simplified) */}
          <EACard>
            <EACardHeader>
              <h2 className="text-lg font-semibold text-white">Cost Trends</h2>
            </EACardHeader>
            <EACardContent>
              {costTrends.length > 0 ? (
                <div className="h-48">
                  {/* Simple bar chart representation */}
                  <div className="flex items-end justify-between h-full gap-1">
                    {costTrends.slice(-14).map((trend, idx) => {
                      const maxCost = Math.max(...costTrends.map((t) => t.cost)) || 1;
                      const height = (trend.cost / maxCost) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-teal-500 rounded-t transition-all duration-300"
                            style={{ height: `${height}%`, minHeight: '4px' }}
                            title={`${trend.date}: $${trend.cost.toFixed(2)}`}
                          />
                          <div className="text-xs text-slate-500 mt-1 truncate w-full text-center">
                            {trend.date.split('/').slice(0, 2).join('/')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500">
                  No cost data available for this period
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      ${costTrends.reduce((sum, t) => sum + t.cost, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">Period Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-400">
                      ${costTrends.reduce((sum, t) => sum + t.savings, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">Period Savings</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {costTrends.reduce((sum, t) => sum + t.calls, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-400">Total Calls</div>
                  </div>
                </div>
              </div>
            </EACardContent>
          </EACard>

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
                  <span className="text-4xl">✅</span>
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
