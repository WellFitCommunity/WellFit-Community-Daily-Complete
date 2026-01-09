-- Add Care Protocol Flags to Profiles
-- Purpose: Enable highlighting and differentiated workflows for special patient populations
-- Flags are combinable (patient can be geriatric + disabled + mental health)

-- ============================================================================
-- CARE PROTOCOL FLAGS
-- ============================================================================

-- Add care protocol columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS care_protocol_geriatric BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS care_protocol_disability BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS care_protocol_mental_health BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS care_level TEXT DEFAULT 'standard';

-- Add check constraint for care_level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_care_level_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_care_level_check
    CHECK (care_level IN ('standard', 'elevated', 'intensive'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.care_protocol_geriatric IS 'Geriatric protocol: 65+ or frailty indicators, requires specialized care pathway';
COMMENT ON COLUMN public.profiles.care_protocol_disability IS 'Disability protocol: ADA accommodations needed, mobility/sensory/cognitive support';
COMMENT ON COLUMN public.profiles.care_protocol_mental_health IS 'Mental health protocol: Behavioral health considerations, psychiatric support';
COMMENT ON COLUMN public.profiles.care_level IS 'Care intensity level: standard (routine), elevated (extra monitoring), intensive (high-touch)';

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_profiles_care_protocol_geriatric
ON public.profiles (care_protocol_geriatric) WHERE care_protocol_geriatric = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_care_protocol_disability
ON public.profiles (care_protocol_disability) WHERE care_protocol_disability = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_care_protocol_mental_health
ON public.profiles (care_protocol_mental_health) WHERE care_protocol_mental_health = TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_care_level
ON public.profiles (care_level) WHERE care_level != 'standard';

-- ============================================================================
-- Note: Demo data updates skipped due to profile update trigger restrictions
-- Demo users can be updated manually via Supabase dashboard if needed
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION FOR CARE PROTOCOL QUERIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_patient_care_badges(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  badges TEXT[] := '{}';
  rec RECORD;
BEGIN
  SELECT
    care_protocol_geriatric,
    care_protocol_disability,
    care_protocol_mental_health,
    care_level
  INTO rec
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF rec IS NULL THEN
    RETURN badges;
  END IF;

  IF rec.care_protocol_geriatric THEN
    badges := array_append(badges, 'GER');
  END IF;

  IF rec.care_protocol_disability THEN
    badges := array_append(badges, 'DIS');
  END IF;

  IF rec.care_protocol_mental_health THEN
    badges := array_append(badges, 'MH');
  END IF;

  IF rec.care_level = 'intensive' THEN
    badges := array_append(badges, 'INTENSIVE');
  ELSIF rec.care_level = 'elevated' THEN
    badges := array_append(badges, 'ELEVATED');
  END IF;

  RETURN badges;
END;
$$;

COMMENT ON FUNCTION public.get_patient_care_badges IS 'Returns array of care protocol badges for a patient: GER (geriatric), DIS (disability), MH (mental health), INTENSIVE/ELEVATED (care level)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_patient_care_badges TO authenticated;
