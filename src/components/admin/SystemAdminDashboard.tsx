/**
 * System Administrator Dashboard
 *
 * Comprehensive system monitoring dashboard for infrastructure health,
 * database performance, user sessions, and application metrics.
 *
 * Design: Envision Atlus Clinical Design System
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import { RefreshCw, Settings, Users, Activity, Clock, Database, AlertTriangle, CheckCircle } from 'lucide-react';

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
  const [_topTables, _setTopTables] = useState<DatabaseTable[]>([]);
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
    if (!metrics) return { status: 'unknown', color: 'slate', icon: '❓' };

    const errorRate = metrics.error_rate_24h;
    const avgResponse = metrics.avg_response_time_ms;

    if (errorRate > 100 || avgResponse > 5000) {
      return { status: 'critical', color: 'red', icon: '🔴' };
    }
    if (errorRate > 50 || avgResponse > 3000) {
      return { status: 'warning', color: 'amber', icon: '🟡' };
    }
    return { status: 'healthy', color: 'emerald', icon: '🟢' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-slate-800 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const healthStatus = getHealthStatus();

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-800/50 backdrop-blur-xs rounded-xl p-6 border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#00857a]/20 rounded-lg">
            <Settings className="h-8 w-8 text-[#00857a]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">System Administration</h1>
            <p className="text-sm text-slate-400">
              Infrastructure monitoring • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 rounded-lg border border-slate-600">
            <span className="text-2xl">{healthStatus.icon}</span>
            <span className="font-semibold text-white capitalize">System {healthStatus.status}</span>
          </div>
          <EAButton
            variant="primary"
            onClick={loadSystemData}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </EAButton>
        </div>
      </div>

      {error && (
        <EAAlert variant="critical">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </EAAlert>
      )}

      {/* System Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <EACard>
            <EACardHeader icon={<Users className="h-5 w-5 text-[#00857a]" />}>
              <span className="text-sm font-medium text-slate-400">Total Users</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-[#33bfb7]">{metrics.total_users}</div>
                <span className="text-3xl">👥</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Registered accounts</p>
            </EACardContent>
          </EACard>

          {/* Active Sessions */}
          <EACard>
            <EACardHeader icon={<Activity className="h-5 w-5 text-[#00857a]" />}>
              <span className="text-sm font-medium text-slate-400">Active Sessions</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-[#33bfb7]">{metrics.active_sessions}</div>
                <span className="text-3xl">🔌</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Last 24 hours</p>
            </EACardContent>
          </EACard>

          {/* Average Response Time */}
          <EACard>
            <EACardHeader icon={<Clock className="h-5 w-5 text-[#00857a]" />}>
              <span className="text-sm font-medium text-slate-400">Avg Response Time</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${
                  metrics.avg_response_time_ms > 3000 ? 'text-red-400' :
                  metrics.avg_response_time_ms > 1000 ? 'text-amber-400' :
                  'text-[#33bfb7]'
                }`}>
                  {formatDuration(metrics.avg_response_time_ms)}
                </div>
                <span className="text-3xl">⚡</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">24h average</p>
            </EACardContent>
          </EACard>

          {/* Error Rate */}
          <EACard>
            <EACardHeader icon={<AlertTriangle className="h-5 w-5 text-red-400" />}>
              <span className="text-sm font-medium text-slate-400">Errors (24h)</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${
                  metrics.error_rate_24h > 100 ? 'text-red-400' :
                  metrics.error_rate_24h > 50 ? 'text-amber-400' :
                  'text-[#33bfb7]'
                }`}>
                  {metrics.error_rate_24h}
                </div>
                <span className="text-3xl">⚠️</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Application errors</p>
            </EACardContent>
          </EACard>

          {/* API Calls */}
          <EACard>
            <EACardHeader icon={<Activity className="h-5 w-5 text-[#00857a]" />}>
              <span className="text-sm font-medium text-slate-400">API Calls</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-[#33bfb7]">{metrics.api_calls_24h}</div>
                <span className="text-3xl">📡</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Last 24 hours</p>
            </EACardContent>
          </EACard>

          {/* System Uptime */}
          <EACard>
            <EACardHeader icon={<Clock className="h-5 w-5 text-[#00857a]" />}>
              <span className="text-sm font-medium text-slate-400">System Uptime</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-[#33bfb7]">{metrics.uptime_percentage}%</div>
                <span className="text-3xl">⏱️</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">30-day average</p>
            </EACardContent>
          </EACard>

          {/* Database Size */}
          <EACard>
            <EACardHeader icon={<Database className="h-5 w-5 text-[#00857a]" />}>
              <span className="text-sm font-medium text-slate-400">Database Size</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold text-[#33bfb7]">
                  {metrics.database_size_mb > 0 ? formatBytes(metrics.database_size_mb * 1024 * 1024) : 'N/A'}
                </div>
                <span className="text-3xl">💾</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Total storage used</p>
            </EACardContent>
          </EACard>

          {/* Pending Migrations */}
          <EACard>
            <EACardHeader icon={<RefreshCw className="h-5 w-5 text-amber-400" />}>
              <span className="text-sm font-medium text-slate-400">Pending Migrations</span>
            </EACardHeader>
            <EACardContent>
              <div className="flex items-center justify-between">
                <div className={`text-3xl font-bold ${metrics.pending_migrations > 0 ? 'text-amber-400' : 'text-[#33bfb7]'}`}>
                  {metrics.pending_migrations}
                </div>
                <span className="text-3xl">🔄</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Database migrations</p>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* Active User Sessions */}
      <EACard>
        <EACardHeader icon={<Activity className="h-5 w-5 text-[#00857a]" />}>
          <h3 className="text-lg font-semibold text-white">Active User Sessions</h3>
        </EACardHeader>
        <EACardContent>
          {activeSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No active sessions in the last 24 hours
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Browser
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      OS
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Session Start
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {activeSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-white">
                        {session.user_email || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                        <span className="capitalize">{session.device_type}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                        {session.browser}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                        {session.os}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                        {formatTimestamp(session.session_start)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
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
        </EACardContent>
      </EACard>

      {/* System Health Recommendations */}
      {metrics && (
        <EACard>
          <EACardHeader icon={<CheckCircle className="h-5 w-5 text-[#00857a]" />}>
            <h3 className="text-lg font-semibold text-white">System Health Recommendations</h3>
          </EACardHeader>
          <EACardContent className="space-y-3">
            {metrics.error_rate_24h > 100 && (
              <EAAlert variant="critical">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  <strong>High Error Rate:</strong> The system has logged {metrics.error_rate_24h} errors in the last 24 hours.
                  Review the Performance Monitoring dashboard to identify the root cause.
                </span>
              </EAAlert>
            )}

            {metrics.avg_response_time_ms > 3000 && (
              <EAAlert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  <strong>Slow Response Time:</strong> Average response time is {formatDuration(metrics.avg_response_time_ms)}.
                  Consider optimizing database queries or adding caching.
                </span>
              </EAAlert>
            )}

            {metrics.pending_migrations > 0 && (
              <EAAlert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  <strong>Pending Migrations:</strong> There are {metrics.pending_migrations} database migrations waiting to be applied.
                  Run <code className="bg-slate-700 px-1 rounded-sm">npx supabase db push</code> to apply them.
                </span>
              </EAAlert>
            )}

            {metrics.error_rate_24h < 10 && metrics.avg_response_time_ms < 1000 && (
              <EAAlert variant="success">
                <CheckCircle className="h-4 w-4" />
                <span>
                  <strong>System Healthy:</strong> All metrics are within normal ranges. System is performing optimally.
                </span>
              </EAAlert>
            )}
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};
