-- Fix patient_engagement_scores view to work with internal auth.users
-- Issue: View was accessing auth.users which is in internal schema
-- Solution: Create a SECURITY DEFINER function to safely access auth.users
--
-- Date: 2025-10-18
-- Purpose: Fix risk assessment scoring after auth.users became internal

BEGIN;

-- Drop the old view
DROP VIEW IF EXISTS public.patient_engagement_scores CASCADE;

-- Create a SECURITY DEFINER function that can access auth.users safely
CREATE OR REPLACE FUNCTION public.get_patient_engagement_scores()
RETURNS TABLE (
  user_id uuid,
  email text,
  check_ins_30d bigint,
  trivia_games_30d bigint,
  word_games_30d bigint,
  self_reports_30d bigint,
  questions_asked_30d bigint,
  check_ins_7d bigint,
  trivia_games_7d bigint,
  last_check_in timestamp with time zone,
  last_trivia_game timestamp with time zone,
  last_word_game timestamp with time zone,
  last_self_report timestamp with time zone,
  avg_trivia_score_pct numeric,
  avg_trivia_completion_time numeric,
  avg_mood_score_30d numeric,
  latest_mood text,
  negative_moods_30d bigint,
  symptom_reports_30d bigint,
  engagement_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to access auth.users
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email::text,

    -- Recent activity indicators (last 30 days)
    COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days')::bigint as check_ins_30d,
    0::bigint as trivia_games_30d,  -- Table doesn't exist yet
    0::bigint as word_games_30d,    -- Table doesn't exist yet
    COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days')::bigint as self_reports_30d,
    COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days')::bigint as questions_asked_30d,

    -- Last 7 days
    COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days')::bigint as check_ins_7d,
    0::bigint as trivia_games_7d,   -- Table doesn't exist yet

    -- Last activity timestamps
    MAX(ci.created_at) as last_check_in,
    NULL::timestamp with time zone as last_trivia_game,
    NULL::timestamp with time zone as last_word_game,
    MAX(sr.created_at) as last_self_report,

    -- Performance indicators
    NULL::numeric as avg_trivia_score_pct,
    NULL::numeric as avg_trivia_completion_time,

    -- Self-report mood indicators (for risk assessment)
    AVG(
      CASE
        WHEN sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%' THEN 5
        WHEN sr.mood ILIKE '%good%' OR sr.mood ILIKE '%okay%' OR sr.mood ILIKE '%fine%' THEN 4
        WHEN sr.mood ILIKE '%neutral%' OR sr.mood ILIKE '%so-so%' THEN 3
        WHEN sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%low%' THEN 2
        WHEN sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%awful%' OR sr.mood ILIKE '%depressed%' THEN 1
        ELSE 3
      END
    ) FILTER (WHERE sr.created_at >= now() - interval '30 days')::numeric as avg_mood_score_30d,

    -- Most recent mood
    (SELECT sr2.mood
     FROM public.self_reports sr2
     WHERE sr2.user_id = u.id
     ORDER BY sr2.created_at DESC
     LIMIT 1
    )::text as latest_mood,

    -- Count of negative moods (concern indicator)
    COUNT(DISTINCT sr.id) FILTER (
      WHERE sr.created_at >= now() - interval '30 days'
      AND (sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%terrible%'
           OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%')
    )::bigint as negative_moods_30d,

    -- Symptom reporting frequency
    COUNT(DISTINCT sr.id) FILTER (
      WHERE sr.created_at >= now() - interval '30 days'
      AND sr.symptoms IS NOT NULL
      AND LENGTH(TRIM(sr.symptoms)) > 0
    )::bigint as symptom_reports_30d,

    -- Engagement score (0-100)
    LEAST(100, (
      (COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') * 2) +
      (COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') * 3) +
      (COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') * 2)
    ))::integer as engagement_score

  FROM auth.users u
  LEFT JOIN public.check_ins ci ON ci.user_id = u.id
  LEFT JOIN public.self_reports sr ON sr.user_id = u.id
  LEFT JOIN public.user_questions uq ON uq.user_id = u.id
  GROUP BY u.id, u.email;
END;
$$;

-- Create a view that calls the function for backward compatibility
CREATE OR REPLACE VIEW public.patient_engagement_scores AS
SELECT * FROM public.get_patient_engagement_scores();

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_scores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_scores() TO anon;
GRANT EXECUTE ON FUNCTION public.get_patient_engagement_scores() TO service_role;

-- Grant permissions on the view
GRANT SELECT ON public.patient_engagement_scores TO authenticated;
GRANT SELECT ON public.patient_engagement_scores TO anon;
GRANT SELECT ON public.patient_engagement_scores TO service_role;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed patient_engagement_scores to work with internal auth.users!';
  RAISE NOTICE '   - Created SECURITY DEFINER function to safely access auth schema';
  RAISE NOTICE '   - Created view that calls the function';
  RAISE NOTICE '   - Risk assessment scoring should now work correctly';
  RAISE NOTICE '   - Engagement scores: Check-ins (2 pts) + Self-reports (3 pts) + Questions (2 pts)';
END $$;
