-- ============================================================================
-- CRITICAL SYSTEMS REPAIR MIGRATION
-- Fixes: Medicine Cabinet, Community Moments, Settings
-- Date: 2025-11-02
-- Zero Tech Debt - Surgical Precision
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: FIX MEDICATIONS TABLE (Medicine Cabinet)
-- ============================================================================

-- Check if medications table exists, if not run the full medicine cabinet migration
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'medications') THEN
    RAISE NOTICE 'Creating medications table...';

    -- Create medications table
    CREATE TABLE public.medications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

      -- Medication Information
      medication_name TEXT NOT NULL,
      generic_name TEXT,
      brand_name TEXT,
      dosage TEXT,
      dosage_form TEXT,
      strength TEXT,

      -- Instructions
      instructions TEXT,
      frequency TEXT,
      route TEXT,

      -- Prescription Information
      prescribed_by TEXT,
      prescribed_date DATE,
      prescription_number TEXT,

      -- Pharmacy Information
      pharmacy_name TEXT,
      pharmacy_phone TEXT,

      -- Refill Information
      quantity INTEGER,
      refills_remaining INTEGER,
      last_refill_date DATE,
      next_refill_date DATE,

      -- Additional Information
      ndc_code TEXT,
      purpose TEXT,
      side_effects TEXT[],
      warnings TEXT[],
      interactions TEXT[],

      -- Status
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
      discontinued_date DATE,
      discontinued_reason TEXT,

      -- AI Extraction Metadata
      ai_confidence NUMERIC(3,2),
      extraction_notes TEXT,
      needs_review BOOLEAN DEFAULT false,
      reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,

      -- Psychiatric Medication Fields
      is_psychiatric BOOLEAN DEFAULT false,
      psych_category TEXT,
      requires_monitoring BOOLEAN DEFAULT false,

      -- Timestamps
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      -- Constraints
      CONSTRAINT valid_confidence CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
    );

    -- Create medication_reminders table
    CREATE TABLE public.medication_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

      time_of_day TIME NOT NULL,
      days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',

      enabled BOOLEAN DEFAULT true,
      notification_method TEXT DEFAULT 'push' CHECK (notification_method IN ('push', 'sms', 'email', 'all')),

      last_reminded_at TIMESTAMPTZ,
      next_reminder_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create medication_doses_taken table
    CREATE TABLE public.medication_doses_taken (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      reminder_id UUID REFERENCES public.medication_reminders(id) ON DELETE SET NULL,

      taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      scheduled_time TIMESTAMPTZ,
      dose_amount TEXT,

      status TEXT NOT NULL DEFAULT 'taken' CHECK (status IN ('taken', 'missed', 'skipped')),
      skip_reason TEXT,

      notes TEXT,
      side_effects_noted TEXT[],

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create medication_image_extractions table
    CREATE TABLE public.medication_image_extractions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,

      image_size INTEGER,
      image_type TEXT,
      extraction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      raw_extraction_data JSONB,
      confidence_score NUMERIC(3,2),
      extraction_success BOOLEAN DEFAULT true,
      extraction_error TEXT,

      processing_time_ms INTEGER,
      model_used TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create indexes for medications
    CREATE INDEX idx_medications_user_id ON public.medications(user_id);
    CREATE INDEX idx_medications_status ON public.medications(status) WHERE status = 'active';
    CREATE INDEX idx_medications_needs_review ON public.medications(needs_review) WHERE needs_review = true;
    CREATE INDEX idx_medications_next_refill ON public.medications(next_refill_date) WHERE next_refill_date IS NOT NULL;
    CREATE INDEX idx_medications_psychiatric ON public.medications(is_psychiatric) WHERE is_psychiatric = true;

    -- Create indexes for reminders
    CREATE INDEX idx_medication_reminders_medication_id ON public.medication_reminders(medication_id);
    CREATE INDEX idx_medication_reminders_user_id ON public.medication_reminders(user_id);
    CREATE INDEX idx_medication_reminders_enabled ON public.medication_reminders(enabled) WHERE enabled = true;

    -- Create indexes for doses taken
    CREATE INDEX idx_medication_doses_taken_medication_id ON public.medication_doses_taken(medication_id);
    CREATE INDEX idx_medication_doses_taken_user_id ON public.medication_doses_taken(user_id);
    CREATE INDEX idx_medication_doses_taken_taken_at ON public.medication_doses_taken(taken_at DESC);

    -- Create indexes for extractions
    CREATE INDEX idx_medication_extractions_user_id ON public.medication_image_extractions(user_id);
    CREATE INDEX idx_medication_extractions_medication_id ON public.medication_image_extractions(medication_id);

    -- Enable RLS
    ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medication_doses_taken ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.medication_image_extractions ENABLE ROW LEVEL SECURITY;

    -- RLS Policies for medications
    CREATE POLICY medications_select_own ON public.medications
      FOR SELECT USING (user_id = auth.uid() OR is_admin_or_super_admin());

    CREATE POLICY medications_insert_own ON public.medications
      FOR INSERT WITH CHECK (user_id = auth.uid());

    CREATE POLICY medications_update_own ON public.medications
      FOR UPDATE USING (user_id = auth.uid() OR is_admin_or_super_admin());

    CREATE POLICY medications_delete_own ON public.medications
      FOR DELETE USING (user_id = auth.uid() OR is_admin_or_super_admin());

    -- RLS Policies for reminders
    CREATE POLICY medication_reminders_select_own ON public.medication_reminders
      FOR SELECT USING (user_id = auth.uid() OR is_admin_or_super_admin());

    CREATE POLICY medication_reminders_insert_own ON public.medication_reminders
      FOR INSERT WITH CHECK (user_id = auth.uid());

    CREATE POLICY medication_reminders_update_own ON public.medication_reminders
      FOR UPDATE USING (user_id = auth.uid() OR is_admin_or_super_admin());

    CREATE POLICY medication_reminders_delete_own ON public.medication_reminders
      FOR DELETE USING (user_id = auth.uid() OR is_admin_or_super_admin());

    -- RLS Policies for doses taken
    CREATE POLICY medication_doses_taken_select_own ON public.medication_doses_taken
      FOR SELECT USING (user_id = auth.uid() OR is_admin_or_super_admin());

    CREATE POLICY medication_doses_taken_insert_own ON public.medication_doses_taken
      FOR INSERT WITH CHECK (user_id = auth.uid());

    -- RLS Policies for extractions
    CREATE POLICY medication_extractions_select_own ON public.medication_image_extractions
      FOR SELECT USING (user_id = auth.uid() OR is_admin_or_super_admin());

    CREATE POLICY medication_extractions_insert_own ON public.medication_image_extractions
      FOR INSERT WITH CHECK (user_id = auth.uid());

    RAISE NOTICE 'Medications tables created successfully!';
  ELSE
    RAISE NOTICE 'Medications table already exists, skipping...';
  END IF;
END $$;

-- ============================================================================
-- PART 2: FIX COMMUNITY MOMENTS INDEXES AND RPC
-- ============================================================================

-- Add critical indexes for community_moments if missing
DO $$
BEGIN
  -- Index for created_at ordering (critical for pagination)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'community_moments'
    AND indexname = 'idx_community_moments_created_at'
  ) THEN
    CREATE INDEX idx_community_moments_created_at ON public.community_moments(created_at DESC);
    RAISE NOTICE 'Created index: idx_community_moments_created_at';
  END IF;

  -- Index for approval_status filtering
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'community_moments'
    AND indexname = 'idx_community_moments_approval_status'
  ) THEN
    CREATE INDEX idx_community_moments_approval_status ON public.community_moments(approval_status);
    RAISE NOTICE 'Created index: idx_community_moments_approval_status';
  END IF;

  -- Composite index for approved moments ordered by date (most common query)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'community_moments'
    AND indexname = 'idx_community_moments_approved_created'
  ) THEN
    CREATE INDEX idx_community_moments_approved_created ON public.community_moments(approval_status, created_at DESC)
    WHERE approval_status = 'approved';
    RAISE NOTICE 'Created index: idx_community_moments_approved_created';
  END IF;

  -- Index for user_id (for user's own moments)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'community_moments'
    AND indexname = 'idx_community_moments_user_id'
  ) THEN
    CREATE INDEX idx_community_moments_user_id ON public.community_moments(user_id);
    RAISE NOTICE 'Created index: idx_community_moments_user_id';
  END IF;
END $$;

-- Create or replace get_pending_photo_count RPC function
CREATE OR REPLACE FUNCTION public.get_pending_photo_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can call this
  IF NOT is_admin_or_super_admin() THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.community_moments
    WHERE approval_status = 'pending'
  );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_pending_photo_count() TO authenticated;

-- ============================================================================
-- PART 3: FIX SETTINGS - ADD MISSING EMERGENCY_CONTACT_PHONE COLUMN
-- ============================================================================

-- Add emergency_contact_phone column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN emergency_contact_phone TEXT;
    RAISE NOTICE 'Added emergency_contact_phone column to profiles table';
  ELSE
    RAISE NOTICE 'emergency_contact_phone column already exists';
  END IF;
END $$;

-- ============================================================================
-- PART 4: CREATE HELPER FUNCTIONS FOR MEDICATIONS
-- ============================================================================

-- Function to get active medications
CREATE OR REPLACE FUNCTION public.get_active_medications(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  medication_name TEXT,
  dosage TEXT,
  frequency TEXT,
  next_refill_date DATE,
  is_psychiatric BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.medication_name,
    m.dosage,
    m.frequency,
    m.next_refill_date,
    m.is_psychiatric
  FROM public.medications m
  WHERE m.user_id = user_id_param
    AND m.status = 'active'
  ORDER BY m.medication_name;
END;
$$;

-- Function to calculate medication adherence rate
CREATE OR REPLACE FUNCTION public.get_medication_adherence_rate(
  user_id_param UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  medication_id UUID,
  medication_name TEXT,
  adherence_rate NUMERIC,
  doses_taken INTEGER,
  doses_scheduled INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.medication_name,
    CASE
      WHEN COUNT(mr.id) > 0
      THEN (COUNT(dt.id)::NUMERIC / (COUNT(mr.id) * days_back)::NUMERIC * 100)
      ELSE 0
    END as adherence_rate,
    COUNT(dt.id)::INTEGER as doses_taken,
    (COUNT(mr.id) * days_back)::INTEGER as doses_scheduled
  FROM public.medications m
  LEFT JOIN public.medication_reminders mr ON mr.medication_id = m.id AND mr.enabled = true
  LEFT JOIN public.medication_doses_taken dt ON dt.medication_id = m.id
    AND dt.taken_at >= NOW() - (days_back || ' days')::INTERVAL
    AND dt.status = 'taken'
  WHERE m.user_id = user_id_param
    AND m.status = 'active'
  GROUP BY m.id, m.medication_name;
END;
$$;

-- Function to get medications needing refill
CREATE OR REPLACE FUNCTION public.get_medications_needing_refill(
  user_id_param UUID,
  days_threshold INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  medication_name TEXT,
  next_refill_date DATE,
  days_until_refill INTEGER,
  pharmacy_name TEXT,
  pharmacy_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.medication_name,
    m.next_refill_date,
    (m.next_refill_date - CURRENT_DATE)::INTEGER as days_until_refill,
    m.pharmacy_name,
    m.pharmacy_phone
  FROM public.medications m
  WHERE m.user_id = user_id_param
    AND m.status = 'active'
    AND m.next_refill_date IS NOT NULL
    AND m.next_refill_date <= CURRENT_DATE + (days_threshold || ' days')::INTERVAL
  ORDER BY m.next_refill_date;
END;
$$;

-- Function to get upcoming reminders
CREATE OR REPLACE FUNCTION public.get_upcoming_reminders(
  user_id_param UUID,
  hours_ahead INTEGER DEFAULT 24
)
RETURNS TABLE (
  medication_id UUID,
  medication_name TEXT,
  reminder_time TIME,
  next_reminder_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.medication_name,
    mr.time_of_day,
    mr.next_reminder_at
  FROM public.medication_reminders mr
  JOIN public.medications m ON m.id = mr.medication_id
  WHERE mr.user_id = user_id_param
    AND mr.enabled = true
    AND mr.next_reminder_at IS NOT NULL
    AND mr.next_reminder_at <= NOW() + (hours_ahead || ' hours')::INTERVAL
  ORDER BY mr.next_reminder_at;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_active_medications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_medication_adherence_rate(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_medications_needing_refill(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upcoming_reminders(UUID, INTEGER) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

DO $$
DECLARE
  med_count INTEGER;
  moment_indexes INTEGER;
  profile_cols INTEGER;
BEGIN
  -- Check medications table
  SELECT COUNT(*)::INTEGER INTO med_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('medications', 'medication_reminders', 'medication_doses_taken', 'medication_image_extractions');

  RAISE NOTICE 'Medication tables created: %/4', med_count;

  -- Check community_moments indexes
  SELECT COUNT(*)::INTEGER INTO moment_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename = 'community_moments'
  AND indexname LIKE 'idx_community_moments_%';

  RAISE NOTICE 'Community moments indexes: %', moment_indexes;

  -- Check profiles columns
  SELECT COUNT(*)::INTEGER INTO profile_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'font_size', 'notifications_enabled', 'emergency_contact_name',
    'emergency_contact_phone', 'timezone', 'daily_reminder_time',
    'care_team_notifications', 'community_notifications'
  );

  RAISE NOTICE 'Settings columns in profiles: %/8', profile_cols;

  IF med_count = 4 AND moment_indexes >= 4 AND profile_cols = 8 THEN
    RAISE NOTICE '✅ ALL SYSTEMS REPAIRED SUCCESSFULLY!';
  ELSE
    RAISE WARNING '⚠️ Some systems may need additional repair';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
