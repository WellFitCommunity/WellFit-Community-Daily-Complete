/**
 * ProviderTaskQueueDashboard — Provider inbox with SLA tracking and escalation
 *
 * Purpose: Shows pending provider tasks (result reviews, order follow-ups,
 * documentation, referral responses) with overdue alerts, priority filtering,
 * and acknowledge/complete workflows.
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
  Inbox,
  X,
  ArrowUpCircle,
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
  providerTaskService,
} from '../../services/providerTaskService';
import type {
  ProviderTaskQueueRow,
  TaskMetrics,
  TaskType,
  TaskPriority,
  TaskStatus,
} from '../../services/providerTaskService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

// =============================================================================
// TYPES
// =============================================================================

type PriorityFilter = 'all' | TaskPriority;
type TypeFilter = 'all' | TaskType;
type StatusFilter = 'all' | TaskStatus;
type AssignFilter = 'all' | 'mine';

// =============================================================================
// HELPERS
// =============================================================================

function formatPatientName(first: string | null, last: string | null): string {
  if (!first && !last) return 'N/A';
  const initial = first ? first.charAt(0) + '.' : '';
  return `${initial} ${last ?? ''}`.trim();
}

function formatDueAge(dueAt: string | null, minutesPastDue: number, isOverdue: boolean): string {
  if (!dueAt) return 'No deadline';
  if (!isOverdue) {
    const minsLeft = Math.max(0, (new Date(dueAt).getTime() - Date.now()) / 60000);
    if (minsLeft < 60) return `${Math.round(minsLeft)}m left`;
    if (minsLeft < 1440) return `${Math.floor(minsLeft / 60)}h left`;
    return `${Math.floor(minsLeft / 1440)}d left`;
  }
  if (minutesPastDue < 60) return `${Math.round(minutesPastDue)}m overdue`;
  if (minutesPastDue < 1440) return `${Math.floor(minutesPastDue / 60)}h overdue`;
  return `${Math.floor(minutesPastDue / 1440)}d overdue`;
}

function getPriorityBadgeVariant(p: string): 'critical' | 'high' | 'neutral' {
  switch (p) {
    case 'stat': return 'critical';
    case 'urgent': return 'high';
    default: return 'neutral';
  }
}

function getStatusBadgeVariant(s: string): 'critical' | 'high' | 'elevated' | 'info' | 'neutral' {
  switch (s) {
    case 'escalated': return 'critical';
    case 'pending': return 'high';
    case 'acknowledged': return 'elevated';
    case 'in_progress': return 'info';
    default: return 'neutral';
  }
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  result_review: 'Result Review',
  order_followup: 'Order Follow-up',
  documentation: 'Documentation',
  referral_response: 'Referral Response',
  general: 'General',
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

function ActionModal({ task, mode, onConfirm, onClose }: {
  task: ProviderTaskQueueRow;
  mode: 'acknowledge' | 'complete';
  onConfirm: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onConfirm(notes);
    setSubmitting(false);
  };

  const isComplete = mode === 'complete';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-label={isComplete ? 'Complete task' : 'Acknowledge task'}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isComplete ? 'Complete Task' : 'Acknowledge Task'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" type="button" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-900">{task.title}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatPatientName(task.patient_first_name, task.patient_last_name)}
            {' \u00b7 '}
            {TASK_TYPE_LABELS[task.task_type]}
          </p>
        </div>

        {isComplete && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Completion Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes about task completion..."
              className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              rows={3}
              aria-label="Completion notes"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <EAButton variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </EAButton>
          <EAButton variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
            <CheckCircle className="w-4 h-4 mr-1" />
            {isComplete ? 'Mark Complete' : 'Acknowledge'}
          </EAButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ProviderTaskQueueDashboard: React.FC = () => {
  useDashboardTheme();
  const [tasks, setTasks] = useState<ProviderTaskQueueRow[]>([]);
  const [metrics, setMetrics] = useState<TaskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{ task: ProviderTaskQueueRow; mode: 'acknowledge' | 'complete' } | null>(null);

  // Fetch current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [queueRes, metricsRes] = await Promise.all([
      providerTaskService.getTaskQueue(),
      providerTaskService.getTaskMetrics(),
    ]);

    if (!queueRes.success) {
      setError(queueRes.error.message);
      setTasks([]);
    } else {
      setTasks(queueRes.data);
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
  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (typeFilter !== 'all' && t.task_type !== typeFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (assignFilter === 'mine' && currentUserId && t.assigned_to !== currentUserId) return false;
    return true;
  });

  const handleAction = async (notes: string) => {
    if (!actionTarget) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to perform this action.');
        setActionTarget(null);
        return;
      }

      const { task, mode } = actionTarget;
      const result = mode === 'complete'
        ? await providerTaskService.completeTask(task.id, user.id, notes || undefined)
        : await providerTaskService.acknowledgeTask(task.id, user.id);

      if (!result.success) {
        setError(result.error.message);
      } else {
        if (mode === 'complete') {
          // Remove completed from list, update metrics
          setTasks(prev => prev.filter(t => t.id !== task.id));
          if (metrics) {
            setMetrics(prev => prev ? {
              ...prev,
              total_active: prev.total_active - 1,
              overdue: task.is_overdue ? prev.overdue - 1 : prev.overdue,
              completed_today: prev.completed_today + 1,
            } : prev);
          }
        } else {
          // Update status in list
          setTasks(prev => prev.map(t =>
            t.id === task.id ? { ...t, status: 'acknowledged' as const, acknowledged_at: new Date().toISOString() } : t
          ));
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PROVIDER_TASK_ACTION_UI_FAILED', error);
      setError('Failed to perform action. Please try again.');
    }

    setActionTarget(null);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-[var(--ea-primary,#00857a)] mr-3" />
          <span className="text-gray-600">Loading provider task queue...</span>
        </EACardContent>
      </EACard>
    );
  }

  const overdueCount = metrics?.overdue ?? 0;
  const escalatedCount = metrics?.escalated ?? 0;

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      {(overdueCount > 0 || escalatedCount > 0) && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {overdueCount > 0 && `${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}`}
              {overdueCount > 0 && escalatedCount > 0 && ' and '}
              {escalatedCount > 0 && `${escalatedCount} escalated task${escalatedCount !== 1 ? 's' : ''}`}
              {' '}requiring attention.
            </span>
          </div>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Total Active"
          value={metrics?.total_active ?? 0}
          variant="default"
        />
        <MetricCard
          label="Overdue"
          value={overdueCount}
          variant={overdueCount > 0 ? 'critical' : 'default'}
        />
        <MetricCard
          label="Escalated"
          value={escalatedCount}
          variant={escalatedCount > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          label="Completed Today"
          value={metrics?.completed_today ?? 0}
          variant="success"
        />
      </div>

      {/* Error */}
      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>
          {error}
        </EAAlert>
      )}

      {/* Task Table */}
      <EACard>
        <EACardHeader
          icon={<Inbox className="w-5 h-5" />}
          action={
            <EAButton variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </EAButton>
          }
        >
          Provider Task Queue
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
              <option value="routine">Routine</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as TypeFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by task type"
            >
              <option value="all">All Types</option>
              <option value="result_review">Result Review</option>
              <option value="order_followup">Order Follow-up</option>
              <option value="documentation">Documentation</option>
              <option value="referral_response">Referral Response</option>
              <option value="general">General</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by status"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="escalated">Escalated</option>
            </select>

            <select
              value={assignFilter}
              onChange={e => setAssignFilter(e.target.value as AssignFilter)}
              className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-[var(--ea-primary,#00857a)] focus:border-[var(--ea-primary,#00857a)]"
              aria-label="Filter by assignment"
            >
              <option value="all">All Tasks</option>
              <option value="mine">My Tasks</option>
            </select>
          </div>

          {/* Table Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
            <span className="w-28">Patient</span>
            <span className="flex-1">Task</span>
            <span className="w-28">Type</span>
            <span className="w-20">Priority</span>
            <span className="w-24 flex items-center gap-1"><Clock className="w-3 h-3" /> Due</span>
            <span className="w-24">Status</span>
            <span className="w-28">Assigned To</span>
            <span className="w-36">Actions</span>
          </div>

          {/* Rows */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium">No tasks in queue</p>
              <p className="text-xs mt-1">
                {tasks.length === 0
                  ? 'All provider tasks have been completed.'
                  : 'No tasks match the current filters.'}
              </p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <div
                key={task.id}
                className={`flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${task.is_overdue ? 'bg-red-50/50' : ''}`}
              >
                <span className="text-sm font-medium text-gray-900 w-28 truncate">
                  {formatPatientName(task.patient_first_name, task.patient_last_name)}
                </span>

                <span className="text-sm text-gray-700 flex-1 truncate" title={task.title}>
                  {task.title}
                </span>

                <span className="w-28">
                  <EABadge variant="info" size="sm">
                    {TASK_TYPE_LABELS[task.task_type]}
                  </EABadge>
                </span>

                <span className="w-20">
                  <EABadge variant={getPriorityBadgeVariant(task.priority)} size="sm">
                    {task.priority}
                  </EABadge>
                </span>

                <span className={`w-24 text-sm ${task.is_overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                  {formatDueAge(task.due_at, task.minutes_past_due, task.is_overdue)}
                </span>

                <span className="w-24">
                  <EABadge
                    variant={getStatusBadgeVariant(task.status)}
                    size="sm"
                    pulse={task.status === 'escalated'}
                  >
                    {task.status}
                  </EABadge>
                </span>

                <span className="text-sm text-gray-600 w-28 truncate">
                  {formatPatientName(task.assignee_first_name, task.assignee_last_name)}
                </span>

                <span className="w-36 flex gap-1">
                  {task.status === 'pending' && (
                    <EAButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionTarget({ task, mode: 'acknowledge' })}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5 mr-0.5" />
                      Ack
                    </EAButton>
                  )}
                  {task.status !== 'completed' && task.status !== 'cancelled' && (
                    <EAButton
                      variant="primary"
                      size="sm"
                      onClick={() => setActionTarget({ task, mode: 'complete' })}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-0.5" />
                      Done
                    </EAButton>
                  )}
                </span>
              </div>
            ))
          )}
        </EACardContent>
      </EACard>

      {/* Action Modal */}
      {actionTarget && (
        <ActionModal
          task={actionTarget.task}
          mode={actionTarget.mode}
          onConfirm={handleAction}
          onClose={() => setActionTarget(null)}
        />
      )}
    </div>
  );
};

export default ProviderTaskQueueDashboard;
