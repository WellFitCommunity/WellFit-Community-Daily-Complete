-- Allergy Intolerance System Migration
-- CRITICAL SAFETY FEATURE: Tracks allergies and drug intolerances

BEGIN;

-- ============================================================================
-- ALLERGY INTOLERANCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.allergy_intolerances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Allergy Information
  allergen_type TEXT NOT NULL CHECK (allergen_type IN ('medication', 'food', 'environment', 'biologic')),
  allergen_name TEXT NOT NULL, -- e.g., "Penicillin", "Peanuts", "Latex"
  allergen_code TEXT, -- RxNorm, SNOMED CT, or UNII code

  -- Clinical Status
  clinical_status TEXT NOT NULL DEFAULT 'active' CHECK (clinical_status IN ('active', 'inactive', 'resolved')),
  verification_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (verification_status IN ('unconfirmed', 'confirmed', 'refuted', 'entered-in-error')),

  -- Severity
  criticality TEXT CHECK (criticality IN ('low', 'high', 'unable-to-assess')),
  severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe')),

  -- Reaction Details
  reaction_manifestation TEXT[], -- e.g., ["Hives", "Difficulty breathing", "Anaphylaxis"]
  reaction_description TEXT,
  onset_date DATE,
  last_occurrence_date DATE,

  -- Source
  recorded_by TEXT, -- Who recorded this (doctor name, patient, etc.)
  recorded_date DATE DEFAULT CURRENT_DATE,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_allergies_user_id ON public.allergy_intolerances(user_id);
CREATE INDEX IF NOT EXISTS idx_allergies_clinical_status ON public.allergy_intolerances(clinical_status) WHERE clinical_status = 'active';
CREATE INDEX IF NOT EXISTS idx_allergies_allergen_type ON public.allergy_intolerances(allergen_type);
CREATE INDEX IF NOT EXISTS idx_allergies_criticality ON public.allergy_intolerances(criticality) WHERE criticality = 'high';

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_allergy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_allergy_updated_at ON public.allergy_intolerances;
CREATE TRIGGER update_allergy_updated_at
  BEFORE UPDATE ON public.allergy_intolerances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_allergy_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.allergy_intolerances ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own allergies
DROP POLICY IF EXISTS "allergies_user_all" ON public.allergy_intolerances;
CREATE POLICY "allergies_user_all"
  ON public.allergy_intolerances FOR ALL
  USING (user_id = auth.uid());

-- Admins and caregivers can view all allergies
DROP POLICY IF EXISTS "allergies_admin_all" ON public.allergy_intolerances;
CREATE POLICY "allergies_admin_all"
  ON public.allergy_intolerances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get all active allergies for a user
CREATE OR REPLACE FUNCTION public.get_active_allergies(user_id_param UUID)
RETURNS SETOF public.allergy_intolerances
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.allergy_intolerances
  WHERE user_id = user_id_param
    AND clinical_status = 'active'
  ORDER BY criticality DESC NULLS LAST, allergen_name;
END;
$$;

-- Check for medication allergies before prescribing
CREATE OR REPLACE FUNCTION public.check_medication_allergy(
  user_id_param UUID,
  medication_name_param TEXT
)
RETURNS TABLE (
  has_allergy BOOLEAN,
  allergy_id UUID,
  allergen_name TEXT,
  criticality TEXT,
  severity TEXT,
  reaction_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as has_allergy,
    ai.id,
    ai.allergen_name,
    ai.criticality,
    ai.severity,
    ai.reaction_description
  FROM public.allergy_intolerances ai
  WHERE ai.user_id = user_id_param
    AND ai.clinical_status = 'active'
    AND ai.allergen_type = 'medication'
    AND (
      LOWER(ai.allergen_name) = LOWER(medication_name_param)
      OR LOWER(medication_name_param) LIKE '%' || LOWER(ai.allergen_name) || '%'
    );
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.check_medication_allergy(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_active_allergies(UUID);
DROP FUNCTION IF EXISTS public.update_allergy_updated_at();
DROP TABLE IF EXISTS public.allergy_intolerances CASCADE;

COMMIT;
