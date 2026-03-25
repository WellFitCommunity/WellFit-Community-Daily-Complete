/**
 * BillingSuiteDashboard - Tabbed Revenue Cycle Management Hub
 *
 * Purpose: Consolidates all billing/revenue dashboards into a single
 * tabbed interface following the revenue cycle workflow order.
 * Used by: /billing-suite route (admin, billing_specialist, finance roles)
 *
 * Tab structure follows the natural revenue cycle:
 *   Overview → Verify → Claims → Track → Appeals → Intelligence
 */

import React, { Suspense, useState, lazy } from 'react';
import {
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../envision-atlus';
import AdminHeader from '../admin/AdminHeader';
import {
  BarChart3,
  ShieldCheck,
  FileText,
  Clock,
  RefreshCw,
  Brain,
} from 'lucide-react';

// Lazy-load each tab's content to keep initial bundle small
const BillingDashboard = lazy(() => import('../admin/BillingDashboard'));
const RevenueDashboard = lazy(() => import('../atlas/RevenueDashboard'));
const EligibilityVerificationPanel = lazy(() => import('../admin/EligibilityVerificationPanel'));
const PriorAuthDashboard = lazy(() => import('../admin/PriorAuthDashboard'));
const ClaimsSubmissionPanel = lazy(() => import('../atlas/ClaimsSubmissionPanel'));
const BillingQueueDashboard = lazy(() => import('../admin/BillingQueueDashboard'));
const SuperbillReviewPanel = lazy(() => import('../admin/SuperbillReviewPanel'));
const ClaimAgingDashboard = lazy(() => import('../admin/ClaimAgingDashboard'));
const ERAPaymentPostingDashboard = lazy(() => import('../admin/ERAPaymentPostingDashboard'));
const ClaimsAppealsPanel = lazy(() => import('../atlas/ClaimsAppealsPanel'));
const ClaimResubmissionDashboard = lazy(() => import('../admin/ClaimResubmissionDashboard'));
const UndercodingDetectionDashboard = lazy(() => import('../admin/UndercodingDetectionDashboard'));
const HCCOpportunityDashboard = lazy(() => import('../admin/HCCOpportunityDashboard'));
const DocumentationGapDashboard = lazy(() => import('../admin/DocumentationGapDashboard'));
const StaffFinancialSavingsTracker = lazy(() => import('../admin/StaffFinancialSavingsTracker'));

/** Loading fallback for lazy-loaded tab content */
const TabLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-[var(--ea-primary,#00857a)]" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);

/** Sub-tab selector for tabs with multiple dashboards */
interface SubTabProps {
  tabs: Array<{ id: string; label: string; component: React.ReactNode }>;
}

const SubTabSelector: React.FC<SubTabProps> = ({ tabs }) => {
  const [activeSubTab, setActiveSubTab] = useState(tabs[0]?.id ?? '');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
              activeSubTab === tab.id
                ? 'bg-[var(--ea-primary,#00857a)] text-white shadow-sm'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) =>
        activeSubTab === tab.id ? (
          <div key={tab.id}>{tab.component}</div>
        ) : null
      )}
    </div>
  );
};

export const BillingSuiteDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Billing Suite</h1>
          <p className="text-slate-400 mt-1">
            Revenue cycle management — from eligibility verification through payment posting
          </p>
        </div>

        {/* Tabs */}
        <EATabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </EATabsTrigger>
            <EATabsTrigger value="verify">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verify
            </EATabsTrigger>
            <EATabsTrigger value="claims">
              <FileText className="h-4 w-4 mr-2" />
              Claims
            </EATabsTrigger>
            <EATabsTrigger value="track">
              <Clock className="h-4 w-4 mr-2" />
              Track
            </EATabsTrigger>
            <EATabsTrigger value="appeals">
              <RefreshCw className="h-4 w-4 mr-2" />
              Appeals
            </EATabsTrigger>
            <EATabsTrigger value="intelligence">
              <Brain className="h-4 w-4 mr-2" />
              Intelligence
            </EATabsTrigger>
          </EATabsList>

          {/* ── Tab 1: Overview ────────────────────────────────────── */}
          <EATabsContent value="overview">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'billing-overview',
                    label: 'Billing & Claims',
                    component: <BillingDashboard />,
                  },
                  {
                    id: 'revenue',
                    label: 'Revenue Analytics',
                    component: <RevenueDashboard />,
                  },
                  {
                    id: 'savings',
                    label: 'Staff Savings',
                    component: <StaffFinancialSavingsTracker />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 2: Verify ──────────────────────────────────────── */}
          <EATabsContent value="verify">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'eligibility',
                    label: 'Eligibility (270/271)',
                    component: <EligibilityVerificationPanel />,
                  },
                  {
                    id: 'prior-auth',
                    label: 'Prior Authorization',
                    component: <PriorAuthDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 3: Claims ──────────────────────────────────────── */}
          <EATabsContent value="claims">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'submission',
                    label: 'Submit Claims (837P)',
                    component: <ClaimsSubmissionPanel />,
                  },
                  {
                    id: 'queue',
                    label: 'Billing Queue',
                    component: <BillingQueueDashboard />,
                  },
                  {
                    id: 'superbill',
                    label: 'Superbill Review',
                    component: <SuperbillReviewPanel />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 4: Track ───────────────────────────────────────── */}
          <EATabsContent value="track">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'aging',
                    label: 'Claim Aging',
                    component: <ClaimAgingDashboard />,
                  },
                  {
                    id: 'era',
                    label: 'ERA Payment Posting',
                    component: <ERAPaymentPostingDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 5: Appeals ─────────────────────────────────────── */}
          <EATabsContent value="appeals">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'appeals-main',
                    label: 'Appeals & Denials',
                    component: <ClaimsAppealsPanel />,
                  },
                  {
                    id: 'resubmit',
                    label: 'Resubmission Workflow',
                    component: <ClaimResubmissionDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 6: Intelligence ────────────────────────────────── */}
          <EATabsContent value="intelligence">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'undercoding',
                    label: 'Undercoding Detection',
                    component: <UndercodingDetectionDashboard />,
                  },
                  {
                    id: 'hcc',
                    label: 'HCC Opportunity Flags',
                    component: <HCCOpportunityDashboard />,
                  },
                  {
                    id: 'doc-gaps',
                    label: 'Documentation Gaps',
                    component: <DocumentationGapDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default BillingSuiteDashboard;
