/**
 * RevenueImpactTab - Revenue Impact tab content for AI Financial Dashboard
 *
 * Purpose: Displays CCM eligibility, billing optimization, readmission risk, and CCM patient list
 * Used by: AIFinancialDashboard
 */

import React from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EATabsContent,
} from '../../envision-atlus';
import {
  TrendingUp,
  Heart,
  FileText,
  Building2,
  Users,
  Calculator,
} from 'lucide-react';
import type { RevenueSummary, CCMPatientSummary } from './AIFinancialDashboard.types';

interface RevenueImpactTabProps {
  revenueSummary: RevenueSummary;
  ccmAssessments: CCMPatientSummary[];
  refreshing: boolean;
  onRunBatchAssessment: () => void;
  formatCurrency: (amount: number) => string;
}

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

const RevenueImpactTab: React.FC<RevenueImpactTabProps> = ({
  revenueSummary,
  ccmAssessments,
  refreshing,
  onRunBatchAssessment,
  formatCurrency,
}) => {
  return (
    <EATabsContent value="revenue" className="space-y-6">
      {/* Key Revenue Metrics */}
      <div className="grid grid-cols-4 gap-4" aria-label="Revenue Impact Key Metrics">
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
            <EAButton variant="primary" size="sm" onClick={onRunBatchAssessment} disabled={refreshing}>
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
                          {assessment.chronicConditions} conditions {'\u2022'} Score: {(assessment.eligibilityScore * 100).toFixed(0)}%
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
  );
};

export default RevenueImpactTab;
