import React, { useState, useEffect } from 'react';
import { SuperAdminService } from '../../services/superAdminService';
import { SystemHealthCheck } from '../../types/superAdmin';
import { Shield, CheckCircle, XCircle, AlertTriangle, Activity, Database, Server, Clock } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

const SystemHealthPanel: React.FC = () => {
  const [healthChecks, setHealthChecks] = useState<SystemHealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHealthData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const checks = await SuperAdminService.getRecentHealthChecks();
      setHealthChecks(checks);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_HEALTH_CHECK_LOAD_FAILED', err as Error, {
        category: 'SYSTEM_EVENT'
      });
      setError('Failed to load system health data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
      case 'unhealthy':
        return <XCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Activity className="w-6 h-6 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'degraded':
        return 'yellow';
      case 'unhealthy':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getComponentIcon = (component: string) => {
    if (component.toLowerCase().includes('database')) {
      return <Database className="w-5 h-5" />;
    }
    if (component.toLowerCase().includes('api')) {
      return <Server className="w-5 h-5" />;
    }
    return <Activity className="w-5 h-5" />;
  };

  // Group health checks by component
  const latestChecks = healthChecks.reduce((acc, check) => {
    if (!acc[check.componentName] || new Date(check.checkedAt) > new Date(acc[check.componentName].checkedAt)) {
      acc[check.componentName] = check;
    }
    return acc;
  }, {} as Record<string, SystemHealthCheck>);

  const components = Object.values(latestChecks);
  const overallStatus = components.length === 0 ? 'unknown' :
    components.some(c => c.status === 'unhealthy') ? 'unhealthy' :
    components.some(c => c.status === 'degraded') ? 'degraded' : 'healthy';

  if (loading && healthChecks.length === 0) {
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
      {/* Overall Health Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">System Health Monitor</h2>
            <p className="text-sm text-gray-600 mt-1">
              Real-time infrastructure and service monitoring
            </p>
          </div>
          <button
            onClick={loadHealthData}
            disabled={loading}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Overall Status Card */}
        <div className={`p-6 rounded-lg border-2 ${
          overallStatus === 'healthy' ? 'bg-green-50 border-green-200' :
          overallStatus === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
          overallStatus === 'unhealthy' ? 'bg-red-50 border-red-200' :
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-lg ${
              overallStatus === 'healthy' ? 'bg-green-100' :
              overallStatus === 'degraded' ? 'bg-yellow-100' :
              overallStatus === 'unhealthy' ? 'bg-red-100' :
              'bg-gray-100'
            }`}>
              <Shield className={`w-8 h-8 ${
                overallStatus === 'healthy' ? 'text-green-600' :
                overallStatus === 'degraded' ? 'text-yellow-600' :
                overallStatus === 'unhealthy' ? 'text-red-600' :
                'text-gray-600'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                System Status: {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
              </h3>
              <p className="text-sm text-gray-700">
                {components.length} components monitored
                {' • '}
                {components.filter(c => c.status === 'healthy').length} healthy
                {components.filter(c => c.status === 'degraded').length > 0 && (
                  <span className="text-yellow-700">
                    {' • '}
                    {components.filter(c => c.status === 'degraded').length} degraded
                  </span>
                )}
                {components.filter(c => c.status === 'unhealthy').length > 0 && (
                  <span className="text-red-700">
                    {' • '}
                    {components.filter(c => c.status === 'unhealthy').length} unhealthy
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Component Health Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Status</h3>

        {components.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No health check data available</p>
            <button
              onClick={loadHealthData}
              className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Load Health Checks
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {components.map((check) => {
              const color = getStatusColor(check.status);
              return (
                <div
                  key={check.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-3 rounded-lg bg-${color}-50`}>
                        {getComponentIcon(check.componentName)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {check.componentName}
                          </h4>
                          {getStatusIcon(check.status)}
                        </div>
                        {check.message && (
                          <p className="text-sm text-gray-600 mb-2">{check.message}</p>
                        )}
                        {check.metrics && Object.keys(check.metrics).length > 0 && (
                          <div className="flex flex-wrap gap-3 mt-3">
                            {Object.entries(check.metrics).map(([key, value]) => (
                              <div key={key} className="bg-gray-50 px-3 py-1 rounded">
                                <span className="text-xs text-gray-600">{key}: </span>
                                <span className="text-sm font-medium text-gray-900">
                                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-600 ml-4">
                      <div className="flex items-center gap-1 text-xs mb-1">
                        <Clock className="w-3 h-3" />
                        {new Date(check.checkedAt).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(check.checkedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-gray-500">
        <Activity className="w-3 h-3 inline mr-1" />
        Auto-refreshing every 30 seconds
      </div>
    </div>
  );
};

export default SystemHealthPanel;
