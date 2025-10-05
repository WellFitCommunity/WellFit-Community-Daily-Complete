-- Create all engagement tracking tables for comprehensive metrics capture
-- This completes the engagement tracking system with trivia, word games, and meal interactions

BEGIN;

-- ========================================================================
-- STEP 1: Create trivia_game_results table
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.trivia_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Timing
  game_date date DEFAULT CURRENT_DATE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_time_seconds integer,

  -- Scoring
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,

  -- Performance metrics
  difficulty_breakdown jsonb DEFAULT '{}'::jsonb,
  questions_attempted text[] DEFAULT ARRAY[]::text[],
  average_response_time_seconds numeric(6,2),

  -- Status
  completion_status text DEFAULT 'completed' CHECK (completion_status IN ('completed', 'abandoned', 'incomplete')),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trivia_game_results_user ON public.trivia_game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_trivia_game_results_date ON public.trivia_game_results(game_date);
CREATE INDEX IF NOT EXISTS idx_trivia_game_results_created ON public.trivia_game_results(created_at);

-- RLS Policies
ALTER TABLE public.trivia_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trivia results"
  ON public.trivia_game_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trivia results"
  ON public.trivia_game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all trivia results"
  ON public.trivia_game_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_trivia_game_results_uat
  BEFORE UPDATE ON public.trivia_game_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

RAISE NOTICE '✅ trivia_game_results table created';

-- ========================================================================
-- STEP 2: Create word_game_results table
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.word_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Timing
  game_date date DEFAULT CURRENT_DATE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_time_seconds integer,

  -- Scoring
  words_found integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL DEFAULT 0,
  hints_used integer DEFAULT 0,

  -- Game details
  difficulty_level text,
  puzzle_id text,

  -- Status
  completion_status text DEFAULT 'completed' CHECK (completion_status IN ('completed', 'abandoned', 'incomplete')),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_word_game_results_user ON public.word_game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_word_game_results_date ON public.word_game_results(game_date);
CREATE INDEX IF NOT EXISTS idx_word_game_results_created ON public.word_game_results(created_at);

-- RLS Policies
ALTER TABLE public.word_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own word game results"
  ON public.word_game_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own word game results"
  ON public.word_game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all word game results"
  ON public.word_game_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_word_game_results_uat
  BEFORE UPDATE ON public.word_game_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

RAISE NOTICE '✅ word_game_results table created';

-- ========================================================================
-- STEP 3: Create meal_interactions table
-- ========================================================================

CREATE TABLE IF NOT EXISTS public.meal_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Meal details
  meal_id text,
  meal_name text,
  meal_category text, -- breakfast, lunch, dinner, snack

  -- Interaction tracking
  viewed boolean DEFAULT false,
  liked boolean DEFAULT false,
  will_make_it boolean DEFAULT false,
  photo_uploaded boolean DEFAULT false,
  photo_url text,

  -- Notes
  user_notes text,
  rating integer CHECK (rating >= 1 AND rating <= 5),

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_interactions_user ON public.meal_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_interactions_meal ON public.meal_interactions(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_interactions_created ON public.meal_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_meal_interactions_photo ON public.meal_interactions(photo_uploaded) WHERE photo_uploaded = true;

-- RLS Policies
ALTER TABLE public.meal_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meal interactions"
  ON public.meal_interactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all meal interactions"
  ON public.meal_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER trg_meal_interactions_uat
  BEFORE UPDATE ON public.meal_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

RAISE NOTICE '✅ meal_interactions table created';

-- ========================================================================
-- STEP 4: Update patient_engagement_metrics view with ALL tables
-- ========================================================================

DROP VIEW IF EXISTS public.patient_engagement_scores CASCADE;
DROP VIEW IF EXISTS public.patient_engagement_metrics CASCADE;

CREATE OR REPLACE VIEW public.patient_engagement_metrics AS
SELECT
  u.id as user_id,
  u.email,
  p.first_name,
  p.last_name,
  p.phone,

  -- ============================================================
  -- ACTIVITY COUNTS (Last 30 days) - ALL TABLES NOW INCLUDED ⭐
  -- ============================================================
  COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days'), 0) as check_ins_30d,
  COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days'), 0) as check_ins_7d,

  -- Self-reports (CORE METRIC with MANDATORY MOOD) ⭐
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) as self_reports_30d,
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '7 days'), 0) as self_reports_7d,

  -- Questions asked
  COALESCE(COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days'), 0) as questions_asked_30d,

  -- Games ⭐ NOW CAPTURED
  COALESCE(COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days'), 0) as trivia_games_30d,
  COALESCE(COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '7 days'), 0) as trivia_games_7d,
  COALESCE(COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days'), 0) as word_games_30d,
  COALESCE(COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '7 days'), 0) as word_games_7d,

  -- Meal interactions ⭐ NOW CAPTURED
  COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days'), 0) as meal_interactions_30d,
  COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true), 0) as meal_photos_30d,
  COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.will_make_it = true), 0) as meals_planning_30d,

  -- Community engagement
  COALESCE(COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days'), 0) as community_photos_30d,

  -- ============================================================
  -- LAST ACTIVITY TIMESTAMPS - ALL ACTIVITIES
  -- ============================================================
  MAX(ci.created_at) as last_check_in,
  MAX(sr.created_at) as last_self_report,
  MAX(uq.created_at) as last_question,
  MAX(cm.created_at) as last_community_photo,
  MAX(tg.created_at) as last_trivia_game,
  MAX(wg.created_at) as last_word_game,
  MAX(mi.created_at) as last_meal_interaction,

  -- ============================================================
  -- MOOD & MENTAL HEALTH INDICATORS (MANDATORY MOOD) ⭐
  -- ============================================================

  AVG(
    CASE
      WHEN sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%' OR sr.mood ILIKE '%wonderful%' THEN 5
      WHEN sr.mood ILIKE '%good%' OR sr.mood ILIKE '%okay%' OR sr.mood ILIKE '%fine%' OR sr.mood ILIKE '%alright%' THEN 4
      WHEN sr.mood ILIKE '%neutral%' OR sr.mood ILIKE '%so-so%' OR sr.mood ILIKE '%meh%' THEN 3
      WHEN sr.mood ILIKE '%not great%' OR sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%low%' OR sr.mood ILIKE '%lonely%' THEN 2
      WHEN sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%awful%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%anxious%' OR sr.mood ILIKE '%stressed%' THEN 1
      ELSE 3
    END
  ) FILTER (WHERE sr.created_at >= now() - interval '30 days') as avg_mood_score_30d,

  (SELECT sr2.mood FROM public.self_reports sr2 WHERE sr2.user_id = u.id ORDER BY sr2.created_at DESC LIMIT 1) as latest_mood,
  (SELECT sr2.created_at FROM public.self_reports sr2 WHERE sr2.user_id = u.id ORDER BY sr2.created_at DESC LIMIT 1) as latest_mood_timestamp,

  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND (sr.mood ILIKE '%not great%' OR sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%'
         OR sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%'
         OR sr.mood ILIKE '%anxious%' OR sr.mood ILIKE '%stressed%' OR sr.mood ILIKE '%lonely%')
  ), 0) as negative_moods_30d,

  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND (sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%'
         OR sr.mood ILIKE '%wonderful%' OR sr.mood ILIKE '%good%')
  ), 0) as positive_moods_30d,

  -- ============================================================
  -- GAME PERFORMANCE METRICS ⭐ NOW CAPTURED
  -- ============================================================
  AVG(tg.score::numeric / NULLIF(tg.total_questions, 0) * 100) FILTER (WHERE tg.created_at >= now() - interval '30 days') as avg_trivia_score_pct,
  AVG(tg.completion_time_seconds) FILTER (WHERE tg.created_at >= now() - interval '30 days' AND tg.completed_at IS NOT NULL) as avg_trivia_completion_time,
  AVG(wg.words_found::numeric / NULLIF(wg.total_words, 0) * 100) FILTER (WHERE wg.created_at >= now() - interval '30 days') as avg_word_game_score_pct,

  -- ============================================================
  -- HEALTH METRICS (Nullable - condition-specific)
  -- ============================================================
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.symptoms IS NOT NULL AND LENGTH(TRIM(sr.symptoms)) > 0
  ), 0) as symptom_reports_30d,

  AVG(sr.bp_systolic) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.bp_systolic IS NOT NULL) as avg_bp_systolic_30d,
  AVG(sr.bp_diastolic) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.bp_diastolic IS NOT NULL) as avg_bp_diastolic_30d,
  AVG(sr.heart_rate) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.heart_rate IS NOT NULL) as avg_heart_rate_30d,
  AVG(sr.blood_sugar) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.blood_sugar IS NOT NULL) as avg_blood_sugar_30d,
  AVG(sr.spo2) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.spo2 IS NOT NULL) as avg_spo2_30d,
  AVG(sr.weight) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.weight IS NOT NULL) as avg_weight_30d,

  (SELECT sr2.bp_systolic FROM public.self_reports sr2 WHERE sr2.user_id = u.id AND sr2.bp_systolic IS NOT NULL ORDER BY sr2.created_at DESC LIMIT 1) as latest_bp_systolic,
  (SELECT sr2.bp_diastolic FROM public.self_reports sr2 WHERE sr2.user_id = u.id AND sr2.bp_diastolic IS NOT NULL ORDER BY sr2.created_at DESC LIMIT 1) as latest_bp_diastolic,
  (SELECT sr2.heart_rate FROM public.self_reports sr2 WHERE sr2.user_id = u.id AND sr2.heart_rate IS NOT NULL ORDER BY sr2.created_at DESC LIMIT 1) as latest_heart_rate,

  -- ============================================================
  -- SOCIAL & PHYSICAL ACTIVITY (Nullable)
  -- ============================================================
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.physical_activity IS NOT NULL AND LENGTH(TRIM(sr.physical_activity)) > 0
  ), 0) as physical_activity_reports_30d,

  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.social_engagement IS NOT NULL AND LENGTH(TRIM(sr.social_engagement)) > 0
  ), 0) as social_engagement_reports_30d,

  -- ============================================================
  -- ENGAGEMENT SCORE (0-100) - COMPLETE FORMULA ⭐
  -- ============================================================
  LEAST(100, (
    (COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days'), 0) * 2) +  -- Check-ins: 2 pts
    (COALESCE(COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days'), 0) * 5) +  -- Trivia: 5 pts ⭐
    (COALESCE(COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days'), 0) * 5) +  -- Word games: 5 pts ⭐
    (COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) * 3) +  -- Self-reports: 3 pts (MOOD) ⭐
    (COALESCE(COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days'), 0) * 2) +  -- Questions: 2 pts
    (COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days'), 0) * 2) +  -- Meals: 2 pts ⭐
    (COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true), 0) * 3) + -- Meal photos: 3 pts bonus ⭐
    (COALESCE(COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days'), 0) * 3)    -- Community: 3 pts
  )) as engagement_score,

  -- ============================================================
  -- RISK FLAGS (Boolean indicators)
  -- ============================================================
  (COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '7 days'
    AND (sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%')
  ), 0) > 0) as has_severe_negative_mood_recent,

  (COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days'), 0) = 0
   AND COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '7 days'), 0) = 0) as no_activity_7days,

  (COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) = 0) as no_self_reports_30d

FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.self_reports sr ON sr.user_id = u.id
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
LEFT JOIN public.community_moments cm ON cm.user_id = u.id
LEFT JOIN public.trivia_game_results tg ON tg.user_id = u.id  -- ⭐ NOW JOINED
LEFT JOIN public.word_game_results wg ON wg.user_id = u.id    -- ⭐ NOW JOINED
LEFT JOIN public.meal_interactions mi ON mi.user_id = u.id    -- ⭐ NOW JOINED
GROUP BY u.id, u.email, p.first_name, p.last_name, p.phone;

-- Backward compatibility alias
CREATE OR REPLACE VIEW public.patient_engagement_scores AS
SELECT * FROM public.patient_engagement_metrics;

-- ========================================================================
-- STEP 5: Grant permissions
-- ========================================================================

GRANT SELECT ON public.patient_engagement_metrics TO authenticated;
GRANT SELECT ON public.patient_engagement_metrics TO anon;
GRANT SELECT ON public.patient_engagement_metrics TO service_role;

GRANT SELECT ON public.patient_engagement_scores TO authenticated;
GRANT SELECT ON public.patient_engagement_scores TO anon;
GRANT SELECT ON public.patient_engagement_scores TO service_role;

COMMIT;

-- ========================================================================
-- SUCCESS MESSAGE
-- ========================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ALL ENGAGEMENT TRACKING TABLES CREATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 TABLES CREATED:';
  RAISE NOTICE '   ✅ trivia_game_results';
  RAISE NOTICE '   ✅ word_game_results';
  RAISE NOTICE '   ✅ meal_interactions';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 COMPREHENSIVE METRICS NOW CAPTURED:';
  RAISE NOTICE '   ⭐ Check-ins (2 pts)';
  RAISE NOTICE '   ⭐ Trivia games (5 pts) - NOW TRACKED';
  RAISE NOTICE '   ⭐ Word games (5 pts) - NOW TRACKED';
  RAISE NOTICE '   ⭐ Self-reports with MANDATORY mood (3 pts)';
  RAISE NOTICE '   ⭐ Questions (2 pts)';
  RAISE NOTICE '   ⭐ Meal interactions (2 pts) - NOW TRACKED';
  RAISE NOTICE '   ⭐ Meal photos bonus (3 pts) - NOW TRACKED';
  RAISE NOTICE '   ⭐ Community photos (3 pts)';
  RAISE NOTICE '';
  RAISE NOTICE '📈 ENGAGEMENT SCORE: All activities now fully captured!';
  RAISE NOTICE '   Max possible score: 100 points';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS policies applied to all tables';
  RAISE NOTICE '========================================';
END $$;
