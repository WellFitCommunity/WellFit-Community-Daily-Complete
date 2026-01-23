/**
 * TenantConfigHistory - Configuration Change History Dashboard
 *
 * Purpose: Display and search tenant configuration change history
 * Compliance: SOC2 CC6.1 - Change management audit trail
 * Used by: Admin dashboard, compliance reporting
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  tenantConfigAuditService,
  ConfigChange,
  ConfigChangeStats,
} from '../../services/tenantConfigAuditService';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../envision-atlus/EACard';
import { supabase } from '../../lib/supabaseClient';

// =============================================================================
// TYPES
// =============================================================================

interface TenantConfigHistoryProps {
  tenantId?: string; // Optional - uses current tenant if not provided
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const TenantConfigHistory: React.FC<TenantConfigHistoryProps> = ({
  tenantId: propTenantId,
  className = '',
}) => {
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const tenantId = propTenantId || currentTenantId || '';

  // Get current user's tenant on mount
  useEffect(() => {
    if (propTenantId) return; // Skip if tenant ID is provided as prop

    const loadTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.tenant_id) {
        setCurrentTenantId(profile.tenant_id);
      }
    };

    loadTenant();
  }, [propTenantId]);

  // State
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [stats, setStats] = useState<ConfigChangeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  // Selected change for detail view
  const [selectedChange, setSelectedChange] = useState<ConfigChange | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    setError(null);

    try {
      // Load changes
      const changesResult = await tenantConfigAuditService.getChangeHistory({
        tenantId,
        configTable: selectedTable || undefined,
        action: selectedAction as 'INSERT' | 'UPDATE' | 'DELETE' | undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: pageSize,
        offset: page * pageSize,
      });

      if (changesResult.success) {
        setChanges(changesResult.data.changes);
        setTotalCount(changesResult.data.total);
      } else {
        setError(changesResult.error.message);
      }

      // Load stats
      const statsResult = await tenantConfigAuditService.getChangeStats(tenantId);
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (err) {
      setError('Failed to load configuration history');
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedTable, selectedAction, dateFrom, dateTo, page]);

  // Search
  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      loadData();
      return;
    }

    setLoading(true);
    const result = await tenantConfigAuditService.searchChanges(searchTerm, tenantId);
    setLoading(false);

    if (result.success) {
      setChanges(result.data);
      setTotalCount(result.data.length);
    }
  }, [searchTerm, tenantId, loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // Get action badge color
  const getActionColor = (action: string): string => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Export handler
  const handleExport = async (format: 'json' | 'csv') => {
    const result = await tenantConfigAuditService.exportChangeHistory(
      {
        tenantId,
        configTable: selectedTable || undefined,
        action: selectedAction as 'INSERT' | 'UPDATE' | 'DELETE' | undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
      format
    );

    if (result.success) {
      const blob = new Blob([result.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `config-history-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Unique tables for filter
  const uniqueTables = Array.from(new Set(changes.map((c) => c.configTable)));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuration History</h2>
          <p className="text-gray-600">Track all changes to tenant configuration</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <EACard>
            <EACardContent className="p-4">
              <div className="text-3xl font-bold text-blue-600">{stats.totalChanges}</div>
              <div className="text-sm text-gray-600">Total Changes (30d)</div>
            </EACardContent>
          </EACard>

          <EACard>
            <EACardContent className="p-4">
              <div className="flex gap-4">
                <div>
                  <div className="text-xl font-bold text-green-600">
                    {stats.changesByAction['INSERT'] || 0}
                  </div>
                  <div className="text-xs text-gray-500">Inserts</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">
                    {stats.changesByAction['UPDATE'] || 0}
                  </div>
                  <div className="text-xs text-gray-500">Updates</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600">
                    {stats.changesByAction['DELETE'] || 0}
                  </div>
                  <div className="text-xs text-gray-500">Deletes</div>
                </div>
              </div>
            </EACardContent>
          </EACard>

          <EACard>
            <EACardContent className="p-4">
              <div className="text-3xl font-bold text-purple-600">
                {stats.changesByUser.length}
              </div>
              <div className="text-sm text-gray-600">Unique Users</div>
            </EACardContent>
          </EACard>

          <EACard>
            <EACardContent className="p-4">
              <div className="text-3xl font-bold text-orange-600">
                {Object.keys(stats.changesByTable).length}
              </div>
              <div className="text-sm text-gray-600">Tables Modified</div>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* Filters */}
      <EACard>
        <EACardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search changes..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Table Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Table
              </label>
              <select
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Tables</option>
                {uniqueTables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <select
                value={selectedAction}
                onChange={(e) => {
                  setSelectedAction(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Actions</option>
                <option value="INSERT">Insert</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </EACardContent>
      </EACard>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Changes Table */}
      <EACard>
        <EACardHeader>
          <h3 className="text-lg font-semibold">
            Change History
            {totalCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({totalCount} total)
              </span>
            )}
          </h3>
        </EACardHeader>
        <EACardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No configuration changes found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date/Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Table
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Field
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Changed By
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {changes.map((change) => (
                      <tr key={change.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {new Date(change.changedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                            {change.configTable}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {change.fieldName}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(
                              change.action
                            )}`}
                          >
                            {change.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div>{change.changedByName || 'System'}</div>
                          {change.changedByRole && (
                            <div className="text-xs text-gray-500">{change.changedByRole}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => setSelectedChange(change)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalCount > pageSize && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Showing {page * pageSize + 1} to{' '}
                    {Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * pageSize >= totalCount}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </EACardContent>
      </EACard>

      {/* Detail Modal */}
      {selectedChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">Change Details</h3>
                <button
                  onClick={() => setSelectedChange(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-xs text-gray-500">Date/Time</div>
                    <div className="font-medium">
                      {new Date(selectedChange.changedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Changed By</div>
                    <div className="font-medium">
                      {selectedChange.changedByName || 'System'}
                      {selectedChange.changedByRole && (
                        <span className="text-gray-500 text-sm ml-1">
                          ({selectedChange.changedByRole})
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Table</div>
                    <div className="font-medium">{selectedChange.configTable}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Field</div>
                    <div className="font-medium">{selectedChange.fieldName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Action</div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(
                        selectedChange.action
                      )}`}
                    >
                      {selectedChange.action}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Source</div>
                    <div className="font-medium">{selectedChange.changeSource}</div>
                  </div>
                </div>

                {/* Reason / Ticket */}
                {(selectedChange.reason || selectedChange.approvalTicket) && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    {selectedChange.reason && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500">Reason</div>
                        <div>{selectedChange.reason}</div>
                      </div>
                    )}
                    {selectedChange.approvalTicket && (
                      <div>
                        <div className="text-xs text-gray-500">Approval Ticket</div>
                        <div>{selectedChange.approvalTicket}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Values */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Old Value */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Previous Value</div>
                    <pre className="p-3 bg-red-50 rounded-lg text-sm overflow-x-auto max-h-60">
                      {formatValue(selectedChange.oldValue)}
                    </pre>
                  </div>

                  {/* New Value */}
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">New Value</div>
                    <pre className="p-3 bg-green-50 rounded-lg text-sm overflow-x-auto max-h-60">
                      {formatValue(selectedChange.newValue)}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedChange(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantConfigHistory;
