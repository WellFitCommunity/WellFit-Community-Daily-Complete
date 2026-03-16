/**
 * HCCOpportunityDashboard - HCC Opportunity Flags for Medicare Advantage
 *
 * Purpose: Surfaces expiring, documented, and suspected HCC diagnoses
 * to maximize risk adjustment factor (RAF) scores. Displays revenue
 * impact, confidence levels, and actionable evidence for each opportunity.
 *
 * Used by: revenueSections.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  XCircle,
  Target,
  Eye,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { hccOpportunityService } from '../../services/hccOpportunityService';
import type {
  HCCOpportunity,
  HCCOpportunityStats,
  HCCOpportunityType,
} from '../../services/hccOpportunityService';
import { auditLogger } from '../../services/auditLogger';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';

// =============================================================================
// TYPES
// =============================================================================

type TypeFilter = 'all' | HCCOpportunityType;

// =============================================================================
// HELPERS
// =============================================================================

const TYPE_LABELS: Record<HCCOpportunityType, string> = {
  expiring_hcc: 'Expiring HCC',
  suspected_hcc: 'Suspected HCC',
  documented_hcc: 'Documented HCC',
};

const TYPE_BADGE_VARIANT: Record<HCCOpportunityType, 'critical' | 'elevated' | 'info'> = {
  expiring_hcc: 'critical',
  suspected_hcc: 'elevated',
  documented_hcc: 'info',
};

function formatDollars(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function MetricCard({ label, value, color }: {
  label: string;
  value: string | number;
  color: 'purple' | 'red' | 'orange' | 'blue';
}) {
  const colorMap = {
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function DetailModal({ opportunity, onClose }: {
  opportunity: HCCOpportunity;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="HCC opportunity details"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">HCC Opportunity Details</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Type</span>
            <EABadge variant={TYPE_BADGE_VARIANT[opportunity.opportunity_type]} size="sm">
              {TYPE_LABELS[opportunity.opportunity_type]}
            </EABadge>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">ICD-10 Code</span>
            <span className="font-mono font-medium">{opportunity.icd10_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">ICD-10 Description</span>
            <span className="font-medium text-right max-w-[250px]">{opportunity.icd10_description ?? 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">HCC Category</span>
            <span className="font-mono font-medium text-purple-700">{opportunity.hcc_code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">HCC Description</span>
            <span className="font-medium text-right max-w-[250px]">{opportunity.hcc_description}</span>
          </div>

          <hr className="my-3" />

          <div className="flex justify-between">
            <span className="text-gray-500">RAF Score Impact</span>
            <span className="font-bold text-orange-700">+{opportunity.raf_score_impact.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Annual Payment Impact</span>
            <span className="font-bold text-red-700">{formatDollars(opportunity.annual_payment_impact)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Confidence</span>
            <span>{Math.round(opportunity.confidence * 100)}%</span>
          </div>

          <hr className="my-3" />

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Evidence</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3">
              <span className="font-medium text-gray-900">{opportunity.evidence_source}:</span>{' '}
              {opportunity.evidence_detail}
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Close</EAButton>
        </div>
      </div>
    </div>
  );
}

function DismissModal({ opportunity, onClose, onDismiss }: {
  opportunity: HCCOpportunity;
  onClose: () => void;
  onDismiss: (id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onDismiss(opportunity.id, reason);
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Dismiss HCC opportunity"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Dismiss Opportunity</h3>
        <p className="text-sm text-gray-600 mb-4">
          Dismiss HCC opportunity for <strong>{opportunity.hcc_code}</strong> ({opportunity.icd10_code}) with annual impact of {formatDollars(opportunity.annual_payment_impact)}.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dismiss-reason">
          Reason for dismissal (minimum 20 characters)
        </label>
        <textarea
          id="dismiss-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] text-sm"
          rows={3}
          placeholder="Provider reviewed and determined this HCC has been captured elsewhere or does not apply because..."
        />
        <div className="flex justify-end gap-2 mt-4">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={reason.trim().length < 20}
          >
            Dismiss
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const HCCOpportunityDashboard: React.FC = () => {
  useDashboardTheme();
  const [opportunities, setOpportunities] = useState<HCCOpportunity[]>([]);
  const [stats, setStats] = useState<HCCOpportunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [confidenceFilter, setConfidenceFilter] = useState(0.70);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTarget, setDetailTarget] = useState<HCCOpportunity | null>(null);
  const [dismissTarget, setDismissTarget] = useState<HCCOpportunity | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [oppsRes, statsRes] = await Promise.all([
      hccOpportunityService.getHCCOpportunities({ min_confidence: confidenceFilter }),
      hccOpportunityService.getHCCStats(),
    ]);

    if (!oppsRes.success) {
      setError(oppsRes.error.message);
      setOpportunities([]);
    } else {
      setOpportunities(oppsRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, [confidenceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredOpps = opportunities.filter(o => {
    if (dismissedIds.has(o.id)) return false;
    if (typeFilter !== 'all' && o.opportunity_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !o.icd10_code.toLowerCase().includes(q) &&
        !o.hcc_code.toLowerCase().includes(q) &&
        !(o.icd10_description ?? '').toLowerCase().includes(q) &&
        !o.hcc_description.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleDismiss = async (id: string, reason: string) => {
    try {
      const result = await hccOpportunityService.dismissOpportunity(id, reason);
      if (!result.success) {
        setError(result.error.message);
      } else {
        setDismissedIds(prev => new Set([...prev, id]));
        setDismissTarget(null);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('HCC_DISMISS_UI_FAILED', e);
      setError('Failed to dismiss opportunity. Please try again.');
    }
  };

  const REVENUE_ALERT_THRESHOLD = 50000;

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Analyzing HCC opportunities...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4" aria-label="HCC Opportunity Dashboard">
      {/* Revenue Impact Alert */}
      {(stats?.total_annual_impact ?? 0) > REVENUE_ALERT_THRESHOLD && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {formatDollars(stats?.total_annual_impact ?? 0)} in annual risk adjustment revenue at risk across {stats?.patients_with_gaps ?? 0} patients with HCC gaps.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Opportunities"
          value={stats?.total_opportunities ?? 0}
          color="purple"
        />
        <MetricCard
          label="Annual Revenue Impact"
          value={formatDollars(stats?.total_annual_impact ?? 0)}
          color="red"
        />
        <MetricCard
          label="Avg RAF Impact / Patient"
          value={`+${(stats?.avg_raf_impact_per_patient ?? 0).toFixed(3)}`}
          color="orange"
        />
        <MetricCard
          label="Patients with Gaps"
          value={stats?.patients_with_gaps ?? 0}
          color="blue"
        />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Opportunities Table */}
      <EACard>
        <EACardHeader
          icon={<Target className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          HCC Opportunities
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as TypeFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by opportunity type"
            >
              <option value="all">All Types</option>
              <option value="expiring_hcc">Expiring HCC</option>
              <option value="suspected_hcc">Suspected HCC</option>
              <option value="documented_hcc">Documented HCC</option>
            </select>

            <select
              value={String(confidenceFilter)}
              onChange={e => setConfidenceFilter(parseFloat(e.target.value))}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by confidence"
            >
              <option value="0.50">50%+ Confidence</option>
              <option value="0.70">70%+ Confidence</option>
              <option value="0.85">85%+ Confidence</option>
              <option value="0.95">95%+ Confidence</option>
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search ICD-10 or HCC..."
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] w-52"
              aria-label="Search codes"
            />
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-24">Date</span>
            <span className="w-24">Type</span>
            <span className="w-20">ICD-10</span>
            <span className="w-20">HCC</span>
            <span className="w-16 flex items-center gap-1"><DollarSign className="w-3 h-3" /> RAF</span>
            <span className="w-24">Annual Impact</span>
            <span className="w-16">Conf.</span>
            <span className="w-28">Evidence</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredOpps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No HCC opportunities detected</p>
              <p className="text-xs mt-1">
                {opportunities.length === 0
                  ? 'All HCC diagnoses are current and documented.'
                  : 'No opportunities match the current filters.'}
              </p>
            </div>
          ) : (
            filteredOpps.map(opp => (
              <div
                key={opp.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <span className="w-24 text-sm text-gray-600">
                  {formatDate(opp.date_of_service)}
                </span>

                <span className="w-24">
                  <EABadge variant={TYPE_BADGE_VARIANT[opp.opportunity_type]} size="sm">
                    {TYPE_LABELS[opp.opportunity_type]}
                  </EABadge>
                </span>

                <span className="w-20 text-sm font-mono font-medium text-gray-900">
                  {opp.icd10_code}
                </span>

                <span className="w-20 text-sm font-mono font-medium text-purple-700">
                  {opp.hcc_code}
                </span>

                <span className="w-16 text-sm font-semibold text-orange-700">
                  +{opp.raf_score_impact.toFixed(3)}
                </span>

                <span className="w-24 text-sm font-semibold text-red-700">
                  {formatDollars(opp.annual_payment_impact)}
                </span>

                <span className="w-16 text-sm text-gray-600">
                  {Math.round(opp.confidence * 100)}%
                </span>

                <span className="w-28 text-xs text-gray-500 truncate" title={opp.evidence_source}>
                  {opp.evidence_source}
                </span>

                <span className="flex-1 flex gap-2 justify-end">
                  <EAButton variant="primary" size="sm" onClick={() => setDetailTarget(opp)}>
                    <Eye className="w-3 h-3 mr-1" />
                    Detail
                  </EAButton>
                  <EAButton variant="ghost" size="sm" onClick={() => setDismissTarget(opp)}>
                    <XCircle className="w-3 h-3 mr-1" />
                    Dismiss
                  </EAButton>
                </span>
              </div>
            ))
          )}
        </EACardContent>
      </EACard>

      {/* Detail Modal */}
      {detailTarget && (
        <DetailModal
          opportunity={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Dismiss Modal */}
      {dismissTarget && (
        <DismissModal
          opportunity={dismissTarget}
          onClose={() => setDismissTarget(null)}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
};

export default HCCOpportunityDashboard;
