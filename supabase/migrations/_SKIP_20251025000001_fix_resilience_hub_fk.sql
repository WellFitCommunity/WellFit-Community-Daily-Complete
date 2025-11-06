-- Fix Resilience Hub Practitioner FK Constraint
-- Problem: provider_burnout_assessments requires fhir_practitioners record,
-- but nurses enrolled via enrollClient don't have practitioner records

-- 1. Make practitioner_id nullable and add user_id as alternative
ALTER TABLE public.provider_burnout_assessments
ALTER COLUMN practitioner_id DROP NOT NULL;

ALTER TABLE public.provider_burnout_assessments
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add check constraint to ensure either practitioner_id OR user_id is present
ALTER TABLE public.provider_burnout_assessments
DROP CONSTRAINT IF EXISTS either_practitioner_or_user;

ALTER TABLE public.provider_burnout_assessments
ADD CONSTRAINT either_practitioner_or_user CHECK (
  practitioner_id IS NOT NULL OR user_id IS NOT NULL
);

-- 3. Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_burnout_assessments_user_id
ON public.provider_burnout_assessments(user_id)
WHERE user_id IS NOT NULL;

-- 4. Update RLS policies to support both access patterns
DROP POLICY IF EXISTS "Users can view own burnout assessments" ON public.provider_burnout_assessments;

CREATE POLICY "Users can view own burnout assessments"
  ON public.provider_burnout_assessments
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can create own burnout assessments" ON public.provider_burnout_assessments;

CREATE POLICY "Users can create own burnout assessments"
  ON public.provider_burnout_assessments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can update own burnout assessments" ON public.provider_burnout_assessments;

CREATE POLICY "Users can update own burnout assessments"
  ON public.provider_burnout_assessments
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

-- 5. Apply same fix to provider_daily_checkins
ALTER TABLE public.provider_daily_checkins
ALTER COLUMN practitioner_id DROP NOT NULL;

ALTER TABLE public.provider_daily_checkins
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.provider_daily_checkins
DROP CONSTRAINT IF EXISTS checkin_either_practitioner_or_user;

ALTER TABLE public.provider_daily_checkins
ADD CONSTRAINT checkin_either_practitioner_or_user CHECK (
  practitioner_id IS NOT NULL OR user_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id
ON public.provider_daily_checkins(user_id)
WHERE user_id IS NOT NULL;

-- 6. Update RLS policies for daily checkins
DROP POLICY IF EXISTS "Users can view own daily checkins" ON public.provider_daily_checkins;

CREATE POLICY "Users can view own daily checkins"
  ON public.provider_daily_checkins
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can create own daily checkins" ON public.provider_daily_checkins;

CREATE POLICY "Users can create own daily checkins"
  ON public.provider_daily_checkins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

-- 7. Apply same fix to other resilience hub tables
ALTER TABLE public.resilience_training_progress
ALTER COLUMN practitioner_id DROP NOT NULL;

ALTER TABLE public.resilience_training_progress
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.resilience_training_progress
DROP CONSTRAINT IF EXISTS training_either_practitioner_or_user;

ALTER TABLE public.resilience_training_progress
ADD CONSTRAINT training_either_practitioner_or_user CHECK (
  practitioner_id IS NOT NULL OR user_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_training_progress_user_id
ON public.resilience_training_progress(user_id)
WHERE user_id IS NOT NULL;

-- 8. Update RLS for training progress
DROP POLICY IF EXISTS "Users can view own training progress" ON public.resilience_training_progress;

CREATE POLICY "Users can view own training progress"
  ON public.resilience_training_progress
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can create own training progress" ON public.resilience_training_progress;

CREATE POLICY "Users can create own training progress"
  ON public.resilience_training_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can update own training progress" ON public.resilience_training_progress;

CREATE POLICY "Users can update own training progress"
  ON public.resilience_training_progress
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()::uuid
    OR practitioner_id IN (
      SELECT id FROM public.fhir_practitioners WHERE user_id = auth.uid()::uuid
    )
  );

-- 9. Helper function to get burnout risk that works with both FK patterns
CREATE OR REPLACE FUNCTION public.get_provider_burnout_risk(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  risk_level TEXT,
  emotional_exhaustion_score INTEGER,
  depersonalization_score INTEGER,
  personal_accomplishment_score INTEGER,
  overall_burnout_score INTEGER,
  assessment_date TIMESTAMPTZ,
  recommendations TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid()::uuid);
  v_practitioner_id UUID;
BEGIN
  -- Try to find practitioner_id for this user
  SELECT id INTO v_practitioner_id
  FROM public.fhir_practitioners
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Get most recent assessment using either FK
  RETURN QUERY
  SELECT
    pba.risk_level,
    pba.emotional_exhaustion_score,
    pba.depersonalization_score,
    pba.personal_accomplishment_score,
    pba.overall_burnout_score,
    pba.assessment_date,
    pba.recommendations
  FROM public.provider_burnout_assessments pba
  WHERE (pba.user_id = v_user_id OR pba.practitioner_id = v_practitioner_id)
  ORDER BY pba.assessment_date DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_burnout_risk(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_provider_burnout_risk IS 'Get burnout risk for provider, works with both user_id and practitioner_id';
COMMENT ON COLUMN public.provider_burnout_assessments.user_id IS 'Direct user reference for nurses without practitioner records';
COMMENT ON COLUMN public.provider_daily_checkins.user_id IS 'Direct user reference for nurses without practitioner records';
COMMENT ON COLUMN public.resilience_training_progress.user_id IS 'Direct user reference for nurses without practitioner records';
