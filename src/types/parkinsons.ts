// =====================================================
// PARKINSON'S DISEASE MANAGEMENT TYPES
// =====================================================
// ROBERT & FORBES Comprehensive Care Framework
// Includes UPDRS, medication tracking, motor monitoring
// =====================================================

// =====================================================
// 1. CORE ENUMS & TYPES
// =====================================================

export type ParkinsonsType =
  | 'idiopathic'
  | 'young_onset'
  | 'genetic'
  | 'drug_induced'
  | 'vascular'
  | 'atypical';

export type HoehnYahrStage = '1' | '1.5' | '2' | '2.5' | '3' | '4' | '5';

export type MedicationClass =
  | 'levodopa'
  | 'dopamine_agonist'
  | 'mao_b_inhibitor'
  | 'comt_inhibitor'
  | 'amantadine'
  | 'anticholinergic'
  | 'antipsychotic'
  | 'antidepressant'
  | 'other';

export type SymptomState = 'ON' | 'partial_ON' | 'OFF';

export type DyskinesiaSeverity = 'mild' | 'moderate' | 'severe';

export type DBSTarget = 'STN' | 'GPi' | 'VIM' | 'bilateral_STN' | 'bilateral_GPi' | 'unilateral_VIM' | 'other' | 'none';

export type LSVTEnrollmentStatus = 'not_enrolled' | 'enrolled' | 'active' | 'completed' | 'discontinued';

export type SwallowStudyResult = 'normal' | 'mild_dysphagia' | 'moderate_dysphagia' | 'severe_dysphagia' | 'aspiration_risk';

// =====================================================
// 2. PATIENT REGISTRY
// =====================================================

export interface ParkinsonsPatient {
  id: string;
  user_id: string;

  // Diagnosis Details
  diagnosis_date?: string;
  parkinsons_type?: ParkinsonsType;
  hoehn_yahr_stage?: HoehnYahrStage;
  primary_symptoms?: string[];

  // Care Team
  neurologist_id?: string;
  movement_disorder_specialist_id?: string;

  // Treatment History
  dbs_implant?: boolean;
  dbs_target?: DBSTarget;

  // Metadata
  created_at: string;
  updated_at: string;
  tenant_id?: string;

  // Joined data
  profile?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

// =====================================================
// 3. MEDICATIONS
// =====================================================

export interface ParkinsonsMedication {
  id: string;
  patient_id: string;

  // Medication Details
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  medication_class?: MedicationClass;

  // Dosing
  dosage?: string;
  frequency?: string;
  timing_instructions?: string;
  scheduled_times?: string[];

  // Status
  is_active: boolean;
  start_date?: string;
  end_date?: string;

  // Prescriber
  prescribed_by?: string;

  // Side Effects
  side_effects?: string[];

  // Metadata
  created_at: string;
  tenant_id?: string;
}

// =====================================================
// 4. MEDICATION LOG (Adherence)
// =====================================================

export interface ParkinsonsMedicationLog {
  id: string;
  medication_id: string;

  // Dose Details
  taken_at: string;
  was_on_time?: boolean;

  // Symptom State After Dose
  symptom_state_30min?: SymptomState;
  symptom_state_60min?: SymptomState;

  // Dyskinesia
  dyskinesia_present?: boolean;
  dyskinesia_severity?: DyskinesiaSeverity;

  // Notes
  notes?: string;

  // Metadata
  created_at: string;
  tenant_id?: string;

  // Joined data
  medication?: ParkinsonsMedication;
}

// =====================================================
// 5. SYMPTOM DIARY
// =====================================================

export interface ParkinsonsSymptomDiary {
  id: string;
  patient_id: string;
  recorded_at: string;

  // Motor Symptoms (0-10 scale)
  tremor_severity?: number;
  rigidity_severity?: number;
  bradykinesia_severity?: number;
  balance_problems?: number;

  // Dyskinesia
  dyskinesia_present: boolean;

  // State Tracking
  on_time_hours?: number;
  off_time_hours?: number;

  // Freezing & Falls
  freezing_episodes?: number;
  falls_count?: number;

  // Non-Motor
  mood_rating?: number;
  sleep_quality?: number;

  // Notes
  notes?: string;

  // Metadata
  created_at: string;
  tenant_id?: string;
}

// =====================================================
// 6. UPDRS ASSESSMENTS
// =====================================================

export interface ParkinsonsUPDRSAssessment {
  id: string;
  patient_id: string;
  assessment_date: string;
  assessor_id?: string;

  // UPDRS Scores (each part)
  part_i_score?: number;   // Non-motor (0-52)
  part_ii_score?: number;  // Motor ADL (0-52)
  part_iii_score?: number; // Motor exam (0-132)
  part_iv_score?: number;  // Motor complications (0-24)

  // Total Score
  total_score?: number; // 0-260

  // Assessment Context
  medication_state?: 'ON' | 'OFF' | 'wearing_off';

  // Notes
  notes?: string;

  // Metadata
  created_at: string;
  tenant_id?: string;

  // Joined data
  assessor?: {
    first_name?: string;
    last_name?: string;
  };
}

// =====================================================
// 7. DBS SESSIONS
// =====================================================

export interface ParkinsonsDBSSession {
  id: string;
  patient_id: string;
  session_date: string;

  // Programmer
  programmer_name?: string;
  programmer_id?: string;

  // Device
  device_manufacturer?: string;
  device_model?: string;
  lead_location?: DBSTarget;

  // Programming Parameters
  settings_changed?: {
    left?: {
      amplitude_v?: number;
      pulse_width_us?: number;
      frequency_hz?: number;
    };
    right?: {
      amplitude_v?: number;
      pulse_width_us?: number;
      frequency_hz?: number;
    };
  };

  // Battery
  battery_status?: string;

  // Outcomes
  patient_response?: string;
  updrs_pre?: number;
  updrs_post?: number;

  // Side Effects
  side_effects?: string[];

  // Notes
  notes?: string;

  // Metadata
  created_at: string;
  tenant_id?: string;
}

// =====================================================
// 8. ROBERT FRAMEWORK TRACKING
// =====================================================
// R: Rhythm & Movement
// O: Optimization of Medication
// B: Bradykinesia & Rigidity
// E: Exercise & PT
// R: Real-time Monitoring
// T: Therapeutic Interventions

export interface ParkinsonsROBERTTracking {
  id: string;
  patient_id: string;
  tracking_date: string;

  // R: Rhythm & Movement
  gait_speed?: number;
  step_length?: number;
  tremor_episodes?: number;
  balance_score?: number;

  // O: Optimization
  medication_adherence_pct?: number;
  on_time_hours?: number;
  off_time_hours?: number;

  // B: Bradykinesia
  finger_tap_count_left?: number;
  finger_tap_count_right?: number;
  rigidity_score_left?: number;
  rigidity_score_right?: number;

  // E: Exercise
  lsvt_big_completed?: boolean;
  lsvt_loud_completed?: boolean;
  minutes_pt_exercises?: number;
  exercise_compliance_pct?: number;

  // R: Real-time (wearables)
  fall_detected_count?: number;
  dyskinesia_detected?: number;
  fog_detected?: number;

  // T: Therapeutic
  medication_adjustments?: boolean;
  cognitive_score?: number;

  // Metadata
  created_at: string;
  tenant_id?: string;
}

// =====================================================
// 9. FORBES FRAMEWORK TRACKING
// =====================================================
// F: Functional Assessment
// O: Ongoing Monitoring
// R: Rehabilitation
// B: Behavioral & Cognitive
// E: Education & Caregiver
// S: Speech & Swallowing

export interface ParkinsonsFORBESTracking {
  id: string;
  patient_id: string;
  updrs_assessment_id?: string;
  tracking_date?: string;

  // F: Functional
  freezing_episodes?: number;
  fall_count?: number;
  balance_score?: number;
  gait_score?: number;

  // O: Ongoing
  clinic_visit?: boolean;
  telehealth_visit?: boolean;
  wearable_data_reviewed?: boolean;

  // R: Rehabilitation
  lsvt_big_status?: LSVTEnrollmentStatus;
  lsvt_loud_status?: LSVTEnrollmentStatus;
  home_exercise_adherence_pct?: number;

  // B: Behavioral
  cognitive_screening_completed?: boolean;
  cognitive_score?: number;
  depression_screening_completed?: boolean;
  depression_score?: number;

  // E: Education
  patient_education_completed?: boolean;
  caregiver_burden_score?: number;
  support_group_attended?: boolean;

  // S: Speech
  speech_eval_completed?: boolean;
  swallow_study_result?: SwallowStudyResult;

  // Metadata
  created_at: string;
  tenant_id?: string;
}

// =====================================================
// 10. DASHBOARD & ANALYTICS TYPES
// =====================================================

export interface ParkinsonsDashboardMetrics {
  totalPatients: number;
  patientsOnDBS: number;
  averageUPDRSScore: number;
  averageMedicationAdherence: number;
  highRiskPatients: number;
  assessmentsDueThisWeek: number;
}

export interface ParkinsonsPatientSummary {
  patient_id: string;
  patient_name: string;
  hoehn_yahr_stage?: HoehnYahrStage;
  last_updrs_score?: number;
  last_updrs_date?: string;
  medication_count: number;
  has_dbs: boolean;
  last_symptom_entry?: string;
  risk_level: 'low' | 'moderate' | 'high';
  days_since_assessment: number;
}

export interface ParkinsonsSymptomTrend {
  date: string;
  tremor: number;
  rigidity: number;
  bradykinesia: number;
  on_time_hours: number;
  off_time_hours: number;
}

// =====================================================
// 11. API REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateParkinsonsPatientRequest {
  user_id: string;
  diagnosis_date?: string;
  parkinsons_type?: ParkinsonsType;
  hoehn_yahr_stage?: HoehnYahrStage;
  primary_symptoms?: string[];
  neurologist_id?: string;
}

export interface CreateMedicationRequest {
  patient_id: string;
  medication_name: string;
  medication_class?: MedicationClass;
  dosage?: string;
  frequency?: string;
  timing_instructions?: string;
  start_date?: string;
}

export interface LogMedicationDoseRequest {
  medication_id: string;
  taken_at?: string;
  was_on_time?: boolean;
  symptom_state_30min?: SymptomState;
  notes?: string;
}

export interface RecordSymptomDiaryRequest {
  patient_id: string;
  tremor_severity?: number;
  rigidity_severity?: number;
  bradykinesia_severity?: number;
  dyskinesia_present?: boolean;
  on_time_hours?: number;
  off_time_hours?: number;
  freezing_episodes?: number;
  mood_rating?: number;
  sleep_quality?: number;
  notes?: string;
}

export interface RecordUPDRSRequest {
  patient_id: string;
  assessment_date?: string;
  part_i_score?: number;
  part_ii_score?: number;
  part_iii_score?: number;
  part_iv_score?: number;
  medication_state?: 'ON' | 'OFF' | 'wearing_off';
  notes?: string;
}

export interface RecordDBSSessionRequest {
  patient_id: string;
  session_date?: string;
  programmer_name?: string;
  settings_changed?: Record<string, any>;
  battery_status?: string;
  patient_response?: string;
  notes?: string;
}
