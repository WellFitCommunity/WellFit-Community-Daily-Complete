/**
 * Mental Health Risk Assessment, Safety Plans, Escalations, Flags & Discharge
 * FHIR-compliant types for risk observations (FHIR Observation),
 * safety plans (FHIR DocumentReference), flags (FHIR Flag),
 * escalation workflows, and discharge checklists.
 */

import type {
  RiskLevel,
  SuicidalIdeation,
  SuicidalPlan,
  SuicidalIntent,
  MeansAccess,
  PHQ9Severity,
  GAD7Severity,
  AdjustmentResponse,
  PatientEngagement,
  EscalationLevel,
  EscalationStatus,
  FlagType,
  FlagStatus,
} from './baseTypes';

// ============================================================================
// RISK ASSESSMENT (FHIR Observation)
// ============================================================================

export interface MentalHealthRiskAssessment {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR Observation fields
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

  // Subject
  patient_id: string;
  therapy_session_id?: string;

  // Code
  code_system: string;
  code: string;
  code_display: string;

  // Category
  category: string[];

  // Timing
  effective_datetime: string;
  issued: string;

  // Performer
  performer_type?: string;
  performer_id?: string;
  performer_display?: string;

  // RISK LEVEL (Primary Value)
  risk_level: RiskLevel;

  // Suicide Screening Components
  suicidal_ideation?: SuicidalIdeation;
  suicidal_plan?: SuicidalPlan;
  suicidal_intent?: SuicidalIntent;
  means_access?: MeansAccess;

  // Depression Screening (PHQ-9)
  phq9_score?: number;
  phq9_severity?: PHQ9Severity;

  // Anxiety Screening (GAD-7)
  gad7_score?: number;
  gad7_severity?: GAD7Severity;

  // Clinical Impression
  clinical_impression: string;
  adjustment_response?: AdjustmentResponse;
  coping_mechanisms?: string[];
  support_system_adequate?: boolean;
  patient_engagement?: PatientEngagement;

  // Protective/Risk Factors
  protective_factors?: string[];
  risk_factors?: string[];

  // Interpretation
  interpretation_code?: 'L' | 'N' | 'H' | 'HH';
  interpretation_display?: string;

  // Notes
  note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateRiskAssessment {
  patient_id: string;
  therapy_session_id: string;
  risk_level: RiskLevel;
  suicidal_ideation: SuicidalIdeation;
  suicidal_plan: SuicidalPlan;
  suicidal_intent: SuicidalIntent;
  means_access: MeansAccess;
  phq9_score?: number;
  gad7_score?: number;
  clinical_impression: string;
  adjustment_response?: AdjustmentResponse;
  coping_mechanisms?: string[];
  support_system_adequate?: boolean;
  patient_engagement?: PatientEngagement;
  protective_factors?: string[];
  risk_factors?: string[];
  note?: string;
}

// ============================================================================
// SAFETY PLAN (FHIR DocumentReference)
// ============================================================================

export interface SafetyPlanContact {
  name: string;
  phone: string;
  relationship?: string;
  role?: string;
  available?: string;
}

export interface MentalHealthSafetyPlan {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR DocumentReference fields
  status: 'current' | 'superseded' | 'entered-in-error';

  // Subject
  patient_id: string;
  risk_assessment_id?: string;
  therapy_session_id?: string;

  // Document Type
  type_code: string;
  type_display: string;
  category: string[];

  // Security
  security_label: 'normal' | 'sensitive' | 'restricted' | 'very-restricted';

  // Date
  date: string;

  // Author
  author_type?: string;
  author_id?: string;
  author_display?: string;

  // SAFETY PLAN CONTENT (Stanley-Brown Model)
  // Step 1: Warning signs
  warning_signs: string[];

  // Step 2: Internal coping strategies
  internal_coping_strategies: string[];

  // Step 3: People and social settings for distraction
  social_distraction_people?: string[];
  social_distraction_places?: string[];

  // Step 4: People to ask for help
  people_to_contact?: SafetyPlanContact[];

  // Step 5: Professionals and agencies to contact
  professional_contacts: SafetyPlanContact[];
  crisis_hotlines: SafetyPlanContact[];

  // Step 6: Making environment safe
  means_restriction_steps: string[];
  lethal_means_addressed: boolean;

  // Additional Content
  scheduled_follow_ups?: string[];
  patient_signature_obtained: boolean;
  patient_signature_date?: string;
  patient_verbalized_understanding: boolean;

  // Distribution
  copy_given_to_patient: boolean;
  copy_given_to_family: boolean;
  copy_in_chart: boolean;

  // Notes
  note?: string;

  // Document Storage
  document_url?: string;
  content_type: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

export interface CreateSafetyPlan {
  patient_id: string;
  risk_assessment_id: string;
  therapy_session_id: string;
  warning_signs: string[];
  internal_coping_strategies: string[];
  social_distraction_people?: string[];
  social_distraction_places?: string[];
  people_to_contact?: SafetyPlanContact[];
  professional_contacts: SafetyPlanContact[];
  crisis_hotlines: SafetyPlanContact[];
  means_restriction_steps: string[];
  lethal_means_addressed: boolean;
  patient_verbalized_understanding: boolean;
  copy_given_to_patient?: boolean;
  copy_given_to_family?: boolean;
  note?: string;
}

// ============================================================================
// ESCALATIONS & ALERTS
// ============================================================================

export interface NotificationRecord {
  recipient: string;
  role: string;
  method: 'page' | 'sms' | 'email' | 'in-app';
  sent_at: string;
  delivered: boolean;
}

export interface MentalHealthEscalation {
  id: string;
  created_at: string;
  updated_at: string;

  // Subject
  patient_id: string;
  risk_assessment_id?: string;
  therapy_session_id?: string;

  // Escalation Details
  escalation_level: EscalationLevel;
  escalation_reason: string;
  trigger_criteria: string[];

  // Actions Taken
  actions_required: string[];
  psych_consult_ordered: boolean;
  psych_consult_id?: string;
  one_to_one_observation_recommended: boolean;
  safety_plan_created: boolean;
  attending_notified: boolean;
  attending_notified_at?: string;
  attending_notified_by?: string;

  // Notifications
  notifications_sent?: NotificationRecord[];

  // Status
  status: EscalationStatus;
  resolved_at?: string;
  resolved_by?: string;
  resolution_note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

// ============================================================================
// FLAGS (FHIR Flag)
// ============================================================================

export interface MentalHealthFlag {
  id: string;
  fhir_id: string;
  created_at: string;
  updated_at: string;

  // FHIR Flag fields
  status: FlagStatus;

  // Subject
  patient_id: string;

  // Category & Code
  category: string[];
  code_system: string;
  code: string;
  code_display: string;

  // Period
  period_start: string;
  period_end?: string;

  // Author
  author_type?: string;
  author_id?: string;
  author_display?: string;

  // Flag Details
  flag_type: FlagType;
  severity?: 'low' | 'medium' | 'high' | 'critical';

  // Alert Behavior
  show_on_banner: boolean;
  alert_frequency: 'once' | 'daily' | 'always';

  // Notes
  note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}

// ============================================================================
// DISCHARGE CHECKLIST
// ============================================================================

export interface MentalHealthDischargeChecklist {
  id: string;
  created_at: string;
  updated_at: string;

  // Patient
  patient_id: string;
  encounter_id?: string;

  // Checklist Items
  initial_therapy_session_completed: boolean;
  initial_therapy_session_id?: string;
  risk_assessment_completed: boolean;
  risk_assessment_id?: string;
  safety_plan_created: boolean;
  safety_plan_id?: string;
  outpatient_therapy_scheduled: boolean;
  outpatient_first_appt_date?: string;
  resources_provided: boolean;
  patient_education_completed: boolean;

  // High Risk Additional Requirements
  psychiatric_clearance_obtained: boolean;
  psychiatric_clearance_by?: string;
  psychiatric_clearance_date?: string;
  family_support_engaged: boolean;
  crisis_plan_provided: boolean;

  // Overall Status
  all_requirements_met: boolean;
  discharge_cleared: boolean;
  discharge_cleared_by?: string;
  discharge_cleared_at?: string;

  // Override
  override_required: boolean;
  override_granted: boolean;
  override_by?: string;
  override_reason?: string;
  override_at?: string;

  // Notes
  note?: string;

  // Audit
  created_by?: string;
  updated_by?: string;
}
