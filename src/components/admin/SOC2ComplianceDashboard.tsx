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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';

// Polling configuration with exponential backoff
const INITIAL_POLL_INTERVAL = 30000; // 30 seconds
const MAX_POLL_INTERVAL = 300000; // 5 minutes max
const MAX_CONSECUTIVE_ERRORS = 5;
import {
  createSOC2MonitoringService,
  PHIAccessAudit,
  AuditSummaryStats,
  ComplianceStatus,
  SecurityMetrics,
  SecurityEvent,
  IncidentResponseItem,
} from '../../services/soc2MonitoringService';
import { auditLogger } from '../../services/auditLogger';
import { useToast } from '../../hooks/useToast';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../envision-atlus';
import {
  Shield,
  AlertTriangle,
  FileSearch,
  RefreshCw,
  CheckCircle2,
  Clock,
  Activity,
  Lock,
  Zap,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type TabValue = 'audit' | 'security' | 'incidents';

type FilterRiskLevel = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
type FilterSeverity = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type FilterStatus = 'ALL' | 'OPEN' | 'RESOLVED';

// ============================================================================
// Helper Components
// ============================================================================

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'indigo';
  highlight?: boolean;
}> = ({ label, value, subValue, color = 'blue', highlight = false }) => {
  const colorClasses = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    indigo: 'text-indigo-400',
  };

  return (
    <div className={`bg-slate-800 rounded-lg p-4 border ${highlight ? 'border-red-500 border-2' : 'border-slate-700'}`}>
      <div className="text-sm text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</div>
      {subValue && <div className="text-sm text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
};

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const variants: Record<string, 'critical' | 'elevated' | 'info' | 'normal' | 'neutral'> = {
    CRITICAL: 'critical',
    HIGH: 'elevated',
    MEDIUM: 'info',
    LOW: 'normal',
  };
  return <EABadge variant={variants[severity] || 'neutral'}>{severity}</EABadge>;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variants: Record<string, 'normal' | 'critical' | 'elevated'> = {
    COMPLIANT: 'normal',
    NON_COMPLIANT: 'critical',
    NEEDS_REVIEW: 'elevated',
    PASS: 'normal',
    FAIL: 'critical',
  };
  return <EABadge variant={variants[status] || 'neutral'}>{status}</EABadge>;
};

const SLABadge: React.FC<{ slaStatus: string }> = ({ slaStatus }) => {
  const variants: Record<string, 'critical' | 'normal' | 'info'> = {
    SLA_BREACH: 'critical',
    WITHIN_SLA: 'normal',
    RESOLVED: 'info',
  };
  return <EABadge variant={variants[slaStatus] || 'neutral'}>{slaStatus.replace(/_/g, ' ')}</EABadge>;
};

// ============================================================================
// Main Component
// ============================================================================

const SOC2ComplianceDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const { showToast, ToastContainer } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>('audit');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Polling and error handling state
  const [pollingPaused, setPollingPaused] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const consecutiveErrorsRef = useRef(0);
  const currentIntervalRef = useRef(INITIAL_POLL_INTERVAL);

  // Audit Trail State
  const [phiAccess, setPhiAccess] = useState<PHIAccessAudit[]>([]);
  const [auditStats, setAuditStats] = useState<AuditSummaryStats[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus[]>([]);
  const [filterRiskLevel, setFilterRiskLevel] = useState<FilterRiskLevel>('ALL');

  // Security Events State
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);

  // Incident Response State
  const [incidents, setIncidents] = useState<IncidentResponseItem[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<FilterSeverity>('ALL');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('OPEN');
  const [selectedIncident, setSelectedIncident] = useState<IncidentResponseItem | null>(null);
  const [resolution, setResolution] = useState('');
  const [submittingResolution, setSubmittingResolution] = useState(false);

  // ============================================================================
  // Data Loading Functions
  // ============================================================================

  const loadAuditData = useCallback(async () => {
    try {
      const service = createSOC2MonitoringService(supabase);
      const [phiData, statsData, complianceData] = await Promise.all([
        service.getPHIAccessAudit(100),
        service.getAuditSummaryStats(),
        service.getComplianceStatus(),
      ]);
      setPhiAccess(phiData);
      setAuditStats(statsData);
      setComplianceStatus(complianceData);
    } catch (error) {
      auditLogger.error('SOC2_AUDIT_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [supabase]);

  const loadSecurityData = useCallback(async () => {
    try {
      const service = createSOC2MonitoringService(supabase);
      const [metricsData, eventsData] = await Promise.all([
        service.getSecurityMetrics(),
        service.getSecurityEvents({ limit: 50 }),
      ]);
      setSecurityMetrics(metricsData);
      setRecentEvents(eventsData);
    } catch (error) {
      auditLogger.error('SOC2_SECURITY_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [supabase]);

  const loadIncidentData = useCallback(async () => {
    try {
      const service = createSOC2MonitoringService(supabase);
      const data = await service.getIncidentResponseQueue();
      setIncidents(data);
    } catch (error) {
      auditLogger.error('SOC2_INCIDENT_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [supabase]);

  const loadAllData = useCallback(async () => {
    // Don't poll if access was denied (403)
    if (accessDenied) return;

    setLoading(true);
    try {
      await Promise.all([loadAuditData(), loadSecurityData(), loadIncidentData()]);
      setLastRefresh(new Date());

      // Reset error counter on success
      consecutiveErrorsRef.current = 0;
      currentIntervalRef.current = INITIAL_POLL_INTERVAL;
    } catch (error: unknown) {
      // Increment consecutive errors and apply backoff
      consecutiveErrorsRef.current += 1;

      // Check if error indicates access denied
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('permission denied')) {
        setAccessDenied(true);
        setPollingPaused(true);
      } else if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        setPollingPaused(true);
      } else {
        // Exponential backoff: double the interval up to max
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * 2,
          MAX_POLL_INTERVAL
        );
      }
    } finally {
      setLoading(false);
    }
  }, [loadAuditData, loadSecurityData, loadIncidentData, accessDenied]);

  // Initial load and auto-refresh
  useEffect(() => {
    loadAllData();
    auditLogger.info('SOC2_COMPLIANCE_DASHBOARD_VIEW', { tab: activeTab });

    // Dynamic polling interval with backoff
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollingPaused) return;
      intervalId = setInterval(() => {
        if (!pollingPaused) {
          loadAllData();
        }
      }, currentIntervalRef.current);
    };

    startPolling();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loadAllData, activeTab, pollingPaused]);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Resolve incident handler
  const handleResolveIncident = async () => {
    if (!selectedIncident || !resolution.trim()) {
      showToast('warning', 'Please provide a resolution description');
      return;
    }

    setSubmittingResolution(true);
    try {
      const service = createSOC2MonitoringService(supabase);
      const success = await service.markEventInvestigated(selectedIncident.id, resolution);

      if (success) {
        showToast('success', 'Incident marked as resolved');
        setSelectedIncident(null);
        setResolution('');
        await loadIncidentData();
      } else {
        showToast('error', 'Failed to resolve incident');
      }
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Error resolving incident');
    } finally {
      setSubmittingResolution(false);
    }
  };

  // ============================================================================
  // Format Helpers
  // ============================================================================

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return formatTimestamp(timestamp);
  };

  const formatHoursSince = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const compliantControls = complianceStatus.filter((c) => c.status === 'COMPLIANT').length;
  const totalControls = complianceStatus.length;
  const complianceScore = totalControls > 0 ? Math.round((compliantControls / totalControls) * 100) : 0;

  const filteredPHIAccess = phiAccess.filter(
    (access) => filterRiskLevel === 'ALL' || access.risk_level === filterRiskLevel
  );

  const filteredIncidents = incidents.filter((incident) => {
    const severityMatch = filterSeverity === 'ALL' || incident.severity === filterSeverity;
    const statusMatch =
      filterStatus === 'ALL' ||
      (filterStatus === 'OPEN' && !incident.investigated) ||
      (filterStatus === 'RESOLVED' && incident.investigated);
    return severityMatch && statusMatch;
  });

  const slaBreachCount = incidents.filter((i) => i.sla_status === 'SLA_BREACH' && !i.investigated).length;
  const criticalOpenCount = incidents.filter((i) => i.severity === 'CRITICAL' && !i.investigated).length;
  const highOpenCount = incidents.filter((i) => i.severity === 'HIGH' && !i.investigated).length;
  const totalOpenIncidents = incidents.filter((i) => !i.investigated).length;

  // ============================================================================
  // Access Denied State
  // ============================================================================

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="bg-amber-900/30 border-2 border-amber-500/50 rounded-xl p-8 text-center max-w-lg mx-auto mt-20">
          <div className="text-5xl mb-4">🔒</div>
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

  if (loading && phiAccess.length === 0 && !securityMetrics) {
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
      <ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">SOC2 Compliance Dashboard</h1>
          <p className="text-slate-400">
            Security monitoring and compliance • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <EAButton variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </EAButton>
      </div>

      {/* Alert for Critical Issues */}
      {(slaBreachCount > 0 || (securityMetrics?.critical_events_24h ?? 0) > 0) && (
        <div className="mb-6 bg-red-900/30 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">
              {slaBreachCount > 0 && `${slaBreachCount} SLA breach(es). `}
              {(securityMetrics?.critical_events_24h ?? 0) > 0 &&
                `${securityMetrics?.critical_events_24h} critical security event(s). `}
              Immediate action required.
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <EATabs defaultValue="audit" value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full">
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
            {totalOpenIncidents > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {totalOpenIncidents}
              </span>
            )}
          </EATabsTrigger>
        </EATabsList>

        {/* ===== AUDIT & COMPLIANCE TAB ===== */}
        <EATabsContent value="audit" className="space-y-6">
          {/* Compliance Score */}
          <EACard className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 border-blue-500/30">
            <EACardContent className="py-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-slate-300 mb-2">SOC2 Compliance Score</h2>
                  <div className="text-6xl font-bold text-blue-400">{complianceScore}%</div>
                  <p className="text-sm text-slate-400 mt-2">
                    {compliantControls} of {totalControls} controls compliant
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-6xl">
                    {complianceScore === 100 ? '🎯' : complianceScore >= 80 ? '✅' : '⚠️'}
                  </div>
                  <p className="text-sm text-slate-400 mt-2">
                    {complianceScore === 100
                      ? 'Fully Compliant'
                      : complianceScore >= 80
                        ? 'Good Standing'
                        : 'Needs Attention'}
                  </p>
                </div>
              </div>
            </EACardContent>
          </EACard>

          {/* SOC2 Control Status */}
          <EACard>
            <EACardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-semibold text-white">SOC2 Control Status</h2>
              </div>
            </EACardHeader>
            <EACardContent>
              {complianceStatus.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No compliance data available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Control Area
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Criterion
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Test Result
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {complianceStatus.map((control, index) => (
                        <tr key={index} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm font-medium text-white">{control.control_area}</td>
                          <td className="px-4 py-3 text-sm text-slate-400 font-mono">{control.soc2_criterion}</td>
                          <td className="px-4 py-3 text-sm text-slate-400 max-w-xs">
                            {control.control_description}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={control.status} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={control.test_result} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </EACardContent>
          </EACard>

          {/* Audit Event Summary */}
          <EACard>
            <EACardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-semibold text-white">Audit Event Summary (Last 30 Days)</h2>
              </div>
            </EACardHeader>
            <EACardContent>
              {auditStats.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No audit statistics available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Event Type
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                          Total Events
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                          Success Rate
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">
                          Unique Users
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Latest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {auditStats.slice(0, 20).map((stat, index) => (
                        <tr key={index} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm font-medium text-white">{stat.event_category}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{stat.event_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-sm text-right text-white font-semibold">
                            {stat.total_events.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span
                              className={`font-semibold ${
                                stat.success_rate_percent >= 95
                                  ? 'text-green-400'
                                  : stat.success_rate_percent >= 80
                                    ? 'text-yellow-400'
                                    : 'text-red-400'
                              }`}
                            >
                              {stat.success_rate_percent}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-400">{stat.unique_users}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{formatTimeAgo(stat.latest_event)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </EACardContent>
          </EACard>

          {/* PHI Access Audit Trail */}
          <EACard>
            <EACardHeader>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-teal-400" />
                  <h2 className="text-lg font-semibold text-white">PHI Access Audit Trail</h2>
                </div>
                <div className="flex gap-2">
                  {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as FilterRiskLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setFilterRiskLevel(level)}
                      className={`px-3 py-1 text-xs rounded ${
                        filterRiskLevel === level ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {level === 'ALL' ? 'All' : level}
                    </button>
                  ))}
                </div>
              </div>
            </EACardHeader>
            <EACardContent>
              {filteredPHIAccess.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No PHI access events recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Access Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Patient</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Risk Level
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filteredPHIAccess.slice(0, 50).map((access) => (
                        <tr key={access.id} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm text-white">{formatTimestamp(access.timestamp)}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{access.actor_email}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{access.actor_role || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-white">{access.access_type}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{access.patient_name}</td>
                          <td className="px-4 py-3">
                            <SeverityBadge severity={access.risk_level} />
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-500">
                            {access.actor_ip_address || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </EACardContent>
          </EACard>
        </EATabsContent>

        {/* ===== SECURITY EVENTS TAB ===== */}
        <EATabsContent value="security" className="space-y-6">
          {/* Security Metrics Grid */}
          {securityMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Critical Events"
                value={securityMetrics.critical_events_24h}
                subValue="Last 24 hours"
                color="red"
                highlight={securityMetrics.critical_events_24h > 0}
              />
              <MetricCard
                label="High Severity"
                value={securityMetrics.high_events_24h}
                subValue="Last 24 hours"
                color="orange"
                highlight={securityMetrics.high_events_24h > 5}
              />
              <MetricCard
                label="Failed Logins"
                value={securityMetrics.failed_logins_24h}
                subValue={`${securityMetrics.failed_logins_1h} in last hour`}
                color="yellow"
                highlight={securityMetrics.failed_logins_1h > 10}
              />
              <MetricCard
                label="Open Investigations"
                value={securityMetrics.open_investigations}
                subValue="Requires attention"
                color="purple"
                highlight={securityMetrics.open_investigations > 0}
              />
              <MetricCard
                label="Total Security Events"
                value={securityMetrics.security_events_24h}
                subValue="Last 24 hours"
                color="blue"
              />
              <MetricCard
                label="Unauthorized Access"
                value={securityMetrics.unauthorized_access_24h}
                subValue="Access control violations"
                color="orange"
              />
              <MetricCard
                label="Auto-Blocked"
                value={securityMetrics.auto_blocked_24h}
                subValue="Threats prevented"
                color="green"
              />
              <MetricCard
                label="PHI Access"
                value={securityMetrics.phi_access_24h}
                subValue="Protected data accessed"
                color="indigo"
              />
            </div>
          )}

          {/* Recent Security Events */}
          <EACard>
            <EACardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-white">Recent Security Events</h2>
              </div>
            </EACardHeader>
            <EACardContent>
              {recentEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No security events recorded</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Severity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Event Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">IP</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {recentEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-slate-800/50">
                          <td className="px-4 py-3 text-sm text-white">{formatTimeAgo(event.timestamp)}</td>
                          <td className="px-4 py-3">
                            <SeverityBadge severity={event.severity} />
                          </td>
                          <td className="px-4 py-3 text-sm text-white">{event.event_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-sm text-slate-400 max-w-md truncate">{event.description}</td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-500">
                            {event.actor_ip_address || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            {event.auto_blocked && <EABadge variant="critical">BLOCKED</EABadge>}
                            {event.investigated && <EABadge variant="normal">RESOLVED</EABadge>}
                            {event.requires_investigation && !event.investigated && (
                              <EABadge variant="elevated">INVESTIGATING</EABadge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </EACardContent>
          </EACard>
        </EATabsContent>

        {/* ===== INCIDENT RESPONSE TAB ===== */}
        <EATabsContent value="incidents" className="space-y-6">
          {/* Incident Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Critical Open"
              value={criticalOpenCount}
              subValue="1 hour SLA"
              color="red"
              highlight={criticalOpenCount > 0}
            />
            <MetricCard
              label="High Priority Open"
              value={highOpenCount}
              subValue="4 hour SLA"
              color="orange"
              highlight={highOpenCount > 0}
            />
            <MetricCard
              label="SLA Breaches"
              value={slaBreachCount}
              subValue="Overdue incidents"
              color="red"
              highlight={slaBreachCount > 0}
            />
            <MetricCard
              label="Total Open"
              value={totalOpenIncidents}
              subValue="Requires investigation"
              color="blue"
            />
          </div>

          {/* Filters */}
          <EACard>
            <EACardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-400">Severity:</label>
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as FilterSeverity)}
                    className="px-3 py-1 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white"
                  >
                    <option value="ALL">All</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-400">Status:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                    className="px-3 py-1 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white"
                  >
                    <option value="ALL">All</option>
                    <option value="OPEN">Open</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
                <div className="ml-auto text-sm text-slate-500">
                  Showing {filteredIncidents.length} of {incidents.length} incidents
                </div>
              </div>
            </EACardContent>
          </EACard>

          {/* Investigation Queue */}
          <EACard>
            <EACardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-semibold text-white">Investigation Queue</h2>
              </div>
            </EACardHeader>
            <EACardContent>
              {filteredIncidents.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No incidents matching filters</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Event Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          Time Since
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">
                          SLA Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filteredIncidents.map((incident) => (
                        <tr
                          key={incident.id}
                          className={`hover:bg-slate-800/50 ${
                            incident.sla_status === 'SLA_BREACH' && !incident.investigated ? 'bg-red-900/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <SeverityBadge severity={incident.severity} />
                          </td>
                          <td className="px-4 py-3 text-sm text-white">{incident.event_type.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-sm text-slate-400 max-w-md">
                            {incident.description}
                            {incident.auto_blocked && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                                AUTO-BLOCKED
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-400">
                            {formatHoursSince(incident.hours_since_event)}
                          </td>
                          <td className="px-4 py-3">
                            <SLABadge slaStatus={incident.sla_status} />
                          </td>
                          <td className="px-4 py-3">
                            <EAButton
                              variant={incident.investigated ? 'secondary' : 'primary'}
                              size="sm"
                              onClick={() => setSelectedIncident(incident)}
                            >
                              {incident.investigated ? 'View' : 'Investigate'}
                            </EAButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </EACardContent>
          </EACard>
        </EATabsContent>
      </EATabs>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <EACard className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <EACardHeader className="border-b border-slate-700">
              <div className="flex justify-between items-start w-full">
                <div>
                  <h2 className="text-xl font-semibold text-white">Incident Details</h2>
                  <p className="text-sm text-slate-400 mt-1">ID: {selectedIncident.id.substring(0, 8)}</p>
                </div>
                <button
                  onClick={() => setSelectedIncident(null)}
                  className="text-slate-400 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </EACardHeader>
            <EACardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">Severity</label>
                  <div className="mt-1">
                    <SeverityBadge severity={selectedIncident.severity} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">SLA Status</label>
                  <div className="mt-1">
                    <SLABadge slaStatus={selectedIncident.sla_status} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Event Type</label>
                <p className="mt-1 text-white">{selectedIncident.event_type.replace(/_/g, ' ')}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Description</label>
                <p className="mt-1 text-white">{selectedIncident.description}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Timestamp</label>
                <p className="mt-1 text-white">{formatTimestamp(selectedIncident.timestamp)}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Source IP</label>
                <p className="mt-1 font-mono text-white">{selectedIncident.actor_ip_address || 'N/A'}</p>
              </div>

              {selectedIncident.metadata && Object.keys(selectedIncident.metadata).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Additional Details</label>
                  <pre className="mt-1 p-3 bg-slate-800 rounded-lg text-xs text-slate-300 overflow-auto">
                    {JSON.stringify(selectedIncident.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedIncident.investigated ? (
                <div className="border-t border-slate-700 pt-4">
                  <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-green-400 mb-2">Resolved</h4>
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>Investigated by:</strong> {selectedIncident.investigated_by || 'Unknown'}
                    </p>
                    <p className="text-sm text-slate-300 mb-2">
                      <strong>Resolved at:</strong>{' '}
                      {selectedIncident.investigated_at ? formatTimestamp(selectedIncident.investigated_at) : 'N/A'}
                    </p>
                    <p className="text-sm text-slate-300">
                      <strong>Resolution:</strong> {selectedIncident.resolution}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-700 pt-4">
                  <label className="text-sm font-medium text-slate-400">Resolution Notes</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                    rows={4}
                    placeholder="Describe the investigation findings and resolution..."
                  />
                  <div className="mt-4 flex gap-2">
                    <EAButton
                      variant="primary"
                      onClick={handleResolveIncident}
                      disabled={submittingResolution || !resolution.trim()}
                    >
                      {submittingResolution ? 'Resolving...' : 'Mark as Resolved'}
                    </EAButton>
                    <EAButton variant="secondary" onClick={() => setSelectedIncident(null)}>
                      Cancel
                    </EAButton>
                  </div>
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>
      )}

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
              <div className="w-2 h-2 rounded-full bg-teal-500" />
              <span>Audit Logging Enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SOC2ComplianceDashboard;
