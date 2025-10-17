-- Psychiatric Medication Flags Migration
-- Adds fields to track psychiatric medications and alerts for multiple psych meds

-- migrate:up

-- ============================================================================
-- ADD PSYCH MED FIELDS TO MEDICATIONS TABLE
-- ============================================================================

-- Add psychiatric classification fields
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medications') THEN
    ALTER TABLE public.medications
    ADD COLUMN IF NOT EXISTS is_psychiatric BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS psych_category TEXT,
    ADD COLUMN IF NOT EXISTS psych_subcategory TEXT,
    ADD COLUMN IF NOT EXISTS psych_classification_confidence NUMERIC(3,2);
  ELSE
    RAISE NOTICE 'Table medications does not exist, skipping column additions';
  END IF;
END $$;

-- Add check constraint for confidence score
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medications') THEN
    -- Add constraint only if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'valid_psych_confidence') THEN
      ALTER TABLE public.medications
      ADD CONSTRAINT valid_psych_confidence
        CHECK (psych_classification_confidence IS NULL OR
               (psych_classification_confidence >= 0 AND psych_classification_confidence <= 1));
    END IF;

    -- Create index for finding psychiatric medications quickly
    CREATE INDEX IF NOT EXISTS idx_medications_psychiatric
      ON public.medications(is_psychiatric, status)
      WHERE is_psychiatric = true AND status = 'active';

    -- Create index for psych category lookups
    CREATE INDEX IF NOT EXISTS idx_medications_psych_category
      ON public.medications(psych_category)
      WHERE psych_category IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- CREATE PSYCH MED ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.psych_med_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT NOT NULL DEFAULT 'multiple_psych_meds'
    CHECK (alert_type IN ('multiple_psych_meds', 'dangerous_combination', 'polypharmacy')),
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),

  -- Medication details
  psych_med_count INTEGER NOT NULL,
  medication_ids UUID[] NOT NULL,
  medication_names TEXT[] NOT NULL,
  categories TEXT[] NOT NULL,

  -- Warnings and recommendations
  warnings TEXT[] NOT NULL DEFAULT '{}',
  requires_review BOOLEAN DEFAULT false,

  -- Status tracking
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,

  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for psych med alerts
CREATE INDEX IF NOT EXISTS idx_psych_alerts_user_id
  ON public.psych_med_alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_psych_alerts_unresolved
  ON public.psych_med_alerts(user_id, acknowledged, resolved)
  WHERE NOT resolved;

CREATE INDEX IF NOT EXISTS idx_psych_alerts_severity
  ON public.psych_med_alerts(severity, resolved)
  WHERE NOT resolved;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Create timestamp update function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_psych_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger for psych_med_alerts
DROP TRIGGER IF EXISTS update_psych_alerts_updated_at ON public.psych_med_alerts;
CREATE TRIGGER update_psych_alerts_updated_at
  BEFORE UPDATE ON public.psych_med_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_psych_alerts_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.psych_med_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
DROP POLICY IF EXISTS "psych_alerts_user_select" ON public.psych_med_alerts;
CREATE POLICY "psych_alerts_user_select"
  ON public.psych_med_alerts FOR SELECT
  USING (user_id = auth.uid());

-- Users can acknowledge their own alerts
DROP POLICY IF EXISTS "psych_alerts_user_update" ON public.psych_med_alerts;
CREATE POLICY "psych_alerts_user_update"
  ON public.psych_med_alerts FOR UPDATE
  USING (user_id = auth.uid());

-- Admins/caregivers can view and manage all alerts
DROP POLICY IF EXISTS "psych_alerts_admin_all" ON public.psych_med_alerts;
CREATE POLICY "psych_alerts_admin_all"
  ON public.psych_med_alerts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver', 'nurse')
    )
  );

-- System can insert alerts (service role)
DROP POLICY IF EXISTS "psych_alerts_system_insert" ON public.psych_med_alerts;
CREATE POLICY "psych_alerts_system_insert"
  ON public.psych_med_alerts FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get all psychiatric medications for a user
CREATE OR REPLACE FUNCTION public.get_user_psych_medications(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  medication_name TEXT,
  generic_name TEXT,
  psych_category TEXT,
  psych_subcategory TEXT,
  dosage TEXT,
  instructions TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.medication_name,
    m.generic_name,
    m.psych_category,
    m.psych_subcategory,
    m.dosage,
    m.instructions
  FROM public.medications m
  WHERE m.user_id = user_id_param
    AND m.status = 'active'
    AND m.is_psychiatric = true
  ORDER BY m.medication_name;
END;
$$;

-- Function to check for multiple psych meds and create alert if needed
CREATE OR REPLACE FUNCTION public.check_multiple_psych_meds(user_id_param UUID)
RETURNS TABLE (
  has_multiple BOOLEAN,
  psych_med_count INTEGER,
  alert_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_med_ids UUID[];
  v_med_names TEXT[];
  v_categories TEXT[];
  v_has_multiple BOOLEAN;
  v_alert_exists BOOLEAN;
BEGIN
  -- Count active psychiatric medications
  SELECT
    COUNT(*),
    ARRAY_AGG(id),
    ARRAY_AGG(medication_name),
    ARRAY_AGG(COALESCE(psych_category, 'unknown'))
  INTO
    v_count,
    v_med_ids,
    v_med_names,
    v_categories
  FROM public.medications
  WHERE user_id = user_id_param
    AND status = 'active'
    AND is_psychiatric = true;

  v_has_multiple := v_count > 1;

  -- Check if alert already exists
  SELECT EXISTS (
    SELECT 1 FROM public.psych_med_alerts
    WHERE user_id = user_id_param
      AND alert_type = 'multiple_psych_meds'
      AND NOT resolved
  ) INTO v_alert_exists;

  -- Create or update alert if needed
  IF v_has_multiple AND NOT v_alert_exists THEN
    INSERT INTO public.psych_med_alerts (
      user_id,
      alert_type,
      severity,
      psych_med_count,
      medication_ids,
      medication_names,
      categories,
      warnings,
      requires_review
    ) VALUES (
      user_id_param,
      'multiple_psych_meds',
      CASE
        WHEN v_count >= 3 THEN 'critical'
        ELSE 'warning'
      END,
      v_count,
      v_med_ids,
      v_med_names,
      v_categories,
      ARRAY[format('Patient is taking %s psychiatric medications simultaneously', v_count)],
      v_count >= 2
    );

    RETURN QUERY SELECT v_has_multiple, v_count, true;
  ELSIF NOT v_has_multiple AND v_alert_exists THEN
    -- Auto-resolve if psych meds reduced to 1 or 0
    UPDATE public.psych_med_alerts
    SET resolved = true,
        resolved_at = NOW(),
        resolved_notes = 'Auto-resolved: Psych medication count reduced to ' || v_count
    WHERE user_id = user_id_param
      AND alert_type = 'multiple_psych_meds'
      AND NOT resolved;

    RETURN QUERY SELECT v_has_multiple, v_count, false;
  ELSE
    RETURN QUERY SELECT v_has_multiple, v_count, false;
  END IF;
END;
$$;

-- Function to get active psych med alerts for a user
CREATE OR REPLACE FUNCTION public.get_active_psych_alerts(user_id_param UUID)
RETURNS SETOF public.psych_med_alerts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.psych_med_alerts
  WHERE user_id = user_id_param
    AND NOT resolved
  ORDER BY
    CASE severity
      WHEN 'critical' THEN 1
      WHEN 'warning' THEN 2
      WHEN 'info' THEN 3
    END,
    created_at DESC;
END;
$$;

-- migrate:down
-- Drop functions
DROP FUNCTION IF EXISTS public.get_active_psych_alerts(UUID);
DROP FUNCTION IF EXISTS public.check_multiple_psych_meds(UUID);
DROP FUNCTION IF EXISTS public.get_user_psych_medications(UUID);
DROP FUNCTION IF EXISTS public.update_psych_alerts_updated_at() CASCADE;

-- Drop table
DROP TABLE IF EXISTS public.psych_med_alerts CASCADE;

-- Remove columns from medications (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medications') THEN
    ALTER TABLE public.medications
    DROP COLUMN IF EXISTS is_psychiatric,
    DROP COLUMN IF EXISTS psych_category,
    DROP COLUMN IF EXISTS psych_subcategory,
    DROP COLUMN IF EXISTS psych_classification_confidence;
  END IF;
END $$;
