/**
 * FHIR R4 Preventive Care Types
 *
 * Immunization, CarePlan, CareTeam, Goal, SDOH screening.
 * Part of the fhir types decomposition (Strangler Fig from fhir.ts).
 */

import type { FHIRResource, CodeableConcept, Quantity, Reference } from './base';

// ============================================================================
// IMMUNIZATION
// ============================================================================

export interface FHIRImmunization extends FHIRResource {
  // External System Integration
  external_id?: string;
  external_system?: string;

  // FHIR Meta
  version_id?: string;
  last_updated?: string;

  // Required Fields (US Core)
  patient_id: string;
  status: 'completed' | 'entered-in-error' | 'not-done';
  vaccine_code: string; // CVX code
  vaccine_display: string;
  occurrence_datetime?: string;
  primary_source: boolean;

  // Status Reason (required if status != completed)
  status_reason_code?: string;
  status_reason_display?: string;

  // Vaccine Details
  lot_number?: string;
  expiration_date?: string;
  manufacturer?: string;

  // Administration Details
  site_code?: string; // Body site
  site_display?: string;
  route_code?: string; // Route of administration
  route_display?: string;
  dose_quantity_value?: number;
  dose_quantity_unit?: string;

  // Performer (who gave the vaccine)
  performer_actor_reference?: string;
  performer_actor_display?: string;
  performer_function_code?: string;
  performer_function_display?: string;
  performer_practitioner_id?: string; // FK to fhir_practitioners

  // Location
  location_reference?: string;
  location_display?: string;

  // Reason for Immunization
  reason_code?: string[];
  reason_display?: string[];

  // Reactions (adverse events)
  reaction_date?: string;
  reaction_detail_reference?: string;
  reaction_reported?: boolean;

  // Protocol Applied (vaccine dose number in series)
  protocol_dose_number_positive_int?: number;
  protocol_series_doses_positive_int?: number;
  protocol_target_disease?: string[];
  protocol_target_disease_display?: string[];

  // Funding Source
  funding_source_code?: string;
  funding_source_display?: string;

  // Education (patient education given)
  education_document_type?: string;
  education_reference?: string;
  education_publication_date?: string;
  education_presentation_date?: string;

  // Notes
  note?: string;

  // Audit Fields
  created_by?: string;
  updated_by?: string;
}

// Common CVX Vaccine Codes for Seniors
export const SENIOR_VACCINE_CODES = {
  FLU: '141', // Influenza, seasonal, injectable
  COVID: '213', // COVID-19
  SHINGLES: '121', // Zoster (Shingles) - Shingrix
  PCV13: '152', // Pneumococcal conjugate PCV13
  PPSV23: '33', // Pneumococcal polysaccharide PPSV23
  TDAP: '115', // Tdap
  TD: '113', // Td (tetanus, diphtheria)
  HEPATITIS_B: '43', // Hepatitis B
  HEPATITIS_A: '83', // Hepatitis A
  MMR: '03', // MMR
} as const;

// Vaccine Display Names
export const VACCINE_NAMES: Record<string, string> = {
  '141': 'Influenza (Flu Shot)',
  '213': 'COVID-19 Vaccine',
  '121': 'Shingles (Shingrix)',
  '152': 'Pneumococcal PCV13',
  '33': 'Pneumococcal PPSV23',
  '115': 'Tdap (Tetanus, Diphtheria, Pertussis)',
  '113': 'Td (Tetanus, Diphtheria)',
  '43': 'Hepatitis B',
  '83': 'Hepatitis A',
  '03': 'MMR (Measles, Mumps, Rubella)',
};

// Administration Routes
export const IMMUNIZATION_ROUTES = {
  IM: { code: 'IM', display: 'Intramuscular' },
  NASINHL: { code: 'NASINHL', display: 'Nasal inhalation' },
  PO: { code: 'PO', display: 'Oral' },
  SC: { code: 'SC', display: 'Subcutaneous' },
  TD: { code: 'TD', display: 'Transdermal' },
} as const;

// Administration Sites
export const IMMUNIZATION_SITES = {
  LA: { code: 'LA', display: 'Left arm' },
  RA: { code: 'RA', display: 'Right arm' },
  LT: { code: 'LT', display: 'Left thigh' },
  RT: { code: 'RT', display: 'Right thigh' },
  LD: { code: 'LD', display: 'Left deltoid' },
  RD: { code: 'RD', display: 'Right deltoid' },
} as const;

// ============================================================================
// CARE PLAN
// ============================================================================

export interface FHIRCarePlan extends FHIRResource {
  // External System Integration
  external_id?: string;
  external_system?: string;

  // FHIR Meta
  version_id?: string;
  last_updated?: string;

  // Required Fields (US Core)
  patient_id: string;
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'option';
  category: string[]; // e.g., ['assess-plan'], ['careteam']
  category_display?: string[];

  // Title and Description
  title?: string;
  description?: string;

  // Subject (usually same as patient)
  subject_reference?: string;
  subject_display?: string;

  // Period (when plan is in effect)
  period_start?: string;
  period_end?: string;

  // Created Date
  created?: string;
  author_reference?: string; // Practitioner/Organization who created plan
  author_display?: string;
  author_practitioner_id?: string; // FK to fhir_practitioners

  // Care Team
  care_team_reference?: string;
  care_team_display?: string;

  // Addresses (conditions this plan addresses)
  addresses_condition_references?: string[];
  addresses_condition_displays?: string[];

  // Supporting Info
  supporting_info_references?: string[];
  supporting_info_displays?: string[];

  // Goals
  goal_references?: string[];
  goal_displays?: string[];

  // Activities
  activities?: CarePlanActivity[];

  // Notes
  note?: string;

  // Audit Fields
  created_by?: string;
  updated_by?: string;
}

export interface CarePlanActivity {
  id?: string;
  status?: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error';

  // Activity Detail
  detail?: {
    kind?: 'Appointment' | 'CommunicationRequest' | 'DeviceRequest' | 'MedicationRequest' | 'NutritionOrder' | 'Task' | 'ServiceRequest' | 'VisionPrescription';
    code?: string;
    code_display?: string;
    status?: 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error';
    description?: string;
    scheduled_timing?: string;
    scheduled_period_start?: string;
    scheduled_period_end?: string;
    location_display?: string;
    performer_display?: string[];
    product_display?: string;
    daily_amount_value?: number;
    daily_amount_unit?: string;
    quantity_value?: number;
    quantity_unit?: string;
    goal_references?: string[];
  };

  // Outcome
  outcome_reference?: string[];
  outcome_display?: string[];

  // Progress
  progress?: string[];

  // Reference to external activity
  reference?: string;
  reference_display?: string;
}

// Care Plan Categories (US Core)
export const CARE_PLAN_CATEGORIES = {
  ASSESS_PLAN: 'assess-plan',
  CARETEAM: 'careteam',
  ENCOUNTER_PLAN: 'encounter-plan',
  LONGITUDINAL_CARE_PLAN: 'longitudinal-care-plan',
} as const;

export const CARE_PLAN_CATEGORY_NAMES: Record<string, string> = {
  'assess-plan': 'Assessment and Plan of Treatment',
  'careteam': 'Care Team',
  'encounter-plan': 'Encounter Plan',
  'longitudinal-care-plan': 'Longitudinal Care Plan',
};

// Activity Detail Kinds
export const ACTIVITY_KINDS = {
  APPOINTMENT: 'Appointment',
  COMMUNICATION: 'CommunicationRequest',
  DEVICE: 'DeviceRequest',
  MEDICATION: 'MedicationRequest',
  NUTRITION: 'NutritionOrder',
  TASK: 'Task',
  SERVICE: 'ServiceRequest',
  VISION: 'VisionPrescription',
} as const;

// Common Activity Codes for Senior Care
export const SENIOR_CARE_ACTIVITIES = {
  MEDICATION_REVIEW: { code: '182836005', display: 'Review of medication' },
  VITAL_SIGNS_MONITORING: { code: '113011001', display: 'Vital signs monitoring' },
  NUTRITION_COUNSELING: { code: '61310001', display: 'Nutrition education' },
  EXERCISE_THERAPY: { code: '229065009', display: 'Exercise therapy' },
  FALL_PREVENTION: { code: '718227007', display: 'Fall prevention education' },
  CHRONIC_DISEASE_MGMT: { code: '408580007', display: 'Chronic disease management' },
  SMOKING_CESSATION: { code: '225323000', display: 'Smoking cessation education' },
  DIABETES_EDUCATION: { code: '281090004', display: 'Diabetes self-management education' },
  HYPERTENSION_MGMT: { code: '386800008', display: 'Hypertension management' },
  DEPRESSION_SCREENING: { code: '171207006', display: 'Depression screening' },
  COGNITIVE_ASSESSMENT: { code: '113024003', display: 'Cognitive assessment' },
  SOCIAL_SUPPORT: { code: '410155007', display: 'Social support' },
} as const;

// ============================================================================
// CARE TEAM
// ============================================================================

export interface FHIRCareTeam extends FHIRResource {
  patient_id: string;
  status: 'draft' | 'active' | 'suspended' | 'inactive' | 'entered-in-error';
  name?: string;
  category?: string[];
  period_start?: string;
  period_end?: string;
  encounter_reference?: string;
  encounter_display?: string;
  managing_organization_reference?: string;
  managing_organization_display?: string;
  telecom?: Array<{ system?: string; value?: string; use?: string; rank?: number }>;
  reason_code?: string[];
  reason_display?: string[];
  note?: string;
  version_id?: number;
  created_by?: string;
  updated_by?: string;
  deleted_at?: string;
}

export interface FHIRCareTeamMember {
  id?: string;
  care_team_id: string;
  role_code?: string;
  role_display?: string;
  role_system?: string;
  member_reference: string;
  member_display: string;
  member_type?: string;
  member_user_id?: string;
  on_behalf_of_reference?: string;
  on_behalf_of_display?: string;
  period_start?: string;
  period_end?: string;
  is_primary_contact?: boolean;
  telecom?: Array<{ system?: string; value?: string; use?: string; rank?: number }>;
  sequence?: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// SDOH (Social Determinants of Health) - US Core 6.0+
// ============================================================================

export interface FHIRSDOHObservation extends FHIRResource {
  patient_id: string;
  status: 'final' | 'preliminary' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error';

  // SDOH Category (LOINC-based)
  category: 'food-insecurity' | 'housing-instability' | 'transportation' | 'financial-strain' | 'social-isolation' | 'education' | 'employment' | 'utility-needs' | 'safety' | 'health-literacy';

  // Standard LOINC codes for SDOH screening
  loinc_code: string;
  loinc_display: string;

  // Response (typically Yes/No or scale)
  value_code?: string;
  value_display?: string;
  value_text?: string;
  value_boolean?: boolean;
  value_integer?: number;

  // Risk level (auto-calculated or provider-assessed)
  risk_level?: 'low' | 'moderate' | 'high' | 'critical';

  // When assessed
  effective_datetime: string;

  // Who assessed
  performer_id?: string;
  performer_display?: string;

  // Related intervention or referral
  intervention_provided?: boolean;
  referral_made?: boolean;
  referral_to?: string;

  // Follow-up
  follow_up_needed?: boolean;
  follow_up_date?: string;

  notes?: string;
}

export interface CreateSDOHObservation extends Partial<FHIRSDOHObservation> {
  patient_id: string;
  status: 'final' | 'preliminary';
  category: 'food-insecurity' | 'housing-instability' | 'transportation' | 'financial-strain' | 'social-isolation' | 'education' | 'employment' | 'utility-needs' | 'safety' | 'health-literacy';
  loinc_code: string;
  loinc_display: string;
  effective_datetime: string;
}

// Standard SDOH screening questions (LOINC codes)
export const SDOH_SCREENING_CODES = {
  // Food Insecurity
  FOOD_INSECURITY: {
    code: '88122-7',
    display: 'Within the past 12 months we worried whether our food would run out before we got money to buy more',
    category: 'food-insecurity'
  },
  FOOD_RAN_OUT: {
    code: '88123-5',
    display: 'Within the past 12 months the food we bought just didn\'t last and we didn\'t have money to get more',
    category: 'food-insecurity'
  },

  // Housing Instability
  HOUSING_UNSTABLE: {
    code: '71802-3',
    display: 'Housing status',
    category: 'housing-instability'
  },
  HOUSING_QUALITY: {
    code: '93033-5',
    display: 'Are you worried about losing your housing?',
    category: 'housing-instability'
  },

  // Transportation
  TRANSPORT_BARRIER: {
    code: '93030-1',
    display: 'Has lack of transportation kept you from medical appointments, meetings, work, or from getting things needed for daily living?',
    category: 'transportation'
  },

  // Financial Strain
  FINANCIAL_STRAIN: {
    code: '93031-9',
    display: 'In the past year, have you or any family members you live with been unable to get any of the following when it was really needed?',
    category: 'financial-strain'
  },
  UTILITY_SHUTOFF: {
    code: '93032-7',
    display: 'Has the electric, gas, oil, or water company threatened to shut off services in your home?',
    category: 'utility-needs'
  },

  // Social Isolation
  SOCIAL_ISOLATION: {
    code: '93029-3',
    display: 'How often do you feel lonely or isolated from those around you?',
    category: 'social-isolation'
  },
  SOCIAL_SUPPORT: {
    code: '93038-4',
    display: 'How often do you see or talk to people that you care about and feel close to?',
    category: 'social-isolation'
  },

  // Safety
  INTIMATE_PARTNER_VIOLENCE: {
    code: '76501-6',
    display: 'Within the past year, have you been afraid of your partner or ex-partner?',
    category: 'safety'
  },

  // Education & Employment
  EDUCATION_LEVEL: {
    code: '82589-3',
    display: 'Highest level of education',
    category: 'education'
  },
  EMPLOYMENT_STATUS: {
    code: '67875-5',
    display: 'Employment status current',
    category: 'employment'
  },
} as const;

// ============================================================================
// GOAL (US Core Required)
// ============================================================================

export interface FHIRGoal extends FHIRResource {
  patient_id: string;

  // Lifecycle status (required)
  lifecycle_status: 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error' | 'rejected';

  // Achievement status
  achievement_status?: CodeableConcept;

  // Category
  category?: CodeableConcept[];

  // Priority
  priority?: CodeableConcept;

  // Description (required for US Core)
  description_code?: string;
  description_display: string;
  description_text?: string;

  // Subject (patient)
  subject_id: string;
  subject_display?: string;

  // Start date
  start_date?: string;
  start_codeable_concept?: CodeableConcept;

  // Target (measurable outcome)
  target?: Array<{
    measure?: CodeableConcept;
    detail_quantity?: Quantity;
    detail_range?: { low: Quantity; high: Quantity };
    detail_codeable_concept?: CodeableConcept;
    due_date?: string;
    due_duration?: { value: number; unit: string };
  }>;

  // Status date
  status_date?: string;
  status_reason?: string;

  // Expressser (who stated the goal)
  expressed_by_id?: string;
  expressed_by_display?: string;

  // Addresses (conditions this goal addresses)
  addresses?: Array<{
    reference: string;
    display?: string;
  }>;

  // Notes
  note?: string;

  // Outcome
  outcome_code?: CodeableConcept[];
  outcome_reference?: Reference[];

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateGoal extends Partial<FHIRGoal> {
  patient_id: string;
  lifecycle_status: 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error' | 'rejected';
  description_display: string;
}
