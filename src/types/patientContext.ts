/**
 * Canonical Patient Context Types
 *
 * ATLUS Requirement: Unity + Accountability
 * - Unity: One patient truth across all modules
 * - Accountability: Full traceability of data sources and freshness
 *
 * This file defines the SINGLE AUTHORITATIVE patient context model.
 * All modules (AI, readmission, discharge, EMS, billing, FHIR, contacts)
 * MUST use these types when working with patient data.
 *
 * @module patientContext
 *
 * ## IDENTITY STANDARD
 *
 * The codebase has two naming conventions:
 * - `user_id` in `profiles` table (legacy, references auth.users.id)
 * - `patient_id` in clinical tables (newer, also references auth.users.id)
 *
 * ### Current State (Phase 1)
 * Today, `patient_id` and `user_id` are 1:1 - they refer to the same
 * auth.users.id UUID. The authenticated user IS the patient.
 *
 * ### Future State (Caregiver/Proxy Support)
 * DO NOT ASSUME THIS IS PERMANENT. The architecture is designed so that:
 * - One user (caregiver) can access multiple patients
 * - One patient can be accessed by multiple users
 * - A mapping table (e.g., `user_patient_access`) would resolve this
 *
 * ### What This Means for Code
 * - Use `patient_id` in all new code (not `user_id`)
 * - The `patientContextService` abstracts the resolution
 * - When proxy access is added, only the service changes - not consumers
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

// =============================================================================
// IDENTITY TYPES
// =============================================================================

/**
 * Canonical patient identifier
 *
 * Currently (Phase 1): This equals auth.users.id (1:1 mapping)
 * Future (Phase 2+): May be a separate patient chart ID with user mapping
 *
 * The service layer abstracts this - consumers should not assume
 * patient_id === authenticated user's ID.
 */
export type PatientId = string;

/**
 * Patient risk level classification for context aggregation
 *
 * Note: Uses lowercase values to match database storage conventions.
 * For clinical risk assessments, see RiskLevel from riskAssessment.ts
 */
export type PatientRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Patient enrollment pathway
 */
export type EnrollmentType = 'app' | 'hospital';

// =============================================================================
// DEMOGRAPHICS PROFILE
// =============================================================================

/**
 * Core patient demographics (minimal PHI, display-safe)
 *
 * This is the MINIMUM data needed to identify and display a patient.
 * For full clinical data, use the specific clinical services.
 */
export interface PatientDemographics {
  /** Patient identifier (auth.users.id) */
  patient_id: PatientId;

  /** Legal first name */
  first_name: string | null;

  /** Legal last name */
  last_name: string | null;

  /** Date of birth (ISO 8601 date string) */
  dob: string | null;

  /** Gender */
  gender: string | null;

  /** Medical Record Number (for hospital patients) */
  mrn: string | null;

  /** Phone number (E.164 format preferred) */
  phone: string | null;

  /** Preferred language (ISO 639-1 code) */
  preferred_language: string | null;

  /** Enrollment type: app (community) or hospital */
  enrollment_type: EnrollmentType | null;

  /** Tenant/organization ID */
  tenant_id: string | null;
}

/**
 * Hospital-specific patient fields
 */
export interface HospitalPatientDetails {
  /** Hospital unit/ward */
  hospital_unit: string | null;

  /** Room number */
  room_number: string | null;

  /** Bed number */
  bed_number: string | null;

  /** Acuity level (1-5 scale) */
  acuity_level: number | null;

  /** Code status (e.g., 'Full Code', 'DNR', 'DNI') */
  code_status: string | null;

  /** Admission date (ISO 8601) */
  admission_date: string | null;

  /** Attending physician ID */
  attending_physician_id: string | null;

  /** Primary diagnosis (for quick display) */
  primary_diagnosis: string | null;

  /** Is currently admitted */
  is_admitted: boolean;
}

// =============================================================================
// CONTACT GRAPH
// =============================================================================

/**
 * Contact relationship type
 */
export type ContactRelationType =
  | 'caregiver'
  | 'emergency_contact'
  | 'family_member'
  | 'provider'
  | 'care_coordinator'
  | 'attending_physician'
  | 'primary_care'
  | 'specialist'
  | 'social_worker'
  | 'guardian'
  | 'power_of_attorney'
  | 'other';

/**
 * Contact permission level
 */
export type ContactPermissionLevel =
  | 'full_access'      // Can view all non-restricted data
  | 'limited_access'   // Can view wellness summaries only
  | 'emergency_only'   // Can only be contacted in emergencies
  | 'no_access';       // Listed for reference only

/**
 * A patient contact (caregiver, family, provider, etc.)
 */
export interface PatientContact {
  /** Contact record ID */
  contact_id: string;

  /** User ID if this contact is a registered user */
  user_id: string | null;

  /** Relationship to patient */
  relationship: ContactRelationType;

  /** Contact's name */
  name: string;

  /** Primary phone */
  phone: string | null;

  /** Email address */
  email: string | null;

  /** Permission level */
  permission_level: ContactPermissionLevel;

  /** Is this the primary contact of this type */
  is_primary: boolean;

  /** Notification preferences */
  notifications_enabled: boolean;

  /** Preferred contact method */
  preferred_contact_method: 'phone' | 'sms' | 'email' | null;

  /** Additional notes */
  notes: string | null;

  /** When this contact was added */
  created_at: string;

  /** Last updated */
  updated_at: string | null;
}

/**
 * Complete contact graph for a patient
 */
export interface PatientContactGraph {
  /** Emergency contacts (sorted by priority) */
  emergency_contacts: PatientContact[];

  /** Family caregivers with app access */
  caregivers: PatientContact[];

  /** Healthcare providers */
  providers: PatientContact[];

  /** Care team members (coordinators, social workers, etc.) */
  care_team: PatientContact[];

  /** Count summary */
  summary: {
    total_contacts: number;
    active_caregivers: number;
    active_providers: number;
  };
}

// =============================================================================
// TIMELINE SUMMARY
// =============================================================================

/**
 * Timeline event type
 */
export type TimelineEventType =
  | 'check_in'
  | 'vital_reading'
  | 'medication_taken'
  | 'appointment'
  | 'discharge'
  | 'admission'
  | 'alert'
  | 'care_plan_update'
  | 'communication'
  | 'assessment';

/**
 * A timeline event summary
 */
export interface TimelineEvent {
  /** Event ID */
  event_id: string;

  /** Event type */
  event_type: TimelineEventType;

  /** Event timestamp (ISO 8601) */
  timestamp: string;

  /** Brief description */
  description: string;

  /** Severity/priority if applicable */
  severity: 'info' | 'warning' | 'alert' | 'critical' | null;

  /** Related entity ID (e.g., check_in_id, encounter_id) */
  related_entity_id: string | null;

  /** Related entity type */
  related_entity_type: string | null;
}

/**
 * Latest items snapshot (for quick context)
 */
export interface PatientTimelineSummary {
  /** Last check-in (if any) */
  last_check_in: {
    timestamp: string;
    wellness_score: number | null;
    mood: string | null;
    concerns: string[];
  } | null;

  /** Last vital signs reading */
  last_vitals: {
    timestamp: string;
    blood_pressure: string | null;
    heart_rate: number | null;
    temperature: number | null;
    oxygen_saturation: number | null;
  } | null;

  /** Last encounter/visit */
  last_encounter: {
    timestamp: string;
    encounter_type: string;
    provider_name: string | null;
    diagnosis_summary: string | null;
  } | null;

  /** Active alerts count */
  active_alerts_count: number;

  /** Recent events (last 7 days) */
  recent_events: TimelineEvent[];

  /** Days since last contact/check-in */
  days_since_last_contact: number | null;
}

// =============================================================================
// RISK & STATUS
// =============================================================================

/**
 * Current risk assessment summary
 */
export interface PatientRiskSummary {
  /** Overall risk level */
  risk_level: PatientRiskLevel;

  /** Risk score (0-100 scale) */
  risk_score: number | null;

  /** Risk factors (brief list) */
  risk_factors: string[];

  /** Last assessment date */
  last_assessment_date: string | null;

  /** 30-day readmission risk (percentage) */
  readmission_risk_30day: number | null;

  /** Fall risk score if assessed */
  fall_risk_score: number | null;
}

/**
 * Active care plan summary
 */
export interface PatientCarePlanSummary {
  /** Active care plan ID (if any) */
  active_plan_id: string | null;

  /** Plan type */
  plan_type: string | null;

  /** Plan status */
  plan_status: 'draft' | 'active' | 'completed' | 'discontinued' | null;

  /** Primary goal */
  primary_goal: string | null;

  /** Next review date */
  next_review_date: string | null;

  /** Care coordinator name */
  care_coordinator_name: string | null;
}

// =============================================================================
// CONTEXT METADATA (TRACEABILITY)
// =============================================================================

/**
 * Data source record for traceability
 */
export interface DataSourceRecord {
  /** Table or view name */
  source: string;

  /** When data was fetched */
  fetched_at: string;

  /** Whether fetch succeeded */
  success: boolean;

  /** Record count if applicable */
  record_count: number | null;

  /** Any notes/warnings */
  note: string | null;
}

/**
 * Context metadata for ATLUS Accountability requirement
 *
 * Every PatientContext includes this metadata to ensure:
 * - We know exactly what data sources were queried
 * - We know when the data was fetched
 * - We can trace any AI/clinical decision back to its inputs
 */
export interface PatientContextMeta {
  /** When this context was generated (ISO 8601) */
  generated_at: string;

  /** Request ID for tracing */
  request_id: string;

  /** Which options were requested */
  options_requested: PatientContextOptions;

  /** Data sources used */
  data_sources: DataSourceRecord[];

  /** Overall freshness assessment */
  data_freshness: 'real_time' | 'recent' | 'stale';

  /** Staleness threshold in minutes for "recent" classification */
  freshness_threshold_minutes: number;

  /** Any warnings about data quality/availability */
  warnings: string[];

  /** Fetch duration in milliseconds */
  fetch_duration_ms: number;
}

// =============================================================================
// FETCH OPTIONS
// =============================================================================

/**
 * Options for fetching patient context
 *
 * Use these to control what data is fetched to avoid over-fetching.
 * Sensible defaults are provided.
 */
export interface PatientContextOptions {
  /** Include contact graph (caregivers, providers, emergency contacts) */
  includeContacts?: boolean;

  /** Include timeline summary (last check-in, vitals, events) */
  includeTimeline?: boolean;

  /** Include risk assessment summary */
  includeRisk?: boolean;

  /** Include care plan summary */
  includeCarePlan?: boolean;

  /** Include hospital-specific details (admission, room, etc.) */
  includeHospitalDetails?: boolean;

  /** Include sensitive data (requires elevated permissions) */
  includeSensitive?: boolean;

  /** Timeline lookback in days (default: 7) */
  timelineDays?: number;

  /** Maximum timeline events (default: 10) */
  maxTimelineEvents?: number;
}

/**
 * Default options for patient context fetch
 */
export const DEFAULT_PATIENT_CONTEXT_OPTIONS: Required<PatientContextOptions> = {
  includeContacts: true,
  includeTimeline: true,
  includeRisk: true,
  includeCarePlan: true,
  includeHospitalDetails: false,  // Opt-in for hospital context
  includeSensitive: false,         // Never include by default
  timelineDays: 7,
  maxTimelineEvents: 10,
};

// =============================================================================
// CANONICAL PATIENT CONTEXT
// =============================================================================

/**
 * Canonical Patient Context
 *
 * This is THE authoritative structure for patient data across all modules.
 * Use `getPatientContext()` to fetch this - do NOT query patient tables directly.
 *
 * ATLUS Requirements Satisfied:
 * - Unity: Single source of truth for patient identity, contacts, status
 * - Accountability: Full metadata for traceability (context_meta)
 *
 * @example
 * // Fetch patient context with defaults
 * const result = await patientContextService.getPatientContext(patientId);
 * if (result.success) {
 *   const { demographics, contacts, timeline, context_meta } = result.data;
 *   // Use context_meta.generated_at for traceability
 * }
 *
 * @example
 * // Fetch minimal context (just demographics)
 * const result = await patientContextService.getPatientContext(patientId, {
 *   includeContacts: false,
 *   includeTimeline: false,
 *   includeRisk: false,
 * });
 */
export interface PatientContext {
  // -------------------------------------------------------------------------
  // IDENTITY & DEMOGRAPHICS (always included)
  // -------------------------------------------------------------------------

  /** Core demographics */
  demographics: PatientDemographics;

  // -------------------------------------------------------------------------
  // OPTIONAL SECTIONS (based on fetch options)
  // -------------------------------------------------------------------------

  /** Hospital-specific details (if includeHospitalDetails) */
  hospital_details: HospitalPatientDetails | null;

  /** Contact graph (if includeContacts) */
  contacts: PatientContactGraph | null;

  /** Timeline summary (if includeTimeline) */
  timeline: PatientTimelineSummary | null;

  /** Risk summary (if includeRisk) */
  risk: PatientRiskSummary | null;

  /** Care plan summary (if includeCarePlan) */
  care_plan: PatientCarePlanSummary | null;

  // -------------------------------------------------------------------------
  // METADATA (always included - required for ATLUS Accountability)
  // -------------------------------------------------------------------------

  /** Context metadata for traceability */
  context_meta: PatientContextMeta;
}

// =============================================================================
// HELPER TYPES
// =============================================================================

/**
 * Type guard: Check if patient has active admission
 */
export function isAdmittedPatient(context: PatientContext): boolean {
  return context.hospital_details?.is_admitted === true;
}

/**
 * Type guard: Check if patient is high risk
 */
export function isHighRiskPatient(context: PatientContext): boolean {
  const level = context.risk?.risk_level;
  return level === 'high' || level === 'critical';
}

/**
 * Get display name from demographics
 */
export function getPatientDisplayName(demographics: PatientDemographics): string {
  const { first_name, last_name } = demographics;
  if (last_name && first_name) {
    return `${last_name}, ${first_name}`;
  }
  return last_name || first_name || 'Unknown Patient';
}

/**
 * Get patient age from DOB
 */
export function getPatientAge(demographics: PatientDemographics): number | null {
  if (!demographics.dob) return null;
  const birth = new Date(demographics.dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
