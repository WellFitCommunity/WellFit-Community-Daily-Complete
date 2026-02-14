/**
 * PublicHealthReportingDashboard - Public Health Transmission Monitoring
 *
 * Purpose: Admin dashboard for monitoring syndromic surveillance, immunization
 *          registry, and electronic case reporting transmissions.
 * Used by: Admin clinical section (sectionDefinitions.tsx)
 * ONC Criteria: 170.315(f)(1), (f)(2), (f)(5)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  publicHealthReportingService,
  type UnifiedTransmission,
  type TransmissionStats,
  type TransmissionType,
  type TransmissionStatus,
} from '../../services/publicHealthReportingService';
import { useUser, useSupabaseClient } from '../../contexts/AuthContext';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type TypeFilter = 'all' | TransmissionType;
type StatusFilter = 'all' | TransmissionStatus;

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_LABELS: Record<TransmissionType, string> = {
  syndromic: 'Syndromic Surveillance',
  immunization: 'Immunization Registry',
  ecr: 'Electronic Case Report',
};

const TYPE_BADGE_STYLES: Record<TransmissionType, { bg: string; text: string }> = {
  syndromic: { bg: 'bg-blue-100', text: 'text-blue-800' },
  immunization: { bg: 'bg-green-100', text: 'text-green-800' },
  ecr: { bg: 'bg-purple-100', text: 'text-purple-800' },
};

const STATUS_STYLES: Record<TransmissionStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Submitted' },
  accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  error: { bg: 'bg-red-100', text: 'text-red-800', label: 'Error' },
};

const REFRESH_INTERVAL_MS = 30_000;

// =============================================================================
// COMPONENT
// =============================================================================

const PublicHealthReportingDashboard: React.FC = () => {
  const user = useUser();
  const supabaseClient = useSupabaseClient();

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [transmissions, setTransmissions] = useState<UnifiedTransmission[]>([]);
  const [stats, setStats] = useState<TransmissionStats | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------------------------------

  const loadData = useCallback(async (tid: string) => {
    try {
      const typeArg = typeFilter === 'all' ? undefined : typeFilter;
      const statusArg = statusFilter === 'all' ? 'all' : statusFilter;

      const [txResult, statsResult] = await Promise.all([
        publicHealthReportingService.getTransmissions(tid, { type: typeArg, status: statusArg }),
        publicHealthReportingService.getStats(tid),
      ]);

      if (txResult.success && txResult.data) setTransmissions(txResult.data);
      if (statsResult.success && statsResult.data) setStats(statsResult.data);
    } catch (err: unknown) {
      await auditLogger.error(
        'PUBLIC_HEALTH_DASHBOARD_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId: tid }
      );
      setError('Failed to load transmission data');
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, statusFilter]);

  // Initialize tenant + data
  useEffect(() => {
    if (!user?.id) return;

    const init = async () => {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (profile?.tenant_id) {
        setTenantId(profile.tenant_id);
        await loadData(profile.tenant_id);
      } else {
        setError('Could not determine your organization');
        setIsLoading(false);
      }
    };

    init();
  }, [user?.id, supabaseClient, loadData]);

  // Reload when filters change
  useEffect(() => {
    if (tenantId) {
      setIsLoading(true);
      loadData(tenantId);
    }
  }, [tenantId, typeFilter, statusFilter, loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!tenantId) return;
    intervalRef.current = setInterval(() => loadData(tenantId), REFRESH_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [tenantId, loadData]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleRetry = async (tx: UnifiedTransmission) => {
    if (!tenantId) return;
    setIsRetrying(tx.id);
    try {
      const result = await publicHealthReportingService.retryTransmission(tx.id, tx.type, tenantId);
      if (result.success) {
        await loadData(tenantId);
      } else {
        setError(result.error?.message || 'Retry failed');
      }
    } catch (err: unknown) {
      setError('Retry failed');
    } finally {
      setIsRetrying(null);
    }
  };

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  const formatTimestamp = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const successRate = stats && stats.total > 0
    ? Math.round((stats.success / stats.total) * 100)
    : 0;

  // ---------------------------------------------------------------------------
  // RENDER: LOADING
  // ---------------------------------------------------------------------------

  if (isLoading && !stats) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 rounded" />)}
          </div>
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Public Health Reporting</h2>
        <p className="text-sm text-slate-500 mt-1">
          ONC 170.315(f)(1), (f)(2), (f)(5) — Transmission monitoring and status
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Transmissions" value={stats?.total ?? 0} color="blue" />
        <MetricCard label="Success Rate" value={`${successRate}%`} color="green" />
        <MetricCard label="Pending" value={stats?.pending ?? 0} color="yellow" />
        <MetricCard label="Errors" value={stats?.errors ?? 0} color="red" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Type tabs */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(['all', 'syndromic', 'immunization', 'ecr'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'all' ? 'All Types' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Transmission Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Destination</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Response</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {transmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No transmissions found for the selected filters.
                  </td>
                </tr>
              ) : (
                transmissions.map(tx => {
                  const typeBadge = TYPE_BADGE_STYLES[tx.type];
                  const statusBadge = STATUS_STYLES[tx.status] || STATUS_STYLES.pending;
                  const isError = tx.status === 'error' || tx.status === 'rejected';

                  return (
                    <tr key={`${tx.type}-${tx.id}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {formatTimestamp(tx.submissionTimestamp)}
                        {tx.isTest && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                            TEST
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${typeBadge.bg} ${typeBadge.text}`}>
                          {TYPE_LABELS[tx.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{tx.destination}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${statusBadge.bg} ${statusBadge.text}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                        {tx.responseMessage || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isError && (
                          <button
                            onClick={() => handleRetry(tx)}
                            disabled={isRetrying === tx.id}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          >
                            {isRetrying === tx.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <p className="text-xs text-slate-400 text-right">
        Auto-refreshes every 30 seconds
      </p>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MetricCardProps {
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'yellow' | 'red';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, color }) => {
  const colorStyles: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };

  const style = colorStyles[color];

  return (
    <div className={`p-4 rounded-lg border ${style.bg} ${style.border}`}>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${style.text}`}>{value}</p>
    </div>
  );
};

export default PublicHealthReportingDashboard;
