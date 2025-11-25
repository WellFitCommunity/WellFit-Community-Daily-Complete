/**
 * AI Revenue Dashboard
 *
 * Consolidates AI-powered revenue optimization services:
 * - CCM Eligibility Scoring (Medicare reimbursement)
 * - Billing Code Suggestions (encounter-based AI coding)
 * - Readmission Risk Predictions (penalty avoidance)
 *
 * HIPAA Compliance:
 * - All data uses patient IDs/tokens, never PHI in browser
 * - All operations logged via audit system
 *
 * Design: Envision Atlus Clinical Design System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  DollarSign,
  Users,
  FileText,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Building2,
  Heart,
  Calculator,
} from 'lucide-react';
import { useAuth, useSupabaseClient } from '../../contexts/AuthContext';
import { auditLogger } from '../../services/auditLogger';
import { ccmEligibilityScorer, type CCMEligibilityResult } from '../../services/ai/ccmEligibilityScorer';

// Envision Atlus Design System
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EAPageLayout,
  EARiskIndicator,
} from '../envision-atlus';

// =====================================================
// TYPES
// =====================================================

interface AIRevenueDashboardProps {
  tenantId?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

type TabValue = 'overview' | 'ccm' | 'billing' | 'readmission';

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

// =====================================================
// COMPONENT
// =====================================================

export const AIRevenueDashboard: React.FC<AIRevenueDashboardProps> = ({
  tenantId,
  showBackButton = false,
  onBack,
}) => {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get tenant ID from user profile if not provided
  const effectiveTenantId = tenantId || user?.user_metadata?.tenant_id;

  // Revenue Summary State
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary>({
    totalMonthlyPotential: 0,
    ccmEligiblePatients: 0,
    pendingBillingSuggestions: 0,
    highRiskPatients: 0,
    projectedAnnualRevenue: 0,
  });

  // CCM Assessments State
  const [ccmAssessments, setCCMAssessments] = useState<CCMPatientSummary[]>([]);

  // Load production data from database
  const loadRevenueSummary = useCallback(async () => {
    if (!effectiveTenantId) {
      setError('Tenant ID required to load revenue data');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get CCM assessments from database
      const { data: ccmData, error: ccmError } = await supabase
        .from('ccm_eligibility_assessments')
        .select('patient_id, overall_eligibility_score, chronic_conditions_count, predicted_monthly_reimbursement, enrollment_recommendation, assessment_date')
        .eq('tenant_id', effectiveTenantId)
        .gte('overall_eligibility_score', 0.5)
        .order('assessment_date', { ascending: false })
        .limit(100);

      if (ccmError) {
        auditLogger.error('AI_REVENUE_CCM_LOAD_ERROR', ccmError);
      }

      // Get pending billing suggestions count
      const { count: billingCount, error: billingError } = await supabase
        .from('encounter_billing_suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', effectiveTenantId)
        .eq('status', 'pending');

      if (billingError) {
        auditLogger.error('AI_REVENUE_BILLING_LOAD_ERROR', billingError);
      }

      // Get high-risk patients from readmission predictions
      const { count: highRiskCount, error: riskError } = await supabase
        .from('readmission_risk_predictions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', effectiveTenantId)
        .in('risk_category', ['high', 'critical']);

      if (riskError) {
        auditLogger.error('AI_REVENUE_RISK_LOAD_ERROR', riskError);
      }

      // Process CCM assessments
      const assessments: CCMPatientSummary[] = (ccmData || []).map((row: any) => ({
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

      auditLogger.info('AI_REVENUE_DASHBOARD_LOADED', {
        tenantId: effectiveTenantId,
        ccmAssessments: assessments.length,
        pendingBilling: billingCount || 0,
        highRiskPatients: highRiskCount || 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load revenue data';
      setError(errorMessage);
      auditLogger.error('AI_REVENUE_DASHBOARD_LOAD_ERROR', err as Error);
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId, supabase]);

  // Initial load
  useEffect(() => {
    loadRevenueSummary();
    auditLogger.info('AI_REVENUE_DASHBOARD_VIEWED', {
      tenantId: effectiveTenantId,
      userId: user?.id,
    });
  }, [loadRevenueSummary, effectiveTenantId, user?.id]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRevenueSummary();
    setRefreshing(false);
    auditLogger.info('AI_REVENUE_DASHBOARD_REFRESHED', {
      tenantId: effectiveTenantId,
      userId: user?.id,
    });
  };

  // Run batch CCM assessment
  const handleRunBatchAssessment = async () => {
    if (!effectiveTenantId) {
      auditLogger.error('AI_REVENUE_BATCH_NO_TENANT', new Error('No tenant ID'));
      return;
    }

    try {
      setLoading(true);
      const results = await ccmEligibilityScorer.batchAssessEligibility(effectiveTenantId);

      auditLogger.info('AI_REVENUE_BATCH_COMPLETED', {
        tenantId: effectiveTenantId,
        userId: user?.id,
        assessed: results.assessed,
        eligible: results.eligible,
        predictedRevenue: results.predictedRevenue,
        aiCost: results.cost,
      });

      // Reload data
      await loadRevenueSummary();
    } catch (err) {
      auditLogger.error('AI_REVENUE_BATCH_ERROR', err as Error);
      setError(err instanceof Error ? err.message : 'Batch assessment failed');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <EAPageLayout
        title="AI Revenue Optimization"
        subtitle="Loading revenue intelligence..."
        backButton={showBackButton && onBack ? { onClick: onBack } : undefined}
      >
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 text-[#00857a] animate-spin" />
          <span className="ml-3 text-lg text-slate-400">Loading revenue data...</span>
        </div>
      </EAPageLayout>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <EAPageLayout
        title="AI Revenue Optimization"
        subtitle="Error loading data"
        backButton={showBackButton && onBack ? { onClick: onBack } : undefined}
      >
        <EAAlert variant="critical" title="Failed to Load Revenue Data" className="mb-6">
          {error}
        </EAAlert>
        <EAButton variant="primary" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </EAButton>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout
      title="AI Revenue Optimization"
      subtitle="Maximize reimbursement with AI-powered billing intelligence"
      badge={
        revenueSummary.totalMonthlyPotential > 0 ? (
          <EABadge variant="normal" size="sm">
            {formatCurrency(revenueSummary.projectedAnnualRevenue)}/yr potential
          </EABadge>
        ) : undefined
      }
      backButton={showBackButton && onBack ? { onClick: onBack } : undefined}
      actions={
        <EAButton
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </EAButton>
      }
    >
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800/50 border border-slate-700 rounded-lg p-1 mb-6">
          <TabsTrigger
            value="overview"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Revenue</span> Overview
          </TabsTrigger>
          <TabsTrigger
            value="ccm"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <Heart className="h-4 w-4" />
            CCM Eligibility
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <FileText className="h-4 w-4" />
            Billing Codes
          </TabsTrigger>
          <TabsTrigger
            value="readmission"
            className="flex items-center gap-2 rounded-md data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400"
          >
            <Building2 className="h-4 w-4" />
            Readmission Risk
          </TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <h2 className="text-xl font-semibold text-white">AI Revenue Intelligence Summary</h2>
              <p className="text-sm text-slate-400 mt-1">
                Consolidated view of revenue optimization opportunities
              </p>
            </EACardHeader>
            <EACardContent className="space-y-4">
              {/* CCM Revenue Opportunity */}
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-[#00857a]" />
                    <span className="font-medium text-white">Chronic Care Management (CCM)</span>
                  </div>
                  <EABadge variant="normal">{revenueSummary.ccmEligiblePatients} Eligible</EABadge>
                </div>
                <p className="text-sm text-slate-400 mb-3">
                  CMS reimburses ${53.50}-${105.00} per patient per month for CCM services.
                  Patients with 2+ chronic conditions qualify.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#00857a]">{formatCurrency(revenueSummary.totalMonthlyPotential)}</p>
                    <p className="text-xs text-slate-500">Monthly Potential</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#33bfb7]">{formatCurrency(revenueSummary.projectedAnnualRevenue)}</p>
                    <p className="text-xs text-slate-500">Annual Projection</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{revenueSummary.ccmEligiblePatients}</p>
                    <p className="text-xs text-slate-500">Eligible Patients</p>
                  </div>
                </div>
              </div>

              {/* Billing Code Optimization */}
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
                  Reduces claim denials and maximizes legitimate reimbursement.
                </p>
              </div>

              {/* Readmission Penalty Avoidance */}
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
                  Our AI predicts risk so you can intervene proactively.
                </p>
              </div>
            </EACardContent>
          </EACard>
        </TabsContent>

        {/* ===== CCM ELIGIBILITY TAB ===== */}
        <TabsContent value="ccm" className="space-y-6">
          <EACard variant="highlight">
            <EACardHeader icon={<Heart className="h-5 w-5" />}>
              <div className="flex items-center justify-between w-full">
                <div>
                  <h2 className="text-xl font-semibold text-white">CCM Eligibility Assessment</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    AI-powered identification of patients eligible for Chronic Care Management
                  </p>
                </div>
                <EAButton
                  variant="primary"
                  size="sm"
                  onClick={handleRunBatchAssessment}
                  disabled={loading}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Run Batch Assessment
                </EAButton>
              </div>
            </EACardHeader>
            <EACardContent>
              {/* CCM Criteria Info */}
              <EAAlert variant="info" className="mb-6">
                <strong>CMS CCM Eligibility Criteria:</strong> Patients must have 2+ chronic conditions
                expected to last 12+ months that place them at significant risk of death, acute exacerbation,
                or functional decline.
              </EAAlert>

              {/* Patient List */}
              {ccmAssessments.length > 0 ? (
                <div className="space-y-3">
                  {ccmAssessments.map((assessment) => (
                    <div
                      key={assessment.patientId}
                      className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-[#00857a] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-[#00857a]/20 flex items-center justify-center">
                            <Users className="h-6 w-6 text-[#00857a]" />
                          </div>
                          <div>
                            <p className="font-medium text-white">Patient ID: {assessment.patientId.substring(0, 8)}...</p>
                            <p className="text-sm text-slate-400">
                              {assessment.chronicConditions} chronic conditions • Assessed {assessment.assessmentDate}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-[#00857a]">
                              {formatCurrency(assessment.predictedReimbursement)}/mo
                            </p>
                            <p className="text-xs text-slate-500">
                              Score: {(assessment.eligibilityScore * 100).toFixed(0)}%
                            </p>
                          </div>
                          {getRecommendationBadge(assessment.recommendation)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No CCM assessments found. Run a batch assessment to identify eligible patients.</p>
                </div>
              )}

              {/* Reimbursement Tiers Info */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-400">Basic CCM</p>
                  <p className="text-xl font-bold text-white">$53.50</p>
                  <p className="text-xs text-slate-500">CPT 99490 (20+ min)</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 text-center border border-[#00857a]">
                  <p className="text-sm text-slate-400">Complex CCM</p>
                  <p className="text-xl font-bold text-[#00857a]">$105.00</p>
                  <p className="text-xs text-slate-500">CPT 99487 (60+ min)</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-400">Principal Care</p>
                  <p className="text-xl font-bold text-white">$85.00</p>
                  <p className="text-xs text-slate-500">CPT 99424</p>
                </div>
              </div>
            </EACardContent>
          </EACard>
        </TabsContent>

        {/* ===== BILLING CODES TAB ===== */}
        <TabsContent value="billing" className="space-y-6">
          <EACard variant="highlight">
            <EACardHeader icon={<FileText className="h-5 w-5" />}>
              <h2 className="text-xl font-semibold text-white">AI Billing Code Suggestions</h2>
              <p className="text-sm text-slate-400 mt-1">
                AI analyzes encounter documentation to optimize billing codes
              </p>
            </EACardHeader>
            <EACardContent>
              <EAAlert variant="info" className="mb-6">
                Billing code suggestions are generated per encounter. Navigate to an encounter to view
                AI-generated CPT, HCPCS, and ICD-10 code recommendations.
              </EAAlert>

              {/* Placeholder for billing suggestions list */}
              <div className="text-center py-8 text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Billing code suggestions are generated on a per-encounter basis.</p>
                <p className="text-sm mt-2">Open an encounter to see AI-powered billing recommendations.</p>
                <EAButton variant="secondary" className="mt-4" onClick={() => setActiveTab('overview')}>
                  View Revenue Overview
                </EAButton>
              </div>

              {/* Code Types Info */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="font-medium text-white mb-2">CPT Codes</p>
                  <p className="text-sm text-slate-400">
                    Current Procedural Terminology codes for medical services and procedures
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="font-medium text-white mb-2">HCPCS Codes</p>
                  <p className="text-sm text-slate-400">
                    Healthcare Common Procedure Coding System for supplies, equipment, and services
                  </p>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                  <p className="font-medium text-white mb-2">ICD-10 Codes</p>
                  <p className="text-sm text-slate-400">
                    International Classification of Diseases for diagnoses and conditions
                  </p>
                </div>
              </div>
            </EACardContent>
          </EACard>
        </TabsContent>

        {/* ===== READMISSION RISK TAB ===== */}
        <TabsContent value="readmission" className="space-y-6">
          <EACard variant="highlight">
            <EACardHeader icon={<Building2 className="h-5 w-5" />}>
              <h2 className="text-xl font-semibold text-white">Readmission Risk & Penalty Avoidance</h2>
              <p className="text-sm text-slate-400 mt-1">
                Identify high-risk patients to avoid CMS readmission penalties
              </p>
            </EACardHeader>
            <EACardContent>
              <EAAlert variant="warning" className="mb-6">
                <strong>CMS Hospital Readmissions Reduction Program:</strong> Hospitals with excess 30-day
                readmissions face penalties up to 3% of Medicare payments. Early intervention is key.
              </EAAlert>

              {/* Risk Categories Summary */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
                  <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-400">3</p>
                  <p className="text-xs text-red-300">Critical Risk</p>
                </div>
                <div className="bg-orange-900/30 border border-orange-500/50 rounded-lg p-4 text-center">
                  <Activity className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-400">7</p>
                  <p className="text-xs text-orange-300">High Risk</p>
                </div>
                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-4 text-center">
                  <Activity className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-400">15</p>
                  <p className="text-xs text-yellow-300">Moderate Risk</p>
                </div>
                <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-400">45</p>
                  <p className="text-xs text-green-300">Low Risk</p>
                </div>
              </div>

              {/* Link to full algorithms dashboard */}
              <div className="bg-slate-900 rounded-lg p-6 border border-slate-700 text-center">
                <Activity className="h-12 w-12 text-[#00857a] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">View Full Risk Prediction Model</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Access the complete Healthcare Algorithms Dashboard for detailed readmission risk
                  analysis including our patent-pending Communication Silence Window algorithm.
                </p>
                <EAButton
                  variant="primary"
                  onClick={() => window.location.href = '/admin/healthcare-algorithms'}
                >
                  Open Healthcare Algorithms
                </EAButton>
              </div>
            </EACardContent>
          </EACard>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="mt-8 text-center text-slate-500 text-sm">
        <p>&copy; 2024 Envision VirtualEdge Group LLC — WellFit Community Platform</p>
        <p className="mt-1">AI Revenue Intelligence — Powered by Claude AI</p>
      </div>
    </EAPageLayout>
  );
};

export default AIRevenueDashboard;
