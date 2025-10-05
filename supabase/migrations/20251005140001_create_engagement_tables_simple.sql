-- Create engagement tracking tables (simplified - no triggers for now)

BEGIN;

-- ===== trivia_game_results =====
CREATE TABLE IF NOT EXISTS public.trivia_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_date date DEFAULT CURRENT_DATE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_time_seconds integer,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  difficulty_breakdown jsonb DEFAULT '{}'::jsonb,
  questions_attempted text[] DEFAULT ARRAY[]::text[],
  average_response_time_seconds numeric(6,2),
  completion_status text DEFAULT 'completed' CHECK (completion_status IN ('completed', 'abandoned', 'incomplete')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trivia_game_results_user ON public.trivia_game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_trivia_game_results_date ON public.trivia_game_results(game_date);

ALTER TABLE public.trivia_game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own trivia" ON public.trivia_game_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trivia" ON public.trivia_game_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all trivia" ON public.trivia_game_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'nurse')));

-- ===== word_game_results =====
CREATE TABLE IF NOT EXISTS public.word_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_date date DEFAULT CURRENT_DATE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  completion_time_seconds integer,
  words_found integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL DEFAULT 0,
  hints_used integer DEFAULT 0,
  difficulty_level text,
  puzzle_id text,
  completion_status text DEFAULT 'completed' CHECK (completion_status IN ('completed', 'abandoned', 'incomplete')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_word_game_results_user ON public.word_game_results(user_id);
CREATE INDEX IF NOT EXISTS idx_word_game_results_date ON public.word_game_results(game_date);

ALTER TABLE public.word_game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own word games" ON public.word_game_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own word games" ON public.word_game_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all word games" ON public.word_game_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'nurse')));

-- ===== meal_interactions =====
CREATE TABLE IF NOT EXISTS public.meal_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id text,
  meal_name text,
  meal_category text,
  viewed boolean DEFAULT false,
  liked boolean DEFAULT false,
  will_make_it boolean DEFAULT false,
  photo_uploaded boolean DEFAULT false,
  photo_url text,
  user_notes text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_interactions_user ON public.meal_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_interactions_meal ON public.meal_interactions(meal_id);
CREATE INDEX IF NOT EXISTS idx_meal_interactions_photo ON public.meal_interactions(photo_uploaded) WHERE photo_uploaded = true;

ALTER TABLE public.meal_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meals" ON public.meal_interactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all meals" ON public.meal_interactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'nurse')));

-- ===== Update the engagement metrics view =====
DROP VIEW IF EXISTS public.patient_engagement_scores CASCADE;
DROP VIEW IF EXISTS public.patient_engagement_metrics CASCADE;

CREATE OR REPLACE VIEW public.patient_engagement_metrics AS
SELECT
  u.id as user_id,
  u.email,
  p.first_name,
  p.last_name,
  p.phone,

  -- Activity counts
  COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days'), 0) as check_ins_30d,
  COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days'), 0) as check_ins_7d,
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) as self_reports_30d,
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '7 days'), 0) as self_reports_7d,
  COALESCE(COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days'), 0) as questions_asked_30d,
  COALESCE(COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days'), 0) as trivia_games_30d,
  COALESCE(COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '7 days'), 0) as trivia_games_7d,
  COALESCE(COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days'), 0) as word_games_30d,
  COALESCE(COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '7 days'), 0) as word_games_7d,
  COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days'), 0) as meal_interactions_30d,
  COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true), 0) as meal_photos_30d,
  COALESCE(COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days'), 0) as community_photos_30d,

  -- Last activity timestamps
  MAX(ci.created_at) as last_check_in,
  MAX(sr.created_at) as last_self_report,
  MAX(uq.created_at) as last_question,
  MAX(cm.created_at) as last_community_photo,
  MAX(tg.created_at) as last_trivia_game,
  MAX(wg.created_at) as last_word_game,
  MAX(mi.created_at) as last_meal_interaction,

  -- Mood metrics (mood is MANDATORY)
  AVG(CASE
    WHEN sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%' THEN 5
    WHEN sr.mood ILIKE '%good%' OR sr.mood ILIKE '%okay%' OR sr.mood ILIKE '%fine%' THEN 4
    WHEN sr.mood ILIKE '%neutral%' OR sr.mood ILIKE '%so-so%' THEN 3
    WHEN sr.mood ILIKE '%not great%' OR sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' THEN 2
    WHEN sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%awful%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%anxious%' OR sr.mood ILIKE '%stressed%' THEN 1
    ELSE 3
  END) FILTER (WHERE sr.created_at >= now() - interval '30 days') as avg_mood_score_30d,
  (SELECT sr2.mood FROM public.self_reports sr2 WHERE sr2.user_id = u.id ORDER BY sr2.created_at DESC LIMIT 1) as latest_mood,
  (SELECT sr2.created_at FROM public.self_reports sr2 WHERE sr2.user_id = u.id ORDER BY sr2.created_at DESC LIMIT 1) as latest_mood_timestamp,
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND (sr.mood ILIKE '%not great%' OR sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%' OR sr.mood ILIKE '%anxious%' OR sr.mood ILIKE '%stressed%')), 0) as negative_moods_30d,
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND (sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%' OR sr.mood ILIKE '%good%')), 0) as positive_moods_30d,

  -- Game performance
  AVG(tg.score::numeric / NULLIF(tg.total_questions, 0) * 100) FILTER (WHERE tg.created_at >= now() - interval '30 days') as avg_trivia_score_pct,
  AVG(tg.completion_time_seconds) FILTER (WHERE tg.created_at >= now() - interval '30 days' AND tg.completed_at IS NOT NULL) as avg_trivia_completion_time,

  -- Health metrics (nullable)
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.symptoms IS NOT NULL AND LENGTH(TRIM(sr.symptoms)) > 0), 0) as symptom_reports_30d,
  AVG(sr.bp_systolic) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.bp_systolic IS NOT NULL) as avg_bp_systolic_30d,
  AVG(sr.bp_diastolic) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.bp_diastolic IS NOT NULL) as avg_bp_diastolic_30d,
  AVG(sr.heart_rate) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.heart_rate IS NOT NULL) as avg_heart_rate_30d,

  -- Engagement score (0-100) - ALL ACTIVITIES
  LEAST(100, (
    (COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days'), 0) * 2) +
    (COALESCE(COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days'), 0) * 5) +
    (COALESCE(COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days'), 0) * 5) +
    (COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) * 3) +
    (COALESCE(COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days'), 0) * 2) +
    (COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days'), 0) * 2) +
    (COALESCE(COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true), 0) * 3) +
    (COALESCE(COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days'), 0) * 3)
  )) as engagement_score

FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.self_reports sr ON sr.user_id = u.id
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
LEFT JOIN public.community_moments cm ON cm.user_id = u.id
LEFT JOIN public.trivia_game_results tg ON tg.user_id = u.id
LEFT JOIN public.word_game_results wg ON wg.user_id = u.id
LEFT JOIN public.meal_interactions mi ON mi.user_id = u.id
GROUP BY u.id, u.email, p.first_name, p.last_name, p.phone;

-- Alias
CREATE OR REPLACE VIEW public.patient_engagement_scores AS SELECT * FROM public.patient_engagement_metrics;

-- Permissions
GRANT SELECT ON public.patient_engagement_metrics TO authenticated, anon, service_role;
GRANT SELECT ON public.patient_engagement_scores TO authenticated, anon, service_role;

COMMIT;

DO $$ BEGIN RAISE NOTICE '✅ All engagement tracking tables created successfully!'; END $$;
