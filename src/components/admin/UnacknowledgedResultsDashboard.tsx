/**
 * UnacknowledgedResultsDashboard - Critical Lab/Imaging Result Tracking
 *
 * Purpose: Shows clinicians which diagnostic results are unacknowledged,
 * with aging buckets and priority escalation. Supports acknowledge workflow.
 *
 * Used by: sectionDefinitions.tsx (patient-care category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useDashboardTheme } from '../../hooks/useDashboardTheme';
import {
  AlertTriangle,
  RefreshCw,
  Filter,
  Clock,
  CheckCircle,
  Beaker,
  X,
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
  unacknowledgedResultsService,
} from '../../services/unacknowledgedResultsService';
import type {
  UnacknowledgedResult,
  ResultMetrics,
  AgingStatus,
  AcknowledgmentType,
} from '../../services/unacknowledgedResultsService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type PriorityFilter = 'all' | 'stat' | 'urgent' | 'asap' | 'routine';
type CategoryFilter = 'all' | 'LAB' | 'RAD';
type AgingFilter = 'all' | AgingStatus;

// =============================================================================
// HELPERS
// =============================================================================

function formatPatientName(first: string, last: string): string {
  const initial = first ? first.charAt(0) + '.' : '';
  return `${initial} ${last}`.trim();
}

function formatAge(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m ago`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remainingH = Math.round(hours - days * 24);
  return remainingH > 0 ? `${days}d ${remainingH}h ago` : `${days}d ago`;
}

function getAgingBadgeVariant(status: AgingStatus): 'critical' | 'high' | 'elevated' | 'normal' {
  switch (status) {
    case 'critical': return 'critical';
    case 'overdue': return 'high';
    case 'warning': return 'elevated';
    default: return 'normal';
  }
}

function getPriorityBadgeVariant(priority: string | null): 'critical' | 'high' | 'elevated' | 'neutral' {
  switch (priority) {
    case 'stat': return 'critical';
    case 'urgent': return 'high';
    case 'asap': return 'elevated';
    default: return 'neutral';
  }
}

const ACK_TYPE_LABELS: Record<AcknowledgmentType, string> = {
  read_only: 'Read Only',
  reviewed: 'Reviewed',
  action_taken: 'Action Taken',
  escalated: 'Escalated',
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function MetricCard({ label, value, variant }: {
  label: string;
  value: number | string;
  variant: 'default' | 'critical' | 'warning' | 'success';
}) {
  const colors = {
    default: 'bg-white border-gray-200 text-gray-900',
    critical: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-green-50 border-green-200 text-green-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[variant]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function AcknowledgeModal({ result, onConfirm, onClose }: {
  result: UnacknowledgedResult;
  onConfirm: (type: AcknowledgmentType, notes: string) => void;
  onClose: () => void;
}) {
  const [ackType, setAckType] = useState<AcknowledgmentType>('reviewed');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onConfirm(ackType, notes);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label="Acknowledge result">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Acknowledge Result</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-900">{result.code_display}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatPatientName(result.first_name, result.last_name)} &middot; {formatAge(result.hours_since_issued)}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Acknowledgment Type
          </label>
          <select
            value={ackType}
            onChange={e => setAckType(e.target.value as AcknowledgmentType)}
            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
            aria-label="Acknowledgment type"
          >
            {(Object.entries(ACK_TYPE_LABELS)).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Clinical notes about this result..."
            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
            rows={3}
            aria-label="Acknowledgment notes"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <EAButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </EAButton>
          <EAButton variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            <CheckCircle className="w-4 h-4 mr-1" />
            Confirm
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const UnacknowledgedResultsDashboard: React.FC = () => {
  useDashboardTheme();
  const [results, setResults] = useState<UnacknowledgedResult[]>([]);
  const [metrics, setMetrics] = useState<ResultMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [agingFilter, setAgingFilter] = useState<AgingFilter>('all');
  const [ackTarget, setAckTarget] = useState<UnacknowledgedResult | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [resultsRes, metricsRes] = await Promise.all([
      unacknowledgedResultsService.getUnacknowledgedResults(),
      unacknowledgedResultsService.getResultMetrics(),
    ]);

    if (!resultsRes.success) {
      setError(resultsRes.error.message);
      setResults([]);
    } else {
      setResults(resultsRes.data);
    }

    if (metricsRes.success) {
      setMetrics(metricsRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredResults = results.filter(r => {
    if (priorityFilter !== 'all' && r.report_priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && !r.category.includes(categoryFilter)) return false;
    if (agingFilter !== 'all' && r.aging_status !== agingFilter) return false;
    return true;
  });

  const handleAcknowledge = async (type: AcknowledgmentType, notes: string) => {
    if (!ackTarget) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to acknowledge results.');
        setAckTarget(null);
        return;
      }

      const result = await unacknowledgedResultsService.acknowledgeResult(
        ackTarget.id,
        user.id,
        type,
        notes || undefined
      );

      if (!result.success) {
        setError(result.error.message);
      } else {
        // Remove acknowledged result from list and update metrics
        setResults(prev => prev.filter(r => r.id !== ackTarget.id));
        if (metrics) {
          const acked = ackTarget;
          setMetrics(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              total_unacknowledged: prev.total_unacknowledged - 1,
              critical_count: acked.aging_status === 'critical' ? prev.critical_count - 1 : prev.critical_count,
              overdue_count: acked.aging_status === 'overdue' ? prev.overdue_count - 1 : prev.overdue_count,
              warning_count: acked.aging_status === 'warning' ? prev.warning_count - 1 : prev.warning_count,
              by_category: prev.by_category,
              by_priority: prev.by_priority,
            };
          });
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('RESULT_ACKNOWLEDGE_UI_FAILED', error);
      setError('Failed to acknowledge result. Please try again.');
    }

    setAckTarget(null);
  };

  // Compute average age
  const avgAge = results.length > 0
    ? results.reduce((sum, r) => sum + r.hours_since_issued, 0) / results.length
    : 0;

  // ---- Loading state ----
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading unacknowledged results...</span>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Critical Alert Banner */}
      {(metrics?.critical_count ?? 0) > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {metrics?.critical_count} critical result{(metrics?.critical_count ?? 0) !== 1 ? 's' : ''} requiring immediate attention — stat/urgent results past SLA.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total Unacknowledged"
          value={metrics?.total_unacknowledged ?? 0}
          variant="default"
        />
        <MetricCard
          label="Critical"
          value={metrics?.critical_count ?? 0}
          variant={(metrics?.critical_count ?? 0) > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          label="Overdue (>24h)"
          value={metrics?.overdue_count ?? 0}
          variant={(metrics?.overdue_count ?? 0) > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          label="Average Age"
          value={formatAge(avgAge)}
          variant="default"
        />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Results Table */}
      <EACard>
        <EACardHeader
          icon={<Beaker className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Unacknowledged Results
        </EACardHeader>

        <EACardContent className="p-0">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
            <Filter className="w-4 h-4 text-gray-400" />

            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as PriorityFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="stat">Stat</option>
              <option value="urgent">Urgent</option>
              <option value="asap">ASAP</option>
              <option value="routine">Routine</option>
            </select>

            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              <option value="LAB">Lab</option>
              <option value="RAD">Radiology</option>
            </select>

            <select
              value={agingFilter}
              onChange={e => setAgingFilter(e.target.value as AgingFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by aging status"
            >
              <option value="all">All Aging</option>
              <option value="critical">Critical</option>
              <option value="overdue">Overdue</option>
              <option value="warning">Warning</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-32">Patient</span>
            <span className="flex-1">Test</span>
            <span className="w-16">Category</span>
            <span className="w-20">Priority</span>
            <span className="w-24 flex items-center gap-1"><Clock className="w-3 h-3" /> Age</span>
            <span className="w-20">Status</span>
            <span className="w-28">Action</span>
          </div>

          {/* Rows */}
          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Beaker className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No unacknowledged results</p>
              <p className="text-xs mt-1">
                {results.length === 0
                  ? 'All diagnostic results have been reviewed.'
                  : 'No results match the current filters.'}
              </p>
            </div>
          ) : (
            filteredResults.map(result => (
              <div
                key={result.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 w-32 truncate">
                  {formatPatientName(result.first_name, result.last_name)}
                </span>

                <span className="text-sm text-gray-700 flex-1 truncate" title={result.code_display}>
                  {result.code_display}
                </span>

                <span className="w-16">
                  <EABadge variant="info" size="sm">
                    {result.category[0] ?? 'N/A'}
                  </EABadge>
                </span>

                <span className="w-20">
                  <EABadge variant={getPriorityBadgeVariant(result.report_priority)} size="sm">
                    {result.report_priority ?? 'N/A'}
                  </EABadge>
                </span>

                <span className="w-24 text-sm text-gray-600">
                  {formatAge(result.hours_since_issued)}
                </span>

                <span className="w-20">
                  <EABadge
                    variant={getAgingBadgeVariant(result.aging_status)}
                    size="sm"
                    pulse={result.aging_status === 'critical'}
                  >
                    {result.aging_status}
                  </EABadge>
                </span>

                <span className="w-28">
                  <EAButton
                    variant="primary"
                    size="sm"
                    onClick={() => setAckTarget(result)}
                  >
                    Acknowledge
                  </EAButton>
                </span>
              </div>
            ))
          )}
        </EACardContent>
      </EACard>

      {/* Acknowledge Modal */}
      {ackTarget && (
        <AcknowledgeModal
          result={ackTarget}
          onConfirm={handleAcknowledge}
          onClose={() => setAckTarget(null)}
        />
      )}
    </div>
  );
};

export default UnacknowledgedResultsDashboard;
