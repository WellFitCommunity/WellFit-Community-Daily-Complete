/**
 * CareGapDashboard - Clinical care gap detection and management
 *
 * Purpose: Provides clinicians a panel-wide view of care gaps across patients
 * Used by: Admin Panel (sectionDefinitions), route /admin/care-gaps
 *
 * Data sources:
 * - care_coordination_events (care_gap_identified = true)
 * - get_vaccine_gaps RPC
 * - profiles (patient demographics)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EATabs,
  EATabsList,
  EATabsTrigger,
} from '../envision-atlus';
import { auditLogger } from '../../services/auditLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CareGapEvent {
  id: string;
  patient_id: string;
  event_type: string;
  event_description: string;
  event_status: string;
  event_timestamp: string;
  care_gap_identified: boolean;
  care_gap_type: string | null;
  care_gap_priority: string | null;
}

interface PatientGapSummary {
  patient_id: string;
  first_name: string;
  last_name: string;
  total_gaps: number;
  high_priority: number;
  gap_types: string[];
}

interface GapMetrics {
  totalGaps: number;
  highPriority: number;
  patientsAffected: number;
  closedThisMonth: number;
}

type TabId = 'overview' | 'by-patient' | 'by-type';

// ─── Component ────────────────────────────────────────────────────────────────

const CareGapDashboard: React.FC = () => {
  useDashboardTheme();
  const supabase = useSupabaseClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<CareGapEvent[]>([]);
  const [patientSummaries, setPatientSummaries] = useState<PatientGapSummary[]>([]);
  const [metrics, setMetrics] = useState<GapMetrics>({
    totalGaps: 0,
    highPriority: 0,
    patientsAffected: 0,
    closedThisMonth: 0,
  });

  const loadCareGaps = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch open care gaps
      const { data: gapData, error: gapError } = await supabase
        .from('care_coordination_events')
        .select('id, patient_id, event_type, event_description, event_status, event_timestamp, care_gap_identified, care_gap_type, care_gap_priority')
        .eq('care_gap_identified', true)
        .order('event_timestamp', { ascending: false })
        .limit(200);

      if (gapError) throw gapError;
      const allGaps = (gapData || []) as CareGapEvent[];
      setGaps(allGaps);

      // Compute metrics
      const openGaps = allGaps.filter(g => g.event_status !== 'completed');
      const highPri = openGaps.filter(g => g.care_gap_priority === 'high');
      const uniquePatients = new Set(openGaps.map(g => g.patient_id));

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const closedRecently = allGaps.filter(
        g => g.event_status === 'completed' && new Date(g.event_timestamp) >= thirtyDaysAgo
      );

      setMetrics({
        totalGaps: openGaps.length,
        highPriority: highPri.length,
        patientsAffected: uniquePatients.size,
        closedThisMonth: closedRecently.length,
      });

      // Build per-patient summaries with names
      const patientIds = [...uniquePatients];
      if (patientIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', patientIds);

        const profileMap = new Map(
          (profiles || []).map((p: Record<string, unknown>) => [
            p.user_id as string,
            { first_name: (p.first_name as string) || 'Unknown', last_name: (p.last_name as string) || '' },
          ])
        );

        const summaryMap = new Map<string, PatientGapSummary>();
        for (const gap of openGaps) {
          const existing = summaryMap.get(gap.patient_id);
          const profile = profileMap.get(gap.patient_id);
          if (existing) {
            existing.total_gaps += 1;
            if (gap.care_gap_priority === 'high') existing.high_priority += 1;
            if (gap.care_gap_type && !existing.gap_types.includes(gap.care_gap_type)) {
              existing.gap_types.push(gap.care_gap_type);
            }
          } else {
            summaryMap.set(gap.patient_id, {
              patient_id: gap.patient_id,
              first_name: profile?.first_name || 'Unknown',
              last_name: profile?.last_name || '',
              total_gaps: 1,
              high_priority: gap.care_gap_priority === 'high' ? 1 : 0,
              gap_types: gap.care_gap_type ? [gap.care_gap_type] : [],
            });
          }
        }

        const summaries = [...summaryMap.values()].sort((a, b) => b.high_priority - a.high_priority);
        setPatientSummaries(summaries);
      } else {
        setPatientSummaries([]);
      }

      await auditLogger.info('CARE_GAP_DASHBOARD_LOADED', { gapCount: openGaps.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load care gaps';
      setError(message);
      await auditLogger.error(
        'CARE_GAP_DASHBOARD_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'loadCareGaps' }
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCareGaps();
  }, [loadCareGaps]);

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'high':
        return <EABadge variant="critical">High</EABadge>;
      case 'medium':
        return <EABadge variant="elevated">Medium</EABadge>;
      default:
        return <EABadge variant="neutral">Low</EABadge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <EABadge variant="normal">Closed</EABadge>;
      case 'in-progress':
        return <EABadge variant="info">In Progress</EABadge>;
      default:
        return <EABadge variant="elevated">Open</EABadge>;
    }
  };

  const getGapTypesByFrequency = () => {
    const typeCounts = new Map<string, number>();
    for (const gap of gaps.filter(g => g.event_status !== 'completed')) {
      const gapType = gap.care_gap_type || 'Unclassified';
      typeCounts.set(gapType, (typeCounts.get(gapType) || 0) + 1);
    }
    return [...typeCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({ type, count }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--ea-primary,#00857a)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading care gaps...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label="Care Gap Dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Care Gap Detection</h2>
          <p className="text-gray-600 mt-1">
            Identify and close preventive care gaps across your patient panel
          </p>
        </div>
        <EAButton onClick={loadCareGaps} variant="secondary" size="sm">
          Refresh
        </EAButton>
      </div>

      {error && (
        <EAAlert variant="warning">
          <p>{error}</p>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EAMetricCard
          label="Open Care Gaps"
          value={metrics.totalGaps}
          sublabel="Across all patients"
        />
        <EAMetricCard
          label="High Priority"
          value={metrics.highPriority}
          sublabel="Requires immediate action"
          riskLevel={metrics.highPriority > 5 ? 'critical' : 'normal'}
        />
        <EAMetricCard
          label="Patients Affected"
          value={metrics.patientsAffected}
          sublabel="With open care gaps"
        />
        <EAMetricCard
          label="Closed (30 days)"
          value={metrics.closedThisMonth}
          sublabel="Gaps resolved this month"
        />
      </div>

      {/* Tabs */}
      <EATabs defaultValue="overview" value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <EATabsList>
          <EATabsTrigger value="overview">Overview</EATabsTrigger>
          <EATabsTrigger value="by-patient">By Patient</EATabsTrigger>
          <EATabsTrigger value="by-type">By Type</EATabsTrigger>
        </EATabsList>
      </EATabs>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <EACard>
          <EACardHeader>
            <h3 className="text-lg font-semibold">Recent Care Gaps</h3>
          </EACardHeader>
          <EACardContent>
            {gaps.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No care gaps identified. Your patient panel is up to date.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200" aria-label="Recent care gaps">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {gaps.slice(0, 25).map((gap) => (
                      <tr key={gap.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(gap.event_timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {gap.care_gap_type || gap.event_type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {gap.event_description}
                        </td>
                        <td className="px-4 py-3">{getPriorityBadge(gap.care_gap_priority)}</td>
                        <td className="px-4 py-3">{getStatusBadge(gap.event_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {gaps.length > 25 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Showing 25 of {gaps.length} care gaps
                  </p>
                )}
              </div>
            )}
          </EACardContent>
        </EACard>
      )}

      {activeTab === 'by-patient' && (
        <EACard>
          <EACardHeader>
            <h3 className="text-lg font-semibold">Patients with Open Care Gaps</h3>
          </EACardHeader>
          <EACardContent>
            {patientSummaries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No patients with open care gaps.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200" aria-label="Patients with open care gaps">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Gaps</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">High Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gap Types</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {patientSummaries.map((summary) => (
                      <tr key={summary.patient_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {summary.first_name} {summary.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <EABadge variant="neutral">{summary.total_gaps}</EABadge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {summary.high_priority > 0 ? (
                            <EABadge variant="critical">{summary.high_priority}</EABadge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {summary.gap_types.join(', ') || 'Unclassified'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}

      {activeTab === 'by-type' && (
        <EACard>
          <EACardHeader>
            <h3 className="text-lg font-semibold">Care Gaps by Type</h3>
          </EACardHeader>
          <EACardContent>
            {(() => {
              const typeBreakdown = getGapTypesByFrequency();
              if (typeBreakdown.length === 0) {
                return (
                  <p className="text-gray-500 text-center py-8">No open care gaps to categorize.</p>
                );
              }
              return (
                <div className="space-y-3">
                  {typeBreakdown.map(({ type, count }) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">{type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[var(--ea-primary,#00857a)] h-2 rounded-full"
                            style={{ width: `${Math.min((count / (metrics.totalGaps || 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <EABadge variant="neutral">{count}</EABadge>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

export default CareGapDashboard;
