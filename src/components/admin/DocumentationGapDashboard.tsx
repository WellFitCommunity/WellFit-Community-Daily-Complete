/**
 * DocumentationGapDashboard - Pre-Billing Documentation Gap Indicator
 *
 * Purpose: Proactively shows providers what to document before billing to
 * qualify for higher E/M levels. Displays actionable steps, revenue
 * opportunities, and gap categories (time, diagnosis, data complexity, risk).
 *
 * Used by: revenueSections.tsx (revenue category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import {
  RefreshCw,
  Filter,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  XCircle,
  FileText,
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
import {
  documentationGapService,
} from '../../services/documentationGapService';
import type {
  DocumentationGap,
  DocumentationGapStats,
  DocumentationGapCategory,
  DocumentationGapPriority,
} from '../../services/documentationGapService';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type CategoryFilter = 'all' | DocumentationGapCategory;
type PriorityFilter = 'all' | DocumentationGapPriority;

// =============================================================================
// HELPERS
// =============================================================================

const CATEGORY_LABELS: Record<DocumentationGapCategory, string> = {
  time_gap: 'Time Gap',
  diagnosis_gap: 'Diagnosis Gap',
  data_complexity_gap: 'Data Complexity',
  risk_gap: 'Risk Level',
};

const CATEGORY_BADGE_VARIANT: Record<DocumentationGapCategory, 'elevated' | 'critical' | 'high' | 'info'> = {
  time_gap: 'elevated',
  diagnosis_gap: 'critical',
  data_complexity_gap: 'high',
  risk_gap: 'info',
};

const PRIORITY_BADGE_VARIANT: Record<DocumentationGapPriority, 'critical' | 'elevated' | 'normal'> = {
  high: 'critical',
  medium: 'elevated',
  low: 'normal',
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
    blue: 'bg-[var(--ea-primary,#00857a)]/5 border-[var(--ea-primary,#00857a)]/20 text-[var(--ea-primary,#00857a)]',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function DetailModal({ gap, onClose, onAcknowledge }: {
  gap: DocumentationGap;
  onClose: () => void;
  onAcknowledge: (gapId: string, encounterId: string) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleAcknowledge = async () => {
    setSubmitting(true);
    await onAcknowledge(gap.id, gap.encounter_id);
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-label="Documentation gap details"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation Gap Details</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Date of Service</span>
            <span className="font-medium">{formatDate(gap.date_of_service)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Current Code</span>
            <span className="font-mono font-medium">{gap.current_em_code} ({formatDollars(gap.current_charge)})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Target Code</span>
            <span className="font-mono font-medium text-green-700">{gap.target_em_code} ({formatDollars(gap.target_charge)})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Revenue Opportunity</span>
            <span className="font-bold text-red-700">{formatDollars(gap.revenue_opportunity)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Confidence</span>
            <span>{Math.round(gap.confidence * 100)}%</span>
          </div>

          <hr className="my-3" />

          <p className="font-medium text-gray-900">{gap.gap_description}</p>

          <div className="mt-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Actionable Steps</p>
            <ul className="space-y-1">
              {gap.actionable_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-[var(--ea-primary,#00857a)] font-bold mt-0.5">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <EAButton variant="ghost" size="sm" onClick={onClose}>Close</EAButton>
          <EAButton
            variant="primary"
            size="sm"
            onClick={handleAcknowledge}
            loading={submitting}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Acknowledge
          </EAButton>
        </div>
      </div>
    </div>
  );
}

function DismissModal({ gap, onClose, onDismiss }: {
  gap: DocumentationGap;
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
      aria-label="Dismiss documentation gap"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Dismiss Gap</h3>
        <p className="text-sm text-gray-600 mb-4">
          Dismiss documentation gap for <strong>{gap.current_em_code}</strong> &rarr; <strong>{gap.target_em_code}</strong> on encounter from {formatDate(gap.date_of_service)}.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="dismiss-reason">
          Reason for dismissal
        </label>
        <textarea
          id="dismiss-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] text-sm"
          rows={3}
          placeholder="Provider reviewed and determined the current documentation level is appropriate because..."
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

const DocumentationGapDashboard: React.FC = () => {
  useDashboardTheme();
  const [gaps, setGaps] = useState<DocumentationGap[]>([]);
  const [stats, setStats] = useState<DocumentationGapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);
  const [detailTarget, setDetailTarget] = useState<DocumentationGap | null>(null);
  const [dismissTarget, setDismissTarget] = useState<DocumentationGap | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [gapsRes, statsRes] = await Promise.all([
      documentationGapService.getDocumentationGaps({ min_confidence: confidenceThreshold }),
      documentationGapService.getDocumentationGapStats(),
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
    if (categoryFilter !== 'all' && g.category !== categoryFilter) return false;
    if (priorityFilter !== 'all' && g.priority !== priorityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !g.current_em_code.toLowerCase().includes(q) &&
        !g.target_em_code.toLowerCase().includes(q) &&
        !g.gap_description.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleDismiss = async (gapId: string, reason: string) => {
    try {
      const result = await documentationGapService.dismissGap(gapId, reason);
      if (!result.success) {
        setError(result.error.message);
      } else {
        setDismissedIds(prev => new Set([...prev, gapId]));
        setDismissTarget(null);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('DOC_GAP_DISMISS_UI_FAILED', e);
      setError('Failed to dismiss gap. Please try again.');
    }
  };

  const handleAcknowledge = async (gapId: string, encounterId: string) => {
    try {
      const result = await documentationGapService.acknowledgeGap(gapId, encounterId);
      if (!result.success) {
        setError(result.error.message);
      } else {
        setDetailTarget(null);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('DOC_GAP_ACKNOWLEDGE_UI_FAILED', e);
      setError('Failed to acknowledge gap. Please try again.');
    }
  };

  const REVENUE_ALERT_THRESHOLD = 5000;

  // --- Loading state ---
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Analyzing documentation gaps...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4" aria-label="Documentation Gap Dashboard">
      {/* Revenue Opportunity Alert */}
      {(stats?.total_revenue_opportunity ?? 0) > REVENUE_ALERT_THRESHOLD && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {formatDollars(stats?.total_revenue_opportunity ?? 0)} in documentation-driven revenue opportunity across {stats?.encounters_with_gaps ?? 0} encounters.
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
          label="Avg Opportunity / Encounter"
          value={formatDollars(stats?.avg_opportunity_per_encounter ?? 0)}
          color="orange"
        />
        <MetricCard
          label="Encounters with Gaps"
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
          icon={<FileText className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Documentation Gaps
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              <option value="time_gap">Time Gap</option>
              <option value="diagnosis_gap">Diagnosis Gap</option>
              <option value="data_complexity_gap">Data Complexity</option>
              <option value="risk_gap">Risk Level</option>
            </select>

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as PriorityFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={String(confidenceThreshold)}
              onChange={e => setConfidenceThreshold(parseFloat(e.target.value))}
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)]"
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
              className="text-sm rounded-md border-gray-300 shadow-sm focus-visible:ring-[var(--ea-primary,#00857a)] focus-visible:border-[var(--ea-primary,#00857a)] w-48"
              aria-label="Search codes"
            />
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-24">Date</span>
            <span className="w-20">Current</span>
            <span className="w-20">Target</span>
            <span className="w-28 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Opportunity</span>
            <span className="w-28">Category</span>
            <span className="w-20">Priority</span>
            <span className="w-20">Confidence</span>
            <span className="flex-1 text-right">Actions</span>
          </div>

          {/* Rows */}
          {filteredGaps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-300" />
              <p className="text-sm font-medium">No documentation gaps detected</p>
              <p className="text-xs mt-1">
                {gaps.length === 0
                  ? 'All encounters coded at optimal level.'
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

                <span className="w-20 text-sm font-mono font-medium text-gray-900">
                  {gap.current_em_code}
                </span>

                <span className="w-20 text-sm font-mono font-medium text-green-700">
                  {gap.target_em_code}
                </span>

                <span className="w-28 text-sm font-semibold text-red-700">
                  {formatDollars(gap.revenue_opportunity)}
                </span>

                <span className="w-28">
                  <EABadge
                    variant={CATEGORY_BADGE_VARIANT[gap.category]}
                    size="sm"
                  >
                    {CATEGORY_LABELS[gap.category]}
                  </EABadge>
                </span>

                <span className="w-20">
                  <EABadge
                    variant={PRIORITY_BADGE_VARIANT[gap.priority]}
                    size="sm"
                  >
                    {gap.priority}
                  </EABadge>
                </span>

                <span className="w-20 text-sm text-gray-600">
                  {Math.round(gap.confidence * 100)}%
                </span>

                <span className="flex-1 flex gap-2 justify-end">
                  <EAButton
                    variant="primary"
                    size="sm"
                    onClick={() => setDetailTarget(gap)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Details
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

      {/* Detail Modal */}
      {detailTarget && (
        <DetailModal
          gap={detailTarget}
          onClose={() => setDetailTarget(null)}
          onAcknowledge={handleAcknowledge}
        />
      )}

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

export default DocumentationGapDashboard;
