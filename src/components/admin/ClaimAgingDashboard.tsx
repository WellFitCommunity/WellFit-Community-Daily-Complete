/**
 * ClaimAgingDashboard - Claim Follow-Up Aging Analysis
 *
 * Purpose: Shows aging claims by bucket (0-30d, 31-60d, 61-90d, 90+d)
 * with status filters, payer search, history modal, and alert banners.
 *
 * Used by: sectionDefinitions.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  Filter,
  History,
  AlertTriangle,
  X,
  CheckCircle,
  DollarSign,
  Search,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import {
  claimAgingService,
} from '../../services/claimAgingService';
import type {
  AgingClaim,
  ClaimAgingStats,
  ClaimStatusEntry,
  ClaimStatusFilter,
} from '../../services/claimAgingService';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

type AgingColor = 'normal' | 'elevated' | 'high' | 'critical';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return `$${(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getAgingColor(days: number): AgingColor {
  if (days > 90) return 'critical';
  if (days > 60) return 'high';
  if (days > 30) return 'elevated';
  return 'normal';
}

function getStatusBadgeVariant(status: string): 'info' | 'neutral' | 'elevated' | 'critical' {
  switch (status) {
    case 'generated': return 'neutral';
    case 'submitted': return 'info';
    case 'accepted': return 'elevated';
    case 'rejected': return 'critical';
    default: return 'neutral';
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function AgingMetricCard({ label, value, color, amount }: {
  label: string;
  value: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
  amount?: string;
}) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {amount && <p className="text-xs mt-1 opacity-60">{amount}</p>}
    </div>
  );
}

function ClaimHistoryModal({ claimId, controlNumber, onClose }: {
  claimId: string;
  controlNumber: string | null;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ClaimStatusEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const result = await claimAgingService.getClaimHistory(claimId);
      if (result.success) {
        setHistory(result.data);
      }
      setLoading(false);
    }
    loadHistory();
  }, [claimId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Claim status history"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Claim Status History
            {controlNumber && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({controlNumber})
              </span>
            )}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-2" />
            <span className="text-gray-600">Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No status transitions recorded.</p>
        ) : (
          <div className="space-y-3">
            {history.map(entry => (
              <div key={entry.id} className="border rounded-md p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {entry.from_status && (
                      <>
                        <EABadge variant={getStatusBadgeVariant(entry.from_status)} size="sm">
                          {entry.from_status}
                        </EABadge>
                        <span className="text-gray-400">&rarr;</span>
                      </>
                    )}
                    <EABadge variant={getStatusBadgeVariant(entry.to_status)} size="sm">
                      {entry.to_status}
                    </EABadge>
                  </div>
                  <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                </div>
                {entry.note && (
                  <p className="text-gray-700 mt-1">{entry.note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Close</EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ClaimAgingDashboard: React.FC = () => {
  useDashboardTheme();
  const [claims, setClaims] = useState<AgingClaim[]>([]);
  const [stats, setStats] = useState<ClaimAgingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ClaimStatusFilter>('all');
  const [payerSearch, setPayerSearch] = useState('');
  const [controlSearch, setControlSearch] = useState('');
  const [historyClaimId, setHistoryClaimId] = useState<string | null>(null);
  const [historyControlNumber, setHistoryControlNumber] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [claimsRes, statsRes] = await Promise.all([
      claimAgingService.getAgingClaims(),
      claimAgingService.getAgingStats(),
    ]);

    if (!claimsRes.success) {
      setError(claimsRes.error.message);
      setClaims([]);
    } else {
      setClaims(claimsRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredClaims = claims.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (payerSearch) {
      const q = payerSearch.toLowerCase();
      if (!(c.payer_name || '').toLowerCase().includes(q)) return false;
    }
    if (controlSearch) {
      const q = controlSearch.toLowerCase();
      if (!(c.control_number || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openHistory = (claim: AgingClaim) => {
    setHistoryClaimId(claim.claim_id);
    setHistoryControlNumber(claim.control_number);
  };

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading claim aging data...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4" aria-label="Claim Aging Dashboard">
      {/* Alert Banner for 90+ day claims */}
      {(stats?.bucket_90_plus ?? 0) > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {stats?.bucket_90_plus} claim{(stats?.bucket_90_plus ?? 0) !== 1 ? 's' : ''} aging 90+ days — immediate follow-up required.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Aging Bucket Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <AgingMetricCard label="0-30 Days" value={stats?.bucket_0_30 ?? 0} color="green" />
        <AgingMetricCard label="31-60 Days" value={stats?.bucket_31_60 ?? 0} color="yellow" />
        <AgingMetricCard label="61-90 Days" value={stats?.bucket_61_90 ?? 0} color="orange" />
        <AgingMetricCard label="90+ Days" value={stats?.bucket_90_plus ?? 0} color="red" />
      </div>

      {/* Total Outstanding Summary */}
      {stats && (
        <div className="flex items-center gap-4 text-sm text-gray-600 px-1">
          <span className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            Total Outstanding: <strong>{formatCurrency(stats.total_amount)}</strong>
          </span>
          <span>|</span>
          <span>{stats.total_outstanding} claim{stats.total_outstanding !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Claims Table */}
      <EACard>
        <EACardHeader
          icon={<Clock className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Aging Claims
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ClaimStatusFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="generated">Generated</option>
              <option value="submitted">Submitted</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={payerSearch}
                onChange={e => setPayerSearch(e.target.value)}
                placeholder="Search payer..."
                className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] w-40 pl-7"
                aria-label="Search by payer"
              />
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={controlSearch}
                onChange={e => setControlSearch(e.target.value)}
                placeholder="Search control #..."
                className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] w-44 pl-7"
                aria-label="Search by control number"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-28">Control #</span>
            <span className="w-36">Payer</span>
            <span className="w-20">Status</span>
            <span className="w-24 text-right">Amount</span>
            <span className="w-16 flex items-center gap-1"><Clock className="w-3 h-3" /> Days</span>
            <span className="w-24">Created</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredClaims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No aging claims found</p>
              <p className="text-xs mt-1">
                {claims.length === 0
                  ? 'All claims are resolved or no outstanding claims exist.'
                  : 'No claims match the current filters.'}
              </p>
            </div>
          ) : (
            filteredClaims.map(claim => (
              <div
                key={claim.claim_id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-mono text-gray-900 w-28 truncate" title={claim.control_number || ''}>
                  {claim.control_number || '--'}
                </span>

                <span className="text-sm text-gray-700 w-36 truncate" title={claim.payer_name || ''}>
                  {claim.payer_name || 'Unknown'}
                </span>

                <span className="w-20">
                  <EABadge variant={getStatusBadgeVariant(claim.status)} size="sm">
                    {claim.status}
                  </EABadge>
                </span>

                <span className="w-24 text-sm font-medium text-gray-900 text-right">
                  {formatCurrency(claim.total_charge)}
                </span>

                <span className="w-16">
                  <EABadge
                    variant={getAgingColor(claim.aging_days)}
                    size="sm"
                    pulse={claim.aging_days > 90}
                  >
                    {claim.aging_days}d
                  </EABadge>
                </span>

                <span className="w-24 text-xs text-gray-500">
                  {formatDate(claim.created_at)}
                </span>

                <span className="flex-1 flex gap-2 justify-end">
                  <EAButton
                    variant="ghost"
                    size="sm"
                    onClick={() => openHistory(claim)}
                  >
                    <History className="w-3 h-3 mr-1" />
                    History
                  </EAButton>
                </span>
              </div>
            ))
          )}
        </EACardContent>
      </EACard>

      {/* History Modal */}
      {historyClaimId && (
        <ClaimHistoryModal
          claimId={historyClaimId}
          controlNumber={historyControlNumber}
          onClose={() => {
            setHistoryClaimId(null);
            setHistoryControlNumber(null);
          }}
        />
      )}
    </div>
  );
};

export default ClaimAgingDashboard;
