/**
 * Tenant Audit Logs
 *
 * Comprehensive audit log viewer for facility administrators.
 * Shows ONLY audit logs for the current tenant's operations.
 *
 * Features:
 * - PHI access tracking (who accessed what, when)
 * - Administrative actions
 * - User authentication events
 * - Data modifications
 * - Export capability for compliance reporting
 *
 * HIPAA Compliance: All PHI access must be logged and auditable
 */

import React, { useState, useEffect } from 'react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { FileText, Download, Filter as _Filter, Search, Calendar as _Calendar } from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';

interface AuditLog {
  id: string;
  timestamp: string;
  user_email: string;
  action_type: string;
  action_category: string;
  resource_type: string;
  resource_id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  ip_address?: string;
  metadata?: Record<string, unknown>;
}

export const TenantAuditLogs: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    category: 'all',
    severity: 'all',
    searchTerm: '',
    dateRange: '7d',
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    loadTenantAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Function is stable, deps capture trigger conditions
  }, [user, filter, page]);

  const loadTenantAuditLogs = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get current user's tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) {
        setLoading(false);
        return;
      }

      setTenantId(profile.tenant_id);

      // Build query for tenant-scoped audit logs
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (filter.category !== 'all') {
        query = query.eq('action_category', filter.category);
      }

      if (filter.severity !== 'all') {
        query = query.eq('severity', filter.severity);
      }

      if (filter.searchTerm) {
        query = query.or(`user_email.ilike.%${filter.searchTerm}%,message.ilike.%${filter.searchTerm}%`);
      }

      // Date range filter
      if (filter.dateRange !== 'all') {
        const days = parseInt(filter.dateRange.replace('d', ''));
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.gte('created_at', cutoffDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setLogs(data.map(log => ({
          id: log.id,
          timestamp: log.created_at,
          user_email: log.user_email || 'System',
          action_type: log.action_type,
          action_category: log.action_category,
          resource_type: log.resource_type || 'N/A',
          resource_id: log.resource_id || 'N/A',
          severity: log.severity || 'info',
          message: log.message || 'No message',
          ip_address: log.ip_address,
          metadata: log.metadata,
        })));
      }

    } catch (error) {
      await auditLogger.error('TENANT_AUDIT_LOGS_LOAD_FAILED', error as Error, { tenantId });
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    // Export current filtered logs to CSV for compliance reporting
    const csv = [
      ['Timestamp', 'User', 'Action', 'Category', 'Resource', 'Severity', 'Message', 'IP Address'].join(','),
      ...logs.map(log => [
        log.timestamp,
        log.user_email,
        log.action_type,
        log.action_category,
        `${log.resource_type}:${log.resource_id}`,
        log.severity,
        `"${log.message.replace(/"/g, '""')}"`,
        log.ip_address || 'N/A',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${tenantId}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'error': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
            <p className="text-sm text-gray-600">Comprehensive activity tracking for your facility</p>
          </div>
        </div>
        <button
          onClick={exportLogs}
          disabled={logs.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search user or message..."
              value={filter.searchTerm}
              onChange={(e) => setFilter({ ...filter, searchTerm: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="PHI_ACCESS">PHI Access</option>
            <option value="AUTHENTICATION">Authentication</option>
            <option value="ADMINISTRATIVE">Administrative</option>
            <option value="DATA_MODIFICATION">Data Modification</option>
            <option value="SECURITY_EVENT">Security Event</option>
          </select>

          {/* Severity Filter */}
          <select
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>

          {/* Date Range */}
          <select
            value={filter.dateRange}
            onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No audit logs found for the selected filters
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.user_email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {log.action_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.action_category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-sm border ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {logs.length > 0 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing page {page} ({logs.length} records)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={logs.length < pageSize}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* HIPAA Compliance Note */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="text-sm text-green-900">
            <p className="font-semibold mb-1">HIPAA Compliance</p>
            <p>All PHI access and administrative actions are automatically logged for compliance and audit purposes. Logs are retained for 7 years as required by HIPAA regulations.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantAuditLogs;
