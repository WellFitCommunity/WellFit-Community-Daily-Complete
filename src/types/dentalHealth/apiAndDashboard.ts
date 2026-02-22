/**
 * Dental Health API Types, Dashboard Views, Constants & Helper Functions
 * Request/response types, dashboard summaries, tooth name constants,
 * and clinical utility functions.
 */

import type {
  DentalVisitType,
  DentalAssessmentStatus,
  ToothCondition,
  PeriodontalStatus,
  TreatmentPriority,
} from './baseTypes';

import type {
  DentalAssessment,
  SurfaceConditions,
  ToothChartEntry,
  TreatmentPhase,
  PatientDentalHealthTracking,
} from './clinicalInterfaces';

// =====================================================
// REQUEST/RESPONSE TYPES FOR API
// =====================================================

/**
 * Create Dental Assessment Request
 */
export interface CreateDentalAssessmentRequest {
  patient_id: string;
  visit_type: DentalVisitType;
  visit_date?: string;
  chief_complaint?: string;
  pain_level?: number;
  clinical_notes?: string;
  // ... other optional fields from DentalAssessment
}

/**
 * Update Dental Assessment Request
 */
export interface UpdateDentalAssessmentRequest {
  id: string;
  status?: DentalAssessmentStatus;
  clinical_notes?: string;
  treatment_recommendations?: string;
  periodontal_status?: PeriodontalStatus;
  // ... other updatable fields
}

/**
 * Create Tooth Chart Entry Request
 */
export interface CreateToothChartEntryRequest {
  assessment_id: string;
  patient_id: string;
  tooth_number: number;
  condition: ToothCondition;
  probing_depths?: {
    mb?: number;
    b?: number;
    db?: number;
    ml?: number;
    l?: number;
    dl?: number;
  };
  surface_conditions?: SurfaceConditions;
  notes?: string;
}

/**
 * Create Dental Procedure Request
 */
export interface CreateDentalProcedureRequest {
  patient_id: string;
  assessment_id?: string;
  procedure_name: string;
  cdt_code?: string;
  procedure_date?: string;
  tooth_numbers?: number[];
  procedure_description?: string;
  estimated_cost?: number;
  priority?: TreatmentPriority;
}

/**
 * Dental treatment plan creation -- phases and cost estimates (distinct from oncology/PT CreateTreatmentPlanRequest)
 */
export interface CreateTreatmentPlanRequest {
  patient_id: string;
  assessment_id?: string;
  plan_name: string;
  treatment_goals?: string[];
  phases?: TreatmentPhase[];
  total_estimated_cost?: number;
}

/**
 * Create Patient Tracking Entry Request
 */
export interface CreatePatientTrackingRequest {
  tooth_pain?: boolean;
  tooth_pain_severity?: number;
  gum_bleeding?: boolean;
  dry_mouth?: boolean;
  brushed_today?: boolean;
  flossed_today?: boolean;
  used_mouthwash?: boolean;
  additional_concerns?: string;
}

// =====================================================
// DASHBOARD & SUMMARY TYPES
// =====================================================

/**
 * Dental Risk Alert
 */
export interface DentalRiskAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string; // e.g., "periodontal", "infection", "chronic-disease-link"
  message: string;
  recommended_action: string;
  related_condition?: string;
}

/**
 * Dashboard Summary Response
 */
export interface DentalHealthDashboardSummary {
  patient_id: string;
  patient_name: string;

  // Latest Assessment
  latest_assessment?: DentalAssessment;
  last_visit_date?: string;
  next_recommended_visit?: string;

  // Health Status
  overall_oral_health_rating?: number;
  periodontal_status?: PeriodontalStatus;
  active_conditions_count: number;

  // Treatment
  active_treatment_plans_count: number;
  pending_procedures_count: number;
  completed_procedures_this_year: number;

  // Referrals & Follow-ups
  pending_referrals_count: number;
  overdue_followups_count: number;

  // Patient Self-Tracking
  recent_self_reports: PatientDentalHealthTracking[];
  current_symptoms: string[];

  // Alerts
  risk_alerts: DentalRiskAlert[];
}

/**
 * Tooth Chart Summary (for visualization)
 */
export interface ToothChartSummary {
  patient_id: string;
  assessment_id: string;
  teeth: ToothChartEntry[];
  overall_periodontal_health: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  total_healthy_teeth: number;
  total_cavities: number;
  total_missing: number;
  total_restored: number;
  average_probing_depth?: number;
  bleeding_points_count?: number;
}

/**
 * Procedure History Summary
 */
export interface ProcedureHistorySummary {
  patient_id: string;
  total_procedures: number;
  preventive_procedures: number;
  restorative_procedures: number;
  surgical_procedures: number;
  last_cleaning_date?: string;
  last_exam_date?: string;
  upcoming_scheduled_count: number;
  total_cost_ytd: number;
}

// =====================================================
// API RESPONSE WRAPPER
// =====================================================

export interface DentalApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// =====================================================
// CONSTANTS & HELPERS
// =====================================================

/**
 * Universal Numbering System - Tooth names mapping
 */
export const TOOTH_NAMES: Record<number, string> = {
  // Upper Right (Quadrant 1)
  1: 'Upper Right 3rd Molar',
  2: 'Upper Right 2nd Molar',
  3: 'Upper Right 1st Molar',
  4: 'Upper Right 2nd Premolar',
  5: 'Upper Right 1st Premolar',
  6: 'Upper Right Canine',
  7: 'Upper Right Lateral Incisor',
  8: 'Upper Right Central Incisor',
  // Upper Left (Quadrant 2)
  9: 'Upper Left Central Incisor',
  10: 'Upper Left Lateral Incisor',
  11: 'Upper Left Canine',
  12: 'Upper Left 1st Premolar',
  13: 'Upper Left 2nd Premolar',
  14: 'Upper Left 1st Molar',
  15: 'Upper Left 2nd Molar',
  16: 'Upper Left 3rd Molar',
  // Lower Left (Quadrant 3)
  17: 'Lower Left 3rd Molar',
  18: 'Lower Left 2nd Molar',
  19: 'Lower Left 1st Molar',
  20: 'Lower Left 2nd Premolar',
  21: 'Lower Left 1st Premolar',
  22: 'Lower Left Canine',
  23: 'Lower Left Lateral Incisor',
  24: 'Lower Left Central Incisor',
  // Lower Right (Quadrant 4)
  25: 'Lower Right Central Incisor',
  26: 'Lower Right Lateral Incisor',
  27: 'Lower Right Canine',
  28: 'Lower Right 1st Premolar',
  29: 'Lower Right 2nd Premolar',
  30: 'Lower Right 1st Molar',
  31: 'Lower Right 2nd Molar',
  32: 'Lower Right 3rd Molar',
};

/**
 * Primary teeth mapping (ISO 3950 notation for deciduous teeth)
 */
export const PRIMARY_TOOTH_NAMES: Record<number, string> = {
  // Upper Right (Quadrant 5)
  51: 'Upper Right 2nd Primary Molar',
  52: 'Upper Right 1st Primary Molar',
  53: 'Upper Right Primary Canine',
  54: 'Upper Right Lateral Primary Incisor',
  55: 'Upper Right Central Primary Incisor',
  // Upper Left (Quadrant 6)
  61: 'Upper Left Central Primary Incisor',
  62: 'Upper Left Lateral Primary Incisor',
  63: 'Upper Left Primary Canine',
  64: 'Upper Left 1st Primary Molar',
  65: 'Upper Left 2nd Primary Molar',
  // Lower Left (Quadrant 7)
  71: 'Lower Left 2nd Primary Molar',
  72: 'Lower Left 1st Primary Molar',
  73: 'Lower Left Primary Canine',
  74: 'Lower Left Lateral Primary Incisor',
  75: 'Lower Left Central Primary Incisor',
  // Lower Right (Quadrant 8)
  81: 'Lower Right Central Primary Incisor',
  82: 'Lower Right Lateral Primary Incisor',
  83: 'Lower Right Primary Canine',
  84: 'Lower Right 1st Primary Molar',
  85: 'Lower Right 2nd Primary Molar',
};

/**
 * Get tooth name from number
 */
export function getToothName(toothNumber: number, isPrimary: boolean = false): string {
  return isPrimary
    ? PRIMARY_TOOTH_NAMES[toothNumber] || `Primary Tooth #${toothNumber}`
    : TOOTH_NAMES[toothNumber] || `Tooth #${toothNumber}`;
}

/**
 * Calculate quadrant from tooth number
 */
export function getQuadrant(toothNumber: number): string {
  if (toothNumber >= 1 && toothNumber <= 8) return 'UR'; // Upper Right
  if (toothNumber >= 9 && toothNumber <= 16) return 'UL'; // Upper Left
  if (toothNumber >= 17 && toothNumber <= 24) return 'LL'; // Lower Left
  if (toothNumber >= 25 && toothNumber <= 32) return 'LR'; // Lower Right
  if (toothNumber >= 51 && toothNumber <= 55) return 'UR'; // Upper Right Primary
  if (toothNumber >= 61 && toothNumber <= 65) return 'UL'; // Upper Left Primary
  if (toothNumber >= 71 && toothNumber <= 75) return 'LL'; // Lower Left Primary
  if (toothNumber >= 81 && toothNumber <= 85) return 'LR'; // Lower Right Primary
  return 'Unknown';
}

/**
 * Severity mapping for periodontal status
 */
export const PERIODONTAL_SEVERITY: Record<PeriodontalStatus, number> = {
  healthy: 0,
  gingivitis: 1,
  mild_periodontitis: 2,
  moderate_periodontitis: 3,
  severe_periodontitis: 4,
  advanced_periodontitis: 5,
};

/**
 * Display labels for enums
 */
export const DENTAL_LABELS = {
  visitType: {
    initial_exam: 'Initial Examination',
    routine_cleaning: 'Routine Cleaning',
    comprehensive_exam: 'Comprehensive Examination',
    emergency: 'Emergency Visit',
    follow_up: 'Follow-up Appointment',
    consultation: 'Consultation',
    procedure: 'Procedure',
    screening: 'Screening',
  },
  periodontalStatus: {
    healthy: 'Healthy Gums',
    gingivitis: 'Gingivitis',
    mild_periodontitis: 'Mild Periodontitis',
    moderate_periodontitis: 'Moderate Periodontitis',
    severe_periodontitis: 'Severe Periodontitis',
    advanced_periodontitis: 'Advanced Periodontitis',
  },
  toothCondition: {
    healthy: 'Healthy',
    cavity: 'Cavity/Caries',
    filling: 'Filling',
    crown: 'Crown',
    bridge: 'Bridge',
    implant: 'Implant',
    root_canal: 'Root Canal',
    extraction: 'Extracted',
    missing: 'Missing',
    fractured: 'Fractured',
    abscessed: 'Abscessed',
    impacted: 'Impacted',
  },
  priority: {
    emergency: 'Emergency',
    urgent: 'Urgent',
    routine: 'Routine',
    elective: 'Elective',
    preventive: 'Preventive',
  },
};
