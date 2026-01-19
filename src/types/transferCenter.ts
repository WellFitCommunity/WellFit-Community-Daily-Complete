/**
 * Transfer Center Types
 *
 * TypeScript interfaces for inter-facility transfer coordination.
 * Supports network-wide patient movement between facilities.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type { AcuityLevel } from './bed';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Transfer request status
 */
export type TransferRequestStatus =
  | 'pending'           // Initial request submitted
  | 'reviewing'         // Under review by receiving facility
  | 'approved'          // Approved, awaiting logistics
  | 'denied'            // Denied by receiving facility
  | 'scheduled'         // Transport scheduled
  | 'in_transit'        // Patient en route
  | 'arrived'           // Patient arrived at receiving facility
  | 'completed'         // Transfer fully completed
  | 'cancelled';        // Transfer cancelled

/**
 * Transfer urgency level
 */
export type TransferUrgency =
  | 'routine'           // Standard transfer, can wait
  | 'urgent'            // Within 24 hours
  | 'emergent'          // Within 4 hours
  | 'stat';             // Immediate, life-threatening

/**
 * Transfer type
 */
export type TransferType =
  | 'step_up'           // To higher level of care
  | 'step_down'         // To lower level of care
  | 'lateral'           // Same level, capacity/specialty
  | 'specialty'         // Requires specific service
  | 'repatriation';     // Return to home facility

/**
 * Transport mode
 */
export type TransportMode =
  | 'ground_ambulance'
  | 'air_ambulance'
  | 'critical_care_transport'
  | 'wheelchair_van'
  | 'private_vehicle'
  | 'walk_in';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Transfer Request - Inter-facility patient transfer
 */
export interface TransferRequest {
  id: string;
  tenant_id: string;
  request_number: string;

  // Patient info (de-identified for transfer coordination)
  patient_id: string;
  patient_mrn?: string;
  patient_age?: number;
  patient_gender?: string;

  // Sending facility
  sending_facility_id: string;
  sending_facility_name?: string;
  sending_unit?: string;
  sending_contact_name?: string;
  sending_contact_phone?: string;

  // Receiving facility
  receiving_facility_id?: string;
  receiving_facility_name?: string;
  receiving_unit?: string;
  receiving_contact_name?: string;
  receiving_contact_phone?: string;
  receiving_physician?: string;

  // Transfer details
  transfer_type: TransferType;
  urgency: TransferUrgency;
  status: TransferRequestStatus;
  reason_for_transfer: string;
  clinical_summary?: string;

  // Medical requirements
  diagnosis_codes?: string[];
  primary_diagnosis?: string;
  required_service?: string;
  required_specialty?: string;
  acuity_level: AcuityLevel;

  // Special needs
  requires_icu: boolean;
  requires_isolation: boolean;
  requires_ventilator: boolean;
  requires_cardiac_monitoring: boolean;
  special_equipment?: string[];
  special_requirements?: string;

  // Transport
  transport_mode?: TransportMode;
  transport_company?: string;
  transport_eta?: string;
  transport_notes?: string;

  // Bed assignment
  assigned_bed_id?: string;
  assigned_bed_label?: string;

  // Timeline
  requested_at: string;
  reviewed_at?: string;
  approved_at?: string;
  denied_at?: string;
  denial_reason?: string;
  scheduled_departure?: string;
  actual_departure?: string;
  actual_arrival?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;

  // Metadata
  created_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Facility Capacity Snapshot
 */
export interface FacilityCapacity {
  id: string;
  tenant_id: string;
  facility_id: string;
  facility_name: string;

  // Census
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  reserved_beds: number;
  blocked_beds: number;

  // Occupancy
  occupancy_percent: number;
  is_accepting_transfers: boolean;
  divert_status: boolean;

  // By unit type
  icu_available: number;
  step_down_available: number;
  telemetry_available: number;
  med_surg_available: number;
  ed_available: number;

  // Timestamps
  snapshot_at: string;
  next_discharge_expected?: string;
  created_at: string;
}

/**
 * Transfer Center Metrics
 */
export interface TransferCenterMetrics {
  total_pending: number;
  total_in_transit: number;
  total_completed_today: number;
  avg_approval_time_minutes: number;
  avg_transfer_time_minutes: number;
  pending_by_urgency: Record<TransferUrgency, number>;
  pending_by_type: Record<TransferType, number>;
  transfers_by_facility: Record<string, number>;
  denial_rate_percent: number;
}

/**
 * Transfer Request Input
 */
export interface CreateTransferRequestInput {
  patient_id: string;
  patient_mrn?: string;
  patient_age?: number;
  patient_gender?: string;
  sending_facility_id: string;
  sending_unit?: string;
  sending_contact_name?: string;
  sending_contact_phone?: string;
  receiving_facility_id?: string;
  transfer_type: TransferType;
  urgency: TransferUrgency;
  reason_for_transfer: string;
  clinical_summary?: string;
  diagnosis_codes?: string[];
  primary_diagnosis?: string;
  required_service?: string;
  required_specialty?: string;
  acuity_level: AcuityLevel;
  requires_icu?: boolean;
  requires_isolation?: boolean;
  requires_ventilator?: boolean;
  requires_cardiac_monitoring?: boolean;
  special_equipment?: string[];
  special_requirements?: string;
  transport_mode?: TransportMode;
  notes?: string;
}

/**
 * Transfer Approval Input
 */
export interface ApproveTransferInput {
  transfer_id: string;
  receiving_unit?: string;
  receiving_contact_name?: string;
  receiving_contact_phone?: string;
  receiving_physician?: string;
  assigned_bed_id?: string;
  assigned_bed_label?: string;
  notes?: string;
}

/**
 * Transfer Denial Input
 */
export interface DenyTransferInput {
  transfer_id: string;
  denial_reason: string;
  notes?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get transfer status label
 */
export function getTransferStatusLabel(status: TransferRequestStatus): string {
  const labels: Record<TransferRequestStatus, string> = {
    pending: 'Pending Review',
    reviewing: 'Under Review',
    approved: 'Approved',
    denied: 'Denied',
    scheduled: 'Scheduled',
    in_transit: 'In Transit',
    arrived: 'Arrived',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get transfer status color
 */
export function getTransferStatusColor(status: TransferRequestStatus): string {
  const colors: Record<TransferRequestStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    reviewing: 'bg-blue-100 text-blue-700 border-blue-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    denied: 'bg-red-100 text-red-700 border-red-200',
    scheduled: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    in_transit: 'bg-purple-100 text-purple-700 border-purple-200',
    arrived: 'bg-teal-100 text-teal-700 border-teal-200',
    completed: 'bg-gray-100 text-gray-600 border-gray-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get urgency label
 */
export function getUrgencyLabel(urgency: TransferUrgency): string {
  const labels: Record<TransferUrgency, string> = {
    routine: 'Routine',
    urgent: 'Urgent',
    emergent: 'Emergent',
    stat: 'STAT',
  };
  return labels[urgency] || urgency;
}

/**
 * Get urgency color
 */
export function getUrgencyColor(urgency: TransferUrgency): string {
  const colors: Record<TransferUrgency, string> = {
    routine: 'bg-gray-100 text-gray-700 border-gray-200',
    urgent: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    emergent: 'bg-orange-100 text-orange-700 border-orange-200',
    stat: 'bg-red-600 text-white border-red-700',
  };
  return colors[urgency] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get transfer type label
 */
export function getTransferTypeLabel(type: TransferType): string {
  const labels: Record<TransferType, string> = {
    step_up: 'Step Up',
    step_down: 'Step Down',
    lateral: 'Lateral Transfer',
    specialty: 'Specialty Service',
    repatriation: 'Repatriation',
  };
  return labels[type] || type;
}

/**
 * Get transport mode label
 */
export function getTransportModeLabel(mode: TransportMode): string {
  const labels: Record<TransportMode, string> = {
    ground_ambulance: 'Ground Ambulance',
    air_ambulance: 'Air Ambulance',
    critical_care_transport: 'Critical Care Transport',
    wheelchair_van: 'Wheelchair Van',
    private_vehicle: 'Private Vehicle',
    walk_in: 'Walk-in',
  };
  return labels[mode] || mode;
}

/**
 * Check if transfer can be cancelled
 */
export function canCancelTransfer(status: TransferRequestStatus): boolean {
  return ['pending', 'reviewing', 'approved', 'scheduled'].includes(status);
}

/**
 * Check if transfer can be approved
 */
export function canApproveTransfer(status: TransferRequestStatus): boolean {
  return ['pending', 'reviewing'].includes(status);
}

/**
 * Get urgency sort order (higher = more urgent)
 */
export function getUrgencySortOrder(urgency: TransferUrgency): number {
  const order: Record<TransferUrgency, number> = {
    stat: 4,
    emergent: 3,
    urgent: 2,
    routine: 1,
  };
  return order[urgency] || 0;
}
