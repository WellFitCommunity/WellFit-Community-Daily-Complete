/**
 * Provider Coverage Service — Type Definitions
 *
 * Extracted from providerCoverageService.ts to keep the service under 600 lines.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

/** Coverage shift type — includes swing/24hr for provider coverage scheduling */
export type ShiftType = 'day' | 'night' | 'swing' | '24hr';
export type CoverageRole = 'primary' | 'secondary' | 'backup';
export type CoverageReason = 'vacation' | 'pto' | 'sick' | 'training' | 'personal' | 'on_call_swap' | 'other';
export type CoverageStatus = 'active' | 'completed' | 'cancelled';

export interface OnCallSchedule {
  id: string;
  provider_id: string;
  facility_id: string | null;
  unit_id: string | null;
  schedule_date: string;
  shift_start: string;
  shift_end: string;
  shift_type: ShiftType;
  coverage_role: CoverageRole;
  is_active: boolean;
  notes: string | null;
  tenant_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoverageAssignment {
  id: string;
  absent_provider_id: string;
  coverage_provider_id: string;
  facility_id: string | null;
  unit_id: string | null;
  effective_start: string;
  effective_end: string;
  coverage_reason: CoverageReason;
  coverage_priority: number;
  status: CoverageStatus;
  auto_route_tasks: boolean;
  notes: string | null;
  tenant_id: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoverageSummaryRow extends CoverageAssignment {
  absent_first_name: string | null;
  absent_last_name: string | null;
  coverage_first_name: string | null;
  coverage_last_name: string | null;
  computed_status: string;
}

export interface CoverageMetrics {
  active_coverages: number;
  upcoming_coverages: number;
  on_call_today: number;
  providers_absent_today: number;
  unassigned_absences: number;
}

export interface OnCallScheduleInput {
  provider_id: string;
  facility_id?: string;
  unit_id?: string;
  schedule_date: string;
  shift_start?: string;
  shift_end?: string;
  shift_type: ShiftType;
  coverage_role: CoverageRole;
  notes?: string;
}

export interface CoverageAssignmentInput {
  absent_provider_id: string;
  coverage_provider_id: string;
  facility_id?: string;
  unit_id?: string;
  effective_start: string;
  effective_end: string;
  coverage_reason: CoverageReason;
  coverage_priority?: number;
  auto_route_tasks?: boolean;
  notes?: string;
}

export interface CoverageAssignmentFilters {
  status?: 'all' | CoverageStatus | 'upcoming';
  coverage_reason?: CoverageReason;
}

export interface CoverageProviderResult {
  coverage_provider_id: string;
  coverage_priority: number;
  coverage_reason: string;
  auto_route_tasks: boolean;
  assignment_id: string;
}
