-- Fix patient_engagement_scores view to use correct self_reports table
-- The view was using "self_report_submissions" but the actual table is "self_reports"
-- This migration also enhances the scoring to include mood-based risk indicators

BEGIN;

DROP VIEW IF EXISTS public.patient_engagement_scores;

CREATE OR REPLACE VIEW public.patient_engagement_scores AS
SELECT
  u.id as user_id,
  u.email,

  -- Recent activity indicators (last 30 days)
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') as check_ins_30d,
  COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days') as trivia_games_30d,
  COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days') as word_games_30d,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') as self_reports_30d,
  COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') as questions_asked_30d,
  COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days') as meal_interactions_30d,
  COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days') as community_photos_30d,

  -- Last 7 days
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days') as check_ins_7d,
  COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '7 days') as trivia_games_7d,

  -- Last activity timestamps
  MAX(ci.created_at) as last_check_in,
  MAX(tg.created_at) as last_trivia_game,
  MAX(wg.created_at) as last_word_game,
  MAX(sr.created_at) as last_self_report,
  MAX(mi.created_at) as last_meal_interaction,

  -- Performance indicators
  AVG(tg.score::numeric / NULLIF(tg.total_questions, 0) * 100) FILTER (WHERE tg.created_at >= now() - interval '30 days') as avg_trivia_score_pct,
  AVG(tg.completion_time_seconds) FILTER (WHERE tg.created_at >= now() - interval '30 days' AND tg.completed_at IS NOT NULL) as avg_trivia_completion_time,

  -- Meal engagement
  COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.will_make_it = true) as meals_planning_to_make_30d,
  COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true) as meal_photos_uploaded_30d,

  -- Self-report mood indicators (for risk assessment)
  -- Recent mood tracking (last 30 days)
  AVG(
    CASE
      WHEN sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%' THEN 5
      WHEN sr.mood ILIKE '%good%' OR sr.mood ILIKE '%okay%' OR sr.mood ILIKE '%fine%' THEN 4
      WHEN sr.mood ILIKE '%neutral%' OR sr.mood ILIKE '%so-so%' THEN 3
      WHEN sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%low%' THEN 2
      WHEN sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%awful%' OR sr.mood ILIKE '%depressed%' THEN 1
      ELSE 3 -- neutral default
    END
  ) FILTER (WHERE sr.created_at >= now() - interval '30 days') as avg_mood_score_30d,

  -- Most recent mood
  (SELECT sr2.mood
   FROM public.self_reports sr2
   WHERE sr2.user_id = u.id
   ORDER BY sr2.created_at DESC
   LIMIT 1
  ) as latest_mood,

  -- Count of negative moods (concern indicator)
  COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND (sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%')
  ) as negative_moods_30d,

  -- Symptom reporting frequency
  COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.symptoms IS NOT NULL
    AND LENGTH(TRIM(sr.symptoms)) > 0
  ) as symptom_reports_30d,

  -- Engagement score (0-100) - INCLUDES SELF-REPORTS
  LEAST(100, (
    (COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') * 2) + -- Check-ins: 2 pts
    (COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days') * 5) + -- Trivia: 5 pts
    (COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days') * 5) + -- Word games: 5 pts
    (COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') * 3) + -- Self-reports: 3 pts ⭐ INCLUDED
    (COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') * 2) + -- Questions: 2 pts
    (COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days') * 2) + -- Meal interactions: 2 pts
    (COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true) * 3) + -- Meal photos: 3 pts bonus
    (COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days') * 3)   -- Community photos: 3 pts
  )) as engagement_score

FROM auth.users u
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.trivia_game_results tg ON tg.user_id = u.id
LEFT JOIN public.word_game_results wg ON wg.user_id = u.id
LEFT JOIN public.self_reports sr ON sr.user_id = u.id  -- ⭐ FIXED: was self_report_submissions
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
LEFT JOIN public.meal_interactions mi ON mi.user_id = u.id
LEFT JOIN public.community_moments cm ON cm.user_id = u.id
GROUP BY u.id, u.email;

-- Grant permissions
GRANT SELECT ON public.patient_engagement_scores TO authenticated;
GRANT SELECT ON public.patient_engagement_scores TO anon;
GRANT SELECT ON public.patient_engagement_scores TO service_role;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed patient_engagement_scores view!';
  RAISE NOTICE '   - Changed self_report_submissions → self_reports (correct table name)';
  RAISE NOTICE '   - Self-reports now properly included in engagement scoring (3 points each)';
  RAISE NOTICE '   - Added mood-based risk indicators:';
  RAISE NOTICE '     • avg_mood_score_30d (1-5 scale)';
  RAISE NOTICE '     • latest_mood (most recent mood entry)';
  RAISE NOTICE '     • negative_moods_30d (count of concerning moods)';
  RAISE NOTICE '     • symptom_reports_30d (symptom tracking frequency)';
  RAISE NOTICE '   - View permissions granted to authenticated, anon, and service_role';
END $$;
