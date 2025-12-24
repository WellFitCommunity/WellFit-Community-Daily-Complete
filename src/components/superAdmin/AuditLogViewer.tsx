import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminService } from '../../services/superAdminService';
import { SuperAdminAuditLog } from '../../types/superAdmin';
import { FileText, AlertTriangle, Info, AlertCircle, Filter, Clock, User, Activity, Shield } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

const AuditLogViewer: React.FC = () => {
  const [auditLogs, setAuditLogs] = useState<SuperAdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const logs = showCriticalOnly
        ? await SuperAdminService.getCriticalAuditEvents()
        : await SuperAdminService.getRecentAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_AUDIT_LOG_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        showCriticalOnly
      });
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [showCriticalOnly]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'red';
      case 'warning':
        return 'yellow';
      case 'info':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('suspend') || action.includes('disable') || action.includes('kill_switch')) {
      return 'text-red-700 bg-red-50';
    }
    if (action.includes('activate') || action.includes('enable') || action.includes('create')) {
      return 'text-green-700 bg-green-50';
    }
    if (action.includes('update') || action.includes('modify')) {
      return 'text-blue-700 bg-blue-50';
    }
    return 'text-gray-700 bg-gray-50';
  };

  const filteredLogs = filterSeverity === 'all'
    ? auditLogs
    : auditLogs.filter(log => log.severity === filterSeverity);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Master Admin Audit Logs</h2>
            <p className="text-sm text-gray-600 mt-1">
              Security and compliance tracking for all master admin actions
            </p>
          </div>
          <button
            onClick={loadAuditLogs}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-xs"
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

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filter by severity:</span>
          </div>
          {['all', 'info', 'warning', 'critical'].map((severity) => (
            <button
              key={severity}
              onClick={() => setFilterSeverity(severity as typeof filterSeverity)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors shadow-xs ${
                filterSeverity === severity
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
          <div className="ml-auto">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showCriticalOnly}
                onChange={(e) => setShowCriticalOnly(e.target.checked)}
                className="rounded-sm border-gray-300"
              />
              Show critical events only
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Info</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">
              {auditLogs.filter(l => l.severity === 'info').length}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Warning</span>
            </div>
            <div className="text-2xl font-bold text-yellow-900">
              {auditLogs.filter(l => l.severity === 'warning').length}
            </div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">Critical</span>
            </div>
            <div className="text-2xl font-bold text-red-900">
              {auditLogs.filter(l => l.severity === 'critical').length}
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-gray-600" />
              <span className="font-semibold text-gray-900">Total Events</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {auditLogs.length}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log List */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Activity ({filteredLogs.length} events)
        </h3>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No audit logs found</p>
            {filterSeverity !== 'all' && (
              <button
                onClick={() => setFilterSeverity('all')}
                className="mt-4 text-red-600 hover:underline font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => {
              const color = getSeverityColor(log.severity);
              return (
                <div
                  key={log.id}
                  className={`border-l-4 border-${color}-500 bg-gray-50 p-4 rounded-r-lg hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg bg-${color}-50 mt-1`}>
                        {getSeverityIcon(log.severity)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className={`px-2 py-1 rounded-sm text-xs font-medium bg-${color}-100 text-${color}-800`}>
                            {log.severity}
                          </span>
                        </div>
                        <p className="text-gray-900 font-medium mb-1">{log.description}</p>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <div className="bg-white p-3 rounded-sm mt-2 border border-gray-200">
                            <div className="text-xs font-medium text-gray-700 mb-2">Details:</div>
                            <div className="space-y-1">
                              {Object.entries(log.details).map(([key, value]) => (
                                <div key={key} className="text-xs">
                                  <span className="text-gray-600">{key}: </span>
                                  <span className="text-gray-900 font-mono">
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Admin ID: {log.superAdminId.slice(0, 8)}...
                          </div>
                          {log.ipAddress && (
                            <div>IP: {log.ipAddress}</div>
                          )}
                          {log.userAgent && (
                            <div className="truncate max-w-xs" title={log.userAgent}>
                              {log.userAgent}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className="w-4 h-4" />
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export/Compliance Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">SOC 2 Compliance</p>
            <p className="text-blue-800">
              All super admin actions are logged with timestamps, IP addresses, and full context for audit and compliance purposes.
              Logs are retained according to compliance requirements and cannot be modified or deleted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewer;
