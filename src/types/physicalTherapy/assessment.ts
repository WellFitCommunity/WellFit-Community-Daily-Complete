/**
 * Physical Therapy - Functional Assessment Types
 *
 * Defines assessment types, pain assessment, ROM, strength, gait,
 * balance, outcome measures, home accessibility, work demands,
 * and the main PTFunctionalAssessment interface.
 */

// =====================================================
// ASSESSMENT ENUMS & BASIC TYPES
// =====================================================

export type AssessmentType =
  | 'initial_evaluation'
  | 'interim_evaluation'
  | 'discharge_evaluation'
  | 'post_discharge_followup';

export type OnsetType = 'acute' | 'insidious' | 'gradual' | 'post_surgical';

export type LivingSituation =
  | 'independent_alone'
  | 'independent_with_family'
  | 'assisted_living'
  | 'skilled_nursing'
  | 'homeless'
  | 'other';

export type TransportationAccess =
  | 'independent_driving'
  | 'family_transport'
  | 'public_transport'
  | 'medical_transport'
  | 'no_reliable_transport';

export type RehabPotential = 'excellent' | 'good' | 'fair' | 'poor' | 'guarded';

// =====================================================
// CLINICAL MEASUREMENT INTERFACES
// =====================================================

export interface PainAssessment {
  location: string;
  quality: string; // Sharp, dull, aching, burning, etc.
  intensity_at_rest: number; // 0-10 NRS
  intensity_with_activity: number;
  aggravating_factors: string[];
  alleviating_factors: string[];
  pain_pattern: string; // Constant, intermittent, nocturnal
  interference_with_function: string;
}

export interface ROMData {
  joint: string;
  movement: string; // Flexion, extension, abduction, etc.
  active_rom_degrees: number;
  passive_rom_degrees: number;
  end_feel: string; // Firm, soft, hard, empty, springy
  limiting_factors: string[]; // Pain, stiffness, weakness
  measurement_method: string; // Goniometer, visual estimate, inclinometer
}

export interface StrengthData {
  muscle_group: string;
  mmt_grade: string; // 0, 1, 2-, 2, 2+, 3-, 3, 3+, 4-, 4, 4+, 5
  mmt_numeric: number; // 0-5 for calculations
  testing_position: string;
  compensation_noted: boolean;
  pain_with_testing: boolean;
}

export interface GaitAnalysis {
  assistive_device: string | null; // None, cane, walker, crutches, wheelchair
  gait_pattern: string; // Normal, antalgic, trendelenburg, ataxic, etc.
  cadence: string; // Slow, normal, fast
  stride_length: string; // Decreased, normal, increased
  deviations: string[];
  weight_bearing_status: string; // Full, partial, non-weight bearing, TTWB
  distance_ambulated: string;
  functional_mobility_score?: number; // Timed Up and Go, 10-meter walk test
}

export interface BalanceAssessment {
  static_balance: string;
  dynamic_balance: string;
  single_leg_stance_seconds_right: number | null;
  single_leg_stance_seconds_left: number | null;
  berg_balance_scale_score?: number; // 0-56
  abc_scale_score?: number; // Activities-Specific Balance Confidence 0-100%
  fall_risk: 'low' | 'moderate' | 'high';
  assistive_device_for_balance: string | null;
}

export interface FunctionalMobilityScore {
  category: string; // Bed mobility, transfers, ambulation, stairs
  fim_score: number; // 1-7 scale
  assistance_level: string; // Independent, supervision, minimal, moderate, maximal, total
}

export interface OutcomeMeasure {
  measure_name: string;
  measure_acronym: string;
  score: number;
  max_score: number;
  percentage: number;
  interpretation: string;
  administration_date: string;
  mcid: number; // Minimal Clinically Important Difference
}

export interface HomeAccessibility {
  stairs_to_enter: number;
  stairs_inside: number;
  handrails_present: boolean;
  bathroom_setup: string;
  bedroom_location: string; // First floor, second floor, etc.
  environmental_barriers: string[];
  modifications_recommended: string[];
}

export interface WorkDemands {
  physical_demand_level: 'sedentary' | 'light' | 'medium' | 'heavy' | 'very_heavy';
  essential_functions: string[];
  lifting_requirements: string;
  standing_requirements: string;
  ergonomic_concerns: string[];
}

// =====================================================
// MAIN FUNCTIONAL ASSESSMENT
// =====================================================

export interface PTFunctionalAssessment {
  id: string;
  patient_id: string;
  encounter_id?: string;
  therapist_id: string;

  assessment_type: AssessmentType;
  assessment_date: string;
  visit_number: number;

  // Chief Complaint
  chief_complaint: string;
  history_present_illness?: string;
  mechanism_of_injury?: string;
  onset_date?: string;
  onset_type?: OnsetType;

  // Medical History
  prior_level_of_function?: string;
  comorbidities?: string[];
  medications_affecting_rehab?: string[];
  surgical_history?: Record<string, string | number | boolean | null>;
  imaging_results?: Record<string, string | number | boolean | null>;
  precautions?: string[];
  contraindications?: string[];

  // Social Determinants (ICF)
  living_situation?: LivingSituation;
  home_accessibility?: HomeAccessibility;
  support_system?: string;
  transportation_access?: TransportationAccess;
  occupation?: string;
  work_demands?: WorkDemands;
  hobbies_recreational_activities?: string[];

  // Patient Goals
  patient_stated_goals?: string[];
  participation_goals?: Record<string, string | number | boolean | null>;

  // Systems Review
  cardiovascular_respiratory_findings?: string;
  integumentary_findings?: string;
  musculoskeletal_findings?: string;
  neuromuscular_findings?: string;

  // Impairments (ICF)
  pain_assessment?: PainAssessment;
  range_of_motion_data?: ROMData[];
  muscle_strength_data?: StrengthData[];
  sensory_assessment?: Record<string, string | number | boolean | null>;
  reflex_testing?: Record<string, string | number | boolean | null>;
  special_tests?: Record<string, string | number | boolean | null>;
  posture_analysis?: string;
  gait_analysis?: GaitAnalysis;
  balance_assessment?: BalanceAssessment;
  coordination_assessment?: string;

  // Activity Limitations
  bed_mobility_score?: number;
  transfer_ability_score?: number;
  ambulation_score?: number;
  stair_negotiation_score?: number;

  // Outcome Measures
  outcome_measures?: OutcomeMeasure[];

  // Clinical Impression
  primary_diagnosis: string;
  secondary_diagnoses?: string[];
  clinical_impression: string;

  // Prognosis
  rehab_potential?: RehabPotential;
  prognosis_narrative?: string;
  expected_duration_weeks?: number;
  expected_visit_frequency?: string;

  // Barriers
  barriers_to_recovery?: Record<string, string | number | boolean | null>;

  // Clinical Reasoning
  clinical_reasoning?: string;
  evidence_based_rationale?: string;

  // Digital
  video_assessment_url?: string;
  imaging_links?: string[];

  // Metadata
  created_at: string;
  updated_at: string;
  signed_by?: string;
  signed_at?: string;
}
