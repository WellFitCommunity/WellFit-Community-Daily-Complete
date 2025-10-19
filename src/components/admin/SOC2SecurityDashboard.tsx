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
import { createSOC2MonitoringService, SecurityMetrics, SecurityEvent } from '../../services/soc2MonitoringService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

export const SOC2SecurityDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadSecurityData = async () => {
    try {
      setError(null);
      const service = createSOC2MonitoringService(supabase);

      // Load metrics and recent events in parallel
      const [metricsData, eventsData] = await Promise.all([
        service.getSecurityMetrics(),
        service.getSecurityEvents({ limit: 50 })
      ]);

      setMetrics(metricsData);
      setRecentEvents(eventsData);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading security data:', err);
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
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              <div className="text-3xl font-bold text-blue-600">{metrics.security_events_24h}</div>
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
              <div className="text-3xl font-bold text-indigo-600">{metrics.phi_access_24h}</div>
              <p className="text-xs text-gray-500 mt-1">Protected data accessed</p>
            </CardContent>
          </Card>
        </div>
      )}

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
              <table className="min-w-full divide-y divide-gray-200">
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
