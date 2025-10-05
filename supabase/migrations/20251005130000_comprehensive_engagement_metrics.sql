-- Comprehensive Engagement Metrics System
-- Makes mood mandatory and creates a robust view for patient risk assessment

BEGIN;

-- ========================================================================
-- STEP 1: Make mood mandatory in self_reports table
-- ========================================================================

-- First, set a default mood for any existing NULL values
UPDATE public.self_reports
SET mood = 'Not Reported'
WHERE mood IS NULL OR TRIM(mood) = '';

-- Now make mood NOT NULL (this ensures data integrity)
ALTER TABLE public.self_reports
ALTER COLUMN mood SET NOT NULL;

-- Add a check constraint to ensure mood is never empty string
ALTER TABLE public.self_reports
DROP CONSTRAINT IF EXISTS self_reports_mood_not_empty;

ALTER TABLE public.self_reports
ADD CONSTRAINT self_reports_mood_not_empty
CHECK (LENGTH(TRIM(mood)) > 0);

DO $$ BEGIN
  RAISE NOTICE '✅ Mood is now mandatory in self_reports table';
END $$;

-- ========================================================================
-- STEP 2: Create comprehensive patient_engagement_metrics view
-- This view encompasses EVERYTHING needed for risk assessment
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
  -- ACTIVITY COUNTS (Last 30 days)
  -- ============================================================
  COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days'), 0) as check_ins_30d,
  COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days'), 0) as check_ins_7d,

  -- Self-reports (CORE METRIC) ⭐
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) as self_reports_30d,
  COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '7 days'), 0) as self_reports_7d,

  -- Questions asked
  COALESCE(COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days'), 0) as questions_asked_30d,

  -- Games (will be 0 until tables are created)
  0 as trivia_games_30d,
  0 as trivia_games_7d,
  0 as word_games_30d,

  -- Community engagement
  COALESCE(COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days'), 0) as community_photos_30d,

  -- ============================================================
  -- LAST ACTIVITY TIMESTAMPS
  -- ============================================================
  MAX(ci.created_at) as last_check_in,
  MAX(sr.created_at) as last_self_report,
  MAX(uq.created_at) as last_question,
  MAX(cm.created_at) as last_community_photo,
  NULL::timestamp as last_trivia_game,
  NULL::timestamp as last_word_game,

  -- ============================================================
  -- MOOD & MENTAL HEALTH INDICATORS (CORE RISK ASSESSMENT) ⭐
  -- ============================================================

  -- Mood scoring (1-5 scale, mood is now MANDATORY)
  AVG(
    CASE
      WHEN sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%' OR sr.mood ILIKE '%wonderful%' THEN 5
      WHEN sr.mood ILIKE '%good%' OR sr.mood ILIKE '%okay%' OR sr.mood ILIKE '%fine%' OR sr.mood ILIKE '%alright%' THEN 4
      WHEN sr.mood ILIKE '%neutral%' OR sr.mood ILIKE '%so-so%' OR sr.mood ILIKE '%meh%' THEN 3
      WHEN sr.mood ILIKE '%not great%' OR sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%' OR sr.mood ILIKE '%low%' OR sr.mood ILIKE '%lonely%' THEN 2
      WHEN sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%awful%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%anxious%' OR sr.mood ILIKE '%stressed%' THEN 1
      ELSE 3 -- neutral default for unrecognized moods
    END
  ) FILTER (WHERE sr.created_at >= now() - interval '30 days') as avg_mood_score_30d,

  -- Most recent mood (MANDATORY field)
  (SELECT sr2.mood
   FROM public.self_reports sr2
   WHERE sr2.user_id = u.id
   ORDER BY sr2.created_at DESC
   LIMIT 1
  ) as latest_mood,

  -- Most recent mood timestamp
  (SELECT sr2.created_at
   FROM public.self_reports sr2
   WHERE sr2.user_id = u.id
   ORDER BY sr2.created_at DESC
   LIMIT 1
  ) as latest_mood_timestamp,

  -- Negative mood count (CRITICAL for intervention)
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND (sr.mood ILIKE '%not great%' OR sr.mood ILIKE '%sad%' OR sr.mood ILIKE '%down%'
         OR sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%'
         OR sr.mood ILIKE '%anxious%' OR sr.mood ILIKE '%stressed%' OR sr.mood ILIKE '%lonely%')
  ), 0) as negative_moods_30d,

  -- Positive mood count
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND (sr.mood ILIKE '%great%' OR sr.mood ILIKE '%excellent%' OR sr.mood ILIKE '%happy%'
         OR sr.mood ILIKE '%wonderful%' OR sr.mood ILIKE '%good%')
  ), 0) as positive_moods_30d,

  -- ============================================================
  -- HEALTH METRICS (Can be NULL - not all patients have conditions)
  -- ============================================================

  -- Symptom reporting (important for clinical monitoring)
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.symptoms IS NOT NULL
    AND LENGTH(TRIM(sr.symptoms)) > 0
  ), 0) as symptom_reports_30d,

  -- Vital signs monitoring (recent 30 days)
  AVG(sr.bp_systolic) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.bp_systolic IS NOT NULL) as avg_bp_systolic_30d,
  AVG(sr.bp_diastolic) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.bp_diastolic IS NOT NULL) as avg_bp_diastolic_30d,
  AVG(sr.heart_rate) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.heart_rate IS NOT NULL) as avg_heart_rate_30d,
  AVG(sr.blood_sugar) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.blood_sugar IS NOT NULL) as avg_blood_sugar_30d,
  AVG(sr.spo2) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.spo2 IS NOT NULL) as avg_spo2_30d,
  AVG(sr.weight) FILTER (WHERE sr.created_at >= now() - interval '30 days' AND sr.weight IS NOT NULL) as avg_weight_30d,

  -- Most recent vitals
  (SELECT sr2.bp_systolic FROM public.self_reports sr2 WHERE sr2.user_id = u.id AND sr2.bp_systolic IS NOT NULL ORDER BY sr2.created_at DESC LIMIT 1) as latest_bp_systolic,
  (SELECT sr2.bp_diastolic FROM public.self_reports sr2 WHERE sr2.user_id = u.id AND sr2.bp_diastolic IS NOT NULL ORDER BY sr2.created_at DESC LIMIT 1) as latest_bp_diastolic,
  (SELECT sr2.heart_rate FROM public.self_reports sr2 WHERE sr2.user_id = u.id AND sr2.heart_rate IS NOT NULL ORDER BY sr2.created_at DESC LIMIT 1) as latest_heart_rate,

  -- ============================================================
  -- SOCIAL & PHYSICAL ACTIVITY (Nullable - lifestyle indicators)
  -- ============================================================

  -- Physical activity frequency
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.physical_activity IS NOT NULL
    AND LENGTH(TRIM(sr.physical_activity)) > 0
  ), 0) as physical_activity_reports_30d,

  -- Social engagement frequency
  COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '30 days'
    AND sr.social_engagement IS NOT NULL
    AND LENGTH(TRIM(sr.social_engagement)) > 0
  ), 0) as social_engagement_reports_30d,

  -- ============================================================
  -- ENGAGEMENT SCORE (0-100) ⭐ CORE RISK METRIC
  -- ============================================================
  -- Self-reports are weighted heavily (3 pts) because they include mood
  -- Mood quality affects overall risk assessment

  LEAST(100, (
    -- Activity scoring
    (COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days'), 0) * 2) +  -- Check-ins: 2 pts
    (COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) * 3) +  -- ⭐ Self-reports: 3 pts (INCLUDES MOOD)
    (COALESCE(COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days'), 0) * 2) +  -- Questions: 2 pts
    (COALESCE(COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days'), 0) * 3)    -- Community: 3 pts
  )) as engagement_score,

  -- ============================================================
  -- RISK FLAGS (Boolean indicators for quick filtering) ⭐
  -- ============================================================

  -- Critical risk flags
  (COALESCE(COUNT(DISTINCT sr.id) FILTER (
    WHERE sr.created_at >= now() - interval '7 days'
    AND (sr.mood ILIKE '%terrible%' OR sr.mood ILIKE '%depressed%' OR sr.mood ILIKE '%awful%')
  ), 0) > 0) as has_severe_negative_mood_recent,

  -- Low engagement flag
  (COALESCE(COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days'), 0) = 0
   AND COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '7 days'), 0) = 0) as no_activity_7days,

  -- No self-reports flag (concerning - missing mood data)
  (COALESCE(COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days'), 0) = 0) as no_self_reports_30d

FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.self_reports sr ON sr.user_id = u.id
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
LEFT JOIN public.community_moments cm ON cm.user_id = u.id
GROUP BY u.id, u.email, p.first_name, p.last_name, p.phone;

-- Create backward-compatible alias
CREATE OR REPLACE VIEW public.patient_engagement_scores AS
SELECT * FROM public.patient_engagement_metrics;

-- ========================================================================
-- STEP 3: Grant permissions
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
  RAISE NOTICE '✅ COMPREHENSIVE ENGAGEMENT METRICS SYSTEM CREATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 MOOD REQUIREMENT:';
  RAISE NOTICE '   ✅ Mood is now MANDATORY (NOT NULL + length > 0)';
  RAISE NOTICE '   ✅ Cannot submit self-report without mood';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ENGAGEMENT METRICS VIEW INCLUDES:';
  RAISE NOTICE '   ⭐ Mood scoring (1-5 scale) - MANDATORY';
  RAISE NOTICE '   ⭐ Latest mood + timestamp';
  RAISE NOTICE '   ⭐ Negative vs positive mood counts';
  RAISE NOTICE '   ⭐ Self-reports count (3 pts each in scoring)';
  RAISE NOTICE '   • Check-ins, questions, community activity';
  RAISE NOTICE '   • Symptom reporting frequency';
  RAISE NOTICE '   • Vital signs (BP, heart rate, etc.) - NULLABLE';
  RAISE NOTICE '   • Physical & social activity - NULLABLE';
  RAISE NOTICE '   • Risk flags for quick filtering';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 ENGAGEMENT SCORING:';
  RAISE NOTICE '   Check-ins: 2 pts | Self-reports: 3 pts | Questions: 2 pts | Community: 3 pts';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  RISK LEVELS:';
  RAISE NOTICE '   70-100: Low Risk | 40-69: Medium | 20-39: High | 0-19: CRITICAL';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 All nullable fields handled with COALESCE - no broken calculations';
  RAISE NOTICE '========================================';
END $$;
