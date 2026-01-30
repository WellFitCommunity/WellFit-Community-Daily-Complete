/**
 * Medication API Type Definitions
 * Shared types for Medicine Cabinet operations
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MedicationAdherenceRate {
  medication_id: string;
  medication_name: string;
  adherence_rate: number;
  doses_taken: number;
  doses_expected: number;
  streak_days: number;
}

export interface MedicationReminder {
  id: string;
  medication_id: string;
  user_id: string;
  time_of_day: string;
  days_of_week?: number[];
  enabled: boolean;
  notification_method: 'push' | 'sms' | 'email' | 'all';
  last_reminded_at?: string;
  next_reminder_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UpcomingReminder {
  id: string;
  medication_id: string;
  medication_name: string;
  scheduled_time: string;
  reminder_type: string;
}

export interface PillIdentificationRecord {
  id: string;
  user_id: string;
  image_size: number;
  image_type: string;
  identification_data: Record<string, unknown>;
  confidence_score: number;
  identification_success: boolean;
  processing_time_ms: number;
  model_used: string;
  api_sources: string[];
  created_at: string;
}

export interface PillComparisonRecord {
  id: string;
  user_id: string;
  medication_id: string;
  pill_medication_name: string;
  label_medication_name: string;
  match: boolean;
  match_confidence: number;
  discrepancies: string[];
  safety_recommendation: string;
  requires_pharmacist_review: boolean;
  created_at: string;
}

export interface PsychMedAlertRecord {
  id: string;
  user_id: string;
  alert_type: string;
  severity: 'warning' | 'critical';
  psych_med_count: number;
  medication_ids: string[];
  medication_names: string[];
  categories: string[];
  warnings: string[];
  requires_review: boolean;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface Medication {
  id: string;
  user_id: string;
  medication_name: string;
  generic_name?: string;
  brand_name?: string;
  dosage?: string;
  dosage_form?: string;
  strength?: string;
  instructions?: string;
  frequency?: string;
  route?: string;
  prescribed_by?: string;
  prescribed_date?: string;
  prescription_number?: string;
  pharmacy_name?: string;
  pharmacy_phone?: string;
  quantity?: number;
  refills_remaining?: number;
  last_refill_date?: string;
  next_refill_date?: string;
  ndc_code?: string;
  purpose?: string;
  side_effects?: string[];
  warnings?: string[];
  interactions?: string[];
  status: 'active' | 'discontinued' | 'completed';
  discontinued_date?: string;
  discontinued_reason?: string;
  ai_confidence?: number;
  extraction_notes?: string;
  needs_review?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  // Psychiatric medication flags
  is_psychiatric?: boolean;
  psych_category?: string;
  psych_subcategory?: string;
  psych_classification_confidence?: number;
  created_at: string;
  updated_at: string;
}

export interface MedicationDoseTaken {
  id: string;
  medication_id: string;
  user_id: string;
  reminder_id?: string;
  taken_at: string;
  scheduled_time?: string;
  dose_amount?: string;
  status: 'taken' | 'missed' | 'skipped';
  skip_reason?: string;
  notes?: string;
  side_effects_noted?: string[];
  created_at: string;
}
