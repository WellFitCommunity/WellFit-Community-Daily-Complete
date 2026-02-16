/**
 * NurseOfficeDashboard — Nurse Office Practice Management
 *
 * Purpose: Aggregates the nurse-specific office workflow into a single
 *          tabbed dashboard. Focuses on intake, triage, task routing,
 *          referral coordination, eligibility, care gaps, and shift handoff.
 *          Excludes billing/revenue sections (physician territory).
 *
 * Used by: Route /nurse-office (clinical role-gated)
 */

import React, { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../admin/AdminHeader';
import NursePatientPriorityBoard from './NursePatientPriorityBoard';

// Lazy-load heavy section components (only downloaded when tab is active)
const ProviderTaskQueueDashboard = lazy(() => import('../admin/ProviderTaskQueueDashboard'));
const UnacknowledgedResultsDashboard = lazy(() => import('../admin/UnacknowledgedResultsDashboard'));
const ResultEscalationDashboard = lazy(() => import('../admin/ResultEscalationDashboard'));
const ReferralAgingDashboard = lazy(() => import('../admin/ReferralAgingDashboard'));
const ReferralCompletionDashboard = lazy(() => import('../admin/ReferralCompletionDashboard'));
const EligibilityVerificationPanel = lazy(() => import('../admin/EligibilityVerificationPanel'));
const CareGapDashboard = lazy(() => import('../admin/CareGapDashboard'));
const ShiftHandoffDashboard = lazy(() => import('./ShiftHandoffDashboard'));

type OfficeTab =
  | 'overview'
  | 'tasks'
  | 'results'
  | 'referrals'
  | 'eligibility'
  | 'handoff';

interface TabDefinition {
  id: OfficeTab;
  label: string;
  description: string;
}

const TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview', description: 'Patient priorities & care gap detection' },
  { id: 'tasks', label: 'Task Inbox', description: 'Nurse task queue & result escalations' },
  { id: 'results', label: 'Clinical Review', description: 'Unacknowledged results requiring attention' },
  { id: 'referrals', label: 'Referrals', description: 'Referral aging, follow-up & specialist confirmation' },
  { id: 'eligibility', label: 'Eligibility & Intake', description: 'Insurance verification for patient intake' },
  { id: 'handoff', label: 'Shift Handoff', description: 'Shift change communication & continuity' },
];

const SectionLoading: React.FC = () => (
  <div className="flex items-center justify-center p-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    <span className="ml-3 text-gray-600">Loading section...</span>
  </div>
);

const NurseOfficeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OfficeTab>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Nurse Office" />

      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {/* Quick Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              Nurse workflow — intake, triage, coordination & handoff
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/nurse-dashboard')}
              className="px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Nurse Dashboard
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
                    ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
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
          {activeTab === 'referrals' && <ReferralsTab />}
          {activeTab === 'eligibility' && <EligibilityTab />}
          {activeTab === 'handoff' && <HandoffTab />}
        </div>

        {/* Safe Harbor */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Safe Harbor — Nurse Office Dashboard | Envision ATLUS I.H.I.S.
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TAB COMPONENTS (lean — delegates to existing components)
// ============================================================================

const OverviewTab: React.FC = () => (
  <div className="space-y-6">
    <NursePatientPriorityBoard />
    <Suspense fallback={<SectionLoading />}>
      <CareGapDashboard />
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

const ReferralsTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <ReferralAgingDashboard />
    </Suspense>
    <Suspense fallback={<SectionLoading />}>
      <ReferralCompletionDashboard />
    </Suspense>
  </div>
);

const EligibilityTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <EligibilityVerificationPanel />
    </Suspense>
  </div>
);

const HandoffTab: React.FC = () => (
  <div className="space-y-6">
    <Suspense fallback={<SectionLoading />}>
      <ShiftHandoffDashboard />
    </Suspense>
  </div>
);

export default NurseOfficeDashboard;
