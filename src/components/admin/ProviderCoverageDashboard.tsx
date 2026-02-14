/**
 * ProviderCoverageDashboard — Provider absence coverage and on-call rotation
 *
 * Purpose: Manages coverage routing when a provider is absent (vacation, PTO,
 * sick, on-call rotation). Two tabs: Coverage Assignments and On-Call Schedule.
 * Metric cards show active/upcoming/on-call/absent/unassigned counts.
 *
 * Used by: sectionDefinitions.tsx (patient-care category)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  UserCheck,
  UserX,
  Shield,
  RefreshCw,
  Filter,
  Plus,
  X,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  EACard,
  EACardContent,
  EACardHeader,
  EAButton,
  EAAlert,
  EABadge,
} from '../envision-atlus';
import { providerCoverageService } from '../../services/providerCoverageService';
import type {
  CoverageSummaryRow,
  CoverageMetrics,
  CoverageReason,
  OnCallSchedule,
} from '../../services/providerCoverageService';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';
import { CancelConfirmModal, AddCoverageModal } from './provider-coverage/CoverageModals';

// =============================================================================
// TYPES
// =============================================================================

type StatusFilter = 'all' | 'active' | 'upcoming' | 'completed' | 'cancelled';
type ActiveTab = 'coverage' | 'oncall';

// =============================================================================
// HELPERS
// =============================================================================

function formatProviderName(first: string | null, last: string | null): string {
  if (!first && !last) return 'N/A';
  return `${first ?? ''} ${last ?? ''}`.trim();
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${s} - ${e}`;
}

function formatScheduleDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function getStatusVariant(status: string): 'info' | 'elevated' | 'neutral' | 'critical' {
  switch (status) {
    case 'active': return 'info';
    case 'upcoming': return 'elevated';
    case 'completed': return 'neutral';
    case 'cancelled': return 'critical';
    default: return 'neutral';
  }
}

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    vacation: 'Vacation', pto: 'PTO', sick: 'Sick', training: 'Training',
    personal: 'Personal', on_call_swap: 'On-Call Swap', other: 'Other',
  };
  return labels[reason] ?? reason;
}

function getShiftLabel(shiftType: string): string {
  const labels: Record<string, string> = {
    day: 'Day', night: 'Night', swing: 'Swing', '24hr': '24 Hr',
  };
  return labels[shiftType] ?? shiftType;
}

function getRoleBadgeVariant(role: string): 'info' | 'elevated' | 'neutral' {
  switch (role) {
    case 'primary': return 'info';
    case 'secondary': return 'elevated';
    case 'backup': return 'neutral';
    default: return 'neutral';
  }
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function MetricCard({ label, value, variant }: {
  label: string;
  value: number;
  variant: 'default' | 'info' | 'warning' | 'success' | 'critical';
}) {
  const colors = {
    default: 'bg-white border-gray-200 text-gray-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    critical: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[variant]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ProviderCoverageDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('coverage');
  const [assignments, setAssignments] = useState<CoverageSummaryRow[]>([]);
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [metrics, setMetrics] = useState<CoverageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [reasonFilter, setReasonFilter] = useState<CoverageReason | 'all'>('all');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [assignmentsRes, metricsRes, schedulesRes] = await Promise.all([
      providerCoverageService.getCoverageAssignments(),
      providerCoverageService.getCoverageMetrics(),
      providerCoverageService.getOnCallSchedules(scheduleDate),
    ]);

    if (!assignmentsRes.success) {
      setError(assignmentsRes.error.message);
      setAssignments([]);
    } else {
      setAssignments(assignmentsRes.data);
    }
    if (metricsRes.success) setMetrics(metricsRes.data);
    if (schedulesRes.success) setSchedules(schedulesRes.data);
    setLoading(false);
  }, [scheduleDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredAssignments = assignments.filter(a => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'upcoming' && a.computed_status !== 'upcoming') return false;
      if (statusFilter !== 'upcoming' && a.computed_status !== statusFilter) return false;
    }
    if (reasonFilter !== 'all' && a.coverage_reason !== reasonFilter) return false;
    return true;
  });

  const handleCancelCoverage = async () => {
    if (!cancelTargetId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('You must be logged in to cancel coverage.'); setCancelTargetId(null); return; }

      const result = await providerCoverageService.cancelCoverageAssignment(
        cancelTargetId, user.id, 'Cancelled via dashboard'
      );
      if (!result.success) { setError(result.error.message); }
      else {
        setAssignments(prev => prev.map(a =>
          a.id === cancelTargetId ? { ...a, status: 'cancelled' as const, computed_status: 'cancelled' } : a
        ));
        if (metrics) {
          setMetrics(prev => prev ? { ...prev, active_coverages: Math.max(0, prev.active_coverages - 1) } : prev);
        }
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('PROVIDER_COVERAGE_CANCEL_UI_FAILED', e);
      setError('Failed to cancel coverage. Please try again.');
    }
    setCancelTargetId(null);
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    const result = await providerCoverageService.deleteOnCallSchedule(scheduleId);
    if (!result.success) { setError(result.error.message); }
    else { setSchedules(prev => prev.filter(s => s.id !== scheduleId)); }
  };

  if (loading) {
    return (
      <EACard>
        <EACardContent className="flex items-center justify-center p-12">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-3" />
          <span className="text-gray-600">Loading provider coverage data...</span>
        </EACardContent>
      </EACard>
    );
  }

  const unassignedCount = metrics?.unassigned_absences ?? 0;

  return (
    <div className="space-y-4">
      {unassignedCount > 0 && (
        <EAAlert variant="critical">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{unassignedCount} absent provider{unassignedCount !== 1 ? 's' : ''} without coverage assignment — patients may experience delays.</span>
          </div>
        </EAAlert>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <MetricCard label="Active Coverages" value={metrics?.active_coverages ?? 0} variant="info" />
        <MetricCard label="Upcoming" value={metrics?.upcoming_coverages ?? 0} variant="default" />
        <MetricCard label="On-Call Today" value={metrics?.on_call_today ?? 0} variant="success" />
        <MetricCard label="Absent Today" value={metrics?.providers_absent_today ?? 0} variant="warning" />
        <MetricCard label="Unassigned" value={unassignedCount} variant={unassignedCount > 0 ? 'critical' : 'default'} />
      </div>

      {error && (
        <EAAlert variant="critical" dismissible onDismiss={() => setError(null)}>{error}</EAAlert>
      )}

      <div className="flex gap-2 border-b pb-0">
        <button type="button" onClick={() => setActiveTab('coverage')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'coverage' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <UserCheck className="w-4 h-4 inline mr-1 -mt-0.5" />Coverage Assignments
        </button>
        <button type="button" onClick={() => setActiveTab('oncall')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'oncall' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Calendar className="w-4 h-4 inline mr-1 -mt-0.5" />On-Call Schedule
        </button>
      </div>

      {activeTab === 'coverage' && (
        <EACard>
          <EACardHeader icon={<Shield className="w-5 h-5" />}
            action={<div className="flex gap-2">
              <EAButton variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-1" />Add Coverage
              </EAButton>
              <EAButton variant="ghost" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-1" />Refresh
              </EAButton>
            </div>}
          >Coverage Assignments</EACardHeader>

          <EACardContent className="p-0">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b bg-gray-50">
              <Filter className="w-4 h-4 text-gray-400" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500" aria-label="Filter by status">
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value as CoverageReason | 'all')}
                className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500" aria-label="Filter by reason">
                <option value="all">All Reasons</option>
                <option value="vacation">Vacation</option>
                <option value="pto">PTO</option>
                <option value="sick">Sick</option>
                <option value="training">Training</option>
                <option value="personal">Personal</option>
                <option value="on_call_swap">On-Call Swap</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
              <span className="w-36">Absent Provider</span>
              <span className="w-36">Coverage Provider</span>
              <span className="w-20">Reason</span>
              <span className="w-32 flex items-center gap-1"><Clock className="w-3 h-3" /> Dates</span>
              <span className="w-12">Priority</span>
              <span className="w-20">Status</span>
              <span className="w-16">Auto-Route</span>
              <span className="flex-1 text-right">Actions</span>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <UserX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">No coverage assignments</p>
                <p className="text-xs mt-1">
                  {assignments.length === 0 ? 'No coverage assignments have been created.' : 'No assignments match the current filters.'}
                </p>
              </div>
            ) : (
              filteredAssignments.map(row => (
                <div key={row.id} className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-900 w-36 truncate" title={formatProviderName(row.absent_first_name, row.absent_last_name)}>
                    {formatProviderName(row.absent_first_name, row.absent_last_name)}
                  </span>
                  <span className="text-sm text-gray-700 w-36 truncate" title={formatProviderName(row.coverage_first_name, row.coverage_last_name)}>
                    {formatProviderName(row.coverage_first_name, row.coverage_last_name)}
                  </span>
                  <span className="w-20"><EABadge variant="neutral" size="sm">{getReasonLabel(row.coverage_reason)}</EABadge></span>
                  <span className="w-32 text-xs text-gray-600">{formatDateRange(row.effective_start, row.effective_end)}</span>
                  <span className="w-12 text-sm text-center text-gray-700">P{row.coverage_priority}</span>
                  <span className="w-20"><EABadge variant={getStatusVariant(row.computed_status)} size="sm">{row.computed_status}</EABadge></span>
                  <span className="w-16 text-sm text-center">{row.auto_route_tasks ? 'Yes' : 'No'}</span>
                  <span className="flex-1 flex gap-2 justify-end">
                    {(row.computed_status === 'active' || row.computed_status === 'upcoming') && (
                      <EAButton variant="ghost" size="sm" onClick={() => setCancelTargetId(row.id)}>
                        <X className="w-3 h-3 mr-1" />Cancel
                      </EAButton>
                    )}
                  </span>
                </div>
              ))
            )}
          </EACardContent>
        </EACard>
      )}

      {activeTab === 'oncall' && (
        <EACard>
          <EACardHeader icon={<Calendar className="w-5 h-5" />}
            action={<div className="flex items-center gap-3">
              <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                className="text-sm rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500" aria-label="Schedule date" />
              <EAButton variant="ghost" size="sm" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-1" />Refresh
              </EAButton>
            </div>}
          >On-Call Schedule — {formatScheduleDate(scheduleDate)}</EACardHeader>

          <EACardContent className="p-0">
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
              <span className="w-36">Provider</span>
              <span className="w-20">Shift</span>
              <span className="w-28">Time</span>
              <span className="w-20">Role</span>
              <span className="flex-1">Notes</span>
              <span className="w-20 text-right">Actions</span>
            </div>

            {schedules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">No on-call schedules</p>
                <p className="text-xs mt-1">No providers are scheduled on-call for this date.</p>
              </div>
            ) : (
              schedules.map(schedule => (
                <div key={schedule.id} className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-900 w-36 truncate">{schedule.provider_id.slice(0, 8)}...</span>
                  <span className="w-20"><EABadge variant="info" size="sm">{getShiftLabel(schedule.shift_type)}</EABadge></span>
                  <span className="w-28 text-sm text-gray-600">{schedule.shift_start} - {schedule.shift_end}</span>
                  <span className="w-20"><EABadge variant={getRoleBadgeVariant(schedule.coverage_role)} size="sm">{schedule.coverage_role}</EABadge></span>
                  <span className="flex-1 text-sm text-gray-500 truncate">{schedule.notes ?? '-'}</span>
                  <span className="w-20 flex justify-end">
                    <EAButton variant="ghost" size="sm" onClick={() => handleDeleteSchedule(schedule.id)}>
                      <X className="w-3 h-3 mr-1" />Delete
                    </EAButton>
                  </span>
                </div>
              ))
            )}
          </EACardContent>
        </EACard>
      )}

      {cancelTargetId && <CancelConfirmModal onConfirm={handleCancelCoverage} onClose={() => setCancelTargetId(null)} />}
      {showAddModal && <AddCoverageModal onClose={() => setShowAddModal(false)} onCreated={() => { setShowAddModal(false); fetchData(); }} />}
    </div>
  );
};

export default ProviderCoverageDashboard;
