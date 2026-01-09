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
-- UPDATE DEMO SENIORS WITH CARE PROTOCOLS
-- ============================================================================

-- Gloria Simmons (HIGH RISK) - Geriatric + Mental Health (anxiety noted in check-ins)
UPDATE public.profiles
SET
  care_protocol_geriatric = TRUE,
  care_protocol_mental_health = TRUE,
  care_level = 'intensive'
WHERE user_id = 'd1a0b0c0-1111-4000-8000-000000000001';

-- Harold Washington (MODERATE) - Geriatric + Disability (diabetic, mobility issues)
UPDATE public.profiles
SET
  care_protocol_geriatric = TRUE,
  care_protocol_disability = TRUE,
  care_level = 'elevated'
WHERE user_id = 'd1a0b0c0-2222-4000-8000-000000000002';

-- Betty Coleman (RECOVERING) - Geriatric only (post-surgery, doing well)
UPDATE public.profiles
SET
  care_protocol_geriatric = TRUE,
  care_level = 'standard'
WHERE user_id = 'd1a0b0c0-3333-4000-8000-000000000003';

-- Marcus Thompson (HEALTHY) - Geriatric only (healthy senior)
UPDATE public.profiles
SET
  care_protocol_geriatric = TRUE,
  care_level = 'standard'
WHERE user_id = 'd1a0b0c0-4444-4000-8000-000000000004';

-- ============================================================================
-- UPDATE DEMO PATIENTS WITH CARE PROTOCOLS
-- ============================================================================

-- Eleanor Thompson - Geriatric + Mental Health (complex care needs)
UPDATE public.profiles
SET
  care_protocol_geriatric = TRUE,
  care_protocol_mental_health = TRUE,
  care_level = 'elevated'
WHERE user_id = 'a1111111-1111-1111-1111-111111111111';

-- Robert Chen - Geriatric + Disability (diabetic)
UPDATE public.profiles
SET
  care_protocol_geriatric = TRUE,
  care_protocol_disability = TRUE,
  care_level = 'elevated'
WHERE user_id = 'a2222222-2222-2222-2222-222222222222';

-- Maria Santos - Standard (post-surgery, younger patient)
UPDATE public.profiles
SET
  care_level = 'standard'
WHERE user_id = 'a3333333-3333-3333-3333-333333333333';

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
