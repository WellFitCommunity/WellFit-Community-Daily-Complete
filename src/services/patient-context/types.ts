/**
 * Internal types for Patient Context Service
 *
 * These are database row shapes used internally by the fetch modules.
 * External consumers should use types from `@/types/patientContext`.
 *
 * @module patient-context/types
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

/**
 * Internal profile row shape (from profiles table)
 *
 * Note: Currently (Phase 1), profiles.user_id === patient_id (same UUID).
 * This mapping is abstracted here so when caregiver/proxy access is added,
 * only this service needs to change - not consumers.
 */
export interface ProfileRow {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  preferred_language: string | null;
  enrollment_type: 'app' | 'hospital' | null;
  tenant_id: string | null;
  mrn: string | null;
  hospital_unit: string | null;
  room_number: string | null;
  bed_number: string | null;
  acuity_level: number | null;
  code_status: string | null;
  admission_date: string | null;
  attending_physician_id: string | null;
}

/**
 * Internal admission row shape
 */
export interface AdmissionRow {
  id: string;
  patient_id: string;
  room_number: string | null;
  facility_unit: string | null;
  admission_date: string;
  is_active: boolean;
  admission_diagnosis: string | null;
  attending_physician_id: string | null;
}

/**
 * Internal check-in row shape (from `check_ins` table)
 *
 * Note: Community daily check-ins use the `check_ins` table.
 * The separate `patient_daily_check_ins` table is for care-plan-linked
 * readmission tracking check-ins (different schema, JSONB responses).
 */
export interface CheckInRow {
  id: string;
  user_id: string;
  created_at: string;
  label: string | null;
  emotional_state: string | null;
  heart_rate: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  glucose_mg_dl: number | null;
  pulse_oximeter: number | null;
  notes: string | null;
  is_emergency: boolean;
}

/**
 * Internal care plan row shape
 */
export interface CarePlanRow {
  id: string;
  patient_id: string;
  plan_type: string;
  status: string;
  title: string;
  goals: unknown;
  next_review_date: string | null;
  primary_coordinator_id: string | null;
}

/**
 * Shared return type for all fetch modules
 */
export interface FetchResult<T> {
  success: boolean;
  data: T | null;
  source: {
    source: string;
    fetched_at: string;
    success: boolean;
    record_count: number | null;
    note: string | null;
  };
}
