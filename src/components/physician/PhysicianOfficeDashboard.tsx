/**
 * PhysicianOfficeDashboard — Physician Office Practice Management
 *
 * Purpose: Aggregates the complete encounter-to-payment workflow for a
 *          physician's office into a single tabbed dashboard. Combines
 *          patient priority, provider tasks, clinical review, billing
 *          pipeline, and revenue intelligence from the Clinical Revenue
 *          Build Tracker.
 *
 * Used by: Route /physician-office (clinical role-gated)
 */

import React, { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../admin/AdminHeader';
import PatientPriorityBoard from './PatientPriorityBoard';

// Lazy-load heavy admin section components (only downloaded when tab is active)
const ProviderTaskQueueDashboard = lazy(() => import('../admin/ProviderTaskQueueDashboard'));
const UnacknowledgedResultsDashboard = lazy(() => import('../admin/UnacknowledgedResultsDashboard'));
const SuperbillReviewPanel = lazy(() => import('../admin/SuperbillReviewPanel'));
const EligibilityVerificationPanel = lazy(() => import('../admin/EligibilityVerificationPanel'));
const BillingQueueDashboard = lazy(() => import('../admin/BillingQueueDashboard'));
const ProviderAssignmentDashboard = lazy(() => import('../admin/ProviderAssignmentDashboard'));
const ResultEscalationDashboard = lazy(() => import('../admin/ResultEscalationDashboard'));
const ProviderCoverageDashboard = lazy(() => import('../admin/ProviderCoverageDashboard'));
const ClaimAgingDashboard = lazy(() => import('../admin/ClaimAgingDashboard'));
const UndercodingDetectionDashboard = lazy(() => import('../admin/UndercodingDetectionDashboard'));
const DocumentationGapDashboard = lazy(() => import('../admin/DocumentationGapDashboard'));
const HCCOpportunityDashboard = lazy(() => import('../admin/HCCOpportunityDashboard'));
const ERAPaymentPostingDashboard = lazy(() => import('../admin/ERAPaymentPostingDashboard'));
const ClaimResubmissionDashboard = lazy(() => import('../admin/ClaimResubmissionDashboard'));

type OfficeTab =
  | 'overview'
  | 'tasks'
  | 'results'
  | 'billing'
  | 'revenue'
  | 'coverage';

interface TabDefinition {
  id: OfficeTab;
  label: string;
  description: string;
}

const TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', description: 'Patient priorities & provider assignments' },
  { id: 'tasks', label: 'Task Inbox', description: 'Provider task queue & escalations' },
  { id: 'results', label: 'Clinical Review', description: 'Unacknowledged results & escalation rules' },
  { id: 'billing', label: 'Billing Pipeline', description: 'Eligibility, superbills, claims' },
  { id: 'revenue', label: 'Revenue Intel', description: 'Undercoding, documentation gaps, HCC' },
  { id: 'coverage', label: 'Coverage & Scheduling', description: 'On-call, coverage assignments' },
];

const SectionLoading: React.FC = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    <span className="ml-3 text-gray-600">Loading section...</span>
  </div>
);

const PhysicianOfficeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OfficeTab>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Physician Office" />

      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {/* Quick Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Practice management — encounter to payment workflow
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/physician-dashboard')}
              className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              Command Center
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Admin Panel
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                title={tab.description}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-1">
            <p className="text-xs text-gray-500 px-4 py-2">
              {TABS.find((t) => t.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'tasks' && <TasksTab />}
          {activeTab === 'results' && <ResultsTab />}
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'revenue' && <RevenueTab />}
          {activeTab === 'coverage' && <CoverageTab />}
        </div>

        {/* Safe Harbor */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Safe Harbor — Physician Office Dashboard | Envision ATLUS I.H.I.S.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB COMPONENTS (kept lean — each delegates to existing admin components)
// ============================================================================

const OverviewTab: React.FC = () => (
  <div className="space-y-6">
    <PatientPriorityBoard />
    <Suspense fallback={<SectionLoading />}>
      <ProviderAssignmentDashboard />
    </Suspense>
  </div>
);

const TasksTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <ProviderTaskQueueDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <ResultEscalationDashboard />
    </Suspense>
  </div>
);

const ResultsTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <UnacknowledgedResultsDashboard />
    </Suspense>
  </div>
);

const BillingTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <EligibilityVerificationPanel />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <BillingQueueDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <SuperbillReviewPanel />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <ClaimAgingDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <ClaimResubmissionDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <ERAPaymentPostingDashboard />
    </Suspense>
  </div>
);

const RevenueTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <UndercodingDetectionDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <DocumentationGapDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <HCCOpportunityDashboard />
    </Suspense>
  </div>
);

const CoverageTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <ProviderCoverageDashboard />
    </Suspense>
  </div>
);

export default PhysicianOfficeDashboard;
