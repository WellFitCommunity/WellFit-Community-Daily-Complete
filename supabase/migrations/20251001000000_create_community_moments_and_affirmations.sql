-- Create community_moments and affirmations tables
-- This migration fixes the "Failed to load moments" error
-- Date: 2025-10-01

-- Create community_moments table
CREATE TABLE IF NOT EXISTS public.community_moments (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url text,
  file_path text,
  title text NOT NULL,
  description text NOT NULL,
  emoji text DEFAULT '😊',
  tags text,
  is_gallery_high boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create affirmations table for daily positive messages
CREATE TABLE IF NOT EXISTS public.affirmations (
  id bigserial PRIMARY KEY,
  text text NOT NULL,
  author text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_moments_user_id ON public.community_moments (user_id);
CREATE INDEX IF NOT EXISTS idx_community_moments_created_at ON public.community_moments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_moments_is_gallery_high ON public.community_moments (is_gallery_high) WHERE is_gallery_high = true;
CREATE INDEX IF NOT EXISTS idx_affirmations_id ON public.affirmations (id);

-- Add updated_at trigger for community_moments
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_community_moments_updated_at ON public.community_moments;
CREATE TRIGGER update_community_moments_updated_at
  BEFORE UPDATE ON public.community_moments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.community_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_moments
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
CREATE POLICY "community_moments_select_all"
ON public.community_moments
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "community_moments_insert_own" ON public.community_moments;
CREATE POLICY "community_moments_insert_own"
ON public.community_moments
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_update_own" ON public.community_moments;
CREATE POLICY "community_moments_update_own"
ON public.community_moments
FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_delete_own" ON public.community_moments;
CREATE POLICY "community_moments_delete_own"
ON public.community_moments
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_admin_all" ON public.community_moments;
CREATE POLICY "community_moments_admin_all"
ON public.community_moments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for affirmations
DROP POLICY IF EXISTS "affirmations_select_all" ON public.affirmations;
CREATE POLICY "affirmations_select_all"
ON public.affirmations
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "affirmations_admin_only" ON public.affirmations;
CREATE POLICY "affirmations_admin_only"
ON public.affirmations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Add default affirmations
INSERT INTO public.affirmations (text, author) VALUES
('Every day is a new beginning. Take a deep breath, smile, and start again.', 'Unknown'),
('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb'),
('Age is merely mind over matter. If you don''t mind, it doesn''t matter.', 'Mark Twain'),
('You are never too old to set another goal or to dream a new dream.', 'C.S. Lewis'),
('Life is what happens when you''re busy making other plans.', 'John Lennon'),
('The secret of getting ahead is getting started.', 'Mark Twain'),
('Believe you can and you''re halfway there.', 'Theodore Roosevelt'),
('It is during our darkest moments that we must focus to see the light.', 'Aristotle'),
('The only impossible journey is the one you never begin.', 'Tony Robbins'),
('In the middle of difficulty lies opportunity.', 'Albert Einstein')
ON CONFLICT DO NOTHING;

-- Storage bucket for community moments
INSERT INTO storage.buckets (id, name)
VALUES ('community-moments', 'community-moments')
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community-moments bucket
DROP POLICY IF EXISTS "community_moments_public_read" ON storage.objects;
CREATE POLICY "community_moments_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-moments');

DROP POLICY IF EXISTS "community_moments_user_upload" ON storage.objects;
CREATE POLICY "community_moments_user_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'community-moments'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "community_moments_user_update" ON storage.objects;
CREATE POLICY "community_moments_user_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'community-moments'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "community_moments_user_delete" ON storage.objects;
CREATE POLICY "community_moments_user_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'community-moments'
  AND auth.role() = 'authenticated'
);
