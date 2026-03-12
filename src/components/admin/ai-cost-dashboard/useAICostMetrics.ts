/**
 * useAICostMetrics - Data fetching hook for AI Cost Dashboard
 *
 * Purpose: Encapsulates all data loading, state management, and recommendation
 * generation for the AI Cost Dashboard.
 * Used by: AICostDashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../../contexts/AuthContext';
import { mcpOptimizer } from '../../../services/mcp/mcp-cost-optimizer';
import { batchInference } from '../../../services/ai/batchInference';
import type { QueueStats } from '../../../services/ai/batchInference';
import { auditLogger } from '../../../services/auditLogger';
import type {
  CostMetrics,
  CostTrend,
  ModelDistribution,
  OptimizationRecommendation,
  BatchStats,
} from './AICostDashboard.types';

type DateRange = '7d' | '30d' | '90d';

interface AICostMetricsResult {
  loading: boolean;
  costMetrics: CostMetrics | null;
  queueStats: QueueStats | null;
  batchStats: BatchStats | null;
  costTrends: CostTrend[];
  modelDistribution: ModelDistribution[];
  recommendations: OptimizationRecommendation[];
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  loadMetrics: () => Promise<void>;
}

function generateRecommendations(
  metrics: Omit<CostMetrics, 'cacheHitRate'>,
  cacheHitRate: number,
  batchStatsData: { totalCostSaved: number; currentQueueSize: number }
): OptimizationRecommendation[] {
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
  if (batchStatsData.currentQueueSize > 100) {
    recs.push({
      type: 'batch',
      title: 'Large Batch Queue',
      description: `${batchStatsData.currentQueueSize} requests queued. Consider increasing batch processing frequency.`,
      potentialSavings: batchStatsData.currentQueueSize * 0.001,
      priority: 'medium',
    });
  }

  // Savings acknowledgment
  if (batchStatsData.totalCostSaved > 10) {
    recs.push({
      type: 'cost',
      title: 'Batch Savings Active',
      description: `Batch processing has saved $${batchStatsData.totalCostSaved.toFixed(2)} through efficient batching.`,
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

  return recs;
}

export function useAICostMetrics(): AICostMetricsResult {
  const supabase = useSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [costTrends, setCostTrends] = useState<CostTrend[]>([]);
  const [modelDistribution, setModelDistribution] = useState<ModelDistribution[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
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
      const recs = generateRecommendations(mcpMetrics, cacheHitRate, batchCumulativeStats);
      setRecommendations(recs);

      setLoading(false);
    } catch (error: unknown) {
      auditLogger.error('AI_COST_DASHBOARD_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
      setLoading(false);
    }
  }, [loadHistoricalTrends]);

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

  return {
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
  };
}
