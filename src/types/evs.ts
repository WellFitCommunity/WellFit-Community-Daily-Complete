/**
 * EVS (Environmental Services) Types
 *
 * TypeScript interfaces for housekeeping dispatch and turnaround tracking.
 * Integrates with bed management for automatic dirty→clean workflow.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * EVS request priority levels
 */
export type EVSPriority = 'routine' | 'urgent' | 'stat' | 'isolation';

/**
 * EVS request status
 */
export type EVSRequestStatus =
  | 'pending'      // Request created, not yet assigned
  | 'assigned'     // Assigned to EVS staff
  | 'in_progress'  // Cleaning started
  | 'completed'    // Cleaning finished
  | 'cancelled'    // Request cancelled (e.g., patient returned)
  | 'on_hold';     // Temporarily paused

/**
 * EVS staff availability status
 */
export type EVSStaffStatus = 'available' | 'busy' | 'on_break' | 'off_duty';

/**
 * EVS request type
 */
export type EVSRequestType =
  | 'discharge'    // Standard discharge clean
  | 'terminal'     // Deep clean (isolation, etc.)
  | 'stat'         // Emergency turnaround
  | 'touch_up'     // Quick freshen
  | 'spill'        // Spill cleanup
  | 'other';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * EVS Request - Cleaning request for a bed
 */
export interface EVSRequest {
  id: string;
  tenant_id: string;
  bed_id: string;
  unit_id: string;
  room_number: string;
  bed_label: string;
  request_type: EVSRequestType;
  priority: EVSPriority;
  status: EVSRequestStatus;
  requested_at: string;
  requested_by?: string;
  assigned_to?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  completed_by?: string;
  estimated_duration_minutes?: number;
  actual_duration_minutes?: number;
  turnaround_minutes?: number;
  isolation_type?: string;
  special_instructions?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  patient_waiting: boolean;
  admission_scheduled_at?: string;
  adt_event_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * EVS Staff - Housekeeping personnel
 */
export interface EVSStaff {
  id: string;
  tenant_id: string;
  user_id?: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  email?: string;
  status: EVSStaffStatus;
  assigned_units?: string[];
  current_request_id?: string;
  shift_start?: string;
  shift_end?: string;
  break_start?: string;
  break_end?: string;
  requests_completed_today: number;
  avg_turnaround_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * EVS Request with related data for display
 */
export interface EVSRequestView extends EVSRequest {
  unit_name?: string;
  unit_type?: string;
  assigned_staff_name?: string;
  facility_name?: string;
}

/**
 * EVS metrics for dashboard
 */
export interface EVSMetrics {
  pending_requests: number;
  in_progress_requests: number;
  completed_today: number;
  avg_turnaround_minutes: number;
  target_turnaround_minutes: number;
  staff_available: number;
  staff_busy: number;
  oldest_pending_minutes?: number;
}

/**
 * EVS unit summary for dispatch view
 */
export interface EVSUnitSummary {
  unit_id: string;
  unit_name: string;
  unit_type: string;
  pending_count: number;
  in_progress_count: number;
  avg_turnaround_minutes?: number;
  oldest_pending_at?: string;
}

/**
 * Input for creating EVS request
 */
export interface CreateEVSRequestInput {
  bed_id: string;
  unit_id: string;
  room_number: string;
  bed_label: string;
  request_type: EVSRequestType;
  priority?: EVSPriority;
  special_instructions?: string;
  isolation_type?: string;
  patient_waiting?: boolean;
  admission_scheduled_at?: string;
  adt_event_id?: string;
  requested_by?: string;
}

/**
 * Input for assigning EVS request to staff
 */
export interface AssignEVSRequestInput {
  request_id: string;
  staff_id: string;
  estimated_duration_minutes?: number;
}

/**
 * Input for completing EVS request
 */
export interface CompleteEVSRequestInput {
  request_id: string;
  completed_by?: string;
  notes?: string;
}

/**
 * EVS turnaround by unit type (for benchmarking)
 */
export interface EVSTurnaroundBenchmark {
  unit_type: string;
  target_minutes: number;
  avg_actual_minutes: number;
  median_minutes: number;
  p90_minutes: number;
  samples: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable priority label
 */
export function getEVSPriorityLabel(priority: EVSPriority): string {
  const labels: Record<EVSPriority, string> = {
    routine: 'Routine',
    urgent: 'Urgent',
    stat: 'STAT',
    isolation: 'Isolation',
  };
  return labels[priority] || priority;
}

/**
 * Get priority color for UI
 */
export function getEVSPriorityColor(priority: EVSPriority): string {
  const colors: Record<EVSPriority, string> = {
    routine: 'bg-gray-100 text-gray-700 border-gray-200',
    urgent: 'bg-orange-100 text-orange-700 border-orange-200',
    stat: 'bg-red-100 text-red-700 border-red-200',
    isolation: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get human-readable status label
 */
export function getEVSStatusLabel(status: EVSRequestStatus): string {
  const labels: Record<EVSRequestStatus, string> = {
    pending: 'Pending',
    assigned: 'Assigned',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    on_hold: 'On Hold',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getEVSStatusColor(status: EVSRequestStatus): string {
  const colors: Record<EVSRequestStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    assigned: 'bg-blue-100 text-blue-700 border-blue-200',
    in_progress: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
    on_hold: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get human-readable request type label
 */
export function getEVSRequestTypeLabel(type: EVSRequestType): string {
  const labels: Record<EVSRequestType, string> = {
    discharge: 'Discharge Clean',
    terminal: 'Terminal Clean',
    stat: 'STAT Turnaround',
    touch_up: 'Touch Up',
    spill: 'Spill Cleanup',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get priority based on unit type and request type
 */
export function determineEVSPriority(
  unitType: string,
  requestType: EVSRequestType,
  hasPatientWaiting: boolean,
  isIsolation: boolean
): EVSPriority {
  // Isolation always takes highest priority for infection control
  if (isIsolation) return 'isolation';

  // STAT requests are urgent by definition
  if (requestType === 'stat') return 'stat';

  // If patient waiting, bump to urgent
  if (hasPatientWaiting) return 'urgent';

  // Critical care units get higher priority
  const criticalUnits = ['icu', 'picu', 'nicu', 'or', 'pacu', 'ed', 'labor_delivery'];
  if (criticalUnits.includes(unitType.toLowerCase())) return 'urgent';

  return 'routine';
}

/**
 * Calculate turnaround time in minutes
 */
export function calculateTurnaroundMinutes(
  requestedAt: string,
  completedAt: string
): number {
  const start = new Date(requestedAt).getTime();
  const end = new Date(completedAt).getTime();
  return Math.round((end - start) / 60000);
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
