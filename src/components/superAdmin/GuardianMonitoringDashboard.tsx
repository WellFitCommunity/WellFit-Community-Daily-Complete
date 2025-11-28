/**
 * Guardian Monitoring Dashboard
 *
 * Shows Guardian agent status, alerts, and system monitoring metrics
 * For Envision VirtualEdge Group staff - Master Panel only
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, Clock, TrendingUp, Zap } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { monitorSystemHealth } from '../../services/guardianAgentClient';

interface GuardianAlert {
  id: string;
  created_at: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  category: string;
  title: string;
  description: string;
  tenant_id: string | null;
  resolved: boolean;
}

interface GuardianCronExecution {
  id: string;
  job_name: string;
  executed_at: string;
  status: string;
  details: any;
}

interface GuardianMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  resolvedAlerts: number;
  lastCronExecution: string | null;
  cronSuccessRate: number;
  agentStatus: 'online' | 'offline' | 'degraded';
}

const GuardianMonitoringDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<GuardianMetrics | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<GuardianAlert[]>([]);
  const [cronExecutions, setCronExecutions] = useState<GuardianCronExecution[]>([]);
  const [healthCheckRunning, setHealthCheckRunning] = useState(false);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    loadGuardianMetrics();
  }, [timeRange]);

  const loadGuardianMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const now = new Date();
      const cutoffDate = new Date();
      switch (timeRange) {
        case '24h':
          cutoffDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          cutoffDate.setDate(now.getDate() - 30);
          break;
      }

      // Get Guardian alerts
      const { data: alerts, error: alertsError } = await supabase
        .from('guardian_alerts')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsError && alertsError.code !== 'PGRST116') {
        throw alertsError;
      }

      // Get cron execution logs
      const { data: cronLogs, error: cronError } = await supabase
        .from('guardian_cron_log')
        .select('*')
        .gte('executed_at', cutoffDate.toISOString())
        .order('executed_at', { ascending: false })
        .limit(20);

      if (cronError && cronError.code !== 'PGRST116') {
        throw cronError;
      }

      // Calculate metrics
      const totalAlerts = alerts?.length || 0;
      const criticalAlerts = alerts?.filter(a => a.severity === 'critical' || a.severity === 'emergency').length || 0;
      const resolvedAlerts = alerts?.filter(a => a.resolved).length || 0;
      const successfulCrons = cronLogs?.filter(c => c.status === 'success').length || 0;
      const totalCrons = cronLogs?.length || 0;

      // Determine agent status
      let agentStatus: 'online' | 'offline' | 'degraded' = 'offline';
      if (cronLogs && cronLogs.length > 0) {
        const latestExecution = new Date(cronLogs[0].executed_at);
        const minutesSinceLastExecution = (now.getTime() - latestExecution.getTime()) / 1000 / 60;

        if (minutesSinceLastExecution < 10) { // Within last 10 minutes
          agentStatus = criticalAlerts > 5 ? 'degraded' : 'online';
        } else {
          agentStatus = 'degraded';
        }
      }

      setMetrics({
        totalAlerts,
        criticalAlerts,
        resolvedAlerts,
        lastCronExecution: cronLogs?.[0]?.executed_at || null,
        cronSuccessRate: totalCrons > 0 ? (successfulCrons / totalCrons) * 100 : 0,
        agentStatus
      });

      setRecentAlerts(alerts || []);
      setCronExecutions(cronLogs || []);

    } catch (err) {
      await auditLogger.error('GUARDIAN_METRICS_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load Guardian metrics');
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    try {
      setHealthCheckRunning(true);
      setError(null);

      const response = await monitorSystemHealth();

      if (response.success) {
        setError('Health check completed successfully');
        setTimeout(() => setError(null), 3000);
        loadGuardianMetrics(); // Reload metrics
      } else {
        setError('Health check failed: ' + (response.error || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed to run health check');
    } finally {
      setHealthCheckRunning(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'emergency':
        return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
      case 'critical':
        return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' };
      case 'warning':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
    }
  };

  const getStatusIcon = (status: 'online' | 'offline' | 'degraded') => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'offline':
        return <XCircle className="w-6 h-6 text-red-600" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-emerald-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Guardian Agent Monitoring</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Autonomous system health and security monitoring
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {(['24h', '7d', '30d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
            <button
              onClick={runHealthCheck}
              disabled={healthCheckRunning}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
            >
              <Activity className={`w-4 h-4 ${healthCheckRunning ? 'animate-spin' : ''}`} />
              Run Health Check
            </button>
          </div>
        </div>

        {error && (
          <div className={`mb-4 p-3 rounded-lg ${error.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Agent Status Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${
              metrics.agentStatus === 'online' ? 'bg-green-50 border-green-200' :
              metrics.agentStatus === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {getStatusIcon(metrics.agentStatus)}
                <span className={`font-semibold ${
                  metrics.agentStatus === 'online' ? 'text-green-900' :
                  metrics.agentStatus === 'degraded' ? 'text-yellow-900' :
                  'text-red-900'
                }`}>Agent Status</span>
              </div>
              <div className="text-2xl font-bold capitalize">
                {metrics.agentStatus}
              </div>
              {metrics.lastCronExecution && (
                <div className="text-xs text-gray-600 mt-1">
                  Last check: {new Date(metrics.lastCronExecution).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-900">Critical Alerts</span>
              </div>
              <div className="text-3xl font-bold text-red-900">
                {metrics.criticalAlerts}
              </div>
              <div className="text-sm text-red-700 mt-1">
                {metrics.totalAlerts} total alerts
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Resolved</span>
              </div>
              <div className="text-3xl font-bold text-blue-900">
                {metrics.resolvedAlerts}
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {metrics.totalAlerts > 0 ? Math.round((metrics.resolvedAlerts / metrics.totalAlerts) * 100) : 0}% resolution rate
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="font-semibold text-purple-900">Cron Success</span>
              </div>
              <div className="text-3xl font-bold text-purple-900">
                {(metrics.cronSuccessRate ?? 0).toFixed(0)}%
              </div>
              <div className="text-sm text-purple-700 mt-1">
                Monitoring reliability
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Recent Guardian Alerts
        </h3>

        {recentAlerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No Guardian alerts in this time period</p>
            <p className="text-sm text-green-600 mt-2">All systems operating normally</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentAlerts.map((alert) => {
              const colors = getSeverityColor(alert.severity);
              return (
                <div
                  key={alert.id}
                  className={`border rounded-lg p-4 ${colors.border} ${colors.bg}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${colors.text}`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs text-gray-600">
                          {new Date(alert.created_at).toLocaleString()}
                        </span>
                        {alert.resolved && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            Resolved
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-gray-900 mb-1">
                        {alert.title || alert.category.replace(/_/g, ' ').toUpperCase()}
                      </div>
                      <div className="text-sm text-gray-700">
                        {alert.description}
                      </div>
                      {alert.tenant_id && (
                        <div className="text-xs text-gray-600 mt-2">
                          Tenant ID: {alert.tenant_id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cron Execution History */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Automated Monitoring Schedule
        </h3>

        {cronExecutions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No cron executions logged</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cronExecutions.slice(0, 10).map((execution) => (
              <div
                key={execution.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {execution.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{execution.job_name}</div>
                    <div className="text-xs text-gray-600">
                      {new Date(execution.executed_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  execution.status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {execution.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-600 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-medium mb-1">About Guardian Agent</p>
            <p className="text-emerald-800">
              Guardian is an autonomous monitoring agent that runs continuous health checks, security scans,
              and system diagnostics. It executes every 5 minutes via automated cron jobs and provides
              real-time alerts for critical issues across all tenants.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardianMonitoringDashboard;
