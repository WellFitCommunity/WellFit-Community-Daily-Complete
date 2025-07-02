-- Create checkins table
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_emergency BOOLEAN DEFAULT FALSE NOT NULL,
  label TEXT, -- Brief label for the check-in or alert type
  notes TEXT, -- Additional notes or details from the user
  mood TEXT, -- User's reported mood
  activity_level TEXT, -- User's reported activity level
  -- Add other self-reported metrics as needed, e.g., pain_level INTEGER
  details JSONB, -- For any other structured data related to the check-in
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.checkins IS 'Stores daily or periodic check-ins by users, including self-reported data and emergency alerts.';
COMMENT ON COLUMN public.checkins.user_id IS 'The ID of the user submitting the check-in.';
COMMENT ON COLUMN public.checkins.is_emergency IS 'Flag indicating if this check-in triggered an emergency alert.';
COMMENT ON COLUMN public.checkins.label IS 'A brief label or type for the check-in (e.g., "Morning Check-in", "Pain Report", "Emergency Button").';
COMMENT ON COLUMN public.checkins.notes IS 'User-provided notes for this check-in.';
COMMENT ON COLUMN public.checkins.mood IS 'Self-reported mood (e.g., "Happy", "Okay", "Sad").';
COMMENT ON COLUMN public.checkins.activity_level IS 'Self-reported activity level (e.g., "Active", "Moderate", "Low").';
COMMENT ON COLUMN public.checkins.details IS 'Additional structured data for the check-in (e.g., specific answers to questions).';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON public.checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON public.checkins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_is_emergency ON public.checkins(is_emergency) WHERE is_emergency = TRUE;
