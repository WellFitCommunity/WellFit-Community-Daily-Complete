/**
 * EVS (Environmental Services) Service
 *
 * Manages housekeeping dispatch, assignments, and turnaround tracking.
 * Integrates with bed management for automatic dirty→clean workflow.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
import type {
  EVSRequest,
  EVSRequestView,
  EVSStaff,
  EVSMetrics,
  EVSUnitSummary,
  CreateEVSRequestInput,
  AssignEVSRequestInput,
  CompleteEVSRequestInput,
  EVSPriority,
  EVSRequestStatus,
} from '../types/evs';

// ============================================================================
// TYPES
// ============================================================================

interface EVSRequestFilters {
  unitId?: string;
  status?: EVSRequestStatus | EVSRequestStatus[];
  priority?: EVSPriority | EVSPriority[];
  assignedTo?: string;
  limit?: number;
}

interface EVSStaffFilters {
  status?: string;
  unitId?: string;
  isActive?: boolean;
}

// ============================================================================
// EVS REQUESTS
// ============================================================================

/**
 * Get EVS requests with optional filters
 */
export async function getEVSRequests(
  filters: EVSRequestFilters = {}
): Promise<ServiceResult<EVSRequestView[]>> {
  try {
    let query = supabase
      .from('evs_requests')
      .select(`
        *,
        hospital_units:unit_id (unit_name, unit_type),
        evs_staff:assigned_to (full_name)
      `)
      .order('priority', { ascending: true })
      .order('requested_at', { ascending: true });

    if (filters.unitId) {
      query = query.eq('unit_id', filters.unitId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        query = query.in('priority', filters.priority);
      } else {
        query = query.eq('priority', filters.priority);
      }
    }

    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('EVS_REQUESTS_FETCH_FAILED', new Error(error.message), { filters });
      return failure('DATABASE_ERROR', `Failed to fetch EVS requests: ${error.message}`, error);
    }

    // Transform to EVSRequestView
    const requests: EVSRequestView[] = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      unit_name: (row.hospital_units as Record<string, unknown>)?.unit_name as string | undefined,
      unit_type: (row.hospital_units as Record<string, unknown>)?.unit_type as string | undefined,
      assigned_staff_name: (row.evs_staff as Record<string, unknown>)?.full_name as string | undefined,
    })) as EVSRequestView[];

    return success(requests);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_REQUESTS_FETCH_ERROR', error, { filters });
    return failure('OPERATION_FAILED', `EVS requests fetch error: ${error.message}`, err);
  }
}

/**
 * Get pending EVS requests (dispatch queue)
 */
export async function getPendingRequests(
  unitId?: string
): Promise<ServiceResult<EVSRequestView[]>> {
  return getEVSRequests({
    unitId,
    status: ['pending', 'assigned'],
    limit: 100,
  });
}

/**
 * Get in-progress EVS requests
 */
export async function getInProgressRequests(): Promise<ServiceResult<EVSRequestView[]>> {
  return getEVSRequests({
    status: 'in_progress',
    limit: 50,
  });
}

/**
 * Create a new EVS request
 */
export async function createEVSRequest(
  input: CreateEVSRequestInput
): Promise<ServiceResult<EVSRequest>> {
  try {
    await auditLogger.clinical('EVS_REQUEST_CREATE_START', true, {
      bedId: input.bed_id,
      roomNumber: input.room_number,
      requestType: input.request_type,
    });

    const { data, error } = await supabase
      .from('evs_requests')
      .insert({
        bed_id: input.bed_id,
        unit_id: input.unit_id,
        room_number: input.room_number,
        bed_label: input.bed_label,
        request_type: input.request_type,
        priority: input.priority || 'routine',
        status: 'pending',
        special_instructions: input.special_instructions,
        isolation_type: input.isolation_type,
        patient_waiting: input.patient_waiting || false,
        admission_scheduled_at: input.admission_scheduled_at,
        adt_event_id: input.adt_event_id,
        requested_by: input.requested_by,
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('EVS_REQUEST_CREATE_FAILED', new Error(error.message), { ...input });
      return failure('DATABASE_ERROR', `Failed to create EVS request: ${error.message}`, error);
    }

    await auditLogger.clinical('EVS_REQUEST_CREATED', true, {
      requestId: data.id,
      bedId: input.bed_id,
      priority: data.priority,
    });

    return success(data as EVSRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_REQUEST_CREATE_ERROR', error, { ...input });
    return failure('OPERATION_FAILED', `EVS request creation error: ${error.message}`, err);
  }
}

/**
 * Assign EVS request to staff member
 */
export async function assignEVSRequest(
  input: AssignEVSRequestInput
): Promise<ServiceResult<{ success: boolean; staff_name?: string }>> {
  try {
    await auditLogger.clinical('EVS_REQUEST_ASSIGN_START', true, {
      requestId: input.request_id,
      staffId: input.staff_id,
    });

    const { data, error } = await supabase.rpc('assign_evs_request', {
      p_request_id: input.request_id,
      p_staff_id: input.staff_id,
      p_estimated_duration_minutes: input.estimated_duration_minutes || null,
    });

    if (error) {
      await auditLogger.error('EVS_REQUEST_ASSIGN_FAILED', new Error(error.message), { ...input });
      return failure('DATABASE_ERROR', `Failed to assign EVS request: ${error.message}`, error);
    }

    const result = data as { success: boolean; error?: string; staff_name?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Assignment failed');
    }

    await auditLogger.clinical('EVS_REQUEST_ASSIGNED', true, {
      requestId: input.request_id,
      staffId: input.staff_id,
      staffName: result.staff_name,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_REQUEST_ASSIGN_ERROR', error, { ...input });
    return failure('OPERATION_FAILED', `EVS assignment error: ${error.message}`, err);
  }
}

/**
 * Start EVS cleaning (mark as in_progress)
 */
export async function startEVSRequest(
  requestId: string
): Promise<ServiceResult<{ success: boolean; bed_id?: string }>> {
  try {
    await auditLogger.clinical('EVS_REQUEST_START_START', true, { requestId });

    const { data, error } = await supabase.rpc('start_evs_request', {
      p_request_id: requestId,
    });

    if (error) {
      await auditLogger.error('EVS_REQUEST_START_FAILED', new Error(error.message), { requestId });
      return failure('DATABASE_ERROR', `Failed to start EVS request: ${error.message}`, error);
    }

    const result = data as { success: boolean; error?: string; bed_id?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Start failed');
    }

    await auditLogger.clinical('EVS_REQUEST_STARTED', true, {
      requestId,
      bedId: result.bed_id,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_REQUEST_START_ERROR', error, { requestId });
    return failure('OPERATION_FAILED', `EVS start error: ${error.message}`, err);
  }
}

/**
 * Complete EVS request (mark bed as available)
 */
export async function completeEVSRequest(
  input: CompleteEVSRequestInput
): Promise<ServiceResult<{ success: boolean; turnaround_minutes?: number }>> {
  try {
    await auditLogger.clinical('EVS_REQUEST_COMPLETE_START', true, {
      requestId: input.request_id,
    });

    const { data, error } = await supabase.rpc('complete_evs_request', {
      p_request_id: input.request_id,
      p_completed_by: input.completed_by || null,
    });

    if (error) {
      await auditLogger.error('EVS_REQUEST_COMPLETE_FAILED', new Error(error.message), { ...input });
      return failure('DATABASE_ERROR', `Failed to complete EVS request: ${error.message}`, error);
    }

    const result = data as {
      success: boolean;
      error?: string;
      turnaround_minutes?: number;
      bed_id?: string;
    };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Complete failed');
    }

    await auditLogger.clinical('EVS_REQUEST_COMPLETED', true, {
      requestId: input.request_id,
      turnaroundMinutes: result.turnaround_minutes,
      bedId: result.bed_id,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_REQUEST_COMPLETE_ERROR', error, { ...input });
    return failure('OPERATION_FAILED', `EVS complete error: ${error.message}`, err);
  }
}

/**
 * Cancel EVS request
 */
export async function cancelEVSRequest(
  requestId: string,
  reason: string,
  cancelledBy?: string
): Promise<ServiceResult<EVSRequest>> {
  try {
    await auditLogger.clinical('EVS_REQUEST_CANCEL_START', true, { requestId, reason });

    const { data, error } = await supabase
      .from('evs_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .in('status', ['pending', 'assigned'])
      .select()
      .single();

    if (error) {
      await auditLogger.error('EVS_REQUEST_CANCEL_FAILED', new Error(error.message), { requestId });
      return failure('DATABASE_ERROR', `Failed to cancel EVS request: ${error.message}`, error);
    }

    await auditLogger.clinical('EVS_REQUEST_CANCELLED', true, { requestId, reason });

    return success(data as EVSRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_REQUEST_CANCEL_ERROR', error, { requestId });
    return failure('OPERATION_FAILED', `EVS cancel error: ${error.message}`, err);
  }
}

// ============================================================================
// EVS STAFF
// ============================================================================

/**
 * Get EVS staff with optional filters
 */
export async function getEVSStaff(
  filters: EVSStaffFilters = {}
): Promise<ServiceResult<EVSStaff[]>> {
  try {
    let query = supabase
      .from('evs_staff')
      .select('*')
      .order('status', { ascending: true })
      .order('full_name', { ascending: true });

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    } else {
      query = query.eq('is_active', true);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.unitId) {
      query = query.contains('assigned_units', [filters.unitId]);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('EVS_STAFF_FETCH_FAILED', new Error(error.message), { filters });
      return failure('DATABASE_ERROR', `Failed to fetch EVS staff: ${error.message}`, error);
    }

    return success((data || []) as EVSStaff[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_STAFF_FETCH_ERROR', error, { filters });
    return failure('OPERATION_FAILED', `EVS staff fetch error: ${error.message}`, err);
  }
}

/**
 * Get available EVS staff for assignment
 */
export async function getAvailableStaff(
  unitId?: string
): Promise<ServiceResult<EVSStaff[]>> {
  return getEVSStaff({
    status: 'available',
    unitId,
    isActive: true,
  });
}

/**
 * Update EVS staff status
 */
export async function updateStaffStatus(
  staffId: string,
  status: string
): Promise<ServiceResult<EVSStaff>> {
  try {
    await auditLogger.clinical('EVS_STAFF_STATUS_UPDATE', true, { staffId, status });

    const { data, error } = await supabase
      .from('evs_staff')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', staffId)
      .select()
      .single();

    if (error) {
      await auditLogger.error('EVS_STAFF_STATUS_UPDATE_FAILED', new Error(error.message), { staffId });
      return failure('DATABASE_ERROR', `Failed to update staff status: ${error.message}`, error);
    }

    return success(data as EVSStaff);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_STAFF_STATUS_UPDATE_ERROR', error, { staffId });
    return failure('OPERATION_FAILED', `Staff status update error: ${error.message}`, err);
  }
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Get EVS metrics for dashboard
 */
export async function getEVSMetrics(): Promise<ServiceResult<EVSMetrics>> {
  try {
    // Get request counts by status
    const { data: requestCounts, error: requestError } = await supabase
      .from('evs_requests')
      .select('status')
      .in('status', ['pending', 'assigned', 'in_progress']);

    if (requestError) {
      await auditLogger.error('EVS_METRICS_REQUESTS_FAILED', new Error(requestError.message));
      return failure('DATABASE_ERROR', `Failed to fetch request counts: ${requestError.message}`);
    }

    // Get completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: completedToday, error: completedError } = await supabase
      .from('evs_requests')
      .select('turnaround_minutes')
      .eq('status', 'completed')
      .gte('completed_at', todayStart.toISOString());

    if (completedError) {
      await auditLogger.error('EVS_METRICS_COMPLETED_FAILED', new Error(completedError.message));
      return failure('DATABASE_ERROR', `Failed to fetch completed count: ${completedError.message}`);
    }

    // Get staff counts
    const { data: staffCounts, error: staffError } = await supabase
      .from('evs_staff')
      .select('status')
      .eq('is_active', true)
      .in('status', ['available', 'busy']);

    if (staffError) {
      await auditLogger.error('EVS_METRICS_STAFF_FAILED', new Error(staffError.message));
      return failure('DATABASE_ERROR', `Failed to fetch staff counts: ${staffError.message}`);
    }

    // Calculate metrics
    const requests = requestCounts || [];
    const completed = completedToday || [];
    const staff = staffCounts || [];

    const pendingCount = requests.filter((r) => r.status === 'pending' || r.status === 'assigned').length;
    const inProgressCount = requests.filter((r) => r.status === 'in_progress').length;
    const completedCount = completed.length;

    const turnaroundTimes = completed
      .map((r) => r.turnaround_minutes)
      .filter((t): t is number => typeof t === 'number' && t > 0);

    const avgTurnaround = turnaroundTimes.length > 0
      ? Math.round(turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length)
      : 0;

    const metrics: EVSMetrics = {
      pending_requests: pendingCount,
      in_progress_requests: inProgressCount,
      completed_today: completedCount,
      avg_turnaround_minutes: avgTurnaround,
      target_turnaround_minutes: 30, // Default target
      staff_available: staff.filter((s) => s.status === 'available').length,
      staff_busy: staff.filter((s) => s.status === 'busy').length,
    };

    return success(metrics);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_METRICS_ERROR', error);
    return failure('OPERATION_FAILED', `EVS metrics error: ${error.message}`, err);
  }
}

/**
 * Get EVS summary by unit
 */
export async function getEVSUnitSummaries(): Promise<ServiceResult<EVSUnitSummary[]>> {
  try {
    const { data, error } = await supabase
      .from('evs_requests')
      .select(`
        unit_id,
        status,
        priority,
        requested_at,
        hospital_units:unit_id (unit_name, unit_type)
      `)
      .in('status', ['pending', 'assigned', 'in_progress']);

    if (error) {
      await auditLogger.error('EVS_UNIT_SUMMARIES_FAILED', new Error(error.message));
      return failure('DATABASE_ERROR', `Failed to fetch unit summaries: ${error.message}`, error);
    }

    // Aggregate by unit
    const unitMap = new Map<string, EVSUnitSummary>();

    for (const row of (data || []) as Record<string, unknown>[]) {
      const unitId = row.unit_id as string;
      const unitInfo = row.hospital_units as Record<string, unknown> | null;

      if (!unitMap.has(unitId)) {
        unitMap.set(unitId, {
          unit_id: unitId,
          unit_name: (unitInfo?.unit_name as string) || 'Unknown',
          unit_type: (unitInfo?.unit_type as string) || 'other',
          pending_count: 0,
          in_progress_count: 0,
        });
      }

      const summary = unitMap.get(unitId);
      if (!summary) continue;

      const status = row.status as string;

      if (status === 'pending' || status === 'assigned') {
        summary.pending_count++;
        const requestedAt = row.requested_at as string;
        if (!summary.oldest_pending_at || requestedAt < summary.oldest_pending_at) {
          summary.oldest_pending_at = requestedAt;
        }
      } else if (status === 'in_progress') {
        summary.in_progress_count++;
      }
    }

    const summaries = Array.from(unitMap.values())
      .sort((a, b) => (b.pending_count + b.in_progress_count) - (a.pending_count + a.in_progress_count));

    return success(summaries);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('EVS_UNIT_SUMMARIES_ERROR', error);
    return failure('OPERATION_FAILED', `EVS unit summaries error: ${error.message}`, err);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const EVSService = {
  // Requests
  getEVSRequests,
  getPendingRequests,
  getInProgressRequests,
  createEVSRequest,
  assignEVSRequest,
  startEVSRequest,
  completeEVSRequest,
  cancelEVSRequest,

  // Staff
  getEVSStaff,
  getAvailableStaff,
  updateStaffStatus,

  // Metrics
  getEVSMetrics,
  getEVSUnitSummaries,
};

export default EVSService;
