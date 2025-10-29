/**
 * Advanced Audit Logs Page
 *
 * Deep-dive audit log investigation and analysis.
 * Searchable, filterable interface for compliance and security reviews.
 */

import React, { useState, useEffect, useCallback } from 'react';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import AdminHeader from '../components/admin/AdminHeader';
import SmartBackButton from '../components/ui/SmartBackButton';
import { useSupabaseClient } from '../contexts/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Search, Filter, Download, Calendar, User, Shield } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
}

const AuditLogsPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const loadAuditLogs = useCallback(async () => {
    try {
      setLoading(true);

      // Load PHI access logs
      const { data: phiLogs, error: phiError } = await supabase
        .from('phi_access_logs')
        .select('*')
        .gte('access_timestamp', `${dateRange.start}T00:00:00`)
        .lte('access_timestamp', `${dateRange.end}T23:59:59`)
        .order('access_timestamp', { ascending: false })
        .limit(500);

      if (phiError && phiError.code !== 'PGRST116') {

      }

      // Load staff auth attempts
      const { data: authLogs, error: authError } = await supabase
        .from('staff_auth_attempts')
        .select('*')
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (authError && authError.code !== 'PGRST116') {

      }

      // Load staff audit logs
      const { data: staffLogs, error: staffError } = await supabase
        .from('staff_audit_log')
        .select('*')
        .gte('created_at', `${dateRange.start}T00:00:00`)
        .lte('created_at', `${dateRange.end}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (staffError && staffError.code !== 'PGRST116') {

      }

      // Combine and format all logs
      const combinedLogs: AuditLog[] = [];

      (phiLogs || []).forEach((log: any) => {
        combinedLogs.push({
          id: log.id,
          timestamp: log.access_timestamp,
          user_id: log.user_id,
          user_email: log.user_id, // Would need to join with profiles
          action: `PHI Access: ${log.action}`,
          resource_type: 'PHI',
          resource_id: log.patient_id,
          ip_address: log.ip_address,
          metadata: log
        });
      });

      (authLogs || []).forEach((log: any) => {
        combinedLogs.push({
          id: log.id,
          timestamp: log.created_at,
          user_id: log.user_id,
          user_email: log.email,
          action: `Auth: ${log.attempt_type}`,
          resource_type: 'Authentication',
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          metadata: log
        });
      });

      (staffLogs || []).forEach((log: any) => {
        combinedLogs.push({
          id: log.id,
          timestamp: log.created_at,
          user_id: log.user_id,
          action: `Staff: ${log.action}`,
          resource_type: 'Staff Action',
          metadata: log
        });
      });

      // Sort by timestamp descending
      combinedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setLogs(combinedLogs);
      setFilteredLogs(combinedLogs);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [dateRange, supabase]);

  const filterLogs = useCallback(() => {
    let filtered = [...logs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        log =>
          log.action?.toLowerCase().includes(query) ||
          log.user_email?.toLowerCase().includes(query) ||
          log.ip_address?.toLowerCase().includes(query) ||
          log.resource_id?.toLowerCase().includes(query)
      );
    }

    // Action type filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action?.toLowerCase().includes(actionFilter.toLowerCase()));
    }

    setFilteredLogs(filtered);
  }, [searchQuery, actionFilter, logs]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  useEffect(() => {
    filterLogs();
  }, [filterLogs]);

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        log.timestamp,
        log.user_email || log.user_id,
        log.action,
        log.resource_type || '',
        log.resource_id || '',
        log.ip_address || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
  };

  const getActionColor = (action: string) => {
    if (action.includes('failure') || action.includes('denied')) return 'text-red-600 bg-red-50';
    if (action.includes('success')) return 'text-green-600 bg-green-50';
    if (action.includes('PHI')) return 'text-purple-600 bg-purple-50';
    return 'text-blue-600 bg-blue-50';
  };

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="Envision Atlus - Audit Logs" showRiskAssessment={false} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <div className="mb-4">
            <SmartBackButton />
          </div>

          {/* Page Header */}
          <div className="bg-gradient-to-r from-[#2D3339] to-[#1F2326] rounded-2xl shadow-2xl p-8 border-2 border-black">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Shield className="w-8 h-8 text-[#C8E63D]" />
                  Advanced Audit Log Viewer
                </h1>
                <p className="text-white/80 mt-2 font-medium">
                  Search, filter, and analyze system audit trails for compliance and security
                </p>
              </div>
              <button
                onClick={exportLogs}
                className="px-6 py-3 bg-[#C8E63D] hover:bg-[#A8C230] text-black font-bold rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-black flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Export CSV ({filteredLogs.length} records)
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-black p-6">
            <h3 className="text-lg font-bold text-black mb-4">Filters & Search</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <Filter className="w-4 h-4 inline mr-1" />
                  Action Type
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
                >
                  <option value="all">All Actions</option>
                  <option value="phi">PHI Access</option>
                  <option value="auth">Authentication</option>
                  <option value="staff">Staff Actions</option>
                  <option value="success">Successful</option>
                  <option value="failure">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  <Search className="w-4 h-4 inline mr-1" />
                  Search
                </label>
                <input
                  type="text"
                  placeholder="User, action, IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
              <div className="text-2xl font-bold text-[#1BA39C]">{filteredLogs.length}</div>
              <div className="text-xs text-gray-600 font-semibold">Matching Records</div>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
              <div className="text-2xl font-bold text-purple-600">
                {filteredLogs.filter(l => l.action?.includes('PHI')).length}
              </div>
              <div className="text-xs text-gray-600 font-semibold">PHI Access Events</div>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
              <div className="text-2xl font-bold text-blue-600">
                {filteredLogs.filter(l => l.action?.includes('Auth')).length}
              </div>
              <div className="text-xs text-gray-600 font-semibold">Auth Events</div>
            </div>
            <div className="bg-white rounded-lg p-4 border-2 border-black shadow-md">
              <div className="text-2xl font-bold text-red-600">
                {filteredLogs.filter(l => l.action?.includes('failure')).length}
              </div>
              <div className="text-xs text-gray-600 font-semibold">Failed Attempts</div>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1BA39C] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading audit logs...</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border-2 border-black shadow-lg overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-[#E8F8F7] sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Resource</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No audit logs found for the selected criteria
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.user_email || log.user_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${getActionColor(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {log.resource_type || 'N/A'}
                            {log.resource_id && <span className="text-gray-500 ml-1">({log.resource_id.slice(0, 8)}...)</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                            {log.ip_address || 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default AuditLogsPage;
