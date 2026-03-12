/**
 * useClaudeBillingData - Data loading hook for Claude & Billing dashboard
 *
 * Purpose: Encapsulates all data fetching, metric aggregation, and insight generation
 * Used by: ClaudeBillingMonitoringDashboard
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseClient } from '../../../contexts/AuthContext';
import { claudeService } from '../../../services/claudeService';
import { UnifiedBillingService } from '../../../services/unifiedBillingService';
import { performanceMonitor } from '../../../services/performanceMonitoring';
import { auditLogger } from '../../../services/auditLogger';
import type {
  ClaudeUsageMetrics,
  BillingWorkflowMetrics,
  CostOptimizationInsight,
  ServiceStatus,
  SpendingSummary,
  DateRange,
} from './ClaudeBillingMonitoringDashboard.types';

interface ClaudeBillingData {
  loading: boolean;
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  claudeMetrics: ClaudeUsageMetrics | null;
  billingMetrics: BillingWorkflowMetrics | null;
  insights: CostOptimizationInsight[];
  serviceStatus: ServiceStatus | null;
  spendingSummary: SpendingSummary | null;
  refresh: () => void;
}

export function useClaudeBillingData(): ClaudeBillingData {
  const supabase = useSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [claudeMetrics, setClaudeMetrics] = useState<ClaudeUsageMetrics | null>(null);
  const [billingMetrics, setBillingMetrics] = useState<BillingWorkflowMetrics | null>(null);
  const [insights, setInsights] = useState<CostOptimizationInsight[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [spendingSummary, setSpendingSummary] = useState<SpendingSummary | null>(null);

  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const from = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      dateFrom: from.toISOString(),
      dateTo: now.toISOString()
    };
  }, [dateRange]);

  const aggregateCostTrend = useCallback((logs: Array<{ created_at: string; cost?: number }>): Array<{ date: string; cost: number }> => {
    const dailyCosts = new Map<string, number>();
    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      dailyCosts.set(date, (dailyCosts.get(date) || 0) + (log.cost || 0));
    });
    return Array.from(dailyCosts.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  const loadClaudeMetrics = useCallback(async (): Promise<ClaudeUsageMetrics | null> => {
    try {
      const { data: claudeLogs, error } = await supabase
        .from('claude_usage_logs')
        .select('created_at, cost, success, input_tokens, output_tokens, model, response_time_ms, error_code, user_id')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!claudeLogs || claudeLogs.length === 0) {
        const emptyMetrics: ClaudeUsageMetrics = {
          totalRequests: 0, successfulRequests: 0, failedRequests: 0, successRate: 0,
          totalCost: 0, costByModel: {}, costTrend: [],
          totalInputTokens: 0, totalOutputTokens: 0, avgTokensPerRequest: 0,
          avgResponseTime: 0, p95ResponseTime: 0, p99ResponseTime: 0,
          rateLimitHits: 0, budgetExceeded: 0, topUsers: []
        };
        setClaudeMetrics(emptyMetrics);
        return emptyMetrics;
      }

      const totalRequests = claudeLogs.length;
      const successfulRequests = claudeLogs.filter((log: { success?: boolean }) => log.success).length;
      const failedRequests = totalRequests - successfulRequests;
      const successRate = (successfulRequests / totalRequests) * 100;
      const totalCost = claudeLogs.reduce((sum: number, log: { cost?: number }) => sum + (log.cost || 0), 0);
      const totalInputTokens = claudeLogs.reduce((sum: number, log: { input_tokens?: number }) => sum + (log.input_tokens || 0), 0);
      const totalOutputTokens = claudeLogs.reduce((sum: number, log: { output_tokens?: number }) => sum + (log.output_tokens || 0), 0);
      const avgTokensPerRequest = (totalInputTokens + totalOutputTokens) / totalRequests;

      const costByModel: Record<string, number> = {};
      claudeLogs.forEach((log: { model?: string; cost?: number }) => {
        const model = log.model || 'unknown';
        costByModel[model] = (costByModel[model] || 0) + (log.cost || 0);
      });

      const costTrend = aggregateCostTrend(claudeLogs);

      const responseTimes = claudeLogs
        .map((log: { response_time_ms?: number }) => log.response_time_ms)
        .filter((t): t is number => typeof t === 'number' && t > 0)
        .sort((a, b) => a - b);

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0;
      const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
      const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

      const rateLimitHits = claudeLogs.filter((log: { error_code?: string }) => log.error_code === 'RATE_LIMIT_EXCEEDED').length;
      const budgetExceeded = claudeLogs.filter((log: { error_code?: string }) => log.error_code === 'BUDGET_EXCEEDED').length;

      const userCosts = new Map<string, { requests: number; cost: number }>();
      claudeLogs.forEach((log: { user_id?: string; cost?: number }) => {
        const userId = log.user_id || 'anonymous';
        const existing = userCosts.get(userId) || { requests: 0, cost: 0 };
        userCosts.set(userId, { requests: existing.requests + 1, cost: existing.cost + (log.cost || 0) });
      });
      const topUsers = Array.from(userCosts.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

      const metrics: ClaudeUsageMetrics = {
        totalRequests, successfulRequests, failedRequests, successRate,
        totalCost, costByModel, costTrend,
        totalInputTokens, totalOutputTokens, avgTokensPerRequest,
        avgResponseTime, p95ResponseTime, p99ResponseTime,
        rateLimitHits, budgetExceeded, topUsers
      };
      setClaudeMetrics(metrics);
      return metrics;
    } catch (err: unknown) {
      auditLogger.error('CLAUDE_METRICS_LOAD_FAILED', err instanceof Error ? err : new Error('Unknown error'));
      return null;
    }
  }, [supabase, dateFrom, dateTo, aggregateCostTrend]);

  const loadBillingMetrics = useCallback(async (): Promise<BillingWorkflowMetrics | null> => {
    try {
      const metrics = await UnifiedBillingService.getWorkflowMetrics(dateFrom, dateTo);
      const { data: workflows, error } = await supabase
        .from('billing_workflows')
        .select('encounter_type, ai_suggestions_used, ai_suggestions_accepted, sdoh_enhanced, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (error) throw error;

      const workflowsByType: Record<string, number> = {};
      workflows?.forEach((w: { encounter_type?: string }) => {
        const type = w.encounter_type || 'unknown';
        workflowsByType[type] = (workflowsByType[type] || 0) + 1;
      });

      const aiSuggestionsUsed = workflows?.filter((w: { ai_suggestions_used?: boolean }) => w.ai_suggestions_used).length || 0;
      const aiAccepted = workflows?.filter((w: { ai_suggestions_accepted?: boolean }) => w.ai_suggestions_accepted).length || 0;
      const aiAcceptanceRate = aiSuggestionsUsed > 0 ? (aiAccepted / aiSuggestionsUsed) * 100 : 0;
      const sdohEnhanced = workflows?.filter((w: { sdoh_enhanced?: boolean }) => w.sdoh_enhanced).length || 0;
      const reimbursementRate = metrics.totalCharges > 0
        ? (metrics.estimatedReimbursement / metrics.totalCharges) * 100 : 0;

      const billingData: BillingWorkflowMetrics = {
        ...metrics, reimbursementRate, workflowsByType,
        aiSuggestionsUsed, aiAcceptanceRate, sdohEnhanced
      };
      setBillingMetrics(billingData);
      return billingData;
    } catch (err: unknown) {
      auditLogger.error('BILLING_METRICS_LOAD_FAILED', err instanceof Error ? err : new Error('Unknown error'));
      return null;
    }
  }, [supabase, dateFrom, dateTo]);

  const generateInsights = useCallback((
    claudeData: ClaudeUsageMetrics | null,
    billingData: BillingWorkflowMetrics | null
  ) => {
    const newInsights: CostOptimizationInsight[] = [];
    const claudeStatus = claudeService.getServiceStatus();
    const currentSpending = claudeService.getSpendingSummary();

    if (!claudeStatus.isHealthy) {
      newInsights.push({
        type: 'warning',
        title: 'Claude AI Service Unhealthy',
        description: `Service is currently unhealthy. Circuit breaker: ${claudeStatus.circuitBreakerState}`,
        actionItems: ['Check API key configuration', 'Review rate limit status', 'Monitor circuit breaker recovery']
      });
    }

    if (currentSpending.totalDaily > 20) {
      newInsights.push({
        type: 'warning',
        title: 'High Daily AI Spending',
        description: `Today's spending: $${currentSpending.totalDaily.toFixed(2)} across ${currentSpending.userCount} users`,
        potentialSavings: currentSpending.totalDaily * 0.3,
        actionItems: ['Review high-usage users', 'Implement request batching', 'Consider model tier optimization']
      });
    }

    if (claudeData && claudeData.totalCost > 1000) {
      newInsights.push({
        type: 'warning',
        title: 'High AI Costs Detected',
        description: `Total AI spending: $${claudeData.totalCost.toFixed(2)} in the selected period`,
        potentialSavings: claudeData.totalCost * 0.2,
        actionItems: ['Use faster AI model for simple queries', 'Implement request caching', 'Review prompt lengths']
      });
    }

    if (claudeData && claudeData.rateLimitHits > 10) {
      newInsights.push({
        type: 'warning',
        title: 'Frequent Rate Limiting',
        description: `${claudeData.rateLimitHits} requests hit rate limits`,
        actionItems: ['Review user request patterns', 'Implement request queuing', 'Add request backoff logic']
      });
    }

    if (billingData && billingData.successRate < 90) {
      newInsights.push({
        type: 'warning',
        title: 'Low Billing Workflow Success Rate',
        description: `Only ${billingData.successRate.toFixed(1)}% of workflows succeed on first attempt`,
        actionItems: ['Review top error codes', 'Improve data validation', 'Enhance AI coding accuracy']
      });
    }

    if (billingData && billingData.manualReviewRate > 30) {
      newInsights.push({
        type: 'info',
        title: 'High Manual Review Rate',
        description: `${billingData.manualReviewRate.toFixed(1)}% of workflows require manual review`,
        potentialSavings: billingData.totalWorkflows * billingData.manualReviewRate * 0.01 * 50,
        actionItems: ['Improve decision tree logic', 'Enhance AI training data', 'Create workflow templates']
      });
    }

    if (billingData && billingData.successRate > 95 && billingData.manualReviewRate < 15) {
      newInsights.push({
        type: 'success',
        title: 'Excellent Billing Performance',
        description: `${billingData.successRate.toFixed(1)}% success rate with ${billingData.manualReviewRate.toFixed(1)}% manual review`,
        actionItems: ['Document best practices', 'Share success metrics with team']
      });
    }

    setInsights(newInsights);
  }, []);

  useEffect(() => {
    const loadAllMetrics = async () => {
      setLoading(true);
      const startTime = performance.now();

      try {
        const status = claudeService.getServiceStatus();
        setServiceStatus({
          isHealthy: status.isHealthy,
          circuitBreakerState: status.circuitBreakerState,
          lastHealthCheck: status.lastHealthCheck
        });

        const spending = claudeService.getSpendingSummary();
        setSpendingSummary(spending);

        const [claudeData, billingData] = await Promise.all([
          loadClaudeMetrics(),
          loadBillingMetrics()
        ]);

        generateInsights(claudeData, billingData);

        const duration = performance.now() - startTime;
        performanceMonitor.trackMetric({
          metric_type: 'page_load',
          metric_name: 'claude_billing_dashboard_load',
          duration_ms: duration,
          metadata: { dateRange }
        });
      } catch (err: unknown) {
        auditLogger.error('DASHBOARD_LOAD_FAILED', err instanceof Error ? err : new Error('Dashboard load failed'));
      } finally {
        setLoading(false);
      }
    };

    loadAllMetrics();
  }, [dateRange, refreshKey, loadClaudeMetrics, loadBillingMetrics, generateInsights]);

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  return {
    loading,
    dateRange,
    setDateRange,
    claudeMetrics,
    billingMetrics,
    insights,
    serviceStatus,
    spendingSummary,
    refresh,
  };
}
