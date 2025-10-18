// ============================================================================
// NurseOS Emotional Resilience Hub - TypeScript Type Definitions
// ============================================================================
// Purpose: Type-safe interfaces for burnout prevention platform
// Database: Aligned with supabase/migrations/20251018090900_resilience_hub.sql
// Standards: FHIR R4 naming (PascalCase types, snake_case fields)
// ============================================================================

// ============================================================================
// PART 1: BURNOUT ASSESSMENTS
// ============================================================================

/**
 * Maslach Burnout Inventory (MBI) assessment
 * Tracks three dimensions of burnout: emotional exhaustion, depersonalization, personal accomplishment
 */
export interface ProviderBurnoutAssessment {
  id: string; // UUID
  practitioner_id: string; // FK to fhir_practitioners
  user_id: string; // FK to auth.users

  // Assessment metadata
  assessment_date: string; // ISO 8601 datetime
  assessment_type: 'MBI-HSS' | 'MBI-ES' | 'custom';

  // MBI Dimensions (0-100 scale)
  emotional_exhaustion_score: number; // 0-100
  depersonalization_score: number; // 0-100
  personal_accomplishment_score: number; // 0-100 (note: high score = low burnout on this dimension)

  // Computed fields (database generated columns)
  composite_burnout_score?: number; // Weighted average, read-only
  risk_level?: 'low' | 'moderate' | 'high' | 'critical'; // Auto-calculated, read-only

  // Full questionnaire responses
  questionnaire_responses?: MBIQuestionnaireResponse[]; // JSONB

  // Provider reflection
  provider_notes?: string | null;

  // Follow-up
  intervention_triggered: boolean;
  intervention_type?: 'automatic_workload_reduction' | 'peer_support_referral' | 'eap_referral' | 'manager_notification' | null;
  follow_up_scheduled?: string | null; // ISO 8601 datetime

  // Audit
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * Individual MBI question response
 */
export interface MBIQuestionnaireResponse {
  question: string;
  score: number; // 0-6 scale (Maslach standard)
  dimension: 'emotional_exhaustion' | 'depersonalization' | 'personal_accomplishment';
}

/**
 * Burnout risk level enum
 */
export type BurnoutRiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';

// ============================================================================
// PART 2: DAILY CHECK-INS
// ============================================================================

/**
 * Daily emotional check-in
 * Supports BOTH Clarity (community) and Shield (hospital) products
 */
export interface ProviderDailyCheckin {
  id: string; // UUID
  practitioner_id: string; // FK
  user_id: string; // FK

  // Metadata
  checkin_date: string; // ISO 8601 date (YYYY-MM-DD)
  work_setting: WorkSetting;
  product_line: 'clarity' | 'shield';

  // Emotional state (1-10 scales) - SHARED
  stress_level: number; // 1-10
  energy_level: number; // 1-10
  mood_rating: number; // 1-10 (1=terrible, 10=excellent)

  // Workload - CLARITY (Community/Outpatient)
  patients_contacted_today?: number | null;
  difficult_patient_calls?: number | null;
  prior_auth_denials?: number | null;
  compassion_fatigue_level?: number | null; // 1-10

  // Workload - SHIELD (Hospital)
  shift_type?: 'day' | 'night' | 'swing' | 'on_call' | null;
  patient_census?: number | null;
  patient_acuity_score?: number | null; // Sum of acuity scores
  codes_responded_to?: number | null;
  lateral_violence_incident?: boolean | null;
  unsafe_staffing?: boolean | null;

  // Shared workload
  overtime_hours?: number | null;
  felt_overwhelmed?: boolean | null;

  // Support indicators
  felt_supported_by_team?: boolean | null;
  missed_break?: boolean | null;
  after_hours_work?: boolean | null;

  // Notes
  notes?: string | null;

  // Audit
  created_at: string; // ISO 8601
}

/**
 * Work setting enum
 */
export type WorkSetting =
  | 'remote'
  | 'office'
  | 'home_visits'
  | 'telehealth'
  | 'skilled_nursing'
  | 'hospital_shift';

/**
 * Product line enum
 */
export type ProductLine = 'clarity' | 'shield' | 'both';

// ============================================================================
// PART 3: RESILIENCE TRAINING MODULES
// ============================================================================

/**
 * Evidence-based resilience training module (video, article, interactive exercise)
 */
export interface ResilienceTrainingModule {
  id: string; // UUID
  title: string;
  description?: string | null;
  category: ResilienceCategory;

  // Content
  content_type: ContentType;
  content_url?: string | null;
  estimated_duration_minutes?: number | null;

  // Metadata
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  evidence_based: boolean;
  citation?: string | null; // Academic reference

  // Status
  is_active: boolean;
  display_order: number;

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string | null; // FK to auth.users
}

/**
 * Resilience module category
 */
export type ResilienceCategory =
  | 'mindfulness'
  | 'stress_management'
  | 'communication'
  | 'self_care'
  | 'boundary_setting'
  | 'compassion_fatigue'
  | 'moral_injury'
  | 'trauma_support';

/**
 * Content type for modules
 */
export type ContentType =
  | 'video'
  | 'article'
  | 'interactive'
  | 'audio'
  | 'worksheet'
  | 'guided_meditation';

// ============================================================================
// PART 4: TRAINING COMPLETION TRACKING
// ============================================================================

/**
 * Tracks provider's completion of resilience modules
 */
export interface ProviderTrainingCompletion {
  id: string; // UUID
  practitioner_id: string; // FK
  user_id: string; // FK
  module_id: string; // FK to resilience_training_modules

  // Progress
  started_at: string; // ISO 8601
  completed_at?: string | null; // ISO 8601
  completion_percentage: number; // 0-100

  // Engagement
  time_spent_minutes?: number | null;
  found_helpful?: boolean | null;
  notes?: string | null; // Personal reflections

  // Commitment
  will_practice?: boolean | null;
}

// ============================================================================
// PART 5: PEER SUPPORT CIRCLES
// ============================================================================

/**
 * Small peer support group (5-8 providers)
 */
export interface ProviderSupportCircle {
  id: string; // UUID
  name: string;
  description?: string | null;

  // Configuration
  meeting_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  max_members: number; // Default 8

  // Status
  is_active: boolean;

  // Facilitation
  facilitator_id?: string | null; // FK to fhir_practitioners

  // Audit
  created_at: string;
  updated_at: string;
}

/**
 * Circle membership (many-to-many)
 */
export interface ProviderSupportCircleMember {
  id: string; // UUID
  circle_id: string; // FK
  practitioner_id: string; // FK
  user_id: string; // FK

  // Membership
  joined_at: string; // ISO 8601
  role: 'member' | 'facilitator';
  is_active: boolean;
}

/**
 * Reflection/post shared within a circle
 */
export interface ProviderSupportReflection {
  id: string; // UUID
  circle_id: string; // FK
  author_id?: string | null; // FK to auth.users (null if anonymous)

  // Content
  reflection_text: string;
  is_anonymous: boolean;

  // Categorization
  tags?: string[] | null; // e.g., ['difficult_patient', 'moral_injury', 'success_story']

  // Engagement
  helpful_count: number; // # of "this helped me" reactions

  // Audit
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PART 6: WORKLOAD ANALYTICS
// ============================================================================

/**
 * Aggregated workload metrics (materialized view)
 * NOTE: Currently disabled - requires encounters table
 */
export interface ProviderWorkloadMetrics {
  practitioner_id: string;
  user_id: string;
  provider_name: string; // Full name from get_practitioner_full_name()

  // Current week
  encounters_this_week: number;
  unique_patients_this_week: number;

  // Current month
  encounters_this_month: number;
  unique_patients_this_month: number;

  // Burnout risk indicators
  avg_stress_last_7_days?: number | null; // 1-10 scale
  avg_overtime_last_30_days?: number | null; // Hours

  // Latest burnout assessment
  latest_burnout_score?: number | null; // 0-100
  latest_burnout_risk?: BurnoutRiskLevel | null;

  // Metadata
  last_refreshed: string; // ISO 8601
}

// ============================================================================
// PART 7: RESOURCE LIBRARY
// ============================================================================

/**
 * Self-care resource (article, app, hotline, book, etc.)
 */
export interface ResilienceResource {
  id: string; // UUID
  title: string;
  description?: string | null;
  resource_type: ResourceType;

  // Content
  url?: string | null;
  thumbnail_url?: string | null;

  // Categorization
  categories: string[]; // e.g., ['stress_management', 'mindfulness']
  tags?: string[] | null; // More granular

  // Targeting
  target_audience?: string[] | null; // ['nurse', 'physician', 'care_manager', 'all']

  // Quality
  is_evidence_based: boolean;
  citation?: string | null;
  reviewed_by?: string | null; // FK to auth.users

  // Status
  is_active: boolean;
  featured: boolean; // Highlighted on homepage

  // Engagement
  view_count: number;
  average_rating?: number | null; // 0.00 to 5.00

  // Audit
  created_at: string;
  updated_at: string;
}

/**
 * Resource type enum
 */
export type ResourceType =
  | 'article'
  | 'video'
  | 'podcast'
  | 'app'
  | 'book'
  | 'worksheet'
  | 'hotline'
  | 'website';

// ============================================================================
// PART 8: PRODUCT CONFIGURATION & FEATURE FLAGS
// ============================================================================

/**
 * Organization-specific NurseOS product configuration
 */
export interface NurseOSProductConfig {
  id: string; // UUID
  organization_id?: string | null; // Null = global default

  // Product selection
  product_line: ProductLine;

  // Branding (white-label)
  branding: {
    logo_url?: string | null;
    primary_color?: string | null;
    company_name?: string | null;
  };

  // Enabled features
  enabled_features: string[]; // Array of feature keys

  // License
  license_tier: 'basic' | 'standard' | 'premium' | 'enterprise';

  // Audit
  created_at: string;
  updated_at: string;
}

/**
 * Feature flag configuration
 */
export interface NurseOSFeatureFlag {
  id: string; // UUID
  feature_key: string; // Unique identifier
  feature_name: string;
  description?: string | null;

  // Product applicability
  applicable_to_clarity: boolean;
  applicable_to_shield: boolean;

  // Global toggle
  is_enabled_globally: boolean;

  // License requirement
  required_license_tier: 'basic' | 'standard' | 'premium' | 'enterprise';

  // Audit
  created_at: string;
  updated_at: string;
}

// ============================================================================
// PART 9: HELPER TYPES & UTILITIES
// ============================================================================

/**
 * Stress trend analysis result
 */
export interface StressTrendAnalysis {
  avg_stress_7_days: number | null;
  avg_stress_30_days: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  checkin_count_7_days: number;
  checkin_count_30_days: number;
}

/**
 * Intervention recommendation
 */
export interface InterventionRecommendation {
  needed: boolean;
  reason?: 'high_burnout' | 'sustained_stress' | 'high_workload' | 'moral_injury';
  recommendation?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Dashboard summary stats
 */
export interface ResilienceHubDashboardStats {
  current_burnout_risk: BurnoutRiskLevel;
  has_checked_in_today: boolean;
  check_in_streak_days: number; // # of consecutive days with check-ins
  modules_completed: number;
  modules_in_progress: number;
  avg_stress_7_days: number | null;
  stress_trend: 'improving' | 'worsening' | 'stable';
  my_support_circles: number; // # of circles user is in
  intervention_needed: boolean;
}

// ============================================================================
// PART 10: FORM INPUT TYPES (for React components)
// ============================================================================

/**
 * Daily check-in form input (subset of ProviderDailyCheckin)
 */
export interface DailyCheckinFormData {
  work_setting: WorkSetting;
  product_line: 'clarity' | 'shield';

  // Required emotional state
  stress_level: number; // 1-10
  energy_level: number; // 1-10
  mood_rating: number; // 1-10

  // Optional workload (depends on product_line)
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

/**
 * Burnout assessment form input
 */
export interface BurnoutAssessmentFormData {
  assessment_type: 'MBI-HSS' | 'MBI-ES' | 'custom';

  // MBI responses (0-6 per question)
  emotional_exhaustion_responses: number[]; // 9 questions
  depersonalization_responses: number[]; // 5 questions
  personal_accomplishment_responses: number[]; // 8 questions

  // Optional reflection
  provider_notes?: string;
}

// ============================================================================
// PART 11: API RESPONSE TYPES
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ResilienceHubApiResponse<T> {
  data: T | null;
  error?: {
    message: string;
    code?: string;
  };
  metadata?: {
    timestamp: string;
    request_id?: string;
  };
}

/**
 * Paginated list response
 */
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

// ============================================================================
// PART 12: CONSTANTS & ENUMS
// ============================================================================

/**
 * MBI question constants (for form rendering)
 */
export const MBI_QUESTIONS = {
  emotional_exhaustion: [
    "I feel emotionally drained from my work.",
    "I feel used up at the end of the workday.",
    "I feel fatigued when I get up in the morning and have to face another day on the job.",
    "Working with people all day is really a strain for me.",
    "I feel burned out from my work.",
    "I feel frustrated by my job.",
    "I feel I'm working too hard on my job.",
    "Working with people directly puts too much stress on me.",
    "I feel like I'm at the end of my rope.",
  ],
  depersonalization: [
    "I feel I treat some patients as if they were impersonal objects.",
    "I've become more callous toward people since I took this job.",
    "I worry that this job is hardening me emotionally.",
    "I don't really care what happens to some patients.",
    "I feel patients blame me for some of their problems.",
  ],
  personal_accomplishment: [
    "I can easily understand how my patients feel about things.",
    "I deal very effectively with the problems of my patients.",
    "I feel I'm positively influencing other people's lives through my work.",
    "I feel very energetic.",
    "I can easily create a relaxed atmosphere with my patients.",
    "I feel exhilarated after working closely with my patients.",
    "I have accomplished many worthwhile things in this job.",
    "In my work, I deal with emotional problems very calmly.",
  ],
} as const;

/**
 * Burnout risk thresholds
 */
export const BURNOUT_THRESHOLDS = {
  low: { min: 0, max: 29 },
  moderate: { min: 30, max: 49 },
  high: { min: 50, max: 69 },
  critical: { min: 70, max: 100 },
} as const;

/**
 * Stress level descriptors (for UI)
 */
export const STRESS_LEVEL_LABELS = {
  1: "😌 Completely calm",
  2: "😊 Very relaxed",
  3: "🙂 Relaxed",
  4: "😐 Slightly stressed",
  5: "😕 Moderately stressed",
  6: "😟 Stressed",
  7: "😰 Very stressed",
  8: "😨 Extremely stressed",
  9: "😫 Overwhelmed",
  10: "🆘 In crisis",
} as const;

// ============================================================================
// TYPE GUARDS (for runtime type checking)
// ============================================================================

/**
 * Check if product line is valid
 */
export function isValidProductLine(value: string): value is ProductLine {
  return ['clarity', 'shield', 'both'].includes(value);
}

/**
 * Check if burnout risk is critical
 */
export function isCriticalBurnoutRisk(risk: BurnoutRiskLevel): boolean {
  return risk === 'critical';
}

/**
 * Check if check-in is recent (within last 24 hours)
 */
export function isRecentCheckin(checkin: ProviderDailyCheckin): boolean {
  const checkinDate = new Date(checkin.checkin_date);
  const now = new Date();
  const diffHours = (now.getTime() - checkinDate.getTime()) / (1000 * 60 * 60);
  return diffHours <= 24;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate composite burnout score from MBI dimensions
 * Weighted average: EE (40%), DP (30%), PA inverted (30%)
 */
export function calculateCompositeBurnoutScore(
  emotional_exhaustion: number,
  depersonalization: number,
  personal_accomplishment: number
): number {
  return (
    emotional_exhaustion * 0.4 +
    depersonalization * 0.3 +
    (100 - personal_accomplishment) * 0.3
  );
}

/**
 * Determine burnout risk level from composite score
 */
export function getBurnoutRiskLevel(compositeScore: number): BurnoutRiskLevel {
  if (compositeScore >= 70) return 'critical';
  if (compositeScore >= 50) return 'high';
  if (compositeScore >= 30) return 'moderate';
  return 'low';
}

/**
 * Calculate MBI dimension score from individual responses
 * @param responses Array of 0-6 scores
 * @param maxQuestions Total number of questions for this dimension
 * @returns Score on 0-100 scale
 */
export function calculateMBIDimensionScore(
  responses: number[],
  maxQuestions: number
): number {
  const sum = responses.reduce((acc, val) => acc + val, 0);
  const maxScore = maxQuestions * 6; // Each question is 0-6
  return (sum / maxScore) * 100;
}

/**
 * Format provider name for display
 */
export function formatProviderName(
  family_name: string,
  given_names: string[],
  prefix?: string | null,
  suffix?: string | null
): string {
  const name = `${prefix ? prefix + ' ' : ''}${given_names.join(' ')} ${family_name}${suffix ? ', ' + suffix : ''}`;
  return name.trim();
}
