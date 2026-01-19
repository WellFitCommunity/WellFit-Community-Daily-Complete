/**
 * Health System Types
 *
 * TypeScript interfaces for multi-facility health system management.
 * Supports network-wide bed visibility and capacity coordination.
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import type { AcuityLevel, BedStatus } from './bed';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Facility type within health system
 */
export type FacilityType =
  | 'acute_care'       // Full-service hospital
  | 'critical_access'  // Small rural hospital
  | 'specialty'        // Specialty hospital (cardiac, orthopedic, etc.)
  | 'ltach'            // Long-term acute care
  | 'rehab'            // Inpatient rehabilitation
  | 'psych'            // Psychiatric facility
  | 'childrens';       // Children's hospital

/**
 * Capacity alert level
 */
export type CapacityAlertLevel =
  | 'normal'     // <70% occupancy
  | 'watch'      // 70-80% occupancy
  | 'warning'    // 80-90% occupancy
  | 'critical'   // 90-95% occupancy
  | 'divert';    // >95% or on divert

/**
 * Trend direction
 */
export type TrendDirection = 'up' | 'down' | 'stable';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Health System - Parent organization for facilities
 */
export interface HealthSystem {
  id: string;
  tenant_id: string;
  name: string;
  short_name?: string;
  region?: string;

  // Contact
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;

  // Capacity management
  central_transfer_number?: string;
  bed_control_email?: string;

  // Network settings
  total_facilities: number;
  total_licensed_beds: number;
  enable_cross_facility_transfers: boolean;

  created_at: string;
  updated_at: string;
}

/**
 * Health System Facility
 */
export interface HealthSystemFacility {
  id: string;
  tenant_id: string;
  health_system_id: string;

  // Identification
  facility_code: string;
  name: string;
  short_name?: string;
  facility_type: FacilityType;

  // Location
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;

  // Contact
  main_phone?: string;
  bed_control_phone?: string;
  transfer_center_phone?: string;

  // Capacity
  licensed_beds: number;
  staffed_beds: number;
  icu_beds: number;
  step_down_beds: number;
  telemetry_beds: number;
  med_surg_beds: number;

  // Status
  is_active: boolean;
  is_accepting_transfers: boolean;
  divert_status: boolean;

  // Services offered
  services_offered?: string[];
  specialties?: string[];

  created_at: string;
  updated_at: string;
}

/**
 * Real-time facility capacity snapshot
 */
export interface FacilityCapacitySnapshot {
  id: string;
  tenant_id: string;
  facility_id: string;
  facility_name: string;
  facility_code: string;

  // Current census
  total_beds: number;
  occupied_beds: number;
  available_beds: number;
  reserved_beds: number;
  blocked_beds: number;
  pending_discharge: number;
  pending_admission: number;

  // Occupancy
  occupancy_percent: number;
  alert_level: CapacityAlertLevel;

  // By unit type
  icu_occupied: number;
  icu_available: number;
  step_down_occupied: number;
  step_down_available: number;
  telemetry_occupied: number;
  telemetry_available: number;
  med_surg_occupied: number;
  med_surg_available: number;
  ed_census: number;
  ed_boarding: number;

  // Trends
  trend_1h: TrendDirection;
  trend_4h: TrendDirection;
  trend_24h: TrendDirection;

  // Predictions
  predicted_available_4h: number;
  predicted_available_8h: number;
  predicted_available_12h: number;
  predicted_available_24h: number;

  // Status
  is_accepting_transfers: boolean;
  divert_status: boolean;
  divert_reason?: string;

  // Timestamps
  snapshot_at: string;
  next_predicted_discharge?: string;
  created_at: string;
}

/**
 * Command Center Summary - Aggregate view
 */
export interface CommandCenterSummary {
  health_system_id: string;
  health_system_name: string;

  // Network totals
  total_facilities: number;
  total_beds: number;
  total_occupied: number;
  total_available: number;
  network_occupancy_percent: number;

  // Alerts
  facilities_on_divert: number;
  facilities_critical: number;
  facilities_warning: number;

  // ED status
  total_ed_boarding: number;
  longest_ed_boarder_minutes: number;

  // Transfers
  pending_transfers_in: number;
  pending_transfers_out: number;

  // By facility
  facilities: FacilityCapacitySnapshot[];

  // Timestamp
  as_of: string;
}

/**
 * Capacity Alert
 */
export interface CapacityAlert {
  id: string;
  tenant_id: string;
  facility_id: string;
  facility_name: string;

  alert_level: CapacityAlertLevel;
  previous_level?: CapacityAlertLevel;

  // Details
  current_occupancy_percent: number;
  threshold_crossed: number;
  message: string;

  // Status
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;

  // Timestamps
  triggered_at: string;
  resolved_at?: string;
  created_at: string;
}

/**
 * Cross-facility bed recommendation
 */
export interface BedRecommendation {
  patient_id?: string;
  source_facility_id: string;
  source_facility_name: string;

  recommended_facility_id: string;
  recommended_facility_name: string;
  recommended_unit_type: string;

  // Reasoning
  distance_miles?: number;
  estimated_transfer_minutes?: number;
  available_beds: number;
  match_score: number;
  reason: string;

  created_at: string;
}

/**
 * Command Center Filter Options
 */
export interface CommandCenterFilters {
  healthSystemId?: string;
  facilityIds?: string[];
  alertLevelMin?: CapacityAlertLevel;
  unitType?: string;
  showOnlyAccepting?: boolean;
  showOnlyDivert?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get capacity alert level based on occupancy
 */
export function getCapacityAlertLevel(occupancyPercent: number, onDivert: boolean): CapacityAlertLevel {
  if (onDivert) return 'divert';
  if (occupancyPercent >= 95) return 'divert';
  if (occupancyPercent >= 90) return 'critical';
  if (occupancyPercent >= 80) return 'warning';
  if (occupancyPercent >= 70) return 'watch';
  return 'normal';
}

/**
 * Get alert level label
 */
export function getAlertLevelLabel(level: CapacityAlertLevel): string {
  const labels: Record<CapacityAlertLevel, string> = {
    normal: 'Normal',
    watch: 'Watch',
    warning: 'Warning',
    critical: 'Critical',
    divert: 'Divert',
  };
  return labels[level] || level;
}

/**
 * Get alert level color
 */
export function getAlertLevelColor(level: CapacityAlertLevel): string {
  const colors: Record<CapacityAlertLevel, string> = {
    normal: 'bg-green-100 text-green-700 border-green-200',
    watch: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    warning: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
    divert: 'bg-red-600 text-white border-red-700',
  };
  return colors[level] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get heatmap color based on occupancy (for visual displays)
 */
export function getOccupancyHeatmapColor(occupancyPercent: number): string {
  if (occupancyPercent < 70) return '#22c55e';      // Green
  if (occupancyPercent < 80) return '#eab308';      // Yellow
  if (occupancyPercent < 90) return '#f97316';      // Orange
  if (occupancyPercent < 95) return '#ef4444';      // Red
  return '#7f1d1d';                                  // Dark red
}

/**
 * Get facility type label
 */
export function getFacilityTypeLabel(type: FacilityType): string {
  const labels: Record<FacilityType, string> = {
    acute_care: 'Acute Care Hospital',
    critical_access: 'Critical Access Hospital',
    specialty: 'Specialty Hospital',
    ltach: 'Long-Term Acute Care',
    rehab: 'Rehabilitation Hospital',
    psych: 'Psychiatric Facility',
    childrens: "Children's Hospital",
  };
  return labels[type] || type;
}

/**
 * Get trend icon
 */
export function getTrendIcon(trend: TrendDirection): string {
  const icons: Record<TrendDirection, string> = {
    up: '\u2191',      // Up arrow
    down: '\u2193',    // Down arrow
    stable: '\u2192',  // Right arrow
  };
  return icons[trend] || '';
}

/**
 * Get trend color
 */
export function getTrendColor(trend: TrendDirection, isCapacity: boolean): string {
  // For capacity, down is good (more available). For occupancy, down is also good.
  if (isCapacity) {
    return trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';
  }
  return trend === 'down' ? 'text-green-600' : trend === 'up' ? 'text-red-600' : 'text-gray-500';
}

/**
 * Calculate network occupancy from facility list
 */
export function calculateNetworkOccupancy(facilities: FacilityCapacitySnapshot[]): number {
  const totalBeds = facilities.reduce((sum, f) => sum + f.total_beds, 0);
  const totalOccupied = facilities.reduce((sum, f) => sum + f.occupied_beds, 0);

  if (totalBeds === 0) return 0;
  return Math.round((totalOccupied / totalBeds) * 100);
}

/**
 * Sort facilities by alert level (most critical first)
 */
export function sortFacilitiesByAlertLevel(
  facilities: FacilityCapacitySnapshot[]
): FacilityCapacitySnapshot[] {
  const levelOrder: Record<CapacityAlertLevel, number> = {
    divert: 5,
    critical: 4,
    warning: 3,
    watch: 2,
    normal: 1,
  };

  return [...facilities].sort((a, b) => {
    const levelDiff = (levelOrder[b.alert_level] || 0) - (levelOrder[a.alert_level] || 0);
    if (levelDiff !== 0) return levelDiff;
    return b.occupancy_percent - a.occupancy_percent;
  });
}

/**
 * Group facilities by alert level
 */
export function groupFacilitiesByAlertLevel(
  facilities: FacilityCapacitySnapshot[]
): Record<CapacityAlertLevel, FacilityCapacitySnapshot[]> {
  const groups: Record<CapacityAlertLevel, FacilityCapacitySnapshot[]> = {
    normal: [],
    watch: [],
    warning: [],
    critical: [],
    divert: [],
  };

  for (const facility of facilities) {
    groups[facility.alert_level].push(facility);
  }

  return groups;
}
