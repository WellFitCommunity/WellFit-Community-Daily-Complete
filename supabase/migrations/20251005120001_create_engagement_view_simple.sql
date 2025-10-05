-- Create patient_engagement_scores view with only existing tables
-- This provides a working baseline until all engagement tracking tables are created

BEGIN;

DROP VIEW IF EXISTS public.patient_engagement_scores;

CREATE OR REPLACE VIEW public.patient_engagement_scores AS
SELECT
  u.id as user_id,
  u.email,

  -- Recent activity indicators (last 30 days)
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') as check_ins_30d,
  0 as trivia_games_30d,  -- Table doesn't exist yet
  0 as word_games_30d,    -- Table doesn't exist yet
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') as self_reports_30d,
  COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') as questions_asked_30d,

  -- Last 7 days
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days') as check_ins_7d,
  0 as trivia_games_7d,   -- Table doesn't exist yet

  -- Last activity timestamps
  MAX(ci.created_at) as last_check_in,
  NULL::timestamp as last_trivia_game,
  NULL::timestamp as last_word_game,
  MAX(sr.created_at) as last_self_report,

  -- Performance indicators
  NULL::numeric as avg_trivia_score_pct,
  NULL::numeric as avg_trivia_completion_time,

  -- Self-report mood indicators (for risk assessment) ⭐ NEW
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

  -- Most recent mood ⭐ NEW
  (SELECT sr2.mood
   FROM public.self_reports sr2
   WHERE sr2.user_id = u.id
   ORDER BY sr2.created_at DESC
   LIMIT 1
  ) as latest_mood,

  -- Count of negative moods (concern indicator) ⭐ NEW
  COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND (sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%terrible%'
         OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%')
  ) as negative_moods_30d,

  -- Symptom reporting frequency ⭐ NEW
  COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.symptoms IS NOT NULL
    AND LENGTH(TRIM(sr.symptoms)) > 0
  ) as symptom_reports_30d,

  -- Engagement score (0-100) - ⭐ SELF-REPORTS PROPERLY INCLUDED NOW
  LEAST(100, (
    (COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') * 2) +  -- Check-ins: 2 pts
    (COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') * 3) +  -- ⭐ Self-reports: 3 pts
    (COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') * 2)    -- Questions: 2 pts
  )) as engagement_score

FROM auth.users u
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.self_reports sr ON sr.user_id = u.id  -- ⭐ FIXED: Using correct table name
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
GROUP BY u.id, u.email;

-- Grant permissions
GRANT SELECT ON public.patient_engagement_scores TO authenticated;
GRANT SELECT ON public.patient_engagement_scores TO anon;
GRANT SELECT ON public.patient_engagement_scores TO service_role;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Created patient_engagement_scores view!';
  RAISE NOTICE '   ⭐ SELF-REPORTS NOW INCLUDED IN SCORING (3 points each)';
  RAISE NOTICE '   - Using self_reports table (correct name)';
  RAISE NOTICE '   - Added mood-based risk indicators:';
  RAISE NOTICE '     • avg_mood_score_30d (1-5 scale based on mood text)';
  RAISE NOTICE '     • latest_mood (most recent mood entry)';
  RAISE NOTICE '     • negative_moods_30d (count of sad/down/depressed moods)';
  RAISE NOTICE '     • symptom_reports_30d (symptom tracking frequency)';
  RAISE NOTICE '   - Current scoring: Check-ins (2 pts) + Self-reports (3 pts) + Questions (2 pts)';
  RAISE NOTICE '   - View uses only existing tables (check_ins, self_reports, user_questions)';
END $$;
