/**
 * Audit Analytics Dashboard - Audit Log Analysis and Visualization
 *
 * Purpose: Analyze and visualize audit log data for compliance and security monitoring
 * Features: Statistics, search, export, PHI access tracking
 * Compliance: SOC2 CC7.2, HIPAA § 164.312(b)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  Download,
  RefreshCw,
  FileText,
  AlertTriangle,
  Clock,
  User,
  Database,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import {
  auditAnalyticsService,
  type AuditLogEntry,
  type AuditStats,
  type AuditEventCategory,
  type AuditSeverity,
  type AuditSearchFilters,
} from '../../services/auditAnalyticsService';

// =============================================================================
// HELPERS
// =============================================================================

const CATEGORY_CONFIG: Record<AuditEventCategory, { label: string; color: string }> = {
  AUTH: { label: 'Authentication', color: 'bg-blue-100 text-blue-800' },
  PHI_ACCESS: { label: 'PHI Access', color: 'bg-purple-100 text-purple-800' },
  DATA_MOD: { label: 'Data Modification', color: 'bg-yellow-100 text-yellow-800' },
  SYSTEM: { label: 'System', color: 'bg-gray-100 text-gray-800' },
  SECURITY: { label: 'Security', color: 'bg-red-100 text-red-800' },
  BILLING: { label: 'Billing', color: 'bg-green-100 text-green-800' },
  CLINICAL: { label: 'Clinical', color: 'bg-indigo-100 text-indigo-800' },
  ADMIN: { label: 'Admin', color: 'bg-orange-100 text-orange-800' },
};

const SEVERITY_CONFIG: Record<AuditSeverity, { label: string; color: string }> = {
  info: { label: 'Info', color: 'bg-blue-100 text-blue-700' },
  warning: { label: 'Warning', color: 'bg-yellow-100 text-yellow-700' },
  error: { label: 'Error', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const AuditAnalyticsDashboard: React.FC = () => {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [searchResults, setSearchResults] = useState<AuditLogEntry[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Search filters
  const [filters, setFilters] = useState<AuditSearchFilters>({
    limit: 50,
    offset: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditEventCategory | ''>('');
  const [selectedSeverity, setSelectedSeverity] = useState<AuditSeverity | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const result = await auditAnalyticsService.getAuditStats(
        dateFrom || undefined,
        dateTo || undefined
      );
      if (result.success) {
        setStats(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Failed to load audit statistics');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Search logs
  const searchLogs = useCallback(async (resetOffset: boolean = true) => {
    setSearching(true);
    try {
      const searchFilters: AuditSearchFilters = {
        query: searchQuery || undefined,
        category: selectedCategory || undefined,
        severity: selectedSeverity || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 50,
        offset: resetOffset ? 0 : filters.offset,
      };

      const result = await auditAnalyticsService.searchAuditLogs(searchFilters);
      if (result.success) {
        setSearchResults(result.data.entries);
        setTotalResults(result.data.total);
        if (resetOffset) {
          setFilters(prev => ({ ...prev, offset: 0 }));
        }
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedCategory, selectedSeverity, dateFrom, dateTo, filters.offset]);

  useEffect(() => {
    fetchStats();
    searchLogs();
  }, [fetchStats]);

  // Handle export
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const result = await auditAnalyticsService.exportAuditLogs(
        {
          query: searchQuery || undefined,
          category: selectedCategory || undefined,
          severity: selectedSeverity || undefined,
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
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setError('Export failed');
      }
    } catch (err) {
      setError('Export failed');
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Loading audit analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            Audit Analytics
          </h1>
          <p className="text-gray-500 mt-1">
            Analyze audit logs for compliance and security monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <EAButton variant="secondary" onClick={() => handleExport('csv')}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </EAButton>
          <EAButton variant="secondary" onClick={fetchStats} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" onDismiss={() => setError(null)} dismissible>
          {error}
        </EAAlert>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <EACard>
            <EACardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Total Events</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.totalEvents.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">Last 30 days</div>
                </div>
                <FileText className="w-10 h-10 text-blue-500" />
              </div>
            </EACardContent>
          </EACard>

          <EACard className={stats.eventsBySeverity.critical > 0 ? 'border-2 border-red-500' : ''}>
            <EACardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Critical Events</div>
                  <div className={`text-3xl font-bold ${stats.eventsBySeverity.critical > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {stats.eventsBySeverity.critical}
                  </div>
                  <div className="text-xs text-gray-400">Requires attention</div>
                </div>
                <AlertTriangle className={`w-10 h-10 ${stats.eventsBySeverity.critical > 0 ? 'text-red-500' : 'text-gray-300'}`} />
              </div>
            </EACardContent>
          </EACard>

          <EACard>
            <EACardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">PHI Access Events</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.eventsByCategory.PHI_ACCESS.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">HIPAA tracked</div>
                </div>
                <Eye className="w-10 h-10 text-purple-500" />
              </div>
            </EACardContent>
          </EACard>

          <EACard>
            <EACardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500">Unique Actors</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {stats.topActors.length}
                  </div>
                  <div className="text-xs text-gray-400">Active users</div>
                </div>
                <User className="w-10 h-10 text-green-500" />
              </div>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* Category Breakdown */}
      {stats && (
        <EACard>
          <EACardHeader>
            <h3 className="font-semibold text-gray-900">Events by Category</h3>
          </EACardHeader>
          <EACardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.entries(stats.eventsByCategory) as [AuditEventCategory, number][]).map(([category, count]) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    searchLogs();
                  }}
                  className={`p-3 rounded-lg text-left transition-colors hover:opacity-80 ${CATEGORY_CONFIG[category].color}`}
                >
                  <div className="text-2xl font-bold">{count.toLocaleString()}</div>
                  <div className="text-sm">{CATEGORY_CONFIG[category].label}</div>
                </button>
              ))}
            </div>
          </EACardContent>
        </EACard>
      )}

      {/* Search Section */}
      <EACard>
        <EACardHeader className="bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Audit Logs
            </h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              <Filter className="w-4 h-4" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </EACardHeader>
        <EACardContent className="p-4 space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event types, details..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => e.key === 'Enter' && searchLogs()}
              />
            </div>
            <EAButton variant="primary" onClick={() => searchLogs()} disabled={searching}>
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
            </EAButton>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as AuditEventCategory | '')}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="">All Categories</option>
                  {(Object.keys(CATEGORY_CONFIG) as AuditEventCategory[]).map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_CONFIG[cat].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value as AuditSeverity | '')}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="">All Severities</option>
                  {(Object.keys(SEVERITY_CONFIG) as AuditSeverity[]).map((sev) => (
                    <option key={sev} value={sev}>{SEVERITY_CONFIG[sev].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>
          )}

          {/* Results */}
          <div className="text-sm text-gray-500">
            Showing {searchResults.length} of {totalResults.toLocaleString()} results
          </div>

          {/* Results List */}
          <div className="divide-y border rounded-lg">
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No audit logs found matching your criteria</p>
              </div>
            ) : (
              searchResults.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const categoryConfig = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.SYSTEM;
                const severityConfig = SEVERITY_CONFIG[entry.severity] || SEVERITY_CONFIG.info;

                return (
                  <div key={entry.id}>
                    <div
                      className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {entry.event_type}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryConfig.color}`}>
                              {categoryConfig.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(entry.created_at).toLocaleString()}
                            {entry.actor_user_id && (
                              <>
                                <span className="text-gray-300">|</span>
                                <User className="w-3 h-3" />
                                {entry.actor_user_id.substring(0, 8)}...
                              </>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 bg-gray-50">
                        <div className="p-3 bg-white rounded border text-sm space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-gray-500">ID:</span>
                              <span className="ml-2 font-mono">{entry.id}</span>
                            </div>
                            {entry.patient_id && (
                              <div>
                                <span className="text-gray-500">Patient:</span>
                                <span className="ml-2 font-mono">{entry.patient_id.substring(0, 8)}...</span>
                              </div>
                            )}
                            {entry.resource_type && (
                              <div>
                                <span className="text-gray-500">Resource:</span>
                                <span className="ml-2">{entry.resource_type}</span>
                              </div>
                            )}
                            {entry.action && (
                              <div>
                                <span className="text-gray-500">Action:</span>
                                <span className="ml-2">{entry.action}</span>
                              </div>
                            )}
                            {entry.ip_address && (
                              <div>
                                <span className="text-gray-500">IP:</span>
                                <span className="ml-2 font-mono">{entry.ip_address}</span>
                              </div>
                            )}
                          </div>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <div>
                              <span className="text-gray-500">Details:</span>
                              <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                {JSON.stringify(entry.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalResults > 50 && (
            <div className="flex justify-center gap-2">
              <EAButton
                variant="secondary"
                onClick={() => {
                  setFilters(prev => ({ ...prev, offset: Math.max(0, (prev.offset || 0) - 50) }));
                  searchLogs(false);
                }}
                disabled={!filters.offset || filters.offset === 0}
              >
                Previous
              </EAButton>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {Math.floor((filters.offset || 0) / 50) + 1} of {Math.ceil(totalResults / 50)}
              </span>
              <EAButton
                variant="secondary"
                onClick={() => {
                  setFilters(prev => ({ ...prev, offset: (prev.offset || 0) + 50 }));
                  searchLogs(false);
                }}
                disabled={(filters.offset || 0) + 50 >= totalResults}
              >
                Next
              </EAButton>
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default AuditAnalyticsDashboard;
