/**
 * SOC2 Compliance Dashboard
 *
 * Consolidated dashboard for SOC2 security and compliance monitoring:
 * - Audit Trail: Compliance score, control status, PHI access audit
 * - Security Events: Real-time security monitoring, failed logins, threats
 * - Incident Response: Investigation queue with SLA tracking
 *
 * HIPAA Compliant: No PHI displayed
 *
 * Consolidates: SOC2AuditDashboard, SOC2SecurityDashboard, SOC2IncidentResponseDashboard
 */

import React from 'react';
import {
  EAButton,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../../envision-atlus';
import {
  Shield,
  AlertTriangle,
  FileSearch,
  RefreshCw,
} from 'lucide-react';
import { useSOC2Data } from './useSOC2Data';
import { AuditTab } from './AuditTab';
import { SecurityTab } from './SecurityTab';
import { IncidentsTab } from './IncidentsTab';
import type { TabValue } from './SOC2ComplianceDashboard.types';

const SOC2ComplianceDashboard: React.FC = () => {
  const state = useSOC2Data();

  // ============================================================================
  // Access Denied State
  // ============================================================================

  if (state.accessDenied) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="bg-amber-900/30 border-2 border-amber-500/50 rounded-xl p-8 text-center max-w-lg mx-auto mt-20">
          <div className="text-5xl mb-4">{'\uD83D\uDD12'}</div>
          <h3 className="text-xl font-semibold text-amber-200 mb-3">Access Restricted</h3>
          <p className="text-amber-100/80">
            You don&apos;t have permission to view SOC 2 compliance data.
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Loading State
  // ============================================================================

  if (state.loading && state.phiAccess.length === 0 && !state.securityMetrics) {
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

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <state.ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">SOC2 Compliance Dashboard</h1>
          <p className="text-slate-400">
            Security monitoring and compliance • Last updated: {state.lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <EAButton variant="secondary" onClick={state.handleRefresh} disabled={state.refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${state.refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </EAButton>
      </div>

      {/* Alert for Critical Issues */}
      {(state.slaBreachCount > 0 || (state.securityMetrics?.critical_events_24h ?? 0) > 0) && (
        <div className="mb-6 bg-red-900/30 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {state.slaBreachCount > 0 && `${state.slaBreachCount} SLA breach(es). `}
              {(state.securityMetrics?.critical_events_24h ?? 0) > 0 &&
                `${state.securityMetrics?.critical_events_24h} critical security event(s). `}
              Immediate action required.
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <EATabs defaultValue="audit" value={state.activeTab} onValueChange={(v) => state.setActiveTab(v as TabValue)} className="w-full">
        <EATabsList className="grid w-full grid-cols-3 mb-6">
          <EATabsTrigger value="audit" className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            Audit & Compliance
          </EATabsTrigger>
          <EATabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Events
          </EATabsTrigger>
          <EATabsTrigger value="incidents" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Incident Response
            {state.totalOpenIncidents > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {state.totalOpenIncidents}
              </span>
            )}
          </EATabsTrigger>
        </EATabsList>

        {/* Audit & Compliance Tab */}
        <EATabsContent value="audit">
          <AuditTab
            complianceScore={state.complianceScore}
            compliantControls={state.compliantControls}
            totalControls={state.totalControls}
            complianceStatus={state.complianceStatus}
            auditStats={state.auditStats}
            filteredPHIAccess={state.filteredPHIAccess}
            filterRiskLevel={state.filterRiskLevel}
            setFilterRiskLevel={state.setFilterRiskLevel}
            formatTimestamp={state.formatTimestamp}
            formatTimeAgo={state.formatTimeAgo}
          />
        </EATabsContent>

        {/* Security Events Tab */}
        <EATabsContent value="security">
          <SecurityTab
            securityMetrics={state.securityMetrics}
            recentEvents={state.recentEvents}
            formatTimeAgo={state.formatTimeAgo}
          />
        </EATabsContent>

        {/* Incident Response Tab */}
        <EATabsContent value="incidents">
          <IncidentsTab
            criticalOpenCount={state.criticalOpenCount}
            highOpenCount={state.highOpenCount}
            slaBreachCount={state.slaBreachCount}
            totalOpenIncidents={state.totalOpenIncidents}
            filteredIncidents={state.filteredIncidents}
            incidents={state.incidents}
            filterSeverity={state.filterSeverity}
            setFilterSeverity={state.setFilterSeverity}
            filterStatus={state.filterStatus}
            setFilterStatus={state.setFilterStatus}
            selectedIncident={state.selectedIncident}
            setSelectedIncident={state.setSelectedIncident}
            resolution={state.resolution}
            setResolution={state.setResolution}
            submittingResolution={state.submittingResolution}
            handleResolveIncident={state.handleResolveIncident}
            formatTimestamp={state.formatTimestamp}
            formatHoursSince={state.formatHoursSince}
          />
        </EATabsContent>
      </EATabs>

      {/* Footer */}
      <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Auto-refreshes every 30 seconds</span>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>SOC2 Monitoring Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--ea-primary)]" />
              <span>Audit Logging Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOC2ComplianceDashboard;
