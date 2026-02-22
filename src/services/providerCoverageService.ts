/**
 * Provider Coverage Service — on-call schedules, absence coverage, task routing
 *
 * Purpose: Manages provider on-call rotation schedules and coverage assignments
 * when a provider is absent (vacation, PTO, sick, on-call swap). Queries the
 * v_provider_coverage_summary view for enriched data and inserts audit records
 * for all coverage mutations.
 *
 * Used by: ProviderCoverageDashboard
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';
import type {
  ShiftType,
  CoverageRole,
  CoverageReason,
  OnCallSchedule,
  CoverageAssignment,
  CoverageSummaryRow,
  CoverageMetrics,
  OnCallScheduleInput,
  CoverageAssignmentInput,
  CoverageAssignmentFilters,
  CoverageProviderResult,
} from './providerCoverageService.types';

// Re-export all types for consumer convenience
export type {
  ShiftType,
  CoverageRole,
  CoverageReason,
  CoverageStatus,
  OnCallSchedule,
  CoverageAssignment,
  CoverageSummaryRow,
  CoverageMetrics,
  OnCallScheduleInput,
  CoverageAssignmentInput,
  CoverageAssignmentFilters,
  CoverageProviderResult,
} from './providerCoverageService.types';

// ------------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------------

const VALID_SHIFT_TYPES: ReadonlySet<string> = new Set(['day', 'night', 'swing', '24hr']);
const VALID_COVERAGE_ROLES: ReadonlySet<string> = new Set(['primary', 'secondary', 'backup']);
const VALID_COVERAGE_REASONS: ReadonlySet<string> = new Set([
  'vacation', 'pto', 'sick', 'training', 'personal', 'on_call_swap', 'other',
]);

function isShiftType(v: string): v is ShiftType {
  return VALID_SHIFT_TYPES.has(v);
}

function isCoverageRole(v: string): v is CoverageRole {
  return VALID_COVERAGE_ROLES.has(v);
}

function isCoverageReason(v: string): v is CoverageReason {
  return VALID_COVERAGE_REASONS.has(v);
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const providerCoverageService = {

  /** Fetch on-call schedules for a date (defaults to today). */
  async getOnCallSchedules(
    date?: string,
    facilityId?: string
  ): Promise<ServiceResult<OnCallSchedule[]>> {
    try {
      const targetDate = date ?? new Date().toISOString().split('T')[0];
      let query = supabase
        .from('provider_on_call_schedules')
        .select('id, provider_id, facility_id, unit_id, schedule_date, shift_start, shift_end, shift_type, coverage_role, is_active, notes, tenant_id, created_by, created_at, updated_at')
        .eq('schedule_date', targetDate)
        .eq('is_active', true)
        .order('coverage_role', { ascending: true });

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      }

      const { data, error } = await query;
      if (error) return failure('DATABASE_ERROR', error.message);
      return success((data ?? []) as unknown as OnCallSchedule[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_ONCALL_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)), {}
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch on-call schedules');
    }
  },

  /** Create an on-call schedule entry. */
  async createOnCallSchedule(
    input: OnCallScheduleInput
  ): Promise<ServiceResult<OnCallSchedule>> {
    try {
      if (!input.provider_id || !input.schedule_date || !input.shift_type) {
        return failure('INVALID_INPUT', 'Provider, date, and shift type are required');
      }
      if (!isShiftType(input.shift_type)) {
        return failure('VALIDATION_ERROR', `Invalid shift type: ${input.shift_type}`);
      }
      if (!isCoverageRole(input.coverage_role)) {
        return failure('VALIDATION_ERROR', `Invalid coverage role: ${input.coverage_role}`);
      }

      const { data, error } = await supabase
        .from('provider_on_call_schedules')
        .insert({
          provider_id: input.provider_id,
          facility_id: input.facility_id ?? null,
          unit_id: input.unit_id ?? null,
          schedule_date: input.schedule_date,
          shift_start: input.shift_start ?? '07:00',
          shift_end: input.shift_end ?? '19:00',
          shift_type: input.shift_type,
          coverage_role: input.coverage_role,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('PROVIDER_ONCALL_CREATE_ERROR', new Error(error.message),
          { provider_id: input.provider_id, date: input.schedule_date });
        return failure('DATABASE_ERROR', error.message);
      }

      await auditLogger.clinical('PROVIDER_ONCALL_CREATED', true, {
        schedule_id: (data as OnCallSchedule).id,
        provider_id: input.provider_id,
        schedule_date: input.schedule_date,
        shift_type: input.shift_type,
        coverage_role: input.coverage_role,
      });
      return success(data as OnCallSchedule);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_ONCALL_CREATE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { provider_id: input.provider_id }
      );
      return failure('UNKNOWN_ERROR', 'Failed to create on-call schedule');
    }
  },

  /** Delete an on-call schedule entry. */
  async deleteOnCallSchedule(
    scheduleId: string
  ): Promise<ServiceResult<{ deleted: boolean }>> {
    try {
      if (!scheduleId) return failure('INVALID_INPUT', 'Schedule ID is required');
      const { error } = await supabase
        .from('provider_on_call_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) return failure('DATABASE_ERROR', error.message);
      await auditLogger.clinical('PROVIDER_ONCALL_DELETED', true, { schedule_id: scheduleId });
      return success({ deleted: true });
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_ONCALL_DELETE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { schedule_id: scheduleId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to delete on-call schedule');
    }
  },

  /** Fetch coverage assignments from the enriched view. */
  async getCoverageAssignments(
    filters?: CoverageAssignmentFilters
  ): Promise<ServiceResult<CoverageSummaryRow[]>> {
    try {
      let query = supabase
        .from('v_provider_coverage_summary')
        .select('id, absent_provider_id, coverage_provider_id, facility_id, unit_id, effective_start, effective_end, coverage_reason, coverage_priority, status, auto_route_tasks, notes, tenant_id, approved_by, approved_at, created_by, created_at, updated_at, absent_first_name, absent_last_name, coverage_first_name, coverage_last_name, computed_status')
        .order('effective_start', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'upcoming') {
          query = query.eq('computed_status', 'upcoming');
        } else {
          query = query.eq('status', filters.status);
        }
      }
      if (filters?.coverage_reason) {
        query = query.eq('coverage_reason', filters.coverage_reason);
      }

      const { data, error } = await query;
      if (error) return failure('DATABASE_ERROR', error.message);
      return success((data ?? []) as unknown as CoverageSummaryRow[]);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_COVERAGE_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)), {}
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch coverage assignments');
    }
  },

  /** Create a coverage assignment and write audit record. */
  async createCoverageAssignment(
    input: CoverageAssignmentInput
  ): Promise<ServiceResult<CoverageAssignment>> {
    try {
      if (!input.absent_provider_id || !input.coverage_provider_id) {
        return failure('INVALID_INPUT', 'Both absent and coverage providers are required');
      }
      if (input.absent_provider_id === input.coverage_provider_id) {
        return failure('VALIDATION_ERROR', 'Provider cannot cover themselves');
      }
      if (!input.effective_start || !input.effective_end) {
        return failure('INVALID_INPUT', 'Effective start and end are required');
      }
      if (new Date(input.effective_end) <= new Date(input.effective_start)) {
        return failure('VALIDATION_ERROR', 'Effective end must be after effective start');
      }
      if (!isCoverageReason(input.coverage_reason)) {
        return failure('VALIDATION_ERROR', `Invalid coverage reason: ${input.coverage_reason}`);
      }

      const { data, error } = await supabase
        .from('provider_coverage_assignments')
        .insert({
          absent_provider_id: input.absent_provider_id,
          coverage_provider_id: input.coverage_provider_id,
          facility_id: input.facility_id ?? null,
          unit_id: input.unit_id ?? null,
          effective_start: input.effective_start,
          effective_end: input.effective_end,
          coverage_reason: input.coverage_reason,
          coverage_priority: input.coverage_priority ?? 1,
          auto_route_tasks: input.auto_route_tasks ?? true,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('PROVIDER_COVERAGE_CREATE_ERROR', new Error(error.message),
          { absent: input.absent_provider_id, coverage: input.coverage_provider_id });
        return failure('DATABASE_ERROR', error.message);
      }

      const assignment = data as CoverageAssignment;

      // Write audit record
      await supabase.from('provider_coverage_audit').insert({
        coverage_assignment_id: assignment.id,
        action: 'created',
        details: {
          absent_provider_id: input.absent_provider_id,
          coverage_provider_id: input.coverage_provider_id,
          coverage_reason: input.coverage_reason,
          effective_start: input.effective_start,
          effective_end: input.effective_end,
          auto_route_tasks: input.auto_route_tasks ?? true,
        },
        tenant_id: assignment.tenant_id,
      });

      await auditLogger.clinical('PROVIDER_COVERAGE_CREATED', true, {
        assignment_id: assignment.id,
        absent_provider_id: input.absent_provider_id,
        coverage_provider_id: input.coverage_provider_id,
        coverage_reason: input.coverage_reason,
      });
      return success(assignment);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_COVERAGE_CREATE_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { absent: input.absent_provider_id }
      );
      return failure('UNKNOWN_ERROR', 'Failed to create coverage assignment');
    }
  },

  /** Cancel a coverage assignment and write audit record. */
  async cancelCoverageAssignment(
    assignmentId: string, userId: string, reason?: string
  ): Promise<ServiceResult<CoverageAssignment>> {
    try {
      if (!assignmentId || !userId) {
        return failure('INVALID_INPUT', 'Assignment ID and user ID are required');
      }

      const { data, error } = await supabase
        .from('provider_coverage_assignments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', assignmentId)
        .select()
        .single();

      if (error) return failure('DATABASE_ERROR', error.message);
      const assignment = data as CoverageAssignment;

      await supabase.from('provider_coverage_audit').insert({
        coverage_assignment_id: assignmentId,
        action: 'cancelled',
        actor_id: userId,
        details: { reason: reason ?? 'Manual cancellation' },
        tenant_id: assignment.tenant_id,
      });

      await auditLogger.clinical('PROVIDER_COVERAGE_CANCELLED', true, {
        assignment_id: assignmentId,
        cancelled_by: userId,
        reason: reason ?? 'Manual cancellation',
      });
      return success(assignment);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_COVERAGE_CANCEL_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { assignment_id: assignmentId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to cancel coverage assignment');
    }
  },

  /** Find the best coverage provider for an absent provider at a given time. */
  async getCoverageProvider(
    absentProviderId: string, atTime?: string
  ): Promise<ServiceResult<CoverageProviderResult | null>> {
    try {
      if (!absentProviderId) return failure('INVALID_INPUT', 'Absent provider ID is required');

      const { data, error } = await supabase.rpc('get_coverage_provider', {
        p_absent_provider_id: absentProviderId,
        p_at_time: atTime ?? new Date().toISOString(),
      });

      if (error) return failure('DATABASE_ERROR', error.message);
      const rows = (data ?? []) as unknown as CoverageProviderResult[];
      return success(rows.length > 0 ? rows[0] : null);
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_COVERAGE_LOOKUP_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { absent_provider_id: absentProviderId }
      );
      return failure('UNKNOWN_ERROR', 'Failed to look up coverage provider');
    }
  },

  /** Aggregate coverage metrics for dashboard cards. */
  async getCoverageMetrics(): Promise<ServiceResult<CoverageMetrics>> {
    try {
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      const { count: activeCoverages, error: activeErr } = await supabase
        .from('provider_coverage_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .lte('effective_start', now)
        .gte('effective_end', now);
      if (activeErr) return failure('DATABASE_ERROR', activeErr.message);

      const { count: upcomingCoverages, error: upcomingErr } = await supabase
        .from('provider_coverage_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gt('effective_start', now);
      if (upcomingErr) return failure('DATABASE_ERROR', upcomingErr.message);

      const { count: onCallToday, error: onCallErr } = await supabase
        .from('provider_on_call_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_date', today)
        .eq('is_active', true);
      if (onCallErr) return failure('DATABASE_ERROR', onCallErr.message);

      const { count: absentToday, error: absentErr } = await supabase
        .from('provider_blocked_times')
        .select('*', { count: 'exact', head: true })
        .lte('start_time', now)
        .gte('end_time', now);
      if (absentErr) return failure('DATABASE_ERROR', absentErr.message);

      const unassigned = Math.max(0, (absentToday ?? 0) - (activeCoverages ?? 0));

      return success({
        active_coverages: activeCoverages ?? 0,
        upcoming_coverages: upcomingCoverages ?? 0,
        on_call_today: onCallToday ?? 0,
        providers_absent_today: absentToday ?? 0,
        unassigned_absences: unassigned,
      });
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_COVERAGE_METRICS_FAILED',
        err instanceof Error ? err : new Error(String(err)), {}
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch coverage metrics');
    }
  },

  /** Get providers who are absent today (from blocked_times). */
  async getAbsentProviders(
    date?: string
  ): Promise<ServiceResult<{ provider_id: string; reason: string | null; start_time: string; end_time: string }[]>> {
    try {
      const targetDate = date ?? new Date().toISOString();
      const dayStart = targetDate.split('T')[0] + 'T00:00:00.000Z';
      const dayEnd = targetDate.split('T')[0] + 'T23:59:59.999Z';

      const { data, error } = await supabase
        .from('provider_blocked_times')
        .select('provider_id, reason, start_time, end_time')
        .lte('start_time', dayEnd)
        .gte('end_time', dayStart);

      if (error) return failure('DATABASE_ERROR', error.message);
      return success(
        (data ?? []) as unknown as { provider_id: string; reason: string | null; start_time: string; end_time: string }[]
      );
    } catch (err: unknown) {
      await auditLogger.error(
        'PROVIDER_ABSENT_FETCH_FAILED',
        err instanceof Error ? err : new Error(String(err)), {}
      );
      return failure('UNKNOWN_ERROR', 'Failed to fetch absent providers');
    }
  },
};

export default providerCoverageService;
