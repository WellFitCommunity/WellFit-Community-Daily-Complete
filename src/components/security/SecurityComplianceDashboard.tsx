/**
 * SecurityComplianceDashboard - Tabbed Security & Compliance Hub
 *
 * Purpose: Consolidates all security, compliance, and audit dashboards
 * into a single tabbed interface for HIPAA officers and admin staff.
 * Used by: /security-compliance route (admin, super_admin roles)
 *
 * Tab structure:
 *   Monitoring → Compliance → Incidents → Audit → AI Transparency
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
  Shield,
  ClipboardCheck,
  AlertTriangle,
  ScrollText,
  Brain,
} from 'lucide-react';

// Lazy-load each dashboard
const TenantSecurityDashboard = lazy(() => import('../admin/TenantSecurityDashboard'));
const MfaComplianceDashboard = lazy(() => import('../admin/MfaComplianceDashboard'));
const EncounterAuditTimeline = lazy(() => import('../admin/EncounterAuditTimeline'));
const TenantComplianceReport = lazy(() => import('../admin/TenantComplianceReport'));
const TrainingComplianceDashboard = lazy(() => import('../admin/TrainingComplianceDashboard'));
const BAATrackingDashboard = lazy(() => import('../admin/BAATrackingDashboard'));
const BreachNotificationDashboard = lazy(() => import('../admin/BreachNotificationDashboard'));
const EscalationOverrideDashboard = lazy(() => import('../admin/EscalationOverrideDashboard'));
const TenantAuditLogs = lazy(() => import('../admin/TenantAuditLogs'));
const TenantConfigHistory = lazy(() => import('../admin/TenantConfigHistory'));
const PatientAmendmentReviewQueue = lazy(() => import('../admin/PatientAmendmentReviewQueue'));
const AIModelCardsDashboard = lazy(() => import('../admin/AIModelCardsDashboard'));

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

export const SecurityComplianceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('monitoring');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Security & Compliance</h1>
          <p className="text-slate-400 mt-1">
            HIPAA compliance, security monitoring, audit trails, and incident management
          </p>
        </div>

        {/* Tabs */}
        <EATabs defaultValue="monitoring" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="monitoring">
              <Shield className="h-4 w-4 mr-2" />
              Monitoring
            </EATabsTrigger>
            <EATabsTrigger value="compliance">
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Compliance
            </EATabsTrigger>
            <EATabsTrigger value="incidents">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Incidents
            </EATabsTrigger>
            <EATabsTrigger value="audit">
              <ScrollText className="h-4 w-4 mr-2" />
              Audit
            </EATabsTrigger>
            <EATabsTrigger value="ai-transparency">
              <Brain className="h-4 w-4 mr-2" />
              AI Transparency
            </EATabsTrigger>
          </EATabsList>

          {/* ── Tab 1: Monitoring ──────────────────────────────────── */}
          <EATabsContent value="monitoring">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'facility-security',
                    label: 'Facility Security',
                    component: <TenantSecurityDashboard />,
                  },
                  {
                    id: 'mfa',
                    label: 'MFA Compliance',
                    component: <MfaComplianceDashboard />,
                  },
                  {
                    id: 'encounter-audit',
                    label: 'Encounter Audit Trail',
                    component: <EncounterAuditTimeline />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 2: Compliance ──────────────────────────────────── */}
          <EATabsContent value="compliance">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'hipaa-report',
                    label: 'HIPAA/SOC2 Status',
                    component: <TenantComplianceReport />,
                  },
                  {
                    id: 'training',
                    label: 'Workforce Training',
                    component: <TrainingComplianceDashboard />,
                  },
                  {
                    id: 'baa',
                    label: 'BAA Tracking',
                    component: <BAATrackingDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 3: Incidents ───────────────────────────────────── */}
          <EATabsContent value="incidents">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'breach',
                    label: 'Breach Notification',
                    component: <BreachNotificationDashboard />,
                  },
                  {
                    id: 'overrides',
                    label: 'Escalation Overrides',
                    component: <EscalationOverrideDashboard />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 4: Audit ───────────────────────────────────────── */}
          <EATabsContent value="audit">
            <Suspense fallback={<TabLoadingFallback />}>
              <SubTabSelector
                tabs={[
                  {
                    id: 'audit-logs',
                    label: 'PHI Access Logs',
                    component: <TenantAuditLogs />,
                  },
                  {
                    id: 'config-history',
                    label: 'Config Changes',
                    component: <TenantConfigHistory />,
                  },
                  {
                    id: 'amendments',
                    label: 'Patient Amendments',
                    component: <PatientAmendmentReviewQueue />,
                  },
                ]}
              />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 5: AI Transparency ─────────────────────────────── */}
          <EATabsContent value="ai-transparency">
            <Suspense fallback={<TabLoadingFallback />}>
              <AIModelCardsDashboard />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default SecurityComplianceDashboard;
