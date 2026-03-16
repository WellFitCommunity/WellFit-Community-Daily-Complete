/**
 * PlatformKPIPanel — MCP Postgres Analytics KPI display
 *
 * Shows 5 platform-wide KPIs fetched via the MCP Postgres server:
 * active members, high-risk patients, today's encounters, pending tasks, SDOH flags.
 *
 * Used by: SystemAdminDashboard
 */

import React from 'react';
import { useDashboardKPIs } from '../../hooks/usePostgresAnalytics';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAAlert,
} from '../envision-atlus';
import {
  TrendingUp,
  RefreshCw,
  Users,
  ShieldAlert,
  Stethoscope,
  ListTodo,
  HeartPulse,
  AlertTriangle,
} from 'lucide-react';

// Default tenant for system admin view
const DEFAULT_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';

interface PlatformKPIPanelProps {
  tenantId?: string;
}

export const PlatformKPIPanel: React.FC<PlatformKPIPanelProps> = ({
  tenantId = DEFAULT_TENANT_ID
}) => {
  const {
    data: platformKPIs,
    loading: kpisLoading,
    error: kpisError,
    refresh: refreshKPIs
  } = useDashboardKPIs(tenantId);

  return (
    <EACard>
      <EACardHeader icon={<TrendingUp className="h-5 w-5 text-[#00857a]" />}>
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-semibold text-white">Platform KPIs</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">via MCP Analytics</span>
            <button
              onClick={refreshKPIs}
              className="text-slate-400 hover:text-white transition p-1 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
              aria-label="Refresh platform KPIs"
            >
              <RefreshCw className={`h-4 w-4 ${kpisLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </EACardHeader>
      <EACardContent>
        {kpisError && (
          <EAAlert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <span>KPI data unavailable: {kpisError}</span>
          </EAAlert>
        )}
        {platformKPIs && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <KPITile
              icon={<Users className="h-4 w-4 text-[#33bfb7]" />}
              label="Active Members"
              value={platformKPIs.active_members}
            />
            <KPITile
              icon={<ShieldAlert className="h-4 w-4 text-red-400" />}
              label="High Risk Patients"
              value={platformKPIs.high_risk_patients}
              highlight={platformKPIs.high_risk_patients > 0 ? 'text-red-400' : undefined}
            />
            <KPITile
              icon={<Stethoscope className="h-4 w-4 text-blue-400" />}
              label="Today's Encounters"
              value={platformKPIs.todays_encounters}
            />
            <KPITile
              icon={<ListTodo className="h-4 w-4 text-amber-400" />}
              label="Pending Tasks"
              value={platformKPIs.pending_tasks}
              highlight={platformKPIs.pending_tasks > 10 ? 'text-amber-400' : undefined}
            />
            <KPITile
              icon={<HeartPulse className="h-4 w-4 text-purple-400" />}
              label="Active SDOH Flags"
              value={platformKPIs.active_sdoh_flags}
              highlight={platformKPIs.active_sdoh_flags > 0 ? 'text-purple-400' : undefined}
            />
          </div>
        )}
        {kpisLoading && !platformKPIs && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-24 mb-3" />
                <div className="h-8 bg-slate-700 rounded w-16" />
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

// =====================================================
// KPITile sub-component
// =====================================================

const KPITile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: string;
}> = ({ icon, label, value, highlight }) => (
  <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs text-slate-400">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${highlight || 'text-white'}`}>{value}</div>
  </div>
);

export default PlatformKPIPanel;
