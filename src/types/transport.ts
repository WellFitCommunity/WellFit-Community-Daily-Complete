/**
 * Transport Types
 *
 * TypeScript interfaces for patient transport coordination.
 * Integrates with bed management for bed turnover timing.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Transport request priority
 */
export type TransportPriority = 'routine' | 'urgent' | 'stat' | 'scheduled';

/**
 * Transport request status
 */
export type TransportStatus =
  | 'requested'     // Request created, awaiting assignment
  | 'assigned'      // Assigned to transporter
  | 'en_route'      // Transporter heading to pickup
  | 'arrived'       // Transporter at pickup location
  | 'in_transit'    // Patient being transported
  | 'delivered'     // Patient at destination
  | 'completed'     // Transport documented complete
  | 'cancelled';    // Request cancelled

/**
 * Transport staff status
 */
export type TransportStaffStatus = 'available' | 'busy' | 'on_break' | 'off_duty';

/**
 * Transport type
 */
export type TransportType =
  | 'wheelchair'
  | 'stretcher'
  | 'bed'
  | 'ambulatory'
  | 'bariatric'
  | 'isolation'
  | 'critical'
  | 'other';

/**
 * Transport reason
 */
export type TransportReason =
  | 'admission'
  | 'discharge'
  | 'transfer'
  | 'procedure'
  | 'imaging'
  | 'surgery'
  | 'therapy'
  | 'dialysis'
  | 'test'
  | 'other';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Transport Request - Patient transport between locations
 */
export interface TransportRequest {
  id: string;
  tenant_id: string;
  patient_id?: string;
  patient_name?: string;
  patient_mrn?: string;

  // Origin
  origin_type: 'bed' | 'department' | 'external';
  origin_bed_id?: string;
  origin_unit_id?: string;
  origin_department?: string;
  origin_location: string;

  // Destination
  destination_type: 'bed' | 'department' | 'external';
  destination_bed_id?: string;
  destination_unit_id?: string;
  destination_department?: string;
  destination_location: string;

  // Transport details
  transport_type: TransportType;
  transport_reason: TransportReason;
  priority: TransportPriority;
  status: TransportStatus;

  // Equipment requirements
  requires_oxygen: boolean;
  requires_iv: boolean;
  requires_monitor: boolean;
  requires_isolation: boolean;
  special_equipment?: string[];
  special_instructions?: string;

  // Timing
  requested_at: string;
  requested_by?: string;
  scheduled_time?: string;
  assigned_to?: string;
  assigned_at?: string;
  pickup_started_at?: string;
  pickup_arrived_at?: string;
  transit_started_at?: string;
  delivered_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;

  // Metrics
  wait_time_minutes?: number;
  transit_time_minutes?: number;
  total_time_minutes?: number;

  created_at: string;
  updated_at: string;
}

/**
 * Transport Staff
 */
export interface TransportStaff {
  id: string;
  tenant_id: string;
  user_id?: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  status: TransportStaffStatus;
  current_request_id?: string;
  current_location?: string;
  assigned_units?: string[];
  certifications?: string[];
  shift_start?: string;
  shift_end?: string;
  transports_completed_today: number;
  avg_transport_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Transport request with related data for display
 */
export interface TransportRequestView extends TransportRequest {
  origin_unit_name?: string;
  destination_unit_name?: string;
  assigned_staff_name?: string;
}

/**
 * Transport metrics for dashboard
 */
export interface TransportMetrics {
  pending_requests: number;
  in_progress_requests: number;
  completed_today: number;
  avg_wait_time_minutes: number;
  avg_transit_time_minutes: number;
  target_wait_time_minutes: number;
  staff_available: number;
  staff_busy: number;
  stat_requests_pending: number;
}

/**
 * Input for creating transport request
 */
export interface CreateTransportRequestInput {
  patient_id?: string;
  patient_name?: string;
  patient_mrn?: string;

  origin_type: 'bed' | 'department' | 'external';
  origin_bed_id?: string;
  origin_unit_id?: string;
  origin_department?: string;
  origin_location: string;

  destination_type: 'bed' | 'department' | 'external';
  destination_bed_id?: string;
  destination_unit_id?: string;
  destination_department?: string;
  destination_location: string;

  transport_type: TransportType;
  transport_reason: TransportReason;
  priority?: TransportPriority;
  scheduled_time?: string;

  requires_oxygen?: boolean;
  requires_iv?: boolean;
  requires_monitor?: boolean;
  requires_isolation?: boolean;
  special_equipment?: string[];
  special_instructions?: string;

  requested_by?: string;
}

/**
 * Input for assigning transport request
 */
export interface AssignTransportRequestInput {
  request_id: string;
  staff_id: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get human-readable priority label
 */
export function getTransportPriorityLabel(priority: TransportPriority): string {
  const labels: Record<TransportPriority, string> = {
    routine: 'Routine',
    urgent: 'Urgent',
    stat: 'STAT',
    scheduled: 'Scheduled',
  };
  return labels[priority] || priority;
}

/**
 * Get priority color for UI
 */
export function getTransportPriorityColor(priority: TransportPriority): string {
  const colors: Record<TransportPriority, string> = {
    routine: 'bg-gray-100 text-gray-700 border-gray-200',
    urgent: 'bg-orange-100 text-orange-700 border-orange-200',
    stat: 'bg-red-100 text-red-700 border-red-200',
    scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get human-readable status label
 */
export function getTransportStatusLabel(status: TransportStatus): string {
  const labels: Record<TransportStatus, string> = {
    requested: 'Requested',
    assigned: 'Assigned',
    en_route: 'En Route',
    arrived: 'Arrived',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getTransportStatusColor(status: TransportStatus): string {
  const colors: Record<TransportStatus, string> = {
    requested: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    assigned: 'bg-blue-100 text-blue-700 border-blue-200',
    en_route: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    arrived: 'bg-purple-100 text-purple-700 border-purple-200',
    in_transit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    delivered: 'bg-teal-100 text-teal-700 border-teal-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get transport type label
 */
export function getTransportTypeLabel(type: TransportType): string {
  const labels: Record<TransportType, string> = {
    wheelchair: 'Wheelchair',
    stretcher: 'Stretcher',
    bed: 'Bed',
    ambulatory: 'Ambulatory',
    bariatric: 'Bariatric',
    isolation: 'Isolation',
    critical: 'Critical Care',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get transport reason label
 */
export function getTransportReasonLabel(reason: TransportReason): string {
  const labels: Record<TransportReason, string> = {
    admission: 'Admission',
    discharge: 'Discharge',
    transfer: 'Transfer',
    procedure: 'Procedure',
    imaging: 'Imaging',
    surgery: 'Surgery',
    therapy: 'Therapy',
    dialysis: 'Dialysis',
    test: 'Test/Lab',
    other: 'Other',
  };
  return labels[reason] || reason;
}

/**
 * Calculate wait time in minutes
 */
export function calculateWaitMinutes(
  requestedAt: string,
  pickupStartedAt: string
): number {
  const start = new Date(requestedAt).getTime();
  const end = new Date(pickupStartedAt).getTime();
  return Math.round((end - start) / 60000);
}

/**
 * Calculate transit time in minutes
 */
export function calculateTransitMinutes(
  transitStartedAt: string,
  deliveredAt: string
): number {
  const start = new Date(transitStartedAt).getTime();
  const end = new Date(deliveredAt).getTime();
  return Math.round((end - start) / 60000);
}

/**
 * Format estimated arrival time
 */
export function formatETA(minutes: number): string {
  if (minutes < 1) return 'Arriving now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
