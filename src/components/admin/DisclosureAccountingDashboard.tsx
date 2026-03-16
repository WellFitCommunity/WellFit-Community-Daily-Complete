/**
 * DisclosureAccountingDashboard - Accounting of Disclosures Management
 *
 * Purpose: Admin dashboard for tracking PHI disclosures per HIPAA requirements
 * Used by: Admin compliance section (sectionDefinitions.tsx)
 * Auth: admin/super_admin/compliance_officer only
 * Regulation: 45 CFR 164.528
 *
 * Features:
 *  - Disclosure count summary
 *  - Recent disclosures table (date, recipient, purpose, PHI types)
 *  - Date range filter
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  disclosureAccountingService,
  type Disclosure,
  type RecipientType,
} from '../../services/disclosureAccountingService';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

interface DisclosureStats {
  total: number;
  electronic: number;
  verbal: number;
  other: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  healthcare_provider: 'Healthcare Provider',
  health_plan: 'Health Plan',
  public_health: 'Public Health',
  law_enforcement: 'Law Enforcement',
  research: 'Research',
  judicial: 'Judicial',
  organ_procurement: 'Organ Procurement',
  coroner: 'Coroner/Medical Examiner',
  workers_comp: "Workers' Compensation",
  government_program: 'Government Program',
  abuse_report: 'Abuse Report',
  other: 'Other',
};

const METHOD_LABELS: Record<string, string> = {
  electronic: 'Electronic',
  fax: 'Fax',
  mail: 'Mail',
  verbal: 'Verbal',
  in_person: 'In Person',
  portal: 'Portal',
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

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return {
    from: sixMonthsAgo.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
}

function computeStats(disclosures: Disclosure[]): DisclosureStats {
  return {
    total: disclosures.length,
    electronic: disclosures.filter(d => d.disclosure_method === 'electronic' || d.disclosure_method === 'portal').length,
    verbal: disclosures.filter(d => d.disclosure_method === 'verbal' || d.disclosure_method === 'in_person').length,
    other: disclosures.filter(d => d.disclosure_method === 'fax' || d.disclosure_method === 'mail').length,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

const DisclosureAccountingDashboard: React.FC = () => {
  const { theme } = useDashboardTheme();
  const defaultRange = getDefaultDateRange();
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await disclosureAccountingService.getDisclosureReport(dateFrom, dateTo);

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setDisclosures(result.data);

      await auditLogger.info('DISCLOSURE_DASHBOARD_LOADED', {
        totalDisclosures: result.data.length,
        dateFrom,
        dateTo,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('DISCLOSURE_DASHBOARD_LOAD_FAILED', e);
      setError('Failed to load disclosure data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = computeStats(disclosures);

  // -- Loading State --
  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-12"
        role="status"
        aria-label="Loading disclosure accounting data"
      >
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--ea-primary,#00857a)]" />
        <span className="ml-3 text-gray-600 text-lg">Loading disclosure data...</span>
      </div>
    );
  }

  // -- Error State (no data) --
  if (error && disclosures.length === 0) {
    return (
      <div className="p-6" role="alert">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Unable to load disclosure data</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 min-h-[44px] min-w-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 text-base font-medium"
            aria-label="Retry loading disclosure data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label="Disclosure Accounting Dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Accounting of Disclosures
          </h2>
          <p className="text-gray-500 mt-1">45 CFR 164.528 Compliance</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className={`min-h-[44px] min-w-[44px] px-4 py-2 ${theme.buttonPrimary} rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)] text-base font-medium disabled:opacity-50`}
          aria-label="Refresh disclosure data"
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

      {/* Date Range Filter */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="date-from" className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-[44px] w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="date-to" className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-[44px] w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-500">Total Disclosures</p>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-500">Electronic/Portal</p>
          <p className="text-3xl font-bold text-[var(--ea-primary,#00857a)]">{stats.electronic}</p>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-500">Verbal/In-Person</p>
          <p className="text-3xl font-bold text-amber-600">{stats.verbal}</p>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-500">Fax/Mail</p>
          <p className="text-3xl font-bold text-gray-600">{stats.other}</p>
        </div>
      </div>

      {/* Disclosures Table */}
      {disclosures.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 text-lg">No disclosures found for the selected date range.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200" aria-label="PHI disclosures">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Recipient
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Purpose
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  Method
                </th>
                <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  PHI Types
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {disclosures.map((disc) => (
                <tr key={disc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {formatDate(disc.disclosure_date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {disc.recipient_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {RECIPIENT_TYPE_LABELS[disc.recipient_type] ?? disc.recipient_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                    {disc.purpose}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {METHOD_LABELS[disc.disclosure_method] ?? disc.disclosure_method}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {disc.phi_types_disclosed.length > 0
                      ? disc.phi_types_disclosed.join(', ')
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DisclosureAccountingDashboard;
