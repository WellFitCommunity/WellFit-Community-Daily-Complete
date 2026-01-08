// ============================================================================
// Discharge-to-Wellness Bridge Types
// ============================================================================
// Purpose: Connect hospital discharge to community wellness app
// Zero tech debt: Full type safety for Methodist demo
// ============================================================================

import type { DischargePlan as _DischargePlan } from './dischargePlanning';
import type { DailyCheckIn } from '../services/patientOutreachService';

// ============================================================================
// WELLNESS ENROLLMENT
// ============================================================================

export interface WellnessEnrollmentRequest {
  patient_id: string;
  discharge_plan_id: string;
  enrollment_method: 'sms' | 'email' | 'app' | 'manual';
  send_invitation?: boolean;
  custom_message?: string;
}

export interface WellnessEnrollmentResponse {
  enrollment_id: string;
  patient_id: string;
  discharge_plan_id: string;
  wellness_app_access_code: string;
  invitation_sent: boolean;
  invitation_sent_at?: string;
  enrollment_status: 'invited' | 'enrolled' | 'declined' | 'expired';
  first_check_in_scheduled_at?: string;
}

// ============================================================================
// DIAGNOSIS-SPECIFIC WARNING SIGNS
// ============================================================================

export type DiagnosisCategory =
  | 'heart_failure'
  | 'copd'
  | 'pneumonia'
  | 'diabetes'
  | 'stroke'
  | 'surgery_recovery'
  | 'mental_health'
  | 'sepsis'
  | 'kidney_disease'
  | 'general';

export interface DiagnosisSpecificWarningSign {
  diagnosis_category: DiagnosisCategory;
  warning_keywords: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  alert_type: string;
  care_team_action: string;
  patient_education_message?: string;
}

export interface ReadmissionRiskAnalysis {
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number; // 0-100
  warning_signs_detected: string[];
  diagnosis_specific_concerns: DiagnosisSpecificWarningSign[];
  requires_immediate_intervention: boolean;
  recommended_actions: string[];
  clinical_summary: string;
}

// ============================================================================
// ENHANCED CHECK-IN RESPONSE
// ============================================================================

export interface EnhancedCheckInResponse extends DailyCheckIn {
  readmission_risk_analysis?: ReadmissionRiskAnalysis;
  diagnosis_specific_warnings?: DiagnosisSpecificWarningSign[];
  mental_health_screening_triggered?: boolean;
  mental_health_screening_reason?: string;
  care_team_notified?: boolean;
  care_team_notification_sent_at?: string;
}

// ============================================================================
// MENTAL HEALTH SCREENING TRIGGERS
// ============================================================================

export interface MentalHealthScreeningTrigger {
  patient_id: string;
  trigger_reason: 'low_mood_pattern' | 'high_stress_pattern' | 'manual_request' | 'discharge_protocol';
  trigger_data: {
    consecutive_low_mood_days?: number;
    consecutive_high_stress_days?: number;
    avg_mood_score?: number;
    avg_stress_score?: number;
    concerning_responses?: string[];
  };
  screening_type: 'PHQ9' | 'GAD7' | 'both';
  priority: 'routine' | 'urgent' | 'emergency';
}

export interface MentalHealthScreeningResult {
  screening_id: string;
  patient_id: string;
  screening_type: 'PHQ9' | 'GAD7';
  score: number;
  severity: 'none' | 'mild' | 'moderate' | 'moderately_severe' | 'severe';
  risk_level: 'low' | 'moderate' | 'high';
  assessment_created: boolean;
  assessment_id?: string;
  safety_plan_required: boolean;
  safety_plan_created: boolean;
  safety_plan_id?: string;
  care_team_notified: boolean;
}

// ============================================================================
// CARE TEAM DASHBOARD
// ============================================================================

export interface DischargedPatientSummary {
  patient_id: string;
  patient_name: string;
  discharge_date: string;
  discharge_diagnosis: string;
  readmission_risk_score: number;
  readmission_risk_category: 'low' | 'moderate' | 'high' | 'very_high';
  wellness_enrolled: boolean;
  wellness_enrollment_date?: string;

  // Check-in metrics
  total_check_ins_expected: number;
  total_check_ins_completed: number;
  check_in_adherence_percentage: number;
  last_check_in_date?: string;
  days_since_last_check_in?: number;
  consecutive_missed_check_ins: number;

  // Clinical concerns
  active_alerts_count: number;
  highest_alert_severity?: 'low' | 'medium' | 'high' | 'critical';
  warning_signs_detected: string[];

  // Mental health
  phq9_score_latest?: number;
  gad7_score_latest?: number;
  mental_health_risk_level?: 'low' | 'moderate' | 'high';

  // Trends
  mood_trend: 'improving' | 'stable' | 'declining' | 'unknown';
  stress_trend: 'improving' | 'stable' | 'worsening' | 'unknown';

  // Actions needed
  needs_attention: boolean;
  attention_reason?: string;
  recommended_action?: string;
}

export interface CareTeamDashboardMetrics {
  total_discharged_patients: number;
  patients_enrolled_in_wellness: number;
  enrollment_rate_percentage: number;

  patients_needing_attention: number;
  high_risk_patients: number;
  missed_check_ins_count: number;

  active_alerts: number;
  critical_alerts: number;

  avg_check_in_adherence: number;
  avg_readmission_risk_score: number;

  mental_health_screenings_pending: number;

  patients_list: DischargedPatientSummary[];
}

// ============================================================================
// SERVICE REQUEST/RESPONSE TYPES
// ============================================================================

export interface DischargeToWellnessServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// PATIENT APP TYPES
// ============================================================================

export interface WellnessAppOnboardingData {
  patient_id: string;
  first_name: string;
  discharge_date: string;
  discharge_diagnosis: string;
  primary_care_physician?: string;
  care_coordinator_name?: string;
  care_coordinator_phone?: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  follow_up_appointments: Array<{
    provider: string;
    date: string;
    location: string;
  }>;
  warning_signs: string[];
  emergency_contact_number: string;
}

export interface PatientWellnessTrend {
  date: string;
  mood_score?: number;
  stress_score?: number;
  energy_score?: number;
  pain_score?: number;
  medication_adherence?: boolean;
  check_in_completed: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface WellnessBridgeConfig {
  auto_enroll_on_discharge: boolean;
  default_check_in_frequency_days: number;
  mental_health_screening_triggers: {
    low_mood_threshold: number; // Mood score that triggers concern
    low_mood_consecutive_days: number;
    high_stress_threshold: number;
    high_stress_consecutive_days: number;
  };
  readmission_risk_thresholds: {
    low: number; // 0-39
    medium: number; // 40-59
    high: number; // 60-79
    critical: number; // 80-100
  };
  care_team_notification_rules: {
    notify_on_missed_check_ins: number; // Days
    notify_on_critical_response: boolean;
    notify_on_mental_health_trigger: boolean;
  };
}

// Default configuration
export const DEFAULT_WELLNESS_BRIDGE_CONFIG: WellnessBridgeConfig = {
  auto_enroll_on_discharge: true,
  default_check_in_frequency_days: 1,
  mental_health_screening_triggers: {
    low_mood_threshold: 3,
    low_mood_consecutive_days: 3,
    high_stress_threshold: 8,
    high_stress_consecutive_days: 3,
  },
  readmission_risk_thresholds: {
    low: 40,
    medium: 60,
    high: 80,
    critical: 100,
  },
  care_team_notification_rules: {
    notify_on_missed_check_ins: 3,
    notify_on_critical_response: true,
    notify_on_mental_health_trigger: true,
  },
};

// ============================================================================
// DIAGNOSIS-SPECIFIC WARNING SIGN LIBRARY
// ============================================================================

export const DIAGNOSIS_WARNING_SIGNS: DiagnosisSpecificWarningSign[] = [
  // Heart Failure
  {
    diagnosis_category: 'heart_failure',
    warning_keywords: ['shortness of breath', 'swelling', 'swollen legs', 'swollen ankles', 'weight gain', 'fluid retention', 'cant breathe', 'breathing hard'],
    severity: 'high',
    alert_type: 'heart_failure_decompensation',
    care_team_action: 'Call patient immediately - assess for CHF exacerbation. Consider same-day clinic visit or ER referral.',
    patient_education_message: 'Swelling and shortness of breath can be signs your heart failure is worsening. Please call your care team right away.'
  },
  // COPD
  {
    diagnosis_category: 'copd',
    warning_keywords: ['shortness of breath', 'wheezing', 'coughing more', 'chest tight', 'cant breathe', 'blue lips', 'increased mucus'],
    severity: 'high',
    alert_type: 'copd_exacerbation',
    care_team_action: 'Assess for COPD exacerbation. Check inhaler adherence. Consider nebulizer treatment or steroid course.',
    patient_education_message: 'Increased breathing difficulty can mean your COPD is flaring up. Contact your care team today.'
  },
  // Diabetes
  {
    diagnosis_category: 'diabetes',
    warning_keywords: ['high sugar', 'low sugar', 'dizzy', 'shaky', 'sweating', 'confused', 'very thirsty', 'urinating a lot'],
    severity: 'medium',
    alert_type: 'blood_sugar_instability',
    care_team_action: 'Review blood sugar logs. Assess for hypoglycemia/hyperglycemia patterns. Adjust medications if needed.',
    patient_education_message: 'Blood sugar changes need attention. Please check your levels and call your care team if very high or low.'
  },
  // Surgical Recovery
  {
    diagnosis_category: 'surgery_recovery',
    warning_keywords: ['incision red', 'incision swollen', 'pus', 'drainage', 'fever', 'chills', 'severe pain', 'wound opening'],
    severity: 'high',
    alert_type: 'surgical_site_infection',
    care_team_action: 'Assess for surgical site infection. Consider in-person wound check within 24 hours. May need antibiotics.',
    patient_education_message: 'Signs of infection at your surgical site need immediate attention. Please call your surgeon today.'
  },
  // Mental Health
  {
    diagnosis_category: 'mental_health',
    warning_keywords: ['want to die', 'suicidal', 'hurt myself', 'no reason to live', 'hopeless', 'cant go on'],
    severity: 'critical',
    alert_type: 'suicide_risk',
    care_team_action: 'IMMEDIATE INTERVENTION REQUIRED. Call patient now. Assess for imminent risk. Consider 911 or crisis mobile team.',
    patient_education_message: 'If you are having thoughts of harming yourself, please call 988 (Suicide & Crisis Lifeline) immediately or go to your nearest ER.'
  },
  // Sepsis
  {
    diagnosis_category: 'sepsis',
    warning_keywords: ['fever', 'chills', 'shaking', 'confusion', 'rapid heart', 'rapid breathing', 'extreme fatigue'],
    severity: 'critical',
    alert_type: 'sepsis_recurrence',
    care_team_action: 'URGENT: Assess for sepsis recurrence. Consider immediate ER evaluation. Do not delay.',
    patient_education_message: 'These symptoms could be serious. Go to the emergency room immediately or call 911.'
  },
  // General Warning Signs
  {
    diagnosis_category: 'general',
    warning_keywords: ['chest pain', 'trouble breathing', 'severe pain', 'bleeding', 'passed out', 'stroke symptoms'],
    severity: 'critical',
    alert_type: 'emergency_symptoms',
    care_team_action: 'EMERGENCY: Advise patient to call 911 or go to ER immediately. Do not wait.',
    patient_education_message: 'This is a medical emergency. Call 911 or go to the emergency room right now.'
  }
];

// All types exported as named exports above
// No default export needed for type-only module
