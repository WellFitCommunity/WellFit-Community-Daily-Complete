// NurseOS Config Types — Product config, feature flags, dashboard stats

import type { BurnoutRiskLevel } from './assessment.types';
import type { ProductLine } from './checkin.types';

export interface NurseOSProductConfig {
  id: string;
  organization_id?: string | null;
  product_line: ProductLine;
  branding: {
    logo_url?: string | null;
    primary_color?: string | null;
    company_name?: string | null;
  };
  enabled_features: string[];
  license_tier: 'basic' | 'standard' | 'premium' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface NurseOSFeatureFlag {
  id: string;
  feature_key: string;
  feature_name: string;
  description?: string | null;
  applicable_to_clarity: boolean;
  applicable_to_shield: boolean;
  is_enabled_globally: boolean;
  required_license_tier: 'basic' | 'standard' | 'premium' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface ResilienceHubDashboardStats {
  current_burnout_risk: BurnoutRiskLevel;
  has_checked_in_today: boolean;
  check_in_streak_days: number;
  modules_completed: number;
  modules_in_progress: number;
  avg_stress_7_days: number | null;
  stress_trend: 'improving' | 'worsening' | 'stable';
  my_support_circles: number;
  intervention_needed: boolean;
}

export interface ResilienceHubApiResponse<T> {
  data: T | null;
  error?: { message: string; code?: string };
  metadata?: { timestamp: string; request_id?: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    page_size: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface ProviderWorkloadMetrics {
  practitioner_id: string;
  user_id: string;
  provider_name: string;
  encounters_this_week: number;
  unique_patients_this_week: number;
  encounters_this_month: number;
  unique_patients_this_month: number;
  avg_stress_last_7_days?: number | null;
  avg_overtime_last_30_days?: number | null;
  latest_burnout_score?: number | null;
  latest_burnout_risk?: BurnoutRiskLevel | null;
  last_refreshed: string;
}
