/**
 * SOC 2 Real-Time Security Operations Dashboard
 *
 * Provides real-time monitoring of security events, failed logins,
 * unauthorized access attempts, and other security metrics.
 *
 * Zero tech debt - follows existing PerformanceMonitoringDashboard pattern
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { createSOC2MonitoringService, SecurityMetrics, SecurityEvent, EncryptionStatus, PlatformKeyStatus } from '../../services/soc2MonitoringService';
import { auditLogger } from '../../services/auditLogger';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

export const SOC2SecurityDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const { theme } = useDashboardTheme();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [platformKeys, setPlatformKeys] = useState<PlatformKeyStatus[]>([]);
  const [rotationKeys, setRotationKeys] = useState<EncryptionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadSecurityData = async () => {
    try {
      setError(null);
      const service = createSOC2MonitoringService(supabase);

      // Load metrics, recent events, and key posture in parallel
      const [metricsData, eventsData, platformKeyData, rotationKeyData] = await Promise.all([
        service.getSecurityMetrics(),
        service.getSecurityEvents({ limit: 50 }),
        service.getPlatformKeyStatus(),
        service.getEncryptionStatus()
      ]);

      setMetrics(metricsData);
      setRecentEvents(eventsData);
      setPlatformKeys(platformKeyData);
      setRotationKeys(rotationKeyData);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      await auditLogger.error('SOC2_SECURITY_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        {}
      );
      setError('Failed to load security monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurityData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSecurityData, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Load on mount only
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-sm w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="h-32 bg-gray-200 rounded-sm"></div>
            <div className="h-32 bg-gray-200 rounded-sm"></div>
            <div className="h-32 bg-gray-200 rounded-sm"></div>
            <div className="h-32 bg-gray-200 rounded-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label="SOC 2 Security Operations Dashboard" aria-live="polite">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Security Operations Center</h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time security monitoring • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={loadSecurityData}
          className={`px-4 py-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)] ${theme.buttonPrimary}`}
        >
          Refresh
        </button>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Critical Events */}
          <Card className={metrics.critical_events_24h > 0 ? 'border-red-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Critical Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{metrics.critical_events_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          {/* High Severity Events */}
          <Card className={metrics.high_events_24h > 5 ? 'border-orange-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">High Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{metrics.high_events_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          {/* Failed Logins */}
          <Card className={metrics.failed_logins_1h > 10 ? 'border-yellow-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Failed Logins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{metrics.failed_logins_24h}</div>
              <p className="text-xs text-gray-500 mt-1">
                {metrics.failed_logins_1h} in last hour
              </p>
            </CardContent>
          </Card>

          {/* Open Investigations */}
          <Card className={metrics.open_investigations > 0 ? 'border-purple-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Open Investigations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{metrics.open_investigations}</div>
              <p className="text-xs text-gray-500 mt-1">Requires attention</p>
            </CardContent>
          </Card>

          {/* Total Security Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Security Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--ea-primary,#00857a)]">{metrics.security_events_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          {/* Unauthorized Access */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Unauthorized Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{metrics.unauthorized_access_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Access control violations</p>
            </CardContent>
          </Card>

          {/* Auto-Blocked */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Auto-Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{metrics.auto_blocked_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Threats prevented</p>
            </CardContent>
          </Card>

          {/* PHI Access */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">PHI Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[var(--ea-primary,#00857a)]">{metrics.phi_access_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Protected data accessed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Encryption Key Posture (§17 platform keys + rotation registry) */}
      <Card>
        <CardHeader>
          <CardTitle>Encryption Key Posture</CardTitle>
        </CardHeader>
        <CardContent>
          {platformKeys.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Key posture unavailable (admin role required)
            </div>
          ) : (
            <div className="space-y-3">
              {platformKeys.map((key) => (
                <div
                  key={`${key.key_scope}-${key.key_name}`}
                  className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {key.key_scope === 'clinical' ? 'Clinical (Envision Atlus)' : 'Community (WellFit)'}
                    </div>
                    <div className="text-xs font-mono text-gray-600">
                      {key.key_name} • {key.key_store === 'supabase_vault' ? 'Supabase Vault' : 'Edge Function Secrets'}
                    </div>
                  </div>
                  <div className="text-right">
                    {key.present === true && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">
                        PRESENT
                      </span>
                    )}
                    {key.present === false && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                        MISSING
                      </span>
                    )}
                    {key.present === null && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 border border-gray-300">
                        NOT SQL-VISIBLE
                      </span>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {key.present === null
                        ? 'Verify in Supabase Dashboard → Edge Functions → Secrets'
                        : key.days_since_rotation !== null
                          ? `Rotated ${key.days_since_rotation} days ago`
                          : 'No rotation recorded'}
                    </p>
                  </div>
                </div>
              ))}
              {rotationKeys.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No rotation-managed keys registered in the key registry.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200" aria-label="Key rotation registry">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rotated</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiration</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rotationKeys.map((key) => (
                        <tr key={key.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{key.key_name}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">v{key.key_version}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${key.is_active ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                              {key.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {key.days_since_rotation} days ago
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                              key.expiration_status === 'EXPIRED'
                                ? 'bg-red-100 text-red-800 border-red-300'
                                : key.expiration_status === 'EXPIRING_SOON'
                                  ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                  : 'bg-green-100 text-green-800 border-green-300'
                            }`}>
                              {key.expiration_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Security Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No security events recorded
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200" aria-label="Recent security events">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatTimestamp(event.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getSeverityColor(event.severity)}`}>
                          {event.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {event.event_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">
                        {event.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                        {event.actor_ip_address || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {event.auto_blocked && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">
                            BLOCKED
                          </span>
                        )}
                        {event.investigated && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">
                            RESOLVED
                          </span>
                        )}
                        {event.requires_investigation && !event.investigated && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                            INVESTIGATING
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert for Critical Issues */}
      {metrics && metrics.critical_events_24h > 0 && (
        <Alert className="bg-red-50 border-red-300">
          <AlertDescription className="text-red-900">
            <strong>Critical Alert:</strong> {metrics.critical_events_24h} critical security event(s) detected in the last 24 hours.
            Immediate investigation required.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
