/**
 * ED Boarding Types
 *
 * TypeScript interfaces for tracking ED patients waiting for inpatient beds.
 * Supports automatic escalation alerts at time thresholds.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type { AcuityLevel, UnitType } from './bed';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * ED boarder status
 */
export type EDBoaderStatus =
  | 'awaiting_bed'      // Admitted, waiting for bed assignment
  | 'bed_assigned'      // Bed assigned, awaiting transport
  | 'in_transport'      // Being transported to unit
  | 'placed'            // Arrived at inpatient bed
  | 'cancelled';        // Admission cancelled

/**
 * Boarding escalation level based on wait time
 */
export type EscalationLevel =
  | 'green'     // <2 hours - normal
  | 'yellow'    // 2-4 hours - monitor
  | 'orange'    // 4-8 hours - escalate to charge nurse
  | 'red'       // 8-12 hours - escalate to supervisor
  | 'critical'; // >12 hours - escalate to administration

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * ED Boarder - Patient in ED waiting for inpatient bed
 */
export interface EDBoarder {
  id: string;
  tenant_id: string;
  patient_id: string;
  patient_name?: string;
  patient_mrn?: string;

  // ED location
  ed_bed_id?: string;
  ed_bed_label?: string;
  ed_zone?: string;

  // Admission details
  admit_decision_at: string;
  admitting_physician?: string;
  admitting_service?: string;
  admission_diagnosis?: string;

  // Bed requirements
  target_unit_type?: UnitType;
  target_unit_id?: string;
  required_bed_type?: string;
  requires_telemetry: boolean;
  requires_isolation: boolean;
  requires_negative_pressure: boolean;
  special_requirements?: string[];

  // Patient acuity
  acuity_level: AcuityLevel;
  is_critical: boolean;

  // Status tracking
  status: EDBoaderStatus;
  assigned_bed_id?: string;
  assigned_bed_label?: string;
  assigned_at?: string;
  placed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;

  // Boarding metrics
  boarding_start_at: string;
  boarding_minutes?: number;
  escalation_level: EscalationLevel;
  last_escalation_at?: string;
  escalation_acknowledged: boolean;
  escalation_acknowledged_by?: string;

  // Notes
  notes?: string;
  barriers_to_placement?: string[];

  created_at: string;
  updated_at: string;
}

/**
 * ED Boarding metrics for dashboard
 */
export interface EDBoaringMetrics {
  total_boarders: number;
  avg_boarding_minutes: number;
  boarders_by_escalation: Record<EscalationLevel, number>;
  boarders_by_acuity: Record<AcuityLevel, number>;
  longest_boarding_minutes: number;
  beds_assigned_pending_transport: number;
  target_boarding_minutes: number;
}

/**
 * ED Boarding summary by target unit
 */
export interface EDBoaringByUnit {
  target_unit_type: UnitType;
  target_unit_name?: string;
  boarder_count: number;
  avg_wait_minutes: number;
  critical_count: number;
  available_beds: number;
}

/**
 * Input for creating ED boarder
 */
export interface CreateEDBoarderInput {
  patient_id: string;
  patient_name?: string;
  patient_mrn?: string;
  ed_bed_id?: string;
  ed_bed_label?: string;
  ed_zone?: string;
  admitting_physician?: string;
  admitting_service?: string;
  admission_diagnosis?: string;
  target_unit_type?: UnitType;
  target_unit_id?: string;
  required_bed_type?: string;
  requires_telemetry?: boolean;
  requires_isolation?: boolean;
  requires_negative_pressure?: boolean;
  special_requirements?: string[];
  acuity_level: AcuityLevel;
  is_critical?: boolean;
  notes?: string;
}

/**
 * Input for assigning bed to boarder
 */
export interface AssignBedToBoarderInput {
  boarder_id: string;
  bed_id: string;
  bed_label: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate escalation level based on boarding minutes
 */
export function calculateEscalationLevel(boardingMinutes: number): EscalationLevel {
  if (boardingMinutes < 120) return 'green';        // <2 hours
  if (boardingMinutes < 240) return 'yellow';       // 2-4 hours
  if (boardingMinutes < 480) return 'orange';       // 4-8 hours
  if (boardingMinutes < 720) return 'red';          // 8-12 hours
  return 'critical';                                 // >12 hours
}

/**
 * Get escalation level label
 */
export function getEscalationLabel(level: EscalationLevel): string {
  const labels: Record<EscalationLevel, string> = {
    green: 'Normal',
    yellow: 'Monitor',
    orange: 'Escalate',
    red: 'Urgent',
    critical: 'Critical',
  };
  return labels[level] || level;
}

/**
 * Get escalation level color for UI
 */
export function getEscalationColor(level: EscalationLevel): string {
  const colors: Record<EscalationLevel, string> = {
    green: 'bg-green-100 text-green-700 border-green-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    orange: 'bg-orange-100 text-orange-700 border-orange-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    critical: 'bg-red-600 text-white border-red-700',
  };
  return colors[level] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get boarder status label
 */
export function getBoarderStatusLabel(status: EDBoaderStatus): string {
  const labels: Record<EDBoaderStatus, string> = {
    awaiting_bed: 'Awaiting Bed',
    bed_assigned: 'Bed Assigned',
    in_transport: 'In Transport',
    placed: 'Placed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get boarder status color
 */
export function getBoarderStatusColor(status: EDBoaderStatus): string {
  const colors: Record<EDBoaderStatus, string> = {
    awaiting_bed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    bed_assigned: 'bg-blue-100 text-blue-700 border-blue-200',
    in_transport: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    placed: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Format boarding time for display
 */
export function formatBoardingTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get escalation threshold in minutes
 */
export function getEscalationThresholdMinutes(level: EscalationLevel): number {
  const thresholds: Record<EscalationLevel, number> = {
    green: 0,
    yellow: 120,    // 2 hours
    orange: 240,    // 4 hours
    red: 480,       // 8 hours
    critical: 720,  // 12 hours
  };
  return thresholds[level] || 0;
}
