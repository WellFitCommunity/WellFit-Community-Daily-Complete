/**
 * SOC Dashboard - Security Operations Center
 *
 * Real-time security monitoring dashboard for Envision super_admins.
 * Replaces external Slack notifications with internal collaboration.
 *
 * Features:
 * - Real-time alert feed
 * - Team messaging on alerts
 * - Presence indicators
 * - Audio/browser notifications
 * - Alert management (acknowledge, assign, resolve)
 *
 * SOC2 Compliance: CC6.1, CC7.2, CC7.3
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { getSOCDashboardService, resetSOCDashboardService } from '../../services/socDashboardService';
import {
  SecurityAlert,
  SOCDashboardSummary,
  SOCPresence,
  SOCNotificationPreferences,
  AlertFilters,
  SoundType,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from '../../types/socDashboard';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';
import { AlertDetailPanel } from './AlertDetailPanel';
import { PresenceIndicator } from './PresenceIndicator';
import { NotificationSettings } from './NotificationSettings';
import { useSOCNotifications } from '../../hooks/useSOCNotifications';

// ============================================================================
// Main Component
// ============================================================================

export const SOCDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const service = getSOCDashboardService(supabase);

  // State
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [summary, setSummary] = useState<SOCDashboardSummary | null>(null);
  const [operators, setOperators] = useState<SOCPresence[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [filters, setFilters] = useState<AlertFilters>({});
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<SOCNotificationPreferences | null>(null);

  // Notification hook
  const { playSound, showNotification } = useSOCNotifications(preferences);

  // Refs
  const alertListRef = useRef<HTMLDivElement>(null);

  // ==========================================================================
  // Data Loading
  // ==========================================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsData, summaryData, operatorsData, prefsData] = await Promise.all([
        service.getAlerts(filters),
        service.getDashboardSummary(),
        service.getOnlineOperators(),
        service.getNotificationPreferences(),
      ]);

      setAlerts(alertsData);
      setSummary(summaryData);
      setOperators(operatorsData);
      setPreferences(prefsData);
    } finally {
      setLoading(false);
    }
  }, [service, filters]);

  // ==========================================================================
  // Realtime Handlers
  // ==========================================================================

  const handleNewAlert = useCallback((alert: SecurityAlert) => {
    setAlerts((prev) => [alert, ...prev]);

    // Update summary counts
    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [`${alert.severity}_count`]: (prev[`${alert.severity}_count` as keyof SOCDashboardSummary] as number || 0) + 1,
        unassigned_count: prev.unassigned_count + 1,
      };
    });

    // Notify
    if (preferences && service.shouldNotify(alert.severity, preferences)) {
      playSound(service.getSoundForSeverity(alert.severity, preferences) as SoundType);
      showNotification(
        `${SEVERITY_CONFIG[alert.severity].icon} ${alert.title}`,
        alert.description || 'New security alert'
      );
    }
  }, [preferences, service, playSound, showNotification]);

  const handleAlertUpdate = useCallback((alert: SecurityAlert) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? alert : a))
    );

    // Update selected alert if it's the one being viewed
    if (selectedAlert?.id === alert.id) {
      setSelectedAlert(alert);
    }
  }, [selectedAlert]);

  const handlePresenceChange = useCallback((newOperators: SOCPresence[]) => {
    setOperators(newOperators);
    setSummary((prev) => {
      if (!prev) return prev;
      return { ...prev, online_operators: newOperators.length };
    });
  }, []);

  // ==========================================================================
  // Effects
  // ==========================================================================

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Start heartbeat
    service.startHeartbeat(selectedAlert?.id);

    // Subscribe to realtime
    service.subscribeToAlerts(handleNewAlert, handleAlertUpdate);
    service.subscribeToPresence(handlePresenceChange);

    // Cleanup
    return () => {
      service.unsubscribeAll();
      resetSOCDashboardService();
    };
  }, [service, handleNewAlert, handleAlertUpdate, handlePresenceChange, selectedAlert?.id]);

  // Update heartbeat when viewing different alert
  useEffect(() => {
    if (selectedAlert) {
      service.updatePresence('busy', selectedAlert.id);
    } else {
      service.updatePresence('online');
    }
  }, [selectedAlert, service]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const handleAcknowledge = async (alertId: string) => {
    const success = await service.acknowledgeAlert(alertId);
    if (success) {
      loadData();
    }
  };

  const handleAssign = async (alertId: string, assigneeId: string) => {
    const success = await service.assignAlert(alertId, assigneeId);
    if (success) {
      loadData();
    }
  };

  const handleResolve = async (alertId: string, resolution: string) => {
    const success = await service.resolveAlert(alertId, resolution);
    if (success) {
      loadData();
      setSelectedAlert(null);
    }
  };

  const handleFalsePositive = async (alertId: string, reason: string) => {
    const success = await service.markAsFalsePositive(alertId, reason);
    if (success) {
      loadData();
      setSelectedAlert(null);
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Security Operations Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">🛡️</span>
              Security Operations Center
            </h1>
            {summary && (
              <div className="flex items-center gap-2 ml-4">
                {summary.critical_count > 0 && (
                  <EABadge variant="critical" pulse>
                    {summary.critical_count} Critical
                  </EABadge>
                )}
                {summary.high_count > 0 && (
                  <EABadge variant="high">
                    {summary.high_count} High
                  </EABadge>
                )}
                {summary.escalated_count > 0 && (
                  <EABadge variant="critical">
                    {summary.escalated_count} Escalated
                  </EABadge>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Online Operators */}
            <PresenceIndicator operators={operators} />

            {/* Settings */}
            <EAButton
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              ⚙️ Settings
            </EAButton>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Alert List */}
        <div className="w-1/2 border-r border-slate-700 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded text-sm ${
                  !filters.severity?.length ? 'bg-teal-600' : 'bg-slate-700'
                }`}
                onClick={() => setFilters((f) => ({ ...f, severity: undefined }))}
              >
                All
              </button>
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                <button
                  key={sev}
                  className={`px-3 py-1 rounded text-sm ${
                    filters.severity?.includes(sev) ? 'bg-teal-600' : 'bg-slate-700'
                  }`}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      severity: f.severity?.includes(sev)
                        ? f.severity.filter((s) => s !== sev)
                        : [...(f.severity || []), sev],
                    }))
                  }
                >
                  {SEVERITY_CONFIG[sev].icon} {SEVERITY_CONFIG[sev].label}
                </button>
              ))}
              <button
                className={`px-3 py-1 rounded text-sm ml-auto ${
                  filters.assigned_to === 'me' ? 'bg-teal-600' : 'bg-slate-700'
                }`}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    assigned_to: f.assigned_to === 'me' ? undefined : 'me',
                  }))
                }
              >
                My Alerts
              </button>
            </div>
          </div>

          {/* Alert List */}
          <div ref={alertListRef} className="flex-1 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="text-6xl mb-4">✅</span>
                <p className="text-xl">No active alerts</p>
                <p className="text-sm">All systems operating normally</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700">
                {alerts.map((alert) => (
                  <AlertListItem
                    key={alert.id}
                    alert={alert}
                    isSelected={selectedAlert?.id === alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    onAcknowledge={() => handleAcknowledge(alert.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alert Detail Panel */}
        <div className="w-1/2 overflow-hidden">
          {selectedAlert ? (
            <AlertDetailPanel
              alert={selectedAlert}
              operators={operators}
              onAcknowledge={() => handleAcknowledge(selectedAlert.id)}
              onAssign={(assigneeId) => handleAssign(selectedAlert.id, assigneeId)}
              onResolve={(resolution) => handleResolve(selectedAlert.id, resolution)}
              onFalsePositive={(reason) => handleFalsePositive(selectedAlert.id, reason)}
              onClose={() => setSelectedAlert(null)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <span className="text-6xl mb-4">👈</span>
              <p className="text-xl">Select an alert to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && preferences && (
        <NotificationSettings
          preferences={preferences}
          onSave={async (prefs) => {
            await service.updateNotificationPreferences(prefs);
            setPreferences({ ...preferences, ...prefs });
            setShowSettings(false);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// Alert List Item Component
// ============================================================================

interface AlertListItemProps {
  alert: SecurityAlert;
  isSelected: boolean;
  onClick: () => void;
  onAcknowledge: () => void;
}

const AlertListItem: React.FC<AlertListItemProps> = ({
  alert,
  isSelected,
  onClick,
  onAcknowledge,
}) => {
  const severityConfig = SEVERITY_CONFIG[alert.severity];
  const statusConfig = STATUS_CONFIG[alert.status];

  const timeAgo = getTimeAgo(new Date(alert.created_at));

  return (
    <div
      className={`p-4 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-slate-700'
          : 'hover:bg-slate-800'
      } ${alert.escalated ? 'border-l-4 border-red-500' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{severityConfig.icon}</span>
            <span className={`text-xs px-2 py-0.5 rounded-sm ${severityConfig.bgColor} ${severityConfig.color}`}>
              {severityConfig.label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-sm ${statusConfig.bgColor} ${statusConfig.color}`}>
              {statusConfig.label}
            </span>
            {alert.escalated && (
              <span className="text-xs px-2 py-0.5 rounded-sm bg-red-500/20 text-red-400">
                ESCALATED
              </span>
            )}
          </div>
          <h3 className="font-semibold text-white mb-1">{alert.title}</h3>
          <p className="text-sm text-slate-400 line-clamp-2">
            {alert.description}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>{timeAgo}</span>
            {alert.source_ip && <span>IP: {alert.source_ip}</span>}
            {alert.assigned_to && (
              <span className="text-teal-400">
                Assigned to: {(alert as unknown as { assigned_user?: { first_name?: string; last_name?: string } }).assigned_user?.first_name || 'Unknown'}
              </span>
            )}
          </div>
        </div>
        {alert.status === 'new' && (
          <EAButton
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
          >
            Acknowledge
          </EAButton>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Utility Functions
// ============================================================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default SOCDashboard;
