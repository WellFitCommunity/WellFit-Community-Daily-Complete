/**
 * Physical Therapy - Exercise Library & Home Exercise Program Types
 *
 * Defines exercise categories, evidence levels, exercise library entries,
 * HEP prescriptions, compliance tracking, and home exercise programs.
 */

// =====================================================
// EXERCISE LIBRARY TYPES
// =====================================================

export type ExerciseCategory =
  | 'therapeutic_exercise'
  | 'neuromuscular_reeducation'
  | 'balance_coordination'
  | 'gait_training'
  | 'manual_therapy'
  | 'modality'
  | 'functional_training'
  | 'cardiovascular_endurance'
  | 'flexibility_rom';

export type EvidenceLevel =
  | 'level_1a' // Systematic review of RCTs
  | 'level_1b' // Individual RCT
  | 'level_2a' // Systematic review of cohort studies
  | 'level_2b' // Individual cohort study
  | 'level_3'  // Case-control
  | 'level_4'  // Case series
  | 'level_5'  // Expert opinion
  | 'clinical_experience';

export interface PTExercise {
  id: string;

  // Identification
  exercise_name: string;
  exercise_code?: string;
  category: ExerciseCategory;
  subcategory?: string;

  // Description
  description: string;
  purpose: string;
  indications?: string[];
  contraindications?: string[];
  precautions?: string[];

  // Evidence Base
  evidence_level?: EvidenceLevel;
  research_references?: string[];
  clinical_practice_guideline?: string;

  // Dosage
  default_sets?: number;
  default_reps?: number;
  default_hold_seconds?: number;
  default_frequency_per_week?: number;
  progression_guidelines?: string;
  regression_options?: string;

  // Media
  demonstration_video_url?: string;
  patient_handout_url?: string;
  images?: string[];

  // Equipment
  equipment_required?: string[];

  // Instructions
  patient_instructions: string;
  common_errors?: string[];

  // Clinical Notes
  therapist_notes?: string;

  // Metadata
  created_by?: string;
  created_at: string;
  updated_at: string;
  approved_for_use: boolean;
  times_prescribed: number;
}

// =====================================================
// HOME EXERCISE PROGRAM TYPES
// =====================================================

export type HEPDeliveryType =
  | 'paper_handout'
  | 'email_pdf'
  | 'patient_portal'
  | 'mobile_app'
  | 'sms_link'
  | 'telehealth_demo';

export interface HEPExercisePrescription {
  exercise_id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  hold_seconds?: number;
  frequency_per_week: number;
  special_instructions?: string;
  video_link?: string;
  order_sequence: number;
}

export interface HEPComplianceLog {
  date: string;
  exercises_completed: string[]; // Array of exercise IDs
  difficulty_rating: number; // 1-5 scale
  pain_during?: number; // 0-10 scale
  notes?: string;
}

export interface PTHomeExerciseProgram {
  id: string;
  patient_id: string;
  treatment_plan_id: string;
  therapist_id: string;

  program_name: string;
  prescribed_date: string;
  last_modified_date?: string;
  active: boolean;

  // Exercises
  exercises: HEPExercisePrescription[];

  // Instructions
  overall_instructions?: string;
  frequency_guidance?: string;
  time_of_day_recommendation?: string;
  expected_duration_minutes?: number;

  // Compliance Tracking
  patient_tracking_enabled: boolean;
  compliance_logs?: HEPComplianceLog[];

  // Digital Delivery
  delivery_method?: HEPDeliveryType;
  sent_to_patient_at?: string;
  patient_acknowledged: boolean;
  patient_acknowledged_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}
