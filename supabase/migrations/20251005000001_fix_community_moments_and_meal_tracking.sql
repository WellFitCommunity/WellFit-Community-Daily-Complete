-- Migration: Fix Community Moments Photos & Add Meal Engagement Tracking
-- Date: 2025-10-05

BEGIN;

-- ====================================================================
-- 1. FIX COMMUNITY MOMENTS STORAGE BUCKET POLICIES
-- ====================================================================

-- Ensure the storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-moments', 'community-moments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Public read access to community moments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload community moments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own community moments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own community moments" ON storage.objects;

-- Allow public read access to all community moment photos
CREATE POLICY "Public read access to community moments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-moments');

-- Allow authenticated users to upload
CREATE POLICY "Users can upload community moments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-moments');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own community moments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'community-moments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own community moments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'community-moments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ====================================================================
-- 2. MEAL ENGAGEMENT TRACKING
-- ====================================================================

-- Create table for meal interactions (will you cook this? + photo)
CREATE TABLE IF NOT EXISTS public.meal_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id text NOT NULL, -- Reference to recipe/meal ID
  meal_name text NOT NULL,

  -- User response
  will_make_it boolean NOT NULL, -- yes/no to "Will you make this meal?"
  photo_uploaded boolean DEFAULT false,
  photo_url text,
  photo_path text,

  -- Engagement metadata
  viewed_at timestamptz DEFAULT now() NOT NULL,
  responded_at timestamptz DEFAULT now() NOT NULL,
  photo_uploaded_at timestamptz,

  -- Additional notes
  notes text,
  rating integer CHECK (rating >= 1 AND rating <= 5),

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_meal_interactions_user ON public.meal_interactions(user_id, responded_at DESC);
CREATE INDEX idx_meal_interactions_meal ON public.meal_interactions(meal_id);
CREATE INDEX idx_meal_interactions_photos ON public.meal_interactions(photo_uploaded) WHERE photo_uploaded = true;

-- RLS for meal interactions
ALTER TABLE public.meal_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal interactions"
  ON public.meal_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal interactions"
  ON public.meal_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal interactions"
  ON public.meal_interactions FOR UPDATE
  USING (auth.uid() = user_id);

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
CREATE TRIGGER update_meal_interactions_updated_at
  BEFORE UPDATE ON public.meal_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- 3. CREATE STORAGE BUCKET FOR MEAL PHOTOS
-- ====================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Meal photos storage policies
CREATE POLICY "Public read access to meal photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meal-photos');

CREATE POLICY "Users can upload meal photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'meal-photos');

CREATE POLICY "Users can update own meal photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own meal photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ====================================================================
-- 4. UPDATE ENGAGEMENT SCORING TO INCLUDE MEALS
-- ====================================================================

-- Drop and recreate the engagement view to include meal interactions
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

  -- Engagement score (0-100) - UPDATED TO INCLUDE MEALS
  LEAST(100, (
    (COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') * 2) + -- Check-ins: 2 pts
    (COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days') * 5) + -- Trivia: 5 pts
    (COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days') * 5) + -- Word games: 5 pts
    (COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') * 3) + -- Self-reports: 3 pts
    (COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') * 2) + -- Questions: 2 pts
    (COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days') * 2) + -- Meal interactions: 2 pts
    (COUNT(DISTINCT mi.id) FILTER (WHERE mi.created_at >= now() - interval '30 days' AND mi.photo_uploaded = true) * 3) + -- Meal photos: 3 pts bonus
    (COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= now() - interval '30 days') * 3)   -- Community photos: 3 pts
  )) as engagement_score

FROM auth.users u
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.trivia_game_results tg ON tg.user_id = u.id
LEFT JOIN public.word_game_results wg ON wg.user_id = u.id
LEFT JOIN public.self_report_submissions sr ON sr.user_id = u.id
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
LEFT JOIN public.meal_interactions mi ON mi.user_id = u.id
LEFT JOIN public.community_moments cm ON cm.user_id = u.id
GROUP BY u.id, u.email;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Community moments photos fixed!';
  RAISE NOTICE '✅ Meal interaction tracking created!';
  RAISE NOTICE '   - Storage buckets configured with public read access';
  RAISE NOTICE '   - meal_interactions table created';
  RAISE NOTICE '   - Engagement scoring updated to include meals';
END $$;
