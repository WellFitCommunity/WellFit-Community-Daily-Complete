/**
 * Specialist Workflow Engine - Type Definitions
 * Future-proof system for ANY specialist type in rural healthcare
 */

export type SpecialistType =
  | 'CHW' // Community Health Worker
  | 'AgHealth' // Agricultural Medicine
  | 'MAT' // Medication-Assisted Treatment
  | 'WoundCare' // Wound Care Specialist
  | 'Geriatric' // Geriatric Care Manager
  | 'Telepsych' // Telepsychiatrist
  | 'RT' // Respiratory Therapist
  | 'Custom'; // Extensible

export type FieldType =
  | 'vitals'
  | 'photo-list'
  | 'photo-single'
  | 'questionnaire'
  | 'checklist'
  | 'text'
  | 'number'
  | 'scale'
  | 'body-diagram'
  | 'spirometry'
  | 'voice-note'
  | 'signature';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertTimeframe = '5min' | '15min' | '30min' | '1hr' | '4hr' | '24hr' | '48hr';

export interface AssessmentField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  offline: boolean; // Can be captured without internet
  template?: string; // Reference to questionnaire template
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customValidator?: string;
  };
  conditionalDisplay?: {
    dependsOn: string;
    condition: string;
    value: unknown;
  };
}

export interface WorkflowStep {
  step: number;
  name: string;
  description?: string;
  action: string;
  required: boolean;
  estimatedMinutes?: number;
  fields?: string[]; // Reference to assessmentFields
  validation?: {
    canSkipIf?: string;
    requiredIf?: string;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string; // e.g., "BP_SYSTOLIC > 180"
  severity: SeverityLevel;
  notifyRole: string;
  notifySpecificUser?: string;
  within: AlertTimeframe;
  message: string;
  autoAction?: string; // Optional automatic action
  escalationPath?: string[]; // Who to notify if not acknowledged
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'note' | 'assessment' | 'plan' | 'order' | 'referral';
  template: string;
  requiredFields: string[];
  autoPopulate?: Record<string, string>;
}

export interface SpecialistIntegrations {
  canOrderLabs: boolean;
  canPrescribe: boolean;
  canReferTo: string[];
  canAccessPHI: string[];
  billingCodes: string[];
  requiredCredentials?: string[];
}

export interface SpecialistWorkflow {
  id: string;
  version: string;
  name: string;
  description: string;
  specialistType: SpecialistType;
  icon?: string;
  color?: string;

  // What data they collect
  assessmentFields: AssessmentField[];

  // Their workflow steps
  visitWorkflow: WorkflowStep[];

  // Alert and escalation rules
  alertRules: AlertRule[];

  // Documentation templates
  documentationTemplates: DocumentTemplate[];

  // System integrations
  integrations: SpecialistIntegrations;

  // Compliance and security
  hipaaControls: {
    requireMFA: boolean;
    sessionTimeout: number;
    requirePhotoConsent: boolean;
    requireLocationConsent: boolean;
    phiAccessLogging: boolean;
  };

  // Billing configuration
  billing: {
    defaultCodes: string[];
    timeBasedBilling: boolean;
    requiresSignature: boolean;
    requiresCoSign?: string; // Role that must co-sign
  };
}

// Database models
export interface SpecialistProvider {
  id: string;
  user_id: string;
  specialist_type: SpecialistType;
  workflow_template_id: string;
  license_number?: string;
  npi?: string;
  service_area?: Record<string, unknown>; // PostGIS geography
  credentials: Record<string, unknown>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FieldVisit {
  id: string;
  specialist_id: string;
  patient_id: string;
  visit_type: string;
  workflow_template_id: string;
  scheduled_at?: Date;
  check_in_location?: { type: string; coordinates: [number, number] }; // PostGIS point
  check_in_time?: Date;
  check_out_location?: { type: string; coordinates: [number, number] };
  check_out_time?: Date;
  current_step: number;
  completed_steps: number[];
  data: Record<string, unknown>; // Flexible JSON data
  photos: string[];
  voice_notes: string[];
  offline_captured: boolean;
  synced_at?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  encounter_id?: string; // Links to billable encounter
  created_at: Date;
  updated_at: Date;
}

export interface SpecialistAssessment {
  id: string;
  visit_id: string;
  assessment_type: string;
  template_id: string;
  data: Record<string, unknown>;
  photos: string[];
  calculated_scores?: Record<string, number>;
  requires_review: boolean;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
}

export interface SpecialistAlert {
  id: string;
  visit_id: string;
  alert_rule_id: string;
  severity: SeverityLevel;
  triggered_by: Record<string, unknown>;
  triggered_at: Date;
  notify_role: string;
  notify_user_id?: string;
  message: string;
  acknowledged: boolean;
  acknowledged_at?: Date;
  acknowledged_by?: string;
  escalated: boolean;
  escalated_at?: Date;
  resolved: boolean;
  resolved_at?: Date;
  resolution_notes?: string;
}

export interface OfflineSyncJob {
  id: string;
  entity_type: 'visit' | 'assessment' | 'photo' | 'alert';
  entity_id: string;
  data: Record<string, unknown>;
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed';
  sync_attempts: number;
  last_attempt_at?: Date;
  error_message?: string;
  created_at: Date;
}

// Workflow execution context
export interface WorkflowContext {
  visit: FieldVisit;
  specialist: SpecialistProvider;
  patient: Record<string, unknown>; // From existing patient table
  workflow: SpecialistWorkflow;
  currentStep: WorkflowStep;
  collectedData: Record<string, unknown>;
  triggeredAlerts: SpecialistAlert[];
}

// Evaluation result for conditions
export interface ConditionEvaluation {
  condition: string;
  result: boolean;
  value?: unknown;
  error?: string;
}
