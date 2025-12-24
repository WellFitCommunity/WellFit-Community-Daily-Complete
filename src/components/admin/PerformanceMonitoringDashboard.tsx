import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';

interface ErrorLog {
  id: string;
  error_message: string;
  error_type: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  component_name?: string;
  page_url?: string;
  created_at: string;
}

interface PerformanceMetric {
  id: string;
  metric_type: string;
  metric_name: string;
  duration_ms: number;
  created_at: string;
}

interface PerformanceDashboardProps {
  className?: string;
}

const PerformanceMonitoringDashboard: React.FC<PerformanceDashboardProps> = ({ className = '' }) => {
  const supabase = useSupabaseClient();
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStats, setErrorStats] = useState({
    critical: 0,
    error: 0,
    warning: 0,
    info: 0
  });

  const loadMonitoringData = useCallback(async () => {
    try {
      setLoading(true);

      // Load recent errors
      const { data: errorData } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (errorData) {
        setErrors(errorData);

        // Calculate error stats
        const stats = errorData.reduce((acc, err) => {
          acc[err.severity] = (acc[err.severity] || 0) + 1;
          return acc;
        }, { critical: 0, error: 0, warning: 0, info: 0 });

        setErrorStats(stats);
      }

      // Load recent performance metrics
      const { data: metricsData } = await supabase
        .from('performance_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (metricsData) {
        setMetrics(metricsData);
      }
    } catch {
      // Error handled silently - monitoring should not interrupt user flow
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadMonitoringData();

    // Refresh every 30 seconds
    const interval = setInterval(loadMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [loadMonitoringData]);

  const getSeverityColor = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      error: 'bg-orange-100 text-orange-800 border-orange-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      info: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getMetricTypeIcon = (type: string) => {
    const icons = {
      page_load: '📄',
      api_call: '🔌',
      component_render: '⚛️',
      user_action: '👆'
    };
    return icons[type as keyof typeof icons] || '📊';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Performance Monitoring</h2>
        <button
          onClick={loadMonitoringData}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Errors</p>
              <p className="text-3xl font-bold text-red-600">{errorStats.critical}</p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-2xl">🚨</span>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Errors</p>
              <p className="text-3xl font-bold text-orange-600">{errorStats.error}</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-orange-600 text-2xl">⚠️</span>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Warnings</p>
              <p className="text-3xl font-bold text-yellow-600">{errorStats.warning}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-yellow-600 text-2xl">⚡</span>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Info</p>
              <p className="text-3xl font-bold text-blue-600">{errorStats.info}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 text-2xl">ℹ️</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
        </div>

        {errors.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {errors.map((error) => (
              <div key={error.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(error.severity)}`}>
                        {error.severity}
                      </span>
                      <span className="text-xs text-gray-500">{error.error_type}</span>
                      {error.component_name && (
                        <span className="text-xs text-gray-500">• {error.component_name}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{error.error_message}</p>
                    {error.page_url && (
                      <p className="text-xs text-gray-500 truncate">{error.page_url}</p>
                    )}
                  </div>
                  <div className="ml-4 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(error.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No errors logged yet</p>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
        </div>

        {metrics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="mr-2">{getMetricTypeIcon(metric.metric_type)}</span>
                        <span className="text-sm text-gray-900">{metric.metric_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{metric.metric_name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        metric.duration_ms > 3000 ? 'text-red-600' :
                        metric.duration_ms > 1000 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {formatDuration(metric.duration_ms)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-gray-500">
                      {new Date(metric.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500">No performance metrics yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceMonitoringDashboard;
