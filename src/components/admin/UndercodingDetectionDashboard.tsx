/**
 * UndercodingDetectionDashboard - AI vs Billed Code Comparison
 *
 * Purpose: Compares AI-suggested billing codes against actually billed codes
 * to flag revenue gaps from undercoding (lower E/M levels, missed charges,
 * lower-value code substitutions).
 *
 * Used by: sectionDefinitions.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  XCircle,
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
  undercodingDetectionService,
} from '../../services/undercodingDetectionService';
import type {
  UndercodingGap,
  UndercodingStats,
  GapType,
} from '../../services/undercodingDetectionService';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type GapTypeFilter = 'all' | GapType;

// =============================================================================
// HELPERS
// =============================================================================

const GAP_TYPE_LABELS: Record<GapType, string> = {
  lower_em_level: 'Lower E/M Level',
  missed_code: 'Missed Charge',
  lower_value_code: 'Lower Value Code',
};

const GAP_TYPE_BADGE_VARIANT: Record<GapType, 'elevated' | 'critical' | 'high'> = {
  lower_em_level: 'elevated',
  missed_code: 'critical',
  lower_value_code: 'high',
};

function formatDollars(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  color: 'green' | 'orange' | 'red' | 'blue';
}) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function DismissModal({ gap, onClose, onDismiss }: {
  gap: UndercodingGap;
  onClose: () => void;
  onDismiss: (gapId: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onDismiss(gap.id, reason);
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Dismiss undercoding gap"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Dismiss Gap</h3>
        <p className="text-sm text-gray-600 mb-4">
          Dismiss suggestion for code <strong>{gap.suggested_code}</strong> on encounter from {formatDate(gap.date_of_service)}.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dismiss-reason">
          Reason for dismissal
        </label>
        <textarea
          id="dismiss-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
          rows={3}
          placeholder="Provider reviewed and determined the current coding is correct because..."
        />
        <div className="flex justify-end gap-2 mt-4">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Cancel</EAButton>
          <EAButton
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!reason.trim()}
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

const UndercodingDetectionDashboard: React.FC = () => {
  const [gaps, setGaps] = useState<UndercodingGap[]>([]);
  const [stats, setStats] = useState<UndercodingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gapTypeFilter, setGapTypeFilter] = useState<GapTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [dismissTarget, setDismissTarget] = useState<UndercodingGap | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [gapsRes, statsRes] = await Promise.all([
      undercodingDetectionService.getUndercodingGaps({ min_confidence: confidenceThreshold }),
      undercodingDetectionService.getUndercodingStats(),
    ]);

    if (!gapsRes.success) {
      setError(gapsRes.error.message);
      setGaps([]);
    } else {
      setGaps(gapsRes.data);
    }

    if (statsRes.success) {
      setStats(statsRes.data);
    }

    setLoading(false);
  }, [confidenceThreshold]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredGaps = gaps.filter(g => {
    if (dismissedIds.has(g.id)) return false;
    if (gapTypeFilter !== 'all' && g.gap_type !== gapTypeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !g.suggested_code.toLowerCase().includes(q) &&
        !(g.billed_code ?? '').toLowerCase().includes(q) &&
        !(g.suggested_description ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleDismiss = async (gapId: string, reason: string) => {
    try {
      const result = await undercodingDetectionService.dismissGap(gapId, reason);
      if (!result.success) {
        setError(result.error.message);
      } else {
        setDismissedIds(prev => new Set([...prev, gapId]));
        setDismissTarget(null);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('UNDERCODING_DISMISS_UI_FAILED', e);
      setError('Failed to dismiss gap. Please try again.');
    }
  };

  // Revenue opportunity threshold for alert banner
  const REVENUE_ALERT_THRESHOLD = 5000;

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600">Analyzing coding gaps...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Revenue Opportunity Alert */}
      {(stats?.total_revenue_opportunity ?? 0) > REVENUE_ALERT_THRESHOLD && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {formatDollars(stats?.total_revenue_opportunity ?? 0)} in potential revenue identified across {stats?.encounters_with_gaps ?? 0} encounters — review recommended.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Gaps"
          value={stats?.total_gaps ?? 0}
          color="blue"
        />
        <MetricCard
          label="Revenue Opportunity"
          value={formatDollars(stats?.total_revenue_opportunity ?? 0)}
          color="red"
        />
        <MetricCard
          label="Avg Gap / Encounter"
          value={formatDollars(stats?.avg_gap_per_encounter ?? 0)}
          color="orange"
        />
        <MetricCard
          label="Encounters Affected"
          value={stats?.encounters_with_gaps ?? 0}
          color="green"
        />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Gaps Table */}
      <EACard>
        <EACardHeader
          icon={<Search className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Undercoding Gaps
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={gapTypeFilter}
              onChange={e => setGapTypeFilter(e.target.value as GapTypeFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by gap type"
            >
              <option value="all">All Gap Types</option>
              <option value="lower_em_level">Lower E/M Level</option>
              <option value="missed_code">Missed Charge</option>
              <option value="lower_value_code">Lower Value Code</option>
            </select>

            <select
              value={String(confidenceThreshold)}
              onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by confidence threshold"
            >
              <option value="0.50">50%+ Confidence</option>
              <option value="0.75">75%+ Confidence</option>
              <option value="0.85">85%+ Confidence</option>
              <option value="0.95">95%+ Confidence</option>
            </select>

            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search codes..."
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 w-48"
              aria-label="Search codes"
            />
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-24">Date</span>
            <span className="w-24">Suggested</span>
            <span className="w-24">Billed</span>
            <span className="w-28 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Gap</span>
            <span className="w-20">Confidence</span>
            <span className="w-32">Gap Type</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredGaps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No undercoding gaps detected</p>
              <p className="text-xs mt-1">
                {gaps.length === 0
                  ? 'AI-suggested codes match billed codes.'
                  : 'No gaps match the current filters.'}
              </p>
            </div>
          ) : (
            filteredGaps.map(gap => (
              <div
                key={gap.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <span className="w-24 text-sm text-gray-600">
                  {formatDate(gap.date_of_service)}
                </span>

                <span className="w-24 text-sm font-mono font-medium text-gray-900" title={gap.suggested_description ?? ''}>
                  {gap.suggested_code}
                </span>

                <span className="w-24 text-sm font-mono text-gray-600">
                  {gap.billed_code ?? <span className="text-red-500 italic">None</span>}
                </span>

                <span className="w-28 text-sm font-semibold text-red-700">
                  {formatDollars(gap.revenue_gap)}
                </span>

                <span className="w-20 text-sm text-gray-600">
                  {Math.round(gap.confidence * 100)}%
                </span>

                <span className="w-32">
                  <EABadge
                    variant={GAP_TYPE_BADGE_VARIANT[gap.gap_type]}
                    size="sm"
                  >
                    {GAP_TYPE_LABELS[gap.gap_type]}
                  </EABadge>
                </span>

                <span className="flex-1 flex gap-2 justify-end">
                  <EAButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      auditLogger.info('UNDERCODING_GAP_REVIEWED', {
                        gapId: gap.id,
                        suggestedCode: gap.suggested_code,
                      });
                    }}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Review
                  </EAButton>
                  <EAButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setDismissTarget(gap)}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Dismiss
                  </EAButton>
                </span>
              </div>
            ))
          )}
        </EACardContent>
      </EACard>

      {/* Dismiss Modal */}
      {dismissTarget && (
        <DismissModal
          gap={dismissTarget}
          onClose={() => setDismissTarget(null)}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
};

export default UndercodingDetectionDashboard;
