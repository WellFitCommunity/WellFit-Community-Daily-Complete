/**
 * Bed Management Types
 *
 * TypeScript interfaces for the Predictive Bed Management System.
 * Used by bed management panel, services, and edge function responses.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

// Bed status enum matching database
export type BedStatus =
  | 'available'
  | 'occupied'
  | 'dirty'
  | 'cleaning'
  | 'blocked'
  | 'maintenance'
  | 'reserved';

// Bed type enum matching database
export type BedType =
  | 'standard'
  | 'bariatric'
  | 'pediatric'
  | 'nicu'
  | 'icu'
  | 'labor_delivery'
  | 'stretcher'
  | 'recliner'
  | 'crib'
  | 'bassinet';

// Hospital unit type enum
export type UnitType =
  | 'icu'
  | 'step_down'
  | 'telemetry'
  | 'med_surg'
  | 'oncology'
  | 'cardiac'
  | 'neuro'
  | 'ortho'
  | 'rehab'
  | 'psych'
  | 'peds'
  | 'nicu'
  | 'picu'
  | 'labor_delivery'
  | 'postpartum'
  | 'nursery'
  | 'ed'
  | 'ed_holding'
  | 'or'
  | 'pacu'
  | 'observation'
  | 'other';

// Patient acuity levels
export type AcuityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Hospital Unit - Care units like ICU, Med-Surg, etc.
 */
export interface HospitalUnit {
  id: string;
  tenant_id: string;
  facility_id?: string;
  department_id?: string;
  unit_code: string;
  unit_name: string;
  unit_type: UnitType;
  floor_number?: string;
  building?: string;
  total_beds: number;
  operational_beds?: number;
  target_census?: number;
  max_census?: number;
  nurse_patient_ratio?: string;
  charge_nurse_required: boolean;
  min_acuity_level: number;
  max_acuity_level: number;
  is_active: boolean;
  is_accepting_patients: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Bed - Physical bed with capabilities and current status
 */
export interface Bed {
  id: string;
  tenant_id: string;
  unit_id: string;
  room_number: string;
  bed_position: string;
  bed_label: string;
  bed_type: BedType;
  has_telemetry: boolean;
  has_isolation_capability: boolean;
  has_negative_pressure: boolean;
  is_bariatric_capable: boolean;
  has_special_equipment?: string[];
  status: BedStatus;
  status_changed_at: string;
  status_changed_by?: string;
  status_notes?: string;
  reserved_for_patient_id?: string;
  reserved_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Bed Board Entry - Combined view of bed with patient info
 */
export interface BedBoardEntry {
  bed_id: string;
  bed_label: string;
  room_number: string;
  bed_position: string;
  bed_type: BedType;
  status: BedStatus;
  status_changed_at: string;
  has_telemetry: boolean;
  has_isolation_capability: boolean;
  has_negative_pressure: boolean;
  unit_id: string;
  unit_code: string;
  unit_name: string;
  unit_type: UnitType;
  floor_number?: string;
  facility_id?: string;
  facility_name?: string;
  patient_id?: string;
  patient_name?: string;
  patient_mrn?: string;
  assigned_at?: string;
  expected_discharge_date?: string;
  patient_acuity?: AcuityLevel;
  tenant_id: string;
}

/**
 * Unit Capacity Summary - Aggregated bed counts per unit
 */
export interface UnitCapacity {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  unit_type: UnitType;
  total_beds: number;
  target_census?: number;
  max_census?: number;
  facility_name?: string;
  active_beds: number;
  occupied: number;
  available: number;
  pending_clean: number;
  out_of_service: number;
  occupancy_pct: number;
  tenant_id: string;
}

/**
 * Unit Census - Real-time census with acuity breakdown
 */
export interface UnitCensus {
  unit_id: string;
  unit_name: string;
  total_beds: number;
  occupied: number;
  available: number;
  dirty: number;
  blocked: number;
  occupancy_rate: number;
  critical_patients: number;
  high_acuity_patients: number;
}

/**
 * Bed Assignment - Patient-to-bed relationship
 */
export interface BedAssignment {
  id: string;
  tenant_id: string;
  bed_id: string;
  patient_id: string;
  assigned_at: string;
  assigned_by?: string;
  expected_discharge_date?: string;
  expected_discharge_time?: string;
  discharge_disposition?: string;
  discharged_at?: string;
  discharged_by?: string;
  actual_disposition?: string;
  transferred_from_bed_id?: string;
  transfer_reason?: string;
  is_active: boolean;
  adt_event_id?: string;
  adt_source?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Available Bed - Bed matching search criteria
 */
export interface AvailableBed {
  bed_id: string;
  bed_label: string;
  unit_id: string;
  unit_name: string;
  room_number: string;
  bed_type: BedType;
  has_telemetry: boolean;
  has_isolation_capability: boolean;
  has_negative_pressure: boolean;
}

/**
 * Bed Forecast - ML prediction for future availability
 */
export interface BedForecast {
  id: string;
  tenant_id: string;
  unit_id: string;
  forecast_date: string;
  predicted_census: number;
  predicted_available: number;
  predicted_discharges?: number;
  predicted_admissions?: number;
  confidence_level?: number;
  lower_bound?: number;
  upper_bound?: number;
  factors_json?: ForecastFactors;
  model_version: string;
  generated_at: string;
  actual_census?: number;
  actual_available?: number;
  forecast_error?: number;
  error_percentage?: number;
  created_at: string;
}

/**
 * Forecast Factors - Inputs used for prediction transparency
 */
export interface ForecastFactors {
  current_census: number;
  total_beds: number;
  expected_discharges: number;
  scheduled_arrivals: number;
  days_ahead: number;
  day_of_week: number;
  historical_avg_los?: number;
  day_of_week_adjustment?: number;
  weather_factor?: number;
}

/**
 * Predicted Discharge - Patient with discharge likelihood
 */
export interface PredictedDischarge {
  patient_id: string;
  patient_name: string;
  bed_label: string;
  days_in_hospital: number;
  expected_discharge_date?: string;
  discharge_likelihood: 'High' | 'Medium' | 'Low';
  los_remaining_days: number;
}

/**
 * Bed Status History - Audit trail entry
 */
export interface BedStatusHistory {
  id: string;
  tenant_id: string;
  bed_id: string;
  previous_status?: BedStatus;
  new_status: BedStatus;
  changed_at: string;
  changed_by?: string;
  reason?: string;
  related_assignment_id?: string;
  duration_minutes?: number;
  created_at: string;
}

/**
 * Daily Census Snapshot - Historical census metrics
 */
export interface DailyCensusSnapshot {
  id: string;
  tenant_id: string;
  unit_id: string;
  census_date: string;
  midnight_census: number;
  midnight_available: number;
  admissions_count: number;
  discharges_count: number;
  transfers_in: number;
  transfers_out: number;
  peak_census?: number;
  peak_time?: string;
  eod_census?: number;
  eod_available?: number;
  occupied_bed_hours?: number;
  average_acuity?: number;
  critical_patients: number;
  high_acuity_patients: number;
  predicted_census?: number;
  census_variance?: number;
  prediction_accuracy?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Scheduled Arrival - Known incoming patient
 */
export interface ScheduledArrival {
  id: string;
  tenant_id: string;
  facility_id?: string;
  patient_id?: string;
  patient_name?: string;
  patient_mrn?: string;
  arrival_type: 'scheduled_surgery' | 'planned_admission' | 'transfer_in' |
                'ed_boarding' | 'observation' | 'direct_admit' | 'other';
  scheduled_date: string;
  scheduled_time?: string;
  target_unit_id?: string;
  target_unit_type?: UnitType;
  required_bed_type?: BedType;
  required_equipment?: string[];
  isolation_required: boolean;
  acuity_level?: number;
  expected_los_days?: number;
  expected_discharge_date?: string;
  status: 'scheduled' | 'confirmed' | 'arrived' | 'cancelled' | 'no_show';
  actual_arrival_time?: string;
  assigned_bed_id?: string;
  source_system?: string;
  external_reference?: string;
  created_at: string;
  updated_at: string;
}

/**
 * ML Learning Feedback - Staff correction to improve predictions
 */
export interface MLLearningFeedback {
  id?: string;
  tenant_id: string;
  unit_id: string;
  feedback_date: string;
  feedback_type: 'discharge_timing' | 'census_prediction' | 'los_estimate' | 'arrival_prediction';
  predicted_value: number;
  actual_value: number;
  variance: number;
  variance_percentage: number;
  staff_notes?: string;
  factors_considered?: string[];
  submitted_by: string;
  created_at?: string;
}

/**
 * Prediction Accuracy Summary - For learning dashboard
 */
export interface PredictionAccuracySummary {
  unit_id: string;
  unit_name: string;
  prediction_type: string;
  total_predictions: number;
  mean_error: number;
  mean_absolute_error: number;
  accuracy_percentage: number;
  improving_trend: boolean;
  last_30_days_accuracy: number;
  samples_for_improvement: number;
}

// Helper functions

/**
 * Get human-readable bed status label
 */
export function getBedStatusLabel(status: BedStatus): string {
  const labels: Record<BedStatus, string> = {
    available: 'Available',
    occupied: 'Occupied',
    dirty: 'Needs Cleaning',
    cleaning: 'Being Cleaned',
    blocked: 'Blocked',
    maintenance: 'Maintenance',
    reserved: 'Reserved',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI display
 */
export function getBedStatusColor(status: BedStatus): string {
  const colors: Record<BedStatus, string> = {
    available: 'bg-green-100 text-green-700 border-green-200',
    occupied: 'bg-blue-100 text-blue-700 border-blue-200',
    dirty: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    cleaning: 'bg-orange-100 text-orange-700 border-orange-200',
    blocked: 'bg-red-100 text-red-700 border-red-200',
    maintenance: 'bg-gray-100 text-gray-700 border-gray-200',
    reserved: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * Get unit type label
 */
export function getUnitTypeLabel(type: UnitType): string {
  const labels: Record<UnitType, string> = {
    icu: 'ICU',
    step_down: 'Step Down',
    telemetry: 'Telemetry',
    med_surg: 'Med-Surg',
    oncology: 'Oncology',
    cardiac: 'Cardiac',
    neuro: 'Neuro',
    ortho: 'Orthopedics',
    rehab: 'Rehabilitation',
    psych: 'Psychiatry',
    peds: 'Pediatrics',
    nicu: 'NICU',
    picu: 'PICU',
    labor_delivery: 'Labor & Delivery',
    postpartum: 'Postpartum',
    nursery: 'Nursery',
    ed: 'Emergency',
    ed_holding: 'ED Holding',
    or: 'Operating Room',
    pacu: 'PACU',
    observation: 'Observation',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get bed type label
 */
export function getBedTypeLabel(type: BedType): string {
  const labels: Record<BedType, string> = {
    standard: 'Standard',
    bariatric: 'Bariatric',
    pediatric: 'Pediatric',
    nicu: 'NICU',
    icu: 'ICU',
    labor_delivery: 'Labor & Delivery',
    stretcher: 'Stretcher',
    recliner: 'Recliner',
    crib: 'Crib',
    bassinet: 'Bassinet',
  };
  return labels[type] || type;
}

/**
 * Get acuity color
 */
export function getAcuityColor(acuity?: AcuityLevel): string {
  if (!acuity) return 'bg-gray-100 text-gray-600';
  const colors: Record<AcuityLevel, string> = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-yellow-100 text-yellow-700',
    HIGH: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-700',
  };
  return colors[acuity];
}

/**
 * Calculate occupancy percentage safely
 */
export function calculateOccupancy(occupied: number, total: number): number {
  if (!total || total === 0) return 0;
  return Math.round((occupied / total) * 100);
}

/**
 * Get occupancy color based on percentage
 */
export function getOccupancyColor(percentage: number): string {
  if (percentage >= 95) return 'text-red-600';
  if (percentage >= 85) return 'text-orange-600';
  if (percentage >= 70) return 'text-yellow-600';
  return 'text-green-600';
}
