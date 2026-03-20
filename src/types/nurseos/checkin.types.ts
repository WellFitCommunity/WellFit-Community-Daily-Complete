// NurseOS Check-In Types — Daily emotional tracking

export interface ProviderDailyCheckin {
  id: string;
  practitioner_id: string;
  user_id: string;
  checkin_date: string;
  work_setting: WorkSetting;
  product_line: 'clarity' | 'shield';
  stress_level: number;
  energy_level: number;
  mood_rating: number;
  patients_contacted_today?: number | null;
  difficult_patient_calls?: number | null;
  prior_auth_denials?: number | null;
  compassion_fatigue_level?: number | null;
  shift_type?: 'day' | 'night' | 'swing' | 'on_call' | null;
  patient_census?: number | null;
  patient_acuity_score?: number | null;
  codes_responded_to?: number | null;
  lateral_violence_incident?: boolean | null;
  unsafe_staffing?: boolean | null;
  overtime_hours?: number | null;
  felt_overwhelmed?: boolean | null;
  felt_supported_by_team?: boolean | null;
  missed_break?: boolean | null;
  after_hours_work?: boolean | null;
  notes?: string | null;
  created_at: string;
}

export type WorkSetting =
  | 'remote'
  | 'office'
  | 'home_visits'
  | 'telehealth'
  | 'skilled_nursing'
  | 'hospital_shift';

export type ProductLine = 'clarity' | 'shield' | 'both';

export interface DailyCheckinFormData {
  work_setting: WorkSetting;
  product_line: 'clarity' | 'shield';
  stress_level: number;
  energy_level: number;
  mood_rating: number;
  patients_contacted_today?: number;
  difficult_patient_calls?: number;
  prior_auth_denials?: number;
  compassion_fatigue_level?: number;
  shift_type?: 'day' | 'night' | 'swing' | 'on_call';
  patient_census?: number;
  patient_acuity_score?: number;
  codes_responded_to?: number;
  lateral_violence_incident?: boolean;
  unsafe_staffing?: boolean;
  overtime_hours?: number;
  felt_overwhelmed?: boolean;
  felt_supported_by_team?: boolean;
  missed_break?: boolean;
  after_hours_work?: boolean;
  notes?: string;
}

export interface StressTrendAnalysis {
  avg_stress_7_days: number | null;
  avg_stress_30_days: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  checkin_count_7_days: number;
  checkin_count_30_days: number;
}
