/**
 * BAATrackingDashboard - Business Associate Agreement Management
 *
 * Purpose: Admin dashboard for tracking and managing BAAs with business associates
 * Used by: Admin compliance section (sectionDefinitions.tsx)
 * Auth: admin/super_admin/compliance_officer only
 * Regulation: 45 CFR 164.502(e)
 *
 * Features:
 *  - List of BAAs with status (active, expired, draft, etc.)
 *  - Expiring soon alerts (90-day window)
 *  - Status badge coloring by lifecycle state
 *  - Stats: total, active, expired, expiring soon
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  baaTrackingService,
  type BAA,
  type BAAStatus,
} from '../../services/baaTrackingService';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

interface BAAStats {
  total: number;
  active: number;
  expired: number;
  expiringSoon: number;
  draft: number;
}

type StatusFilterOption = 'all' | 'active' | 'expired' | 'expiring' | 'draft';

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_STYLES: Record<BAAStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
  pending_review: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending Review' },
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Expired' },
  terminated: { bg: 'bg-red-200', text: 'text-red-900', label: 'Terminated' },
  not_required: { bg: 'bg-[var(--ea-primary,#00857a)]/15', text: 'text-[var(--ea-primary,#00857a)]', label: 'Not Required' },
};

const ASSOCIATE_TYPE_LABELS: Record<string, string> = {
  vendor: 'Vendor',
  subcontractor: 'Subcontractor',
  clearinghouse: 'Clearinghouse',
  cloud_provider: 'Cloud Provider',
  ehr_vendor: 'EHR Vendor',
  other: 'Other',
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function computeStats(allBaas: BAA[], expiringBaas: BAA[]): BAAStats {
  return {
    total: allBaas.length,
    active: allBaas.filter(b => b.status === 'active').length,
    expired: allBaas.filter(b => b.status === 'expired').length,
    expiringSoon: expiringBaas.length,
    draft: allBaas.filter(b => b.status === 'draft' || b.status === 'pending_review').length,
  };
}

function filterBAAs(
  allBaas: BAA[],
  expiringIds: Set<string>,
  filter: StatusFilterOption
): BAA[] {
  switch (filter) {
    case 'active':
      return allBaas.filter(b => b.status === 'active');
    case 'expired':
      return allBaas.filter(b => b.status === 'expired' || b.status === 'terminated');
    case 'expiring':
      return allBaas.filter(b => expiringIds.has(b.id));
    case 'draft':
      return allBaas.filter(b => b.status === 'draft' || b.status === 'pending_review');
    default:
      return allBaas;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

const BAATrackingDashboard: React.FC = () => {
  const { theme } = useDashboardTheme();
  const [allBaas, setAllBaas] = useState<BAA[]>([]);
  const [expiringBaas, setExpiringBaas] = useState<BAA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [listResult, expiringResult] = await Promise.all([
        baaTrackingService.listBAAs(),
        baaTrackingService.getExpiringBAAs(90),
      ]);

      if (!listResult.success) {
        setError(listResult.error.message);
        return;
      }

      setAllBaas(listResult.data);
      setExpiringBaas(expiringResult.success ? expiringResult.data : []);

      await auditLogger.info('BAA_DASHBOARD_LOADED', {
        totalBaas: listResult.data.length,
        expiringCount: expiringResult.success ? expiringResult.data.length : 0,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('BAA_DASHBOARD_LOAD_FAILED', e);
      setError('Failed to load Business Associate Agreements. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const expiringIds = new Set(expiringBaas.map(b => b.id));
  const stats = computeStats(allBaas, expiringBaas);
  const filteredBaas = filterBAAs(allBaas, expiringIds, statusFilter);

  // -- Loading State --
  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        role="status"
        aria-label="Loading business associate agreements"
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--ea-primary,#00857a)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading BAA data...</span>
      </div>
    );
  }

  // -- Error State (no data) --
  if (error && allBaas.length === 0) {
    return (
      <div className="p-6" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Unable to load BAA data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-base font-medium"
            aria-label="Retry loading BAA data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Business Associate Agreement Tracking
          </h2>
          <p className="text-gray-500 mt-1">45 CFR 164.502(e) Compliance</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 ${theme.buttonPrimary} rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] text-base font-medium disabled:opacity-50`}
          aria-label="Refresh BAA data"
        >
          Refresh
        </button>
      </div>

      {/* Inline error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Expiring Soon Alert */}
      {expiringBaas.length > 0 && (
        <div
          className="bg-amber-50 border border-amber-300 rounded-lg p-4"
          role="alert"
          aria-label="Expiring BAAs warning"
        >
          <p className="text-amber-800 font-semibold">
            {expiringBaas.length} agreement{expiringBaas.length !== 1 ? 's' : ''} expiring within 90 days
          </p>
          <ul className="mt-2 space-y-1">
            {expiringBaas.slice(0, 5).map(baa => (
              <li key={baa.id} className="text-amber-700 text-sm">
                {baa.associate_name} &mdash; expires{' '}
                {baa.expiration_date ? formatDate(baa.expiration_date) : 'unknown'}
                {baa.expiration_date && (
                  <span className="font-medium ml-1">
                    ({daysUntil(baa.expiration_date)} days)
                  </span>
                )}
              </li>
            ))}
            {expiringBaas.length > 5 && (
              <li className="text-amber-600 text-sm italic">
                and {expiringBaas.length - 5} more...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'all' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'all'}
          aria-label={`Show all BAAs: ${stats.total}`}
        >
          <p className="text-sm text-gray-500">Total BAAs</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </button>

        <button
          onClick={() => setStatusFilter('active')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'active' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'active'}
          aria-label={`Show active BAAs: ${stats.active}`}
        >
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-3xl font-bold text-green-600">{stats.active}</p>
        </button>

        <button
          onClick={() => setStatusFilter('expiring')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'expiring' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'expiring'}
          aria-label={`Show expiring BAAs: ${stats.expiringSoon}`}
        >
          <p className="text-sm text-gray-500">Expiring Soon</p>
          <p className="text-3xl font-bold text-amber-600">{stats.expiringSoon}</p>
        </button>

        <button
          onClick={() => setStatusFilter('expired')}
          className={`p-4 rounded-lg border-2 text-left min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] ${
            statusFilter === 'expired' ? 'border-[var(--ea-primary,#00857a)] bg-[var(--ea-primary,#00857a)]/10' : 'border-gray-200 bg-white'
          }`}
          aria-pressed={statusFilter === 'expired'}
          aria-label={`Show expired BAAs: ${stats.expired}`}
        >
          <p className="text-sm text-gray-500">Expired</p>
          <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
        </button>
      </div>

      {/* BAA List */}
      {filteredBaas.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-lg">No business associate agreements found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBaas.map(baa => {
            const statusStyle = STATUS_STYLES[baa.status];
            const isExpiring = expiringIds.has(baa.id);

            return (
              <div
                key={baa.id}
                className={`bg-white border rounded-lg p-5 shadow-sm ${
                  isExpiring ? 'border-amber-300' : 'border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {baa.associate_name}
                      </h3>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                        aria-label={`Status: ${statusStyle.label}`}
                      >
                        {statusStyle.label}
                      </span>
                      {isExpiring && (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                          Expiring Soon
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 text-sm mt-1">
                      {ASSOCIATE_TYPE_LABELS[baa.associate_type] ?? baa.associate_type} &mdash;{' '}
                      {baa.service_description}
                    </p>

                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                      {baa.effective_date && (
                        <span>Effective: {formatDate(baa.effective_date)}</span>
                      )}
                      {baa.expiration_date ? (
                        <span className={isExpiring ? 'text-amber-700 font-medium' : ''}>
                          Expires: {formatDate(baa.expiration_date)}
                          {isExpiring && ` (${daysUntil(baa.expiration_date)} days)`}
                        </span>
                      ) : (
                        <span>No expiration date</span>
                      )}
                      {baa.auto_renew && (
                        <span className="text-[var(--ea-primary,#00857a)]">Auto-renew enabled</span>
                      )}
                    </div>

                    {baa.contact_name && (
                      <p className="text-gray-500 text-sm mt-1">
                        Contact: {baa.contact_name}
                        {baa.contact_email ? ` (${baa.contact_email})` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BAATrackingDashboard;
