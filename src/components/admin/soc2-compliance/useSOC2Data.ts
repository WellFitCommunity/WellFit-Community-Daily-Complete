/**
 * SOC2 Compliance Dashboard - Data Hook
 *
 * Custom hook that manages all data loading, polling with exponential backoff,
 * filtering, and computed values for the SOC2 compliance dashboard.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseClient } from '../../../contexts/AuthContext';
import {
  createSOC2MonitoringService,
} from '../../../services/soc2MonitoringService';
import type {
  PHIAccessAudit,
  AuditSummaryStats,
  ComplianceStatus,
  SecurityMetrics,
  SecurityEvent,
  IncidentResponseItem,
} from '../../../services/soc2MonitoringService';
import { auditLogger } from '../../../services/auditLogger';
import { useToast } from '../../../hooks/useToast';
import type {
  TabValue,
  FilterRiskLevel,
  FilterSeverity,
  FilterStatus,
  SOC2DashboardState,
} from './SOC2ComplianceDashboard.types';
import { formatTimestamp, formatTimeAgo, formatHoursSince } from './helpers';

// Polling configuration with exponential backoff
const INITIAL_POLL_INTERVAL = 30000; // 30 seconds
const MAX_POLL_INTERVAL = 300000; // 5 minutes max
const MAX_CONSECUTIVE_ERRORS = 5;

export function useSOC2Data(): SOC2DashboardState & { ToastContainer: React.FC } {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      auditLogger.error('SOC2_SECURITY_LOAD_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    }
  }, [supabase]);

  const loadIncidentData = useCallback(async () => {
    try {
      const service = createSOC2MonitoringService(supabase);
      const data = await service.getIncidentResponseQueue();
      setIncidents(data);
    } catch (error: unknown) {
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
      const resolveSuccess = await service.markEventInvestigated(selectedIncident.id, resolution);

      if (resolveSuccess) {
        showToast('success', 'Incident marked as resolved');
        setSelectedIncident(null);
        setResolution('');
        await loadIncidentData();
      } else {
        showToast('error', 'Failed to resolve incident');
      }
    } catch (error: unknown) {
      showToast('error', error instanceof Error ? error.message : 'Error resolving incident');
    } finally {
      setSubmittingResolution(false);
    }
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

  return {
    // Tab
    activeTab,
    setActiveTab,

    // Loading
    loading,
    refreshing,
    lastRefresh,

    // Polling
    pollingPaused,
    accessDenied,

    // Audit
    phiAccess,
    auditStats,
    complianceStatus,
    filterRiskLevel,
    setFilterRiskLevel,

    // Security
    securityMetrics,
    recentEvents,

    // Incidents
    incidents,
    filterSeverity,
    setFilterSeverity,
    filterStatus,
    setFilterStatus,
    selectedIncident,
    setSelectedIncident,
    resolution,
    setResolution,
    submittingResolution,

    // Actions
    handleRefresh,
    handleResolveIncident,

    // Format helpers
    formatTimestamp,
    formatTimeAgo,
    formatHoursSince,

    // Computed
    compliantControls,
    totalControls,
    complianceScore,
    filteredPHIAccess,
    filteredIncidents,
    slaBreachCount,
    criticalOpenCount,
    highOpenCount,
    totalOpenIncidents,

    // Toast
    ToastContainer,
  };
}
