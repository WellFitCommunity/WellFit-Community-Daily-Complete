-- ============================================================================
-- EMOTIONAL RESILIENCE HUB - DATABASE SCHEMA
-- ============================================================================
-- Purpose: Provider burnout prevention and emotional wellness tracking
-- Target Users: Nurses, physicians, care managers, and other clinical staff
-- FHIR Alignment: Uses FHIR Practitioner resources, compatible with FHIR R4
-- HIPAA Compliance: PHI protection, audit logging, RLS policies
-- ============================================================================

-- ============================================================================
-- PART 1: CORE BURNOUT TRACKING
-- ============================================================================

-- Table: provider_burnout_assessments
-- Purpose: Track Maslach Burnout Inventory (MBI) scores over time
-- Reference: Maslach, C., & Jackson, S. E. (1981). The measurement of experienced burnout.
CREATE TABLE IF NOT EXISTS provider_burnout_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identification (links to FHIR practitioner)
  practitioner_id UUID NOT NULL REFERENCES fhir_practitioners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Assessment metadata
  assessment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assessment_type TEXT NOT NULL DEFAULT 'MBI-HSS', -- MBI-HSS (Human Services Survey), MBI-ES (Educators), or custom

  -- Maslach Burnout Inventory Dimensions (0-100 scale, normalized)
  -- Higher scores = higher burnout risk
  emotional_exhaustion_score DECIMAL(5,2) CHECK (emotional_exhaustion_score >= 0 AND emotional_exhaustion_score <= 100),
  depersonalization_score DECIMAL(5,2) CHECK (depersonalization_score >= 0 AND depersonalization_score <= 100),
  personal_accomplishment_score DECIMAL(5,2) CHECK (personal_accomplishment_score >= 0 AND personal_accomplishment_score <= 100),

  -- Composite burnout score (weighted average)
  composite_burnout_score DECIMAL(5,2) GENERATED ALWAYS AS (
    (emotional_exhaustion_score * 0.4 + depersonalization_score * 0.3 + (100 - personal_accomplishment_score) * 0.3)
  ) STORED,

  -- Risk level (auto-calculated)
  risk_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN (emotional_exhaustion_score * 0.4 + depersonalization_score * 0.3 + (100 - personal_accomplishment_score) * 0.3) >= 70 THEN 'critical'
      WHEN (emotional_exhaustion_score * 0.4 + depersonalization_score * 0.3 + (100 - personal_accomplishment_score) * 0.3) >= 50 THEN 'high'
      WHEN (emotional_exhaustion_score * 0.4 + depersonalization_score * 0.3 + (100 - personal_accomplishment_score) * 0.3) >= 30 THEN 'moderate'
      ELSE 'low'
    END
  ) STORED,

  -- Full questionnaire responses (JSONB for flexibility)
  -- Example: [{"question": "I feel emotionally drained...", "score": 4}]
  questionnaire_responses JSONB,

  -- Optional free-text reflection
  provider_notes TEXT,

  -- Follow-up flags
  intervention_triggered BOOLEAN DEFAULT FALSE,
  intervention_type TEXT, -- 'automatic_workload_reduction', 'peer_support_referral', 'eap_referral', 'manager_notification'
  follow_up_scheduled TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_provider_burnout_practitioner ON provider_burnout_assessments(practitioner_id);
CREATE INDEX idx_provider_burnout_user ON provider_burnout_assessments(user_id);
CREATE INDEX idx_provider_burnout_date ON provider_burnout_assessments(assessment_date DESC);
CREATE INDEX idx_provider_burnout_risk ON provider_burnout_assessments(risk_level);

-- RLS Policies
ALTER TABLE provider_burnout_assessments ENABLE ROW LEVEL SECURITY;

-- Providers can view their own assessments
CREATE POLICY "Providers can view own burnout assessments"
  ON provider_burnout_assessments FOR SELECT
  USING (auth.uid() = user_id);

-- Providers can insert their own assessments
CREATE POLICY "Providers can create own burnout assessments"
  ON provider_burnout_assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins and care managers can view all (for intervention purposes)
CREATE POLICY "Admins can view all burnout assessments"
  ON provider_burnout_assessments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'care_manager')
    )
  );

-- ============================================================================
-- PART 2: DAILY EMOTIONAL CHECK-INS (Lightweight)
-- ============================================================================

-- Table: provider_daily_checkins
-- Purpose: Quick daily mood/stress tracking (lower friction than full MBI)
-- Supports BOTH Clarity (community) and Shield (hospital) products
CREATE TABLE IF NOT EXISTS provider_daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identification
  practitioner_id UUID NOT NULL REFERENCES fhir_practitioners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Check-in metadata
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_setting TEXT, -- 'remote', 'office', 'home_visits', 'telehealth', 'skilled_nursing', 'hospital_shift'
  product_line TEXT DEFAULT 'clarity', -- 'clarity' (community) or 'shield' (hospital)

  -- Emotional state (1-10 scales) - SHARED ACROSS BOTH PRODUCTS
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 10), -- 1=terrible, 10=excellent

  -- Workload indicators - CLARITY (Community/Outpatient)
  patients_contacted_today INTEGER, -- # of patients reached (CCM calls, telehealth visits, home visits)
  difficult_patient_calls INTEGER, -- # of emotionally draining calls (lonely seniors, health anxiety, etc.)
  prior_auth_denials INTEGER, -- Administrative burden metric (insurance denials cause stress)
  compassion_fatigue_level INTEGER CHECK (compassion_fatigue_level >= 1 AND compassion_fatigue_level <= 10), -- Specific to community nurses

  -- Workload indicators - SHIELD (Hospital/Acute Care)
  shift_type TEXT, -- 'day', 'night', 'swing', 'on_call' (hospital-specific)
  patient_census INTEGER, -- # of patients assigned this shift
  patient_acuity_score DECIMAL(5,2), -- Sum of patient acuity scores (higher = sicker patients)
  codes_responded_to INTEGER, -- # of rapid responses, code blues this shift
  lateral_violence_incident BOOLEAN, -- Experienced bullying, yelling, disrespect from colleagues
  unsafe_staffing BOOLEAN, -- Nurse:patient ratio exceeded safe limits

  -- Shared workload indicators
  overtime_hours DECIMAL(4,2), -- Hours worked beyond scheduled shift
  felt_overwhelmed BOOLEAN,

  -- Support indicators - SHARED
  felt_supported_by_team BOOLEAN,
  missed_break BOOLEAN, -- Did you skip lunch/breaks?
  after_hours_work BOOLEAN, -- Charting or calls after shift end (Clarity) OR mandatory overtime (Shield)

  -- Optional free-text
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uniqueness constraint: one check-in per provider per day
  UNIQUE(user_id, checkin_date)
);

-- Indexes
CREATE INDEX idx_provider_checkin_practitioner ON provider_daily_checkins(practitioner_id);
CREATE INDEX idx_provider_checkin_date ON provider_daily_checkins(checkin_date DESC);
CREATE INDEX idx_provider_checkin_stress ON provider_daily_checkins(stress_level DESC);

-- RLS Policies
ALTER TABLE provider_daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view own check-ins"
  ON provider_daily_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Providers can create own check-ins"
  ON provider_daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can update own check-ins"
  ON provider_daily_checkins FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all check-ins"
  ON provider_daily_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'care_manager')
    )
  );

-- ============================================================================
-- PART 3: RESILIENCE TRAINING MODULES
-- ============================================================================

-- Table: resilience_training_modules
-- Purpose: Catalog of evidence-based resilience training content
CREATE TABLE IF NOT EXISTS resilience_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Module metadata
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'mindfulness', 'stress_management', 'communication', 'self_care', 'boundary_setting'

  -- Content
  content_type TEXT NOT NULL, -- 'video', 'article', 'interactive', 'audio', 'worksheet'
  content_url TEXT, -- Link to video/article or null for in-app content
  estimated_duration_minutes INTEGER, -- How long to complete

  -- Metadata
  difficulty_level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  evidence_based BOOLEAN DEFAULT TRUE, -- Is this based on research?
  citation TEXT, -- Academic reference if applicable

  -- Engagement
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_resilience_modules_category ON resilience_training_modules(category);
CREATE INDEX idx_resilience_modules_active ON resilience_training_modules(is_active);

-- RLS: All authenticated users can view active modules
ALTER TABLE resilience_training_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active modules"
  ON resilience_training_modules FOR SELECT
  USING (is_active = TRUE AND auth.role() = 'authenticated');

CREATE POLICY "Admins can manage modules"
  ON resilience_training_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 4: TRAINING COMPLETION TRACKING
-- ============================================================================

-- Table: provider_training_completions
-- Purpose: Track which providers completed which resilience modules
CREATE TABLE IF NOT EXISTS provider_training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identification
  practitioner_id UUID NOT NULL REFERENCES fhir_practitioners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Module reference
  module_id UUID NOT NULL REFERENCES resilience_training_modules(id) ON DELETE CASCADE,

  -- Completion tracking
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),

  -- Engagement metrics
  time_spent_minutes INTEGER, -- Self-reported or tracked
  found_helpful BOOLEAN, -- Optional feedback
  notes TEXT, -- Personal reflections

  -- Follow-up
  will_practice BOOLEAN, -- Did they commit to practicing this skill?

  -- Uniqueness: one completion record per user per module
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_training_completions_practitioner ON provider_training_completions(practitioner_id);
CREATE INDEX idx_training_completions_module ON provider_training_completions(module_id);
CREATE INDEX idx_training_completions_completed ON provider_training_completions(completed_at);

-- RLS Policies
ALTER TABLE provider_training_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view own completions"
  ON provider_training_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Providers can create own completions"
  ON provider_training_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can update own completions"
  ON provider_training_completions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all completions"
  ON provider_training_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 5: PEER SUPPORT SYSTEM
-- ============================================================================

-- Table: provider_support_circles
-- Purpose: Small peer support groups (5-8 providers) for regular check-ins
CREATE TABLE IF NOT EXISTS provider_support_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Circle metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Configuration
  meeting_frequency TEXT DEFAULT 'weekly', -- 'daily', 'weekly', 'biweekly', 'monthly'
  max_members INTEGER DEFAULT 8,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Facilitation
  facilitator_id UUID REFERENCES fhir_practitioners(id), -- Optional: designated facilitator

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: provider_support_circle_members
-- Purpose: Many-to-many relationship between providers and circles
CREATE TABLE IF NOT EXISTS provider_support_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  circle_id UUID NOT NULL REFERENCES provider_support_circles(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES fhir_practitioners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Membership metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT DEFAULT 'member', -- 'member', 'facilitator'
  is_active BOOLEAN DEFAULT TRUE,

  -- Uniqueness
  UNIQUE(circle_id, user_id)
);

CREATE INDEX idx_support_circle_members_circle ON provider_support_circle_members(circle_id);
CREATE INDEX idx_support_circle_members_practitioner ON provider_support_circle_members(practitioner_id);

-- Table: provider_support_reflections
-- Purpose: Anonymous or named reflections shared within support circles
CREATE TABLE IF NOT EXISTS provider_support_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  circle_id UUID NOT NULL REFERENCES provider_support_circles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Nullable for anonymous posts

  -- Content
  reflection_text TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT FALSE,

  -- Categorization
  tags TEXT[], -- 'difficult_patient', 'moral_injury', 'team_conflict', 'loss', 'success_story'

  -- Engagement
  helpful_count INTEGER DEFAULT 0, -- Number of "this helped me" reactions

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_reflections_circle ON provider_support_reflections(circle_id);
CREATE INDEX idx_support_reflections_created ON provider_support_reflections(created_at DESC);

-- RLS Policies for Support Circles
ALTER TABLE provider_support_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_support_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_support_reflections ENABLE ROW LEVEL SECURITY;

-- Only members can view their circles
CREATE POLICY "Members can view their circles"
  ON provider_support_circles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM provider_support_circle_members
      WHERE provider_support_circle_members.circle_id = provider_support_circles.id
      AND provider_support_circle_members.user_id = auth.uid()
      AND provider_support_circle_members.is_active = TRUE
    )
  );

-- Members can view circle membership
CREATE POLICY "Members can view circle membership"
  ON provider_support_circle_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM provider_support_circle_members scm
      WHERE scm.circle_id = provider_support_circle_members.circle_id
      AND scm.user_id = auth.uid()
      AND scm.is_active = TRUE
    )
  );

-- Members can view reflections in their circles
CREATE POLICY "Members can view circle reflections"
  ON provider_support_reflections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM provider_support_circle_members
      WHERE provider_support_circle_members.circle_id = provider_support_reflections.circle_id
      AND provider_support_circle_members.user_id = auth.uid()
      AND provider_support_circle_members.is_active = TRUE
    )
  );

-- Members can post reflections to their circles
CREATE POLICY "Members can create reflections"
  ON provider_support_reflections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM provider_support_circle_members
      WHERE provider_support_circle_members.circle_id = provider_support_reflections.circle_id
      AND provider_support_circle_members.user_id = auth.uid()
      AND provider_support_circle_members.is_active = TRUE
    )
  );

-- ============================================================================
-- PART 6: WORKLOAD ANALYTICS
-- ============================================================================

-- Table: provider_workload_metrics
-- Purpose: Aggregate workload data from FHIR encounters and system activity
-- NOTE: This is a materialized view refreshed nightly or on-demand
CREATE MATERIALIZED VIEW IF NOT EXISTS provider_workload_metrics AS
SELECT
  p.id AS practitioner_id,
  p.user_id,
  get_practitioner_full_name(p.*) AS provider_name,

  -- Current week metrics
  COUNT(DISTINCT e.id) FILTER (WHERE e.date_of_service >= CURRENT_DATE - INTERVAL '7 days') AS encounters_this_week,
  COUNT(DISTINCT e.patient_id) FILTER (WHERE e.date_of_service >= CURRENT_DATE - INTERVAL '7 days') AS unique_patients_this_week,

  -- Current month metrics
  COUNT(DISTINCT e.id) FILTER (WHERE e.date_of_service >= DATE_TRUNC('month', CURRENT_DATE)) AS encounters_this_month,
  COUNT(DISTINCT e.patient_id) FILTER (WHERE e.date_of_service >= DATE_TRUNC('month', CURRENT_DATE)) AS unique_patients_this_month,

  -- Burnout risk indicators
  AVG(pdc.stress_level) FILTER (WHERE pdc.checkin_date >= CURRENT_DATE - INTERVAL '7 days') AS avg_stress_last_7_days,
  AVG(pdc.overtime_hours) FILTER (WHERE pdc.checkin_date >= CURRENT_DATE - INTERVAL '30 days') AS avg_overtime_last_30_days,

  -- Latest burnout assessment
  (SELECT pba.composite_burnout_score
   FROM provider_burnout_assessments pba
   WHERE pba.practitioner_id = p.id
   ORDER BY pba.assessment_date DESC
   LIMIT 1) AS latest_burnout_score,

  (SELECT pba.risk_level
   FROM provider_burnout_assessments pba
   WHERE pba.practitioner_id = p.id
   ORDER BY pba.assessment_date DESC
   LIMIT 1) AS latest_burnout_risk,

  -- Last updated
  NOW() AS last_refreshed

FROM fhir_practitioners p
LEFT JOIN encounters e ON e.provider_id = p.id
LEFT JOIN provider_daily_checkins pdc ON pdc.practitioner_id = p.id
WHERE p.active = TRUE
GROUP BY p.id, p.user_id;

-- Index for fast lookups
CREATE UNIQUE INDEX idx_workload_metrics_practitioner ON provider_workload_metrics(practitioner_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_provider_workload_metrics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY provider_workload_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: SELF-CARE RESOURCE LIBRARY
-- ============================================================================

-- Table: resilience_resources
-- Purpose: Curated library of articles, videos, tools for on-demand access
CREATE TABLE IF NOT EXISTS resilience_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource metadata
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL, -- 'article', 'video', 'podcast', 'app', 'book', 'worksheet', 'hotline'

  -- Content
  url TEXT,
  thumbnail_url TEXT,

  -- Categorization
  categories TEXT[] NOT NULL, -- ['stress_management', 'mindfulness', 'communication', 'boundary_setting', 'self_compassion']
  tags TEXT[], -- More granular: 'meditation', 'breathing', 'journaling', etc.

  -- Targeting
  target_audience TEXT[], -- ['nurse', 'physician', 'care_manager', 'all']

  -- Quality indicators
  is_evidence_based BOOLEAN DEFAULT FALSE,
  citation TEXT,
  reviewed_by UUID REFERENCES auth.users(id), -- Admin who vetted this resource

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE, -- Highlighted on homepage

  -- Engagement
  view_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2), -- 0.00 to 5.00

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resilience_resources_categories ON resilience_resources USING GIN(categories);
CREATE INDEX idx_resilience_resources_active ON resilience_resources(is_active);
CREATE INDEX idx_resilience_resources_featured ON resilience_resources(featured);

-- RLS
ALTER TABLE resilience_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active resources"
  ON resilience_resources FOR SELECT
  USING (is_active = TRUE AND auth.role() = 'authenticated');

CREATE POLICY "Admins can manage resources"
  ON resilience_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 8: PRODUCT CONFIGURATION & FEATURE FLAGS
-- ============================================================================

-- Table: nurseos_product_config
-- Purpose: Configure which NurseOS product(s) an organization uses
CREATE TABLE IF NOT EXISTS nurseos_product_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization identification (NULL = default global config)
  organization_id UUID, -- Future: link to organizations table

  -- Product selection
  product_line TEXT NOT NULL DEFAULT 'clarity', -- 'clarity', 'shield', or 'both'
  CHECK (product_line IN ('clarity', 'shield', 'both')),

  -- Branding customization (white-label support)
  branding JSONB DEFAULT '{
    "logo_url": null,
    "primary_color": null,
    "company_name": null
  }'::jsonb,

  -- Enabled features (array of feature keys)
  enabled_features TEXT[] DEFAULT ARRAY['daily_checkins', 'burnout_assessments', 'peer_circles', 'resource_library'],

  -- License tier
  license_tier TEXT DEFAULT 'standard', -- 'basic', 'standard', 'premium', 'enterprise'

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Uniqueness: one config per organization
  UNIQUE(organization_id)
);

-- Insert default global config (for organizations without custom config)
INSERT INTO nurseos_product_config (organization_id, product_line, license_tier)
VALUES (NULL, 'clarity', 'standard')
ON CONFLICT (organization_id) DO NOTHING;

-- Table: nurseos_feature_flags
-- Purpose: Toggle NurseOS modules on/off per organization or globally
CREATE TABLE IF NOT EXISTS nurseos_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Feature identification
  feature_key TEXT UNIQUE NOT NULL, -- 'resilience_hub', 'brain_generator', 'medication_guardian', etc.
  feature_name TEXT NOT NULL,
  description TEXT,

  -- Product applicability
  applicable_to_clarity BOOLEAN DEFAULT TRUE, -- Is this feature available in Clarity product?
  applicable_to_shield BOOLEAN DEFAULT TRUE, -- Is this feature available in Shield product?

  -- Global toggle
  is_enabled_globally BOOLEAN DEFAULT FALSE,

  -- License tier (for future monetization)
  required_license_tier TEXT DEFAULT 'standard', -- 'basic', 'standard', 'premium', 'enterprise'

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default flags with product applicability
INSERT INTO nurseos_feature_flags (feature_key, feature_name, description, applicable_to_clarity, applicable_to_shield, is_enabled_globally, required_license_tier)
VALUES
  -- Core features (both products)
  ('daily_checkins', 'Daily Emotional Check-Ins', 'Quick daily stress/mood tracking', TRUE, TRUE, TRUE, 'basic'),
  ('burnout_assessments', 'Burnout Assessments (MBI)', 'Maslach Burnout Inventory assessments', TRUE, TRUE, TRUE, 'standard'),
  ('peer_circles', 'Peer Support Circles', 'Small group peer support (5-8 members)', TRUE, TRUE, TRUE, 'standard'),
  ('resource_library', 'Self-Care Resource Library', 'Curated articles, apps, crisis hotlines', TRUE, TRUE, TRUE, 'basic'),
  ('training_modules', 'Resilience Training Modules', 'Evidence-based resilience exercises', TRUE, TRUE, FALSE, 'standard'),

  -- Clarity-specific features (community/outpatient)
  ('compassion_fatigue_tracker', 'Compassion Fatigue Tracker', 'Track emotional drain from patient calls', TRUE, FALSE, FALSE, 'standard'),
  ('workload_rebalancing', 'CCM Workload Rebalancing', 'Auto-recommend patient panel rebalancing', TRUE, FALSE, FALSE, 'premium'),
  ('boundary_setting_academy', 'Boundary Setting Academy', 'Training on saying no, setting limits', TRUE, FALSE, FALSE, 'standard'),

  -- Shield-specific features (hospital/acute care)
  ('shift_stress_monitor', 'Shift Stress Monitor', 'Real-time stress tracking during shift', FALSE, TRUE, FALSE, 'standard'),
  ('code_lavender', 'Code Lavender Integration', 'Post-trauma rapid response system', FALSE, TRUE, FALSE, 'premium'),
  ('brain_generator', 'Brain Generator', 'Auto-generate shift handoff notes', FALSE, TRUE, FALSE, 'premium'),
  ('medication_guardian', 'Medication Guardian', 'Real-time drug interaction checking', FALSE, TRUE, FALSE, 'enterprise'),
  ('rapid_peer_support', 'Rapid Peer Support', 'Real-time chat with other nurses during shift', FALSE, TRUE, FALSE, 'premium')
ON CONFLICT (feature_key) DO NOTHING;

-- RLS
ALTER TABLE nurseos_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All users can view feature flags"
  ON nurseos_feature_flags FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can modify feature flags"
  ON nurseos_feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin')
    )
  );

-- ============================================================================
-- PART 9: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get provider's current burnout risk level
CREATE OR REPLACE FUNCTION get_provider_burnout_risk(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  risk TEXT;
BEGIN
  SELECT risk_level INTO risk
  FROM provider_burnout_assessments
  WHERE user_id = p_user_id
  ORDER BY assessment_date DESC
  LIMIT 1;

  RETURN COALESCE(risk, 'unknown');
END;
$$ LANGUAGE plpgsql;

-- Function: Get provider's average stress trend (7-day vs 30-day)
CREATE OR REPLACE FUNCTION get_provider_stress_trend(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avg_stress_7_days', AVG(stress_level) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '7 days'),
    'avg_stress_30_days', AVG(stress_level) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '30 days'),
    'trend',
      CASE
        WHEN AVG(stress_level) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '7 days') >
             AVG(stress_level) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '30 days') + 1
        THEN 'increasing'
        WHEN AVG(stress_level) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '7 days') <
             AVG(stress_level) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '30 days') - 1
        THEN 'decreasing'
        ELSE 'stable'
      END,
    'checkin_count_7_days', COUNT(*) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '7 days'),
    'checkin_count_30_days', COUNT(*) FILTER (WHERE checkin_date >= CURRENT_DATE - INTERVAL '30 days')
  ) INTO result
  FROM provider_daily_checkins
  WHERE user_id = p_user_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if provider qualifies for intervention
CREATE OR REPLACE FUNCTION check_burnout_intervention_needed(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  latest_score DECIMAL;
  avg_stress DECIMAL;
  high_stress_days INTEGER;
BEGIN
  -- Get latest burnout score
  SELECT composite_burnout_score INTO latest_score
  FROM provider_burnout_assessments
  WHERE user_id = p_user_id
  ORDER BY assessment_date DESC
  LIMIT 1;

  -- Get recent stress metrics
  SELECT
    AVG(stress_level),
    COUNT(*) FILTER (WHERE stress_level >= 8)
  INTO avg_stress, high_stress_days
  FROM provider_daily_checkins
  WHERE user_id = p_user_id
  AND checkin_date >= CURRENT_DATE - INTERVAL '14 days';

  -- Intervention criteria:
  -- 1. Burnout score >= 70 (critical)
  -- 2. Average stress >= 8 over 14 days
  -- 3. 5+ days with stress >= 8 in last 14 days

  RETURN (
    (latest_score IS NOT NULL AND latest_score >= 70) OR
    (avg_stress IS NOT NULL AND avg_stress >= 8) OR
    (high_stress_days >= 5)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 10: INITIAL SEED DATA (Example Resilience Modules)
-- ============================================================================

INSERT INTO resilience_training_modules (title, description, category, content_type, estimated_duration_minutes, evidence_based, citation)
VALUES
  (
    'Box Breathing for Stress Relief',
    'Learn the 4-4-4-4 breathing technique used by Navy SEALs to manage stress in high-pressure situations. Reduces cortisol and activates parasympathetic nervous system.',
    'mindfulness',
    'interactive',
    5,
    TRUE,
    'Perciavalle et al. (2017). The role of deep breathing on stress. Neurological Sciences, 38(3), 451-458.'
  ),
  (
    'Setting Boundaries with Compassion',
    'Learn how to say no to additional tasks without guilt. Protect your time and energy while maintaining professional relationships.',
    'boundary_setting',
    'article',
    10,
    TRUE,
    'Maslach, C., & Leiter, M. P. (2016). Understanding the burnout experience: recent research and its implications for psychiatry. World Psychiatry, 15(2), 103-111.'
  ),
  (
    'Self-Compassion for Healthcare Workers',
    'Practice Kristin Neff''s self-compassion exercises adapted for clinical settings. Combat self-criticism and moral injury.',
    'self_care',
    'video',
    15,
    TRUE,
    'Neff, K. D., & Germer, C. K. (2013). A pilot study and randomized controlled trial of the mindful self-compassion program. Journal of Clinical Psychology, 69(1), 28-44.'
  ),
  (
    '3-Minute Micro-Break Routine',
    'Quick reset exercises you can do between patients: neck stretches, hand massage, grounding techniques. Evidence shows micro-breaks reduce fatigue.',
    'stress_management',
    'interactive',
    3,
    TRUE,
    'Hunter, E. M., & Wu, C. (2016). Give me a better break: Choosing workday break activities using the recovery experience. Journal of Applied Psychology, 101(2), 245.'
  ),
  (
    'Communication Scripts for Difficult Conversations',
    'Templates for addressing understaffing, reporting unsafe conditions, and advocating for your needs with administrators.',
    'communication',
    'worksheet',
    20,
    TRUE,
    'AACN Practice Alerts and Position Statements on Healthy Work Environments (2023)'
  )
ON CONFLICT DO NOTHING;

-- Seed example resources
INSERT INTO resilience_resources (title, description, resource_type, url, categories, tags, target_audience, is_evidence_based, featured)
VALUES
  (
    'National Suicide Prevention Lifeline (988)',
    '24/7 crisis support for healthcare workers experiencing emotional distress. Call or text 988, or chat online.',
    'hotline',
    'https://988lifeline.org',
    ARRAY['crisis_support'],
    ARRAY['suicide_prevention', 'crisis', 'mental_health'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),
  (
    'Dr. Lorna Breen Heroes'' Foundation',
    'Resources specifically for healthcare worker mental health and suicide prevention. Named after Dr. Lorna Breen, an ER physician who died by suicide during COVID-19.',
    'article',
    'https://drlornabreen.org',
    ARRAY['crisis_support', 'self_care'],
    ARRAY['mental_health', 'resources', 'healthcare_workers'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),
  (
    'Headspace for Healthcare Workers',
    'Free meditation and mindfulness app access for all healthcare professionals. Includes sleep, stress, and focus exercises.',
    'app',
    'https://www.headspace.com/health-professionals',
    ARRAY['mindfulness', 'stress_management'],
    ARRAY['meditation', 'sleep', 'free'],
    ARRAY['all'],
    TRUE,
    FALSE
  ),
  (
    'Code Lavender: Rapid Response for Caregiver Distress',
    'Learn about implementing Code Lavender programs - holistic rapid response for staff emotional trauma after difficult events.',
    'article',
    'https://consultqd.clevelandclinic.org/code-lavender-holistic-care-for-caregivers',
    ARRAY['crisis_support'],
    ARRAY['trauma', 'code_lavender', 'hospital_programs'],
    ARRAY['nurse', 'physician', 'care_manager'],
    TRUE,
    FALSE
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATIONS COMPLETE
-- ============================================================================

-- Grant permissions (adjust as needed for your Supabase setup)
-- These are examples - modify based on your role structure

-- Allow service role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Allow authenticated users appropriate access (RLS handles fine-grained control)
GRANT SELECT, INSERT, UPDATE ON provider_burnout_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON provider_daily_checkins TO authenticated;
GRANT SELECT ON resilience_training_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON provider_training_completions TO authenticated;
GRANT SELECT ON resilience_resources TO authenticated;
GRANT SELECT ON nurseos_feature_flags TO authenticated;

-- Comments for documentation
COMMENT ON TABLE provider_burnout_assessments IS 'Maslach Burnout Inventory (MBI) assessments for healthcare providers. Tracks emotional exhaustion, depersonalization, and personal accomplishment over time.';
COMMENT ON TABLE provider_daily_checkins IS 'Lightweight daily emotional check-ins for providers. Lower friction than full MBI, enables trend detection.';
COMMENT ON TABLE resilience_training_modules IS 'Catalog of evidence-based resilience training content (videos, articles, interactive exercises).';
COMMENT ON TABLE provider_training_completions IS 'Tracks which providers completed which resilience training modules.';
COMMENT ON TABLE provider_support_circles IS 'Small peer support groups (5-8 providers) for regular emotional check-ins and mutual support.';
COMMENT ON TABLE provider_support_reflections IS 'Anonymous or named reflections shared within peer support circles.';
COMMENT ON TABLE resilience_resources IS 'Curated library of self-care resources (articles, apps, hotlines, books) for on-demand access.';
COMMENT ON TABLE nurseos_feature_flags IS 'Feature flags for toggling NurseOS modules (Resilience Hub, Brain Generator, etc.) per organization or globally.';
COMMENT ON MATERIALIZED VIEW provider_workload_metrics IS 'Aggregated workload data from encounters and check-ins. Refresh nightly or on-demand.';
