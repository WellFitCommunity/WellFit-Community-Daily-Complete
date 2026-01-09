/**
 * AI Financial Dashboard
 *
 * Consolidated dashboard for AI financial management:
 * - Cost Management: MCP tracking, batch inference, cache optimization
 * - MCP Savings: User-level cost savings and efficiency metrics
 * - Revenue Impact: CCM eligibility, billing optimization, readmission avoidance
 *
 * HIPAA Compliant: No PHI displayed
 *
 * Consolidates: AICostDashboard, MCPCostDashboard, AIRevenueDashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useAuth } from '../../contexts/AuthContext';
import { mcpOptimizer } from '../../services/mcp/mcpCostOptimizer';
import { batchInference } from '../../services/ai/batchInference';
import type { QueueStats } from '../../services/ai/batchInference';
import { ccmEligibilityScorer } from '../../services/ai/ccmEligibilityScorer';
import { auditLogger } from '../../services/auditLogger';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../envision-atlus';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Zap,
  Target,
  Activity,
  Award,
  Heart,
  FileText,
  Building2,
  RefreshCw,
  Users,
  Calculator,
} from 'lucide-react';

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

interface MCPUserMetrics {
  total_spent: number;
  total_saved: number;
  avg_cache_hit_rate: number;
  total_calls: number;
  total_cached_calls: number;
  total_haiku_calls: number;
  total_sonnet_calls: number;
}

interface DailySavings {
  date: string;
  total_cost: number;
  saved_cost: number;
  cache_hit_rate: number;
  efficiency_score: number;
}

interface RevenueSummary {
  totalMonthlyPotential: number;
  ccmEligiblePatients: number;
  pendingBillingSuggestions: number;
  highRiskPatients: number;
  projectedAnnualRevenue: number;
}

interface CCMPatientSummary {
  patientId: string;
  eligibilityScore: number;
  chronicConditions: number;
  predictedReimbursement: number;
  recommendation: string;
  assessmentDate: string;
}

type TabValue = 'costs' | 'savings' | 'revenue';

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

const AIFinancialDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>('costs');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Cost Management State
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

  // MCP Savings State
  const [mcpUserMetrics, setMcpUserMetrics] = useState<MCPUserMetrics | null>(null);
  const [dailySavings, setDailySavings] = useState<DailySavings[]>([]);

  // Revenue Impact State
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary>({
    totalMonthlyPotential: 0,
    ccmEligiblePatients: 0,
    pendingBillingSuggestions: 0,
    highRiskPatients: 0,
    projectedAnnualRevenue: 0,
  });
  const [ccmAssessments, setCCMAssessments] = useState<CCMPatientSummary[]>([]);

  // Get tenant ID
  const tenantId = user?.user_metadata?.tenant_id;

  // ============================================================================
  // Data Loading Functions
  // ============================================================================

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
      setCostTrends([]);
    }
  }, [dateRange, supabase]);

  // Load cost management metrics
  const loadCostMetrics = useCallback(async () => {
    try {
      const mcpMetrics = mcpOptimizer.getMetrics();
      const cacheHitRate = mcpOptimizer.getCacheHitRate();

      setCostMetrics({
        ...mcpMetrics,
        cacheHitRate,
      });

      const batchCumulativeStats = batchInference.getCumulativeStats();
      setBatchStats(batchCumulativeStats);

      const queueStatsData = batchInference.getQueueStats();
      setQueueStats(queueStatsData);

      const totalCalls = mcpMetrics.haikuCalls + mcpMetrics.sonnetCalls;
      if (totalCalls > 0) {
        const haikuCostEstimate = mcpMetrics.haikuCalls * 0.001;
        const sonnetCostEstimate = mcpMetrics.sonnetCalls * 0.003;

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

      await loadHistoricalTrends();

      // Generate recommendations
      const recs: OptimizationRecommendation[] = [];
      if (cacheHitRate < 30) {
        recs.push({
          type: 'cost',
          title: 'Low Cache Hit Rate',
          description: `Your cache hit rate is ${cacheHitRate.toFixed(1)}%. Increasing prompt consistency could improve caching effectiveness.`,
          potentialSavings: mcpMetrics.totalCost * 0.3,
          priority: 'high',
        });
      }
      const haikuRatio = mcpMetrics.haikuCalls / (mcpMetrics.haikuCalls + mcpMetrics.sonnetCalls || 1);
      if (haikuRatio < 0.5) {
        recs.push({
          type: 'cost',
          title: 'Optimize Model Selection',
          description: 'Many simple tasks could use Claude Haiku instead of Sonnet, reducing costs by 60%.',
          potentialSavings: mcpMetrics.sonnetCalls * 0.002,
          priority: 'medium',
        });
      }
      setRecommendations(recs);
    } catch (error) {
      auditLogger.error('AI_FINANCIAL_COST_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [loadHistoricalTrends]);

  // Load MCP user savings
  const loadMCPSavings = useCallback(async () => {
    if (!user) return;

    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('mcp_cost_savings_summary')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!metricsError || metricsError.code === 'PGRST116') {
        setMcpUserMetrics(metricsData);
      }

      const { data: savingsData, error: savingsError } = await supabase.rpc(
        'calculate_mcp_daily_savings',
        { target_user_id: user.id }
      );

      if (!savingsError) {
        setDailySavings(savingsData || []);
      }
    } catch {
      // Non-critical error, keep existing state
    }
  }, [user, supabase]);

  // Load revenue impact data
  const loadRevenueData = useCallback(async () => {
    if (!tenantId) return;

    try {
      const { data: ccmData } = await supabase
        .from('ccm_eligibility_assessments')
        .select('patient_id, overall_eligibility_score, chronic_conditions_count, predicted_monthly_reimbursement, enrollment_recommendation, assessment_date')
        .eq('tenant_id', tenantId)
        .gte('overall_eligibility_score', 0.5)
        .order('assessment_date', { ascending: false })
        .limit(100);

      const { count: billingCount } = await supabase
        .from('encounter_billing_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      const { count: highRiskCount } = await supabase
        .from('readmission_risk_predictions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('risk_category', ['high', 'critical']);

      interface CCMRow {
        patient_id: string;
        overall_eligibility_score: number | null;
        chronic_conditions_count: number | null;
        predicted_monthly_reimbursement: number | null;
        enrollment_recommendation: string | null;
        assessment_date: string | null;
      }

      const assessments: CCMPatientSummary[] = ((ccmData || []) as CCMRow[]).map((row) => ({
        patientId: row.patient_id,
        eligibilityScore: row.overall_eligibility_score || 0,
        chronicConditions: row.chronic_conditions_count || 0,
        predictedReimbursement: row.predicted_monthly_reimbursement || 0,
        recommendation: row.enrollment_recommendation || 'not_recommended',
        assessmentDate: row.assessment_date || new Date().toISOString().split('T')[0],
      }));

      setCCMAssessments(assessments);

      const totalMonthly = assessments.reduce((sum, a) => sum + a.predictedReimbursement, 0);
      setRevenueSummary({
        totalMonthlyPotential: totalMonthly,
        ccmEligiblePatients: assessments.filter(a => a.eligibilityScore >= 0.5).length,
        pendingBillingSuggestions: billingCount || 0,
        highRiskPatients: highRiskCount || 0,
        projectedAnnualRevenue: totalMonthly * 12,
      });
    } catch (error) {
      auditLogger.error('AI_FINANCIAL_REVENUE_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [tenantId, supabase]);

  // Load all data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadCostMetrics(),
      loadMCPSavings(),
      loadRevenueData(),
    ]);
    setLoading(false);
  }, [loadCostMetrics, loadMCPSavings, loadRevenueData]);

  // Initial load
  useEffect(() => {
    loadAllData();
    auditLogger.info('AI_FINANCIAL_DASHBOARD_VIEW', { tab: activeTab });
  }, [loadAllData, activeTab]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Run batch CCM assessment
  const handleRunBatchAssessment = async () => {
    if (!tenantId) return;
    try {
      setRefreshing(true);
      await ccmEligibilityScorer.batchAssessEligibility(tenantId);
      await loadRevenueData();
    } catch (error) {
      auditLogger.error('AI_FINANCIAL_BATCH_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setRefreshing(false);
    }
  };

  // Format helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'strongly_recommend':
        return <EABadge variant="normal">Strongly Recommend</EABadge>;
      case 'recommend':
        return <EABadge variant="info">Recommend</EABadge>;
      case 'consider':
        return <EABadge variant="elevated">Consider</EABadge>;
      default:
        return <EABadge variant="neutral">Not Recommended</EABadge>;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-800 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-800 rounded" />
            ))}
          </div>
          <div className="h-64 bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  const totalSavings = (costMetrics?.savedCost ?? 0) + (batchStats?.totalCostSaved ?? 0);
  const savingsPercentage = costMetrics?.totalCost
    ? ((totalSavings / (costMetrics.totalCost + totalSavings)) * 100)
    : 0;

  const mcpTotalPotentialCost = (mcpUserMetrics?.total_spent ?? 0) + (mcpUserMetrics?.total_saved ?? 0);
  const mcpSavingsPercentage = mcpTotalPotentialCost > 0
    ? ((mcpUserMetrics?.total_saved ?? 0) / mcpTotalPotentialCost) * 100
    : 0;

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Financial Dashboard</h1>
          <p className="text-slate-400">Monitor AI costs, savings, and revenue impact</p>
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
          <EAButton
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Tabs */}
      <EATabs defaultValue="costs" value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <EATabsList className="grid w-full grid-cols-3 mb-6">
          <EATabsTrigger value="costs" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Management
          </EATabsTrigger>
          <EATabsTrigger value="savings" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            MCP Savings
          </EATabsTrigger>
          <EATabsTrigger value="revenue" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Revenue Impact
          </EATabsTrigger>
        </EATabsList>

        {/* ===== COST MANAGEMENT TAB ===== */}
        <EATabsContent value="costs" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-4">
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
                      <div className="text-sm text-slate-500">Est. cost: ${model.cost.toFixed(2)}</div>
                    </div>
                  ))}
                </EACardContent>
              </EACard>

              <EACard>
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white">Batch Queue</h2>
                </EACardHeader>
                <EACardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{queueStats?.totalQueued ?? 0}</div>
                      <div className="text-sm text-slate-400">Queued</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-teal-400">{batchStats?.processingCount ?? 0}</div>
                      <div className="text-sm text-slate-400">Processing</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Batch Savings</span>
                      <span className="text-green-400">${(batchStats?.totalCostSaved ?? 0).toFixed(2)}</span>
                    </div>
                  </div>
                </EACardContent>
              </EACard>
            </div>

            {/* Center/Right - Trends & Recommendations */}
            <div className="col-span-2 space-y-6">
              <EACard>
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white">Cost Trends</h2>
                </EACardHeader>
                <EACardContent>
                  {costTrends.length > 0 ? (
                    <div className="h-48">
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
                </EACardContent>
              </EACard>

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
        </EATabsContent>

        {/* ===== MCP SAVINGS TAB ===== */}
        <EATabsContent value="savings" className="space-y-6">
          {!mcpUserMetrics || mcpUserMetrics.total_calls === 0 ? (
            <EACard>
              <EACardContent className="py-12">
                <div className="flex items-center justify-center gap-4">
                  <Zap className="w-12 h-12 text-blue-500" />
                  <div>
                    <h3 className="text-xl font-bold text-white">MCP Cost Optimizer Active</h3>
                    <p className="text-slate-400">Start using Claude-powered features to see your cost savings here</p>
                  </div>
                </div>
              </EACardContent>
            </EACard>
          ) : (
            <>
              {/* Hero Stats */}
              <EACard className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700">
                <EACardContent className="py-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">MCP Cost Savings</h2>
                      <p className="text-green-100">Intelligent caching reducing your AI costs</p>
                    </div>
                    <DollarSign className="w-16 h-16 text-white/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-green-100 text-sm mb-1">Total Saved</p>
                      <p className="text-5xl font-bold text-white">${(mcpUserMetrics.total_saved ?? 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-green-100 text-sm mb-1">Savings Rate</p>
                      <p className="text-5xl font-bold text-white">{mcpSavingsPercentage.toFixed(0)}%</p>
                    </div>
                  </div>
                </EACardContent>
              </EACard>

              {/* Efficiency Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <EACard>
                  <EACardContent className="py-6">
                    <div className="flex items-center justify-between mb-3">
                      <Target className="w-8 h-8 text-blue-400" />
                      <span className="text-3xl font-bold text-blue-400">
                        {(mcpUserMetrics.avg_cache_hit_rate ?? 0).toFixed(0)}%
                      </span>
                    </div>
                    <h3 className="font-semibold text-white">Cache Hit Rate</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {mcpUserMetrics.total_cached_calls} / {mcpUserMetrics.total_calls} cached
                    </p>
                  </EACardContent>
                </EACard>

                <EACard>
                  <EACardContent className="py-6">
                    <div className="flex items-center justify-between mb-3">
                      <Activity className="w-8 h-8 text-purple-400" />
                      <div className="text-right">
                        <div className="font-bold text-white">
                          {mcpUserMetrics.total_haiku_calls} / {mcpUserMetrics.total_sonnet_calls}
                        </div>
                      </div>
                    </div>
                    <h3 className="font-semibold text-white">Haiku / Sonnet</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {((mcpUserMetrics.total_haiku_calls / (mcpUserMetrics.total_calls || 1)) * 100).toFixed(0)}% using cheaper Haiku
                    </p>
                  </EACardContent>
                </EACard>

                <EACard>
                  <EACardContent className="py-6">
                    <div className="flex items-center justify-between mb-3">
                      <Award className="w-8 h-8 text-amber-400" />
                      <span className="text-3xl font-bold text-amber-400">
                        {mcpSavingsPercentage >= 70 ? 'A+' : mcpSavingsPercentage >= 50 ? 'A' : 'B'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white">Efficiency Grade</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {mcpSavingsPercentage >= 70 ? 'Excellent' : mcpSavingsPercentage >= 50 ? 'Good' : 'Room to improve'}
                    </p>
                  </EACardContent>
                </EACard>
              </div>

              {/* Daily Savings Trend */}
              {dailySavings.length > 0 && (
                <EACard>
                  <EACardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-green-400" />
                      <h3 className="text-lg font-bold text-white">Daily Savings Trend (Last 7 Days)</h3>
                    </div>
                  </EACardHeader>
                  <EACardContent>
                    <div className="space-y-3">
                      {dailySavings.slice(0, 7).map((day, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className="w-24 text-sm text-slate-400">
                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${day.efficiency_score}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right w-20">
                            <div className="text-sm font-bold text-green-400">${(day.saved_cost ?? 0).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </EACardContent>
                </EACard>
              )}
            </>
          )}
        </EATabsContent>

        {/* ===== REVENUE IMPACT TAB ===== */}
        <EATabsContent value="revenue" className="space-y-6">
          {/* Key Revenue Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <EAMetricCard
              label="Monthly Revenue Potential"
              value={formatCurrency(revenueSummary.totalMonthlyPotential)}
              sublabel="From CCM Services"
              riskLevel="normal"
            />
            <EAMetricCard
              label="CCM Eligible Patients"
              value={revenueSummary.ccmEligiblePatients.toString()}
              sublabel="2+ Chronic Conditions"
            />
            <EAMetricCard
              label="Pending Billing Reviews"
              value={revenueSummary.pendingBillingSuggestions.toString()}
              sublabel="AI Suggestions Ready"
              riskLevel={revenueSummary.pendingBillingSuggestions > 10 ? 'elevated' : 'normal'}
            />
            <EAMetricCard
              label="Projected Annual Revenue"
              value={formatCurrency(revenueSummary.projectedAnnualRevenue)}
              sublabel="CCM Program"
              riskLevel="normal"
            />
          </div>

          {/* Revenue Summary Card */}
          <EACard variant="highlight">
            <EACardHeader icon={<TrendingUp className="h-5 w-5" />}>
              <div className="flex items-center justify-between w-full">
                <div>
                  <h2 className="text-xl font-semibold text-white">AI Revenue Intelligence</h2>
                  <p className="text-sm text-slate-400 mt-1">Revenue optimization opportunities</p>
                </div>
                <EAButton variant="primary" size="sm" onClick={handleRunBatchAssessment} disabled={refreshing}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Run CCM Assessment
                </EAButton>
              </div>
            </EACardHeader>
            <EACardContent className="space-y-4">
              {/* CCM Revenue */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-[#00857a]" />
                    <span className="font-medium text-white">Chronic Care Management (CCM)</span>
                  </div>
                  <EABadge variant="normal">{revenueSummary.ccmEligiblePatients} Eligible</EABadge>
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  CMS reimburses $53.50-$105.00 per patient per month for CCM services.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00857a]">{formatCurrency(revenueSummary.totalMonthlyPotential)}</p>
                    <p className="text-xs text-slate-500">Monthly</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#33bfb7]">{formatCurrency(revenueSummary.projectedAnnualRevenue)}</p>
                    <p className="text-xs text-slate-500">Annual</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{revenueSummary.ccmEligiblePatients}</p>
                    <p className="text-xs text-slate-500">Patients</p>
                  </div>
                </div>
              </div>

              {/* Billing Optimization */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#00857a]" />
                    <span className="font-medium text-white">AI Billing Code Suggestions</span>
                  </div>
                  <EABadge variant={revenueSummary.pendingBillingSuggestions > 0 ? 'elevated' : 'normal'}>
                    {revenueSummary.pendingBillingSuggestions} Pending
                  </EABadge>
                </div>
                <p className="text-sm text-slate-400">
                  AI analyzes encounter documentation to suggest optimal CPT, HCPCS, and ICD-10 codes.
                </p>
              </div>

              {/* Readmission Risk */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#00857a]" />
                    <span className="font-medium text-white">Readmission Penalty Avoidance</span>
                  </div>
                  <EABadge variant={revenueSummary.highRiskPatients > 5 ? 'critical' : 'normal'}>
                    {revenueSummary.highRiskPatients} High Risk
                  </EABadge>
                </div>
                <p className="text-sm text-slate-400">
                  CMS penalizes hospitals up to 3% of Medicare payments for excess readmissions.
                </p>
              </div>
            </EACardContent>
          </EACard>

          {/* CCM Patient List */}
          {ccmAssessments.length > 0 && (
            <EACard>
              <EACardHeader icon={<Users className="h-5 w-5" />}>
                <h2 className="text-lg font-semibold text-white">CCM Eligible Patients</h2>
              </EACardHeader>
              <EACardContent>
                <div className="space-y-3">
                  {ccmAssessments.slice(0, 5).map((assessment) => (
                    <div
                      key={assessment.patientId}
                      className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-[#00857a] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#00857a]/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-[#00857a]" />
                          </div>
                          <div>
                            <p className="font-medium text-white">Patient ID: {assessment.patientId.substring(0, 8)}...</p>
                            <p className="text-sm text-slate-400">
                              {assessment.chronicConditions} conditions • Score: {(assessment.eligibilityScore * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold text-[#00857a]">
                            {formatCurrency(assessment.predictedReimbursement)}/mo
                          </p>
                          {getRecommendationBadge(assessment.recommendation)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </EACardContent>
            </EACard>
          )}
        </EATabsContent>
      </EATabs>

      {/* Footer */}
      <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>MCP Optimizer Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <span>Batch Queue Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIFinancialDashboard;
