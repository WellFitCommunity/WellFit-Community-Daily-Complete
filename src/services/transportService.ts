/**
 * Transport Service
 *
 * Manages patient transport requests, assignments, and tracking.
 * Integrates with bed management for bed turnover coordination.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
import type {
  TransportRequest,
  TransportRequestView,
  TransportStaff,
  TransportMetrics,
  CreateTransportRequestInput,
  AssignTransportRequestInput,
  TransportStatus,
  TransportPriority,
} from '../types/transport';

// ============================================================================
// TYPES
// ============================================================================

interface TransportRequestFilters {
  status?: TransportStatus | TransportStatus[];
  priority?: TransportPriority | TransportPriority[];
  assignedTo?: string;
  originUnitId?: string;
  destinationUnitId?: string;
  limit?: number;
}

// ============================================================================
// TRANSPORT REQUESTS
// ============================================================================

/**
 * Get transport requests with optional filters
 */
export async function getTransportRequests(
  filters: TransportRequestFilters = {}
): Promise<ServiceResult<TransportRequestView[]>> {
  try {
    let query = supabase
      .from('transport_requests')
      .select(`
        *,
        origin_unit:origin_unit_id (unit_name),
        destination_unit:destination_unit_id (unit_name),
        transport_staff:assigned_to (full_name)
      `)
      .order('priority', { ascending: true })
      .order('requested_at', { ascending: true });

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

    if (filters.originUnitId) {
      query = query.eq('origin_unit_id', filters.originUnitId);
    }

    if (filters.destinationUnitId) {
      query = query.eq('destination_unit_id', filters.destinationUnitId);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('TRANSPORT_REQUESTS_FETCH_FAILED', new Error(error.message), { filters });
      return failure('DATABASE_ERROR', `Failed to fetch transport requests: ${error.message}`, error);
    }

    // Transform to TransportRequestView
    const requests: TransportRequestView[] = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      origin_unit_name: (row.origin_unit as Record<string, unknown>)?.unit_name as string | undefined,
      destination_unit_name: (row.destination_unit as Record<string, unknown>)?.unit_name as string | undefined,
      assigned_staff_name: (row.transport_staff as Record<string, unknown>)?.full_name as string | undefined,
    })) as TransportRequestView[];

    return success(requests);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_REQUESTS_FETCH_ERROR', error, { filters });
    return failure('OPERATION_FAILED', `Transport requests fetch error: ${error.message}`, err);
  }
}

/**
 * Get pending transport requests (dispatch queue)
 */
export async function getPendingRequests(): Promise<ServiceResult<TransportRequestView[]>> {
  return getTransportRequests({
    status: ['requested', 'assigned', 'en_route', 'arrived'],
    limit: 100,
  });
}

/**
 * Get in-transit transport requests
 */
export async function getInTransitRequests(): Promise<ServiceResult<TransportRequestView[]>> {
  return getTransportRequests({
    status: 'in_transit',
    limit: 50,
  });
}

/**
 * Create a new transport request
 */
export async function createTransportRequest(
  input: CreateTransportRequestInput
): Promise<ServiceResult<TransportRequest>> {
  try {
    await auditLogger.clinical('TRANSPORT_REQUEST_CREATE_START', true, {
      origin: input.origin_location,
      destination: input.destination_location,
      reason: input.transport_reason,
    });

    const { data, error } = await supabase
      .from('transport_requests')
      .insert({
        patient_id: input.patient_id,
        patient_name: input.patient_name,
        patient_mrn: input.patient_mrn,
        origin_type: input.origin_type,
        origin_bed_id: input.origin_bed_id,
        origin_unit_id: input.origin_unit_id,
        origin_department: input.origin_department,
        origin_location: input.origin_location,
        destination_type: input.destination_type,
        destination_bed_id: input.destination_bed_id,
        destination_unit_id: input.destination_unit_id,
        destination_department: input.destination_department,
        destination_location: input.destination_location,
        transport_type: input.transport_type,
        transport_reason: input.transport_reason,
        priority: input.priority || 'routine',
        status: 'requested',
        scheduled_time: input.scheduled_time,
        requires_oxygen: input.requires_oxygen || false,
        requires_iv: input.requires_iv || false,
        requires_monitor: input.requires_monitor || false,
        requires_isolation: input.requires_isolation || false,
        special_equipment: input.special_equipment || [],
        special_instructions: input.special_instructions,
        requested_by: input.requested_by,
      })
      .select()
      .single();

    if (error) {
      await auditLogger.error('TRANSPORT_REQUEST_CREATE_FAILED', new Error(error.message), { ...input });
      return failure('DATABASE_ERROR', `Failed to create transport request: ${error.message}`, error);
    }

    await auditLogger.clinical('TRANSPORT_REQUEST_CREATED', true, {
      requestId: data.id,
      priority: data.priority,
    });

    return success(data as TransportRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_REQUEST_CREATE_ERROR', error, { ...input });
    return failure('OPERATION_FAILED', `Transport request creation error: ${error.message}`, err);
  }
}

/**
 * Assign transport request to staff member
 */
export async function assignTransportRequest(
  input: AssignTransportRequestInput
): Promise<ServiceResult<{ success: boolean; staff_name?: string }>> {
  try {
    await auditLogger.clinical('TRANSPORT_REQUEST_ASSIGN_START', true, {
      requestId: input.request_id,
      staffId: input.staff_id,
    });

    const { data, error } = await supabase.rpc('assign_transport_request', {
      p_request_id: input.request_id,
      p_staff_id: input.staff_id,
    });

    if (error) {
      await auditLogger.error('TRANSPORT_REQUEST_ASSIGN_FAILED', new Error(error.message), { ...input });
      return failure('DATABASE_ERROR', `Failed to assign transport: ${error.message}`, error);
    }

    const result = data as { success: boolean; error?: string; staff_name?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Assignment failed');
    }

    await auditLogger.clinical('TRANSPORT_REQUEST_ASSIGNED', true, {
      requestId: input.request_id,
      staffId: input.staff_id,
      staffName: result.staff_name,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_REQUEST_ASSIGN_ERROR', error, { ...input });
    return failure('OPERATION_FAILED', `Transport assignment error: ${error.message}`, err);
  }
}

/**
 * Update transport status
 */
export async function updateTransportStatus(
  requestId: string,
  newStatus: TransportStatus,
  location?: string
): Promise<ServiceResult<{ success: boolean }>> {
  try {
    await auditLogger.clinical('TRANSPORT_STATUS_UPDATE_START', true, { requestId, newStatus });

    const { data, error } = await supabase.rpc('update_transport_status', {
      p_request_id: requestId,
      p_new_status: newStatus,
      p_location: location || null,
    });

    if (error) {
      await auditLogger.error('TRANSPORT_STATUS_UPDATE_FAILED', new Error(error.message), { requestId });
      return failure('DATABASE_ERROR', `Failed to update status: ${error.message}`, error);
    }

    const result = data as { success: boolean; error?: string };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Status update failed');
    }

    await auditLogger.clinical('TRANSPORT_STATUS_UPDATED', true, { requestId, newStatus });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_STATUS_UPDATE_ERROR', error, { requestId });
    return failure('OPERATION_FAILED', `Transport status update error: ${error.message}`, err);
  }
}

/**
 * Complete transport request (mark beds appropriately)
 */
export async function completeTransportRequest(
  requestId: string,
  completedBy?: string
): Promise<ServiceResult<{ success: boolean; total_time_minutes?: number }>> {
  try {
    await auditLogger.clinical('TRANSPORT_REQUEST_COMPLETE_START', true, { requestId });

    const { data, error } = await supabase.rpc('complete_transport_request', {
      p_request_id: requestId,
      p_completed_by: completedBy || null,
    });

    if (error) {
      await auditLogger.error('TRANSPORT_REQUEST_COMPLETE_FAILED', new Error(error.message), { requestId });
      return failure('DATABASE_ERROR', `Failed to complete transport: ${error.message}`, error);
    }

    const result = data as {
      success: boolean;
      error?: string;
      total_time_minutes?: number;
    };

    if (!result.success) {
      return failure('OPERATION_FAILED', result.error || 'Complete failed');
    }

    await auditLogger.clinical('TRANSPORT_REQUEST_COMPLETED', true, {
      requestId,
      totalTimeMinutes: result.total_time_minutes,
    });

    return success(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_REQUEST_COMPLETE_ERROR', error, { requestId });
    return failure('OPERATION_FAILED', `Transport complete error: ${error.message}`, err);
  }
}

/**
 * Cancel transport request
 */
export async function cancelTransportRequest(
  requestId: string,
  reason: string,
  cancelledBy?: string
): Promise<ServiceResult<TransportRequest>> {
  try {
    await auditLogger.clinical('TRANSPORT_REQUEST_CANCEL_START', true, { requestId, reason });

    // First, get the request to free up staff if assigned
    const { data: existing } = await supabase
      .from('transport_requests')
      .select('assigned_to')
      .eq('id', requestId)
      .single();

    const { data, error } = await supabase
      .from('transport_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: cancelledBy,
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .in('status', ['requested', 'assigned', 'en_route', 'arrived'])
      .select()
      .single();

    if (error) {
      await auditLogger.error('TRANSPORT_REQUEST_CANCEL_FAILED', new Error(error.message), { requestId });
      return failure('DATABASE_ERROR', `Failed to cancel transport: ${error.message}`, error);
    }

    // Free up assigned staff
    if (existing?.assigned_to) {
      await supabase
        .from('transport_staff')
        .update({
          status: 'available',
          current_request_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.assigned_to);
    }

    await auditLogger.clinical('TRANSPORT_REQUEST_CANCELLED', true, { requestId, reason });

    return success(data as TransportRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_REQUEST_CANCEL_ERROR', error, { requestId });
    return failure('OPERATION_FAILED', `Transport cancel error: ${error.message}`, err);
  }
}

// ============================================================================
// TRANSPORT STAFF
// ============================================================================

/**
 * Get transport staff
 */
export async function getTransportStaff(
  filters: { status?: string; isActive?: boolean } = {}
): Promise<ServiceResult<TransportStaff[]>> {
  try {
    let query = supabase
      .from('transport_staff')
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

    const { data, error } = await query;

    if (error) {
      await auditLogger.error('TRANSPORT_STAFF_FETCH_FAILED', new Error(error.message), { filters });
      return failure('DATABASE_ERROR', `Failed to fetch transport staff: ${error.message}`, error);
    }

    return success((data || []) as TransportStaff[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_STAFF_FETCH_ERROR', error, { filters });
    return failure('OPERATION_FAILED', `Transport staff fetch error: ${error.message}`, err);
  }
}

/**
 * Get available transport staff
 */
export async function getAvailableStaff(): Promise<ServiceResult<TransportStaff[]>> {
  return getTransportStaff({ status: 'available', isActive: true });
}

// ============================================================================
// METRICS
// ============================================================================

/**
 * Get transport metrics for dashboard
 */
export async function getTransportMetrics(): Promise<ServiceResult<TransportMetrics>> {
  try {
    // Get request counts
    const { data: requestCounts, error: requestError } = await supabase
      .from('transport_requests')
      .select('status, priority')
      .in('status', ['requested', 'assigned', 'en_route', 'arrived', 'in_transit']);

    if (requestError) {
      return failure('DATABASE_ERROR', `Failed to fetch request counts: ${requestError.message}`);
    }

    // Get completed today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: completedToday, error: completedError } = await supabase
      .from('transport_requests')
      .select('wait_time_minutes, transit_time_minutes')
      .eq('status', 'completed')
      .gte('completed_at', todayStart.toISOString());

    if (completedError) {
      return failure('DATABASE_ERROR', `Failed to fetch completed count: ${completedError.message}`);
    }

    // Get staff counts
    const { data: staffCounts, error: staffError } = await supabase
      .from('transport_staff')
      .select('status')
      .eq('is_active', true)
      .in('status', ['available', 'busy']);

    if (staffError) {
      return failure('DATABASE_ERROR', `Failed to fetch staff counts: ${staffError.message}`);
    }

    // Calculate metrics
    const requests = requestCounts || [];
    const completed = completedToday || [];
    const staff = staffCounts || [];

    const pendingCount = requests.filter((r) =>
      ['requested', 'assigned', 'en_route', 'arrived'].includes(r.status)
    ).length;
    const inProgressCount = requests.filter((r) => r.status === 'in_transit').length;
    const statPending = requests.filter((r) =>
      r.priority === 'stat' && ['requested', 'assigned'].includes(r.status)
    ).length;

    const waitTimes = completed
      .map((r) => r.wait_time_minutes)
      .filter((t): t is number => typeof t === 'number' && t > 0);
    const transitTimes = completed
      .map((r) => r.transit_time_minutes)
      .filter((t): t is number => typeof t === 'number' && t > 0);

    const avgWait = waitTimes.length > 0
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
      : 0;
    const avgTransit = transitTimes.length > 0
      ? Math.round(transitTimes.reduce((a, b) => a + b, 0) / transitTimes.length)
      : 0;

    const metrics: TransportMetrics = {
      pending_requests: pendingCount,
      in_progress_requests: inProgressCount,
      completed_today: completed.length,
      avg_wait_time_minutes: avgWait,
      avg_transit_time_minutes: avgTransit,
      target_wait_time_minutes: 15,
      staff_available: staff.filter((s) => s.status === 'available').length,
      staff_busy: staff.filter((s) => s.status === 'busy').length,
      stat_requests_pending: statPending,
    };

    return success(metrics);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('TRANSPORT_METRICS_ERROR', error);
    return failure('OPERATION_FAILED', `Transport metrics error: ${error.message}`, err);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const TransportService = {
  getTransportRequests,
  getPendingRequests,
  getInTransitRequests,
  createTransportRequest,
  assignTransportRequest,
  updateTransportStatus,
  completeTransportRequest,
  cancelTransportRequest,
  getTransportStaff,
  getAvailableStaff,
  getTransportMetrics,
};

export default TransportService;
