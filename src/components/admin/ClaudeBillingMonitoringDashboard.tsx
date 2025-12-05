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

import React, { useState, useEffect, useMemo } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { claudeService } from '../../services/claudeService';
import { UnifiedBillingService } from '../../services/unifiedBillingService';
import { performanceMonitor } from '../../services/performanceMonitoring';

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

  // Load metrics
  useEffect(() => {
    loadAllMetrics();
  }, [dateRange, refreshKey]);

  const loadAllMetrics = async () => {
    setLoading(true);

    try {
      await Promise.all([
        loadClaudeMetrics(),
        loadBillingMetrics(),
        generateInsights()
      ]);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const loadClaudeMetrics = async () => {
    try {
      // Query Claude usage logs from database
      const { data: claudeLogs, error } = await supabase
        .from('claude_usage_logs')
        .select('*')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!claudeLogs || claudeLogs.length === 0) {
        setClaudeMetrics({
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          successRate: 0,
          totalCost: 0,
          costByModel: {},
          costTrend: [],
          totalInputTokens: 0,
          totalOutputTokens: 0,
          avgTokensPerRequest: 0,
          avgResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          rateLimitHits: 0,
          budgetExceeded: 0,
          topUsers: []
        });
        return;
      }

      // Aggregate metrics
      const totalRequests = claudeLogs.length;
      const successfulRequests = claudeLogs.filter(log => log.success).length;
      const failedRequests = totalRequests - successfulRequests;
      const successRate = (successfulRequests / totalRequests) * 100;

      const totalCost = claudeLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
      const totalInputTokens = claudeLogs.reduce((sum, log) => sum + (log.input_tokens || 0), 0);
      const totalOutputTokens = claudeLogs.reduce((sum, log) => sum + (log.output_tokens || 0), 0);
      const avgTokensPerRequest = (totalInputTokens + totalOutputTokens) / totalRequests;

      // Cost by model
      const costByModel: Record<string, number> = {};
      claudeLogs.forEach(log => {
        const model = log.model || 'unknown';
        costByModel[model] = (costByModel[model] || 0) + (log.cost || 0);
      });

      // Cost trend (daily)
      const costTrend = aggregateCostTrend(claudeLogs);

      // Response times
      const responseTimes = claudeLogs
        .map(log => log.response_time_ms)
        .filter(t => t > 0)
        .sort((a, b) => a - b);

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

      const p95ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.95)] || 0;
      const p99ResponseTime = responseTimes[Math.floor(responseTimes.length * 0.99)] || 0;

      // Rate limiting
      const rateLimitHits = claudeLogs.filter(log => log.error_code === 'RATE_LIMIT_EXCEEDED').length;
      const budgetExceeded = claudeLogs.filter(log => log.error_code === 'BUDGET_EXCEEDED').length;

      // Top users
      const userCosts = new Map<string, { requests: number; cost: number }>();
      claudeLogs.forEach(log => {
        const userId = log.user_id || 'anonymous';
        const existing = userCosts.get(userId) || { requests: 0, cost: 0 };
        userCosts.set(userId, {
          requests: existing.requests + 1,
          cost: existing.cost + (log.cost || 0)
        });
      });

      const topUsers = Array.from(userCosts.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);

      setClaudeMetrics({
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate,
        totalCost,
        costByModel,
        costTrend,
        totalInputTokens,
        totalOutputTokens,
        avgTokensPerRequest,
        avgResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        rateLimitHits,
        budgetExceeded,
        topUsers
      });

    } catch (error) {

    }
  };

  const loadBillingMetrics = async () => {
    try {
      const metrics = await UnifiedBillingService.getWorkflowMetrics(dateFrom, dateTo);

      // Query additional billing data
      const { data: workflows, error } = await supabase
        .from('billing_workflows')
        .select('*')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (error) throw error;

      // Calculate workflow distribution
      const workflowsByType: Record<string, number> = {};
      workflows?.forEach(w => {
        const type = w.encounter_type || 'unknown';
        workflowsByType[type] = (workflowsByType[type] || 0) + 1;
      });

      // AI integration metrics
      const aiSuggestionsUsed = workflows?.filter(w => w.ai_suggestions_used).length || 0;
      const aiAccepted = workflows?.filter(w => w.ai_suggestions_accepted).length || 0;
      const aiAcceptanceRate = aiSuggestionsUsed > 0 ? (aiAccepted / aiSuggestionsUsed) * 100 : 0;
      const sdohEnhanced = workflows?.filter(w => w.sdoh_enhanced).length || 0;

      const reimbursementRate = metrics.totalCharges > 0
        ? (metrics.estimatedReimbursement / metrics.totalCharges) * 100
        : 0;

      setBillingMetrics({
        ...metrics,
        reimbursementRate,
        workflowsByType,
        aiSuggestionsUsed,
        aiAcceptanceRate,
        sdohEnhanced
      });

    } catch (error) {

    }
  };

  const generateInsights = async () => {
    const insights: CostOptimizationInsight[] = [];

    // Load current service status
    const claudeStatus = claudeService.getServiceStatus();
    const spendingSummary = claudeService.getSpendingSummary();

    // Insight 1: High cost alert
    if (claudeMetrics && claudeMetrics.totalCost > 1000) {
      insights.push({
        type: 'warning',
        title: 'High AI Costs Detected',
        description: `Total AI spending: $${claudeMetrics.totalCost.toFixed(2)} in the last ${dateRange}`,
        potentialSavings: claudeMetrics.totalCost * 0.2,
        actionItems: [
          'Consider using faster AI model for simple queries',
          'Implement request caching for common questions',
          'Review and optimize prompt lengths',
          'Set stricter user rate limits'
        ]
      });
    }

    // Insight 2: Rate limiting issues
    if (claudeMetrics && claudeMetrics.rateLimitHits > 10) {
      insights.push({
        type: 'warning',
        title: 'Frequent Rate Limiting',
        description: `${claudeMetrics.rateLimitHits} requests hit rate limits`,
        actionItems: [
          'Review user request patterns',
          'Implement request queuing',
          'Consider increasing rate limits for power users',
          'Add request backoff logic'
        ]
      });
    }

    // Insight 3: Low billing workflow success rate
    if (billingMetrics && billingMetrics.successRate < 90) {
      insights.push({
        type: 'warning',
        title: 'Low Billing Workflow Success Rate',
        description: `Only ${billingMetrics.successRate.toFixed(1)}% of workflows succeed on first attempt`,
        actionItems: [
          'Review top error codes and patterns',
          'Improve data validation before workflow',
          'Enhance AI coding accuracy',
          'Train staff on documentation requirements'
        ]
      });
    }

    // Insight 4: High manual review rate
    if (billingMetrics && billingMetrics.manualReviewRate > 30) {
      insights.push({
        type: 'info',
        title: 'High Manual Review Rate',
        description: `${billingMetrics.manualReviewRate.toFixed(1)}% of workflows require manual review`,
        potentialSavings: billingMetrics.totalWorkflows * billingMetrics.manualReviewRate * 0.01 * 50,
        actionItems: [
          'Improve decision tree logic',
          'Enhance AI training data',
          'Standardize encounter documentation',
          'Create workflow templates for common scenarios'
        ]
      });
    }

    // Insight 5: Good performance
    if (billingMetrics && billingMetrics.successRate > 95 && billingMetrics.manualReviewRate < 15) {
      insights.push({
        type: 'success',
        title: 'Excellent Billing Performance',
        description: `${billingMetrics.successRate.toFixed(1)}% success rate with ${billingMetrics.manualReviewRate.toFixed(1)}% manual review`,
        actionItems: [
          'Document best practices',
          'Share success metrics with team',
          'Consider expanding automation to other areas'
        ]
      });
    }

    // Insight 6: Model optimization
    if (claudeMetrics && claudeMetrics.costByModel['claude-sonnet-4-5-20250929']) {
      const sonnetCost = claudeMetrics.costByModel['claude-sonnet-4-5-20250929'];
      const sonnetPercentage = (sonnetCost / claudeMetrics.totalCost) * 100;

      if (sonnetPercentage > 60) {
        insights.push({
          type: 'info',
          title: 'AI Model Mix Optimization',
          description: `${sonnetPercentage.toFixed(1)}% of costs from premium AI tier`,
          potentialSavings: sonnetCost * 0.7,
          actionItems: [
            'Use fast AI tier for simple health questions',
            'Reserve premium AI for complex medical analysis',
            'Implement automatic model selection based on query complexity',
            'Test fast tier performance on current workload'
          ]
        });
      }
    }

    setInsights(insights);
  };

  const aggregateCostTrend = (logs: any[]): Array<{ date: string; cost: number }> => {
    const dailyCosts = new Map<string, number>();

    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      dailyCosts.set(date, (dailyCosts.get(date) || 0) + (log.cost || 0));
    });

    return Array.from(dailyCosts.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

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
