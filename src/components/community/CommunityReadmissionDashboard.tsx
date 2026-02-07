/**
 * CommunityReadmissionDashboard - Orchestrator for the readmission prevention dashboard.
 *
 * Fetches data from tenant-scoped Supabase views:
 *   - v_readmission_dashboard_metrics → KPI cards
 *   - v_readmission_high_risk_members → high-risk member table
 *   - v_readmission_active_alerts → clinical alerts
 *
 * All rendering is delegated to sub-components in ./readmission/.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Download,
  Bell,
  Brain,
} from 'lucide-react';
import {
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
  EABadge,
} from '../envision-atlus';
import { useBranding } from '../../BrandingContext';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { auditLogger } from '../../services/auditLogger';
import {
  ReadmissionMetricCards,
  ReadmissionOverviewTab,
  ReadmissionMembersTab,
  ReadmissionAlertsTab,
  ReadmissionSdohTab,
  ReadmissionEngagementTab,
  MemberDetailModal,
} from './readmission';
import type {
  CommunityMember,
  DashboardMetrics,
  CommunityAlert,
} from './readmission';
import { parseSdohFactors } from './readmission';

// ============================================================================
// EMPTY STATE DEFAULTS
// ============================================================================

const emptyMetrics: DashboardMetrics = {
  total_high_risk_members: 0,
  total_readmissions_30d: 0,
  cms_penalty_risk_count: 0,
  prevented_readmissions: 0,
  active_care_plans: 0,
  avg_engagement_score: 0,
  check_in_completion_rate: 0,
  medication_adherence_rate: 0,
  cost_savings_estimate: 0,
  critical_alerts: 0,
};

// ============================================================================
// DATA FETCHING
// ============================================================================

interface ViewRow {
  [key: string]: unknown;
}

function mapMemberRow(row: ViewRow): CommunityMember {
  return {
    id: String(row.id ?? ''),
    first_name: String(row.first_name ?? ''),
    last_name: String(row.last_name ?? ''),
    phone: row.phone ? String(row.phone) : undefined,
    discharge_facility: row.discharge_facility ? String(row.discharge_facility) : undefined,
    primary_diagnosis: row.primary_diagnosis ? String(row.primary_diagnosis) : undefined,
    risk_score: Number(row.risk_score ?? 50),
    risk_category: (row.risk_category as CommunityMember['risk_category']) || 'moderate',
    total_visits_30d: Number(row.total_visits_30d ?? 0),
    er_visits_30d: Number(row.er_visits_30d ?? 0),
    readmissions_30d: Number(row.readmissions_30d ?? 0),
    last_check_in: row.last_check_in ? String(row.last_check_in) : undefined,
    check_in_streak: Number(row.check_in_streak ?? 0),
    missed_check_ins_7d: Number(row.missed_check_ins_7d ?? 0),
    has_active_care_plan: Boolean(row.has_active_care_plan),
    sdoh_risk_factors: parseSdohFactors(row.sdoh_risk_factors),
    engagement_score: Number(row.engagement_score ?? 50),
    medication_adherence: Number(row.medication_adherence ?? 50),
    cms_penalty_risk: Boolean(row.cms_penalty_risk),
    predicted_readmission_date: row.predicted_readmission_date ? String(row.predicted_readmission_date) : undefined,
    days_since_discharge: row.days_since_discharge != null ? Number(row.days_since_discharge) : undefined,
    wellfit_member_since: row.wellfit_member_since ? String(row.wellfit_member_since) : undefined,
    estimated_savings: row.estimated_savings != null ? Number(row.estimated_savings) : undefined,
  };
}

function mapAlertRow(row: ViewRow): CommunityAlert {
  return {
    alert_id: String(row.alert_id ?? ''),
    member_id: String(row.member_id ?? ''),
    member_name: String(row.member_name ?? 'Unknown'),
    alert_type: String(row.alert_type ?? ''),
    severity: (row.severity as CommunityAlert['severity']) || 'medium',
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    created_at: String(row.created_at ?? new Date().toISOString()),
    status: (row.status as CommunityAlert['status']) || 'active',
    recommended_action: row.recommended_action ? String(row.recommended_action) : undefined,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CommunityReadmissionDashboard: React.FC = () => {
  const { branding } = useBranding();
  const hospitalName = branding.appName || 'Partner Hospital System';
  const supabase = useSupabaseClient();

  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high'>('all');
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);

  // Fetch all dashboard data from views
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsResult, membersResult, alertsResult] = await Promise.all([
        supabase.from('v_readmission_dashboard_metrics').select('*').single(),
        supabase.from('v_readmission_high_risk_members').select('*'),
        supabase.from('v_readmission_active_alerts').select('*'),
      ]);

      if (metricsResult.data) {
        const d = metricsResult.data as ViewRow;
        setMetrics({
          total_high_risk_members: Number(d.total_high_risk_members ?? 0),
          total_readmissions_30d: Number(d.total_readmissions_30d ?? 0),
          cms_penalty_risk_count: Number(d.cms_penalty_risk_count ?? 0),
          prevented_readmissions: Number(d.prevented_readmissions ?? 0),
          active_care_plans: Number(d.active_care_plans ?? 0),
          avg_engagement_score: Number(d.avg_engagement_score ?? 0),
          check_in_completion_rate: Number(d.check_in_completion_rate ?? 0),
          medication_adherence_rate: Number(d.medication_adherence_rate ?? 0),
          cost_savings_estimate: Number(d.cost_savings_estimate ?? 0),
          critical_alerts: Number(d.critical_alerts ?? 0),
        });
      }

      if (membersResult.data) {
        const rows = membersResult.data as ViewRow[];
        setMembers(rows.map(mapMemberRow));
      }

      if (alertsResult.data) {
        const rows = alertsResult.data as ViewRow[];
        setAlerts(rows.map(mapAlertRow));
      }

      // Log errors without blocking UI
      if (metricsResult.error) {
        await auditLogger.warn('READMISSION_METRICS_FETCH_WARN', { error: metricsResult.error.message });
      }
      if (membersResult.error) {
        await auditLogger.warn('READMISSION_MEMBERS_FETCH_WARN', { error: membersResult.error.message });
      }
      if (alertsResult.error) {
        await auditLogger.warn('READMISSION_ALERTS_FETCH_WARN', { error: alertsResult.error.message });
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'READMISSION_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { period: selectedPeriod }
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedPeriod]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // Filter members by risk level
  const filteredMembers = useMemo(() => {
    if (riskFilter === 'all') return members;
    if (riskFilter === 'critical') return members.filter(m => m.risk_category === 'critical');
    return members.filter(m => m.risk_category === 'high' || m.risk_category === 'critical');
  }, [members, riskFilter]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[#00857a] mx-auto mb-4" />
          <p className="text-slate-400">Loading readmission dashboard...</p>
        </div>
      </div>
    );
  }

  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="text-[#00857a]" size={28} />
            Community Readmission Prevention
          </h1>
          <p className="text-slate-400 mt-1">
            {hospitalName} Partnership — Powered by WellFit Community
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {([30, 60, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedPeriod === p
                    ? 'bg-[#00857a] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>

          {/* Risk Filter */}
          <div className="flex bg-slate-800 rounded-lg p-1">
            {(['all', 'high', 'critical'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRiskFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                  riskFilter === f
                    ? 'bg-[#00857a] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Alert Badge */}
          {criticalAlertCount > 0 && (
            <button
              onClick={() => setActiveTab('alerts')}
              className="relative p-2 bg-red-500/20 rounded-lg border border-red-500/50"
            >
              <Bell className="text-red-400" size={20} />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                {criticalAlertCount}
              </span>
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => void loadDashboardData()}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400"
          >
            <RefreshCw size={20} />
          </button>
          <button className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400">
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlertCount > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-400" size={24} />
            <div>
              <p className="text-white font-semibold">{criticalAlertCount} Critical Alert{criticalAlertCount > 1 ? 's' : ''}</p>
              <p className="text-sm text-slate-400">Immediate attention required</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('alerts')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
          >
            View Alerts
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <ReadmissionMetricCards metrics={metrics} />

      {/* Tab Content */}
      <div>
        <EATabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList>
            <EATabsTrigger value="overview">Overview</EATabsTrigger>
            <EATabsTrigger value="members">
              Members
              <EABadge variant="info" className="ml-2">{filteredMembers.length}</EABadge>
            </EATabsTrigger>
            <EATabsTrigger value="alerts">
              Alerts
              {criticalAlertCount > 0 && (
                <EABadge variant="critical" className="ml-2">{criticalAlertCount}</EABadge>
              )}
            </EATabsTrigger>
            <EATabsTrigger value="sdoh">SDOH</EATabsTrigger>
            <EATabsTrigger value="engagement">Engagement</EATabsTrigger>
          </EATabsList>

          <EATabsContent value="overview">
            <ReadmissionOverviewTab
              metrics={metrics}
              members={filteredMembers}
              onTabChange={setActiveTab}
            />
          </EATabsContent>

          <EATabsContent value="members">
            <ReadmissionMembersTab
              members={filteredMembers}
              onSelectMember={setSelectedMember}
            />
          </EATabsContent>

          <EATabsContent value="alerts">
            <ReadmissionAlertsTab alerts={alerts} />
          </EATabsContent>

          <EATabsContent value="sdoh">
            <ReadmissionSdohTab members={members} />
          </EATabsContent>

          <EATabsContent value="engagement">
            <ReadmissionEngagementTab members={members} />
          </EATabsContent>
        </EATabs>
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
};

export default CommunityReadmissionDashboard;
