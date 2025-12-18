/**
 * Claude & Billing Monitoring Dashboard
 *
 * Enterprise-grade monitoring dashboard for:
 * - Claude AI usage and costs
 * - Billing workflow metrics
 * - Performance monitoring
 * - Cost optimization insights
 *
 * HIPAA & SOC2 Compliant:
 * - No PHI displayed in monitoring data
 * - Audit logging for all administrative actions
 * - Role-based access control
 * - Data retention policies enforced
 *
 * @module ClaudeBillingMonitoringDashboard
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { claudeService } from '../../services/claudeService';
import { UnifiedBillingService } from '../../services/unifiedBillingService';
import { performanceMonitor } from '../../services/performanceMonitoring';
import { auditLogger } from '../../services/auditLogger';

// ============================================================================
// Types
// ============================================================================

interface ClaudeUsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;

  // Cost tracking
  totalCost: number;
  costByModel: Record<string, number>;
  costTrend: Array<{ date: string; cost: number }>;

  // Token usage
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTokensPerRequest: number;

  // Performance
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;

  // Rate limiting
  rateLimitHits: number;
  budgetExceeded: number;

  // User distribution
  topUsers: Array<{ userId: string; requests: number; cost: number }>;
}

interface BillingWorkflowMetrics {
  totalWorkflows: number;
  successRate: number;
  averageProcessingTime: number;
  manualReviewRate: number;

  // Financial
  totalCharges: number;
  estimatedReimbursement: number;
  reimbursementRate: number;

  // Errors
  topErrors: Array<{ code: string; count: number; message: string }>;

  // Workflow distribution
  workflowsByType: Record<string, number>;

  // AI integration
  aiSuggestionsUsed: number;
  aiAcceptanceRate: number;
  sdohEnhanced: number;
}

interface CostOptimizationInsight {
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  potentialSavings?: number;
  actionItems: string[];
}

// ============================================================================
// Main Component
// ============================================================================

const ClaudeBillingMonitoringDashboard: React.FC = () => {
  const supabase = useSupabaseClient();

  // State
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [claudeMetrics, setClaudeMetrics] = useState<ClaudeUsageMetrics | null>(null);
  const [billingMetrics, setBillingMetrics] = useState<BillingWorkflowMetrics | null>(null);
  const [insights, setInsights] = useState<CostOptimizationInsight[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time service status from claudeService
  const [serviceStatus, setServiceStatus] = useState<{
    isHealthy: boolean;
    circuitBreakerState: string;
    lastHealthCheck: Date;
  } | null>(null);
  const [spendingSummary, setSpendingSummary] = useState<{
    totalDaily: number;
    totalMonthly: number;
    userCount: number;
  } | null>(null);

  // Calculate date range
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const daysAgo = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const from = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    return {
      dateFrom: from.toISOString(),
      dateTo: now.toISOString()
    };
  }, [dateRange]);

  // Helper: aggregate cost trend from logs
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

  // Load Claude metrics and return the data
  const loadClaudeMetrics = useCallback(async (): Promise<ClaudeUsageMetrics | null> => {
    try {
      const { data: claudeLogs, error } = await supabase
        .from('claude_usage_logs')
        .select('*')
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

  // Load billing metrics and return the data
  const loadBillingMetrics = useCallback(async (): Promise<BillingWorkflowMetrics | null> => {
    try {
      const metrics = await UnifiedBillingService.getWorkflowMetrics(dateFrom, dateTo);
      const { data: workflows, error } = await supabase
        .from('billing_workflows')
        .select('*')
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

  // Generate insights based on loaded metrics (takes data as params, not from state)
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

  // Load all metrics on mount and when dependencies change
  useEffect(() => {
    const loadAllMetrics = async () => {
      setLoading(true);
      const startTime = performance.now();

      try {
        // Load real-time service status
        const status = claudeService.getServiceStatus();
        setServiceStatus({
          isHealthy: status.isHealthy,
          circuitBreakerState: status.circuitBreakerState,
          lastHealthCheck: status.lastHealthCheck
        });

        // Load spending summary
        const spending = claudeService.getSpendingSummary();
        setSpendingSummary(spending);

        // Load metrics in parallel and get returned data
        const [claudeData, billingData] = await Promise.all([
          loadClaudeMetrics(),
          loadBillingMetrics()
        ]);

        // Generate insights with the loaded data (not stale state)
        generateInsights(claudeData, billingData);

        // Track dashboard load performance
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

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Claude & Billing Monitoring</h2>
          <p className="text-sm text-gray-600 mt-1">Real-time monitoring of AI usage and billing workflows</p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Date Range Selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Real-Time Service Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Service Health */}
        <div className={`border rounded-lg p-4 ${
          serviceStatus?.isHealthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Claude AI Service</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              serviceStatus?.isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {serviceStatus?.isHealthy ? '✓ Healthy' : '⚠ Unhealthy'}
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Circuit Breaker: <span className="font-medium">{serviceStatus?.circuitBreakerState || 'Unknown'}</span></p>
            <p>Last Check: <span className="font-medium">
              {serviceStatus?.lastHealthCheck ? new Date(serviceStatus.lastHealthCheck).toLocaleTimeString() : 'N/A'}
            </span></p>
          </div>
        </div>

        {/* Real-Time Spending */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Real-Time Spending</h3>
            <span className="text-2xl">💵</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-600">Today</p>
              <p className="text-lg font-bold text-gray-900">${(spendingSummary?.totalDaily ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">This Month</p>
              <p className="text-lg font-bold text-gray-900">${(spendingSummary?.totalMonthly ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Active Users</p>
              <p className="text-lg font-bold text-gray-900">{spendingSummary?.userCount ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Optimization Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`border-l-4 rounded-lg p-4 ${
                insight.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                insight.type === 'info' ? 'border-blue-500 bg-blue-50' :
                'border-green-500 bg-green-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{insight.title}</h3>
                  <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                  {insight.potentialSavings && (
                    <p className="text-sm font-medium text-green-700 mb-2">
                      💰 Potential savings: ${insight.potentialSavings.toFixed(2)}
                    </p>
                  )}
                  <ul className="text-xs text-gray-600 space-y-1">
                    {insight.actionItems.map((action, i) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Claude AI Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Claude AI Usage</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Requests"
            value={claudeMetrics?.totalRequests || 0}
            icon="📊"
            trend={undefined}
          />
          <MetricCard
            title="Success Rate"
            value={`${(claudeMetrics?.successRate || 0).toFixed(1)}%`}
            icon="✅"
            trend={undefined}
          />
          <MetricCard
            title="Total Cost"
            value={`$${(claudeMetrics?.totalCost || 0).toFixed(2)}`}
            icon="💰"
            trend={undefined}
          />
          <MetricCard
            title="Avg Response Time"
            value={`${(claudeMetrics?.avgResponseTime || 0).toFixed(0)}ms`}
            icon="⚡"
            trend={undefined}
          />
        </div>

        {/* Cost by Model */}
        {claudeMetrics && Object.keys(claudeMetrics.costByModel).length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Cost by Model</h4>
            <div className="space-y-2">
              {Object.entries(claudeMetrics.costByModel).map(([model, cost]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{model}</span>
                  <span className="text-sm font-medium text-gray-900">${cost.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Billing Workflow Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Workflow Performance</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Total Workflows"
            value={billingMetrics?.totalWorkflows || 0}
            icon="🔄"
            trend={undefined}
          />
          <MetricCard
            title="Success Rate"
            value={`${(billingMetrics?.successRate || 0).toFixed(1)}%`}
            icon="✓"
            trend={undefined}
          />
          <MetricCard
            title="Manual Review Rate"
            value={`${(billingMetrics?.manualReviewRate || 0).toFixed(1)}%`}
            icon="👁️"
            trend={undefined}
          />
          <MetricCard
            title="Avg Processing Time"
            value={`${((billingMetrics?.averageProcessingTime || 0) / 1000).toFixed(1)}s`}
            icon="⏱️"
            trend={undefined}
          />
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Charges</p>
            <p className="text-2xl font-bold text-gray-900">
              ${(billingMetrics?.totalCharges || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Estimated Reimbursement</p>
            <p className="text-2xl font-bold text-green-600">
              ${(billingMetrics?.estimatedReimbursement || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Reimbursement Rate</p>
            <p className="text-2xl font-bold text-blue-600">
              {(billingMetrics?.reimbursementRate || 0).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Top Errors */}
        {billingMetrics && billingMetrics.topErrors.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Top Billing Errors</h4>
            <div className="space-y-2">
              {billingMetrics.topErrors.map((error, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{error.code}</span>
                    {error.message && (
                      <p className="text-xs text-gray-600 mt-0.5">{error.message}</p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-red-600">{error.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: { value: number; direction: 'up' | 'down' };
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && (
          <span className={`text-xs font-medium ${
            trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
};

export default ClaudeBillingMonitoringDashboard;
