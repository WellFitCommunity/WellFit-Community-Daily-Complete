/**
 * CareOperationsDashboard - Tabbed Care Operations Hub
 *
 * Purpose: Consolidates provider workflow, task queue, referral tracking,
 * and result escalation dashboards into a single tabbed interface.
 * Used by: /care-operations route (admin, physician, nurse, case_manager roles)
 *
 * Tab structure:
 *   Providers → Tasks → Results → Referrals
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
  Users,
  ClipboardList,
  AlertCircle,
  ArrowRightLeft,
} from 'lucide-react';

// Lazy-load each dashboard
const ProviderAssignmentDashboard = lazy(() => import('../admin/ProviderAssignmentDashboard'));
const ProviderCoverageDashboard = lazy(() => import('../admin/ProviderCoverageDashboard'));
const ProviderTaskQueueDashboard = lazy(() => import('../admin/ProviderTaskQueueDashboard'));
const UnacknowledgedResultsDashboard = lazy(() => import('../admin/UnacknowledgedResultsDashboard'));
const ResultEscalationDashboard = lazy(() => import('../admin/ResultEscalationDashboard'));
const ReferralAgingDashboard = lazy(() => import('../admin/ReferralAgingDashboard'));
const ReferralCompletionDashboard = lazy(() => import('../admin/ReferralCompletionDashboard'));

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

export const CareOperationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('providers');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Care Operations</h1>
          <p className="text-slate-400 mt-1">
            Provider assignments, task queues, result escalation, and referral tracking
          </p>
        </div>

        {/* Tabs */}
        <EATabs defaultValue="providers" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="providers">
              <Users className="h-4 w-4 mr-2" />
              Providers
            </EATabsTrigger>
            <EATabsTrigger value="tasks">
              <ClipboardList className="h-4 w-4 mr-2" />
              Tasks
            </EATabsTrigger>
            <EATabsTrigger value="results">
              <AlertCircle className="h-4 w-4 mr-2" />
              Results
            </EATabsTrigger>
            <EATabsTrigger value="referrals">
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Referrals
            </EATabsTrigger>
          </EATabsList>

          {/* ── Tab 1: Providers ───────────────────────────────────── */}
          <EATabsContent value="providers">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'assignments',
                    label: 'Provider Assignments',
                    component: <ProviderAssignmentDashboard />,
                  },
                  {
                    id: 'coverage',
                    label: 'On-Call Coverage',
                    component: <ProviderCoverageDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 2: Tasks ───────────────────────────────────────── */}
          <EATabsContent value="tasks">
            <Suspense fallback={<TabLoadingFallback />}>
              <ProviderTaskQueueDashboard />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 3: Results ─────────────────────────────────────── */}
          <EATabsContent value="results">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'unacknowledged',
                    label: 'Unacknowledged Results',
                    component: <UnacknowledgedResultsDashboard />,
                  },
                  {
                    id: 'escalation',
                    label: 'Result Escalation',
                    component: <ResultEscalationDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 4: Referrals ───────────────────────────────────── */}
          <EATabsContent value="referrals">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'aging',
                    label: 'Referral Aging',
                    component: <ReferralAgingDashboard />,
                  },
                  {
                    id: 'completion',
                    label: 'Referral Completion',
                    component: <ReferralCompletionDashboard />,
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

export default CareOperationsDashboard;
