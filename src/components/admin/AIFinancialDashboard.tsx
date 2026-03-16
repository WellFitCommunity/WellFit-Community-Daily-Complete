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
import { mcpOptimizer } from '../../services/mcp/mcp-cost-optimizer';
import { batchInference } from '../../services/ai/batchInference';
import type { QueueStats } from '../../services/ai/batchInference';
import { ccmEligibilityScorer } from '../../services/ai/ccmEligibilityScorer';
import { auditLogger } from '../../services/auditLogger';
import {
  EAButton,
  EATabs,
  EATabsList,
  EATabsTrigger,
} from '../envision-atlus';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import type {
  CostMetrics,
  CostTrend,
  ModelDistribution,
  OptimizationRecommendation,
  MCPUserMetrics,
  DailySavings,
  RevenueSummary,
  CCMPatientSummary,
  CCMRow,
  TabValue,
} from './ai-financial-dashboard/AIFinancialDashboard.types';
import CostManagementTab from './ai-financial-dashboard/CostManagementTab';
import MCPSavingsTab from './ai-financial-dashboard/MCPSavingsTab';
import RevenueImpactTab from './ai-financial-dashboard/RevenueImpactTab';

// ============================================================================
// Main Component
// ============================================================================

const AIFinancialDashboard: React.FC = () => {
  useDashboardTheme();
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
    } catch (error: unknown) {
      auditLogger.error('AI_FINANCIAL_COST_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [loadHistoricalTrends]);

  const loadMCPSavings = useCallback(async () => {
    if (!user) return;

    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('mcp_cost_savings_summary')
        .select('total_spent, total_saved, avg_cache_hit_rate, total_calls, total_cached_calls, total_haiku_calls, total_sonnet_calls')
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
    } catch (error: unknown) {
      auditLogger.error('AI_FINANCIAL_REVENUE_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [tenantId, supabase]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadCostMetrics(),
      loadMCPSavings(),
      loadRevenueData(),
    ]);
    setLoading(false);
  }, [loadCostMetrics, loadMCPSavings, loadRevenueData]);

  useEffect(() => {
    loadAllData();
    auditLogger.info('AI_FINANCIAL_DASHBOARD_VIEW', { tab: activeTab });
  }, [loadAllData, activeTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const handleRunBatchAssessment = async () => {
    if (!tenantId) return;
    try {
      setRefreshing(true);
      await ccmEligibilityScorer.batchAssessEligibility(tenantId);
      await loadRevenueData();
    } catch (error: unknown) {
      auditLogger.error('AI_FINANCIAL_BATCH_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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
    <div className="min-h-screen bg-slate-900 p-6" aria-label="AI Financial Dashboard">
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
            className="bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
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

        <CostManagementTab
          costMetrics={costMetrics}
          totalSavings={totalSavings}
          savingsPercentage={savingsPercentage}
          modelDistribution={modelDistribution}
          queueStats={queueStats}
          batchStats={batchStats}
          costTrends={costTrends}
          recommendations={recommendations}
        />

        <MCPSavingsTab
          mcpUserMetrics={mcpUserMetrics}
          mcpSavingsPercentage={mcpSavingsPercentage}
          dailySavings={dailySavings}
        />

        <RevenueImpactTab
          revenueSummary={revenueSummary}
          ccmAssessments={ccmAssessments}
          refreshing={refreshing}
          onRunBatchAssessment={handleRunBatchAssessment}
          formatCurrency={formatCurrency}
        />
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
              <div className="w-2 h-2 rounded-full bg-[var(--ea-primary,#00857a)]" />
              <span>Batch Queue Running</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIFinancialDashboard;
