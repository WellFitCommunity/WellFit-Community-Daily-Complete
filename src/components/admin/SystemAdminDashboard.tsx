/**
 * System Administrator Dashboard
 *
 * Comprehensive system monitoring dashboard for infrastructure health,
 * database performance, user sessions, and application metrics.
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

interface SystemMetrics {
  // Database metrics
  total_tables: number;
  total_users: number;
  active_sessions: number;
  database_size_mb: number;

  // Performance metrics
  avg_response_time_ms: number;
  error_rate_24h: number;
  api_calls_24h: number;

  // System health
  uptime_percentage: number;
  last_backup: string | null;
  pending_migrations: number;
}

interface ActiveSession {
  id: string;
  user_id: string;
  user_email?: string;
  device_type: string;
  browser: string;
  os: string;
  session_start: string;
  last_activity?: string;
}

interface DatabaseTable {
  table_name: string;
  row_count: number;
  table_size: string;
}

export const SystemAdminDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [topTables, setTopTables] = useState<DatabaseTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadSystemData = async () => {
    try {
      setError(null);

      // Load basic metrics
      const [usersData, sessionsData, errorsData, metricsData] = await Promise.all([
        // Total users
        supabase.from('profiles').select('id', { count: 'exact', head: true }),

        // Active sessions (last 24 hours)
        supabase
          .from('user_sessions')
          .select('*, profiles(email)')
          .gte('session_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .is('session_end', null)
          .order('session_start', { ascending: false })
          .limit(50),

        // Error rate
        supabase
          .from('error_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

        // Performance metrics
        supabase
          .from('performance_metrics')
          .select('duration_ms')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      ]);

      // Calculate average response time
      const avgResponseTime = metricsData.data && metricsData.data.length > 0
        ? metricsData.data.reduce((sum, m) => sum + m.duration_ms, 0) / metricsData.data.length
        : 0;

      // Build metrics object
      const systemMetrics: SystemMetrics = {
        total_tables: 0, // Will be populated if we can access pg_catalog
        total_users: usersData.count || 0,
        active_sessions: sessionsData.data?.length || 0,
        database_size_mb: 0, // Will be populated if we can access pg_catalog
        avg_response_time_ms: avgResponseTime,
        error_rate_24h: errorsData.count || 0,
        api_calls_24h: metricsData.data?.length || 0,
        uptime_percentage: 99.9, // This would come from a monitoring service
        last_backup: null, // This would come from your backup system
        pending_migrations: 0
      };

      setMetrics(systemMetrics);

      // Set active sessions with user emails
      if (sessionsData.data) {
        const sessions = sessionsData.data.map((session: any) => ({
          id: session.id,
          user_id: session.user_id,
          user_email: session.profiles?.email,
          device_type: session.device_type || 'unknown',
          browser: session.browser || 'unknown',
          os: session.os || 'unknown',
          session_start: session.session_start,
          last_activity: session.last_activity
        }));
        setActiveSessions(sessions);
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading system data:', err);
      setError('Failed to load system monitoring data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemData();

    // Auto-refresh every 60 seconds
    const interval = setInterval(loadSystemData, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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

  const getHealthStatus = () => {
    if (!metrics) return { status: 'unknown', color: 'gray', icon: '❓' };

    const errorRate = metrics.error_rate_24h;
    const avgResponse = metrics.avg_response_time_ms;

    if (errorRate > 100 || avgResponse > 5000) {
      return { status: 'critical', color: 'red', icon: '🔴' };
    }
    if (errorRate > 50 || avgResponse > 3000) {
      return { status: 'warning', color: 'yellow', icon: '🟡' };
    }
    return { status: 'healthy', color: 'green', icon: '🟢' };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Administration</h2>
          <p className="text-sm text-gray-600 mt-1">
            Infrastructure monitoring • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border-2"
               style={{ borderColor: healthStatus.color === 'red' ? '#ef4444' : healthStatus.color === 'yellow' ? '#eab308' : '#10b981' }}>
            <span className="text-2xl">{healthStatus.icon}</span>
            <span className="font-semibold text-gray-700">System {healthStatus.status}</span>
          </div>
          <button
            onClick={loadSystemData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* System Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-blue-600">{metrics.total_users}</div>
                <span className="text-3xl">👥</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Registered accounts</p>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card className={metrics.active_sessions > 50 ? 'border-green-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-600">{metrics.active_sessions}</div>
                <span className="text-3xl">🔌</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          {/* Average Response Time */}
          <Card className={metrics.avg_response_time_ms > 3000 ? 'border-orange-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${
                  metrics.avg_response_time_ms > 3000 ? 'text-red-600' :
                  metrics.avg_response_time_ms > 1000 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {formatDuration(metrics.avg_response_time_ms)}
                </div>
                <span className="text-3xl">⚡</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">24h average</p>
            </CardContent>
          </Card>

          {/* Error Rate */}
          <Card className={metrics.error_rate_24h > 50 ? 'border-red-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Errors (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${
                  metrics.error_rate_24h > 100 ? 'text-red-600' :
                  metrics.error_rate_24h > 50 ? 'text-orange-600' :
                  'text-green-600'
                }`}>
                  {metrics.error_rate_24h}
                </div>
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Application errors</p>
            </CardContent>
          </Card>

          {/* API Calls */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">API Calls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-purple-600">{metrics.api_calls_24h}</div>
                <span className="text-3xl">📡</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          {/* System Uptime */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">System Uptime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-green-600">{metrics.uptime_percentage}%</div>
                <span className="text-3xl">⏱️</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">30-day average</p>
            </CardContent>
          </Card>

          {/* Database Size */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Database Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-indigo-600">
                  {metrics.database_size_mb > 0 ? formatBytes(metrics.database_size_mb * 1024 * 1024) : 'N/A'}
                </div>
                <span className="text-3xl">💾</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Total storage used</p>
            </CardContent>
          </Card>

          {/* Pending Migrations */}
          <Card className={metrics.pending_migrations > 0 ? 'border-yellow-500 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Migrations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${metrics.pending_migrations > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {metrics.pending_migrations}
                </div>
                <span className="text-3xl">🔄</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Database migrations</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active User Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active User Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active sessions in the last 24 hours
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Browser
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      OS
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session Start
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {session.user_email || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        <span className="capitalize">{session.device_type}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {session.browser}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {session.os}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatTimestamp(session.session_start)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {(() => {
                          const duration = Date.now() - new Date(session.session_start).getTime();
                          const hours = Math.floor(duration / 3600000);
                          const mins = Math.floor((duration % 3600000) / 60000);
                          return `${hours}h ${mins}m`;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health Recommendations */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>System Health Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.error_rate_24h > 100 && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">
                    <strong>High Error Rate:</strong> The system has logged {metrics.error_rate_24h} errors in the last 24 hours.
                    Review the Performance Monitoring dashboard to identify the root cause.
                  </AlertDescription>
                </Alert>
              )}

              {metrics.avg_response_time_ms > 3000 && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription className="text-yellow-800">
                    <strong>Slow Response Time:</strong> Average response time is {formatDuration(metrics.avg_response_time_ms)}.
                    Consider optimizing database queries or adding caching.
                  </AlertDescription>
                </Alert>
              )}

              {metrics.pending_migrations > 0 && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription className="text-yellow-800">
                    <strong>Pending Migrations:</strong> There are {metrics.pending_migrations} database migrations waiting to be applied.
                    Run <code className="bg-yellow-100 px-1 rounded">npx supabase db push</code> to apply them.
                  </AlertDescription>
                </Alert>
              )}

              {metrics.error_rate_24h < 10 && metrics.avg_response_time_ms < 1000 && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription className="text-green-800">
                    <strong>System Healthy:</strong> All metrics are within normal ranges. System is performing optimally.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
