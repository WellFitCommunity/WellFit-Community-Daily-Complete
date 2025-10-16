-- Medicine Cabinet System Migration
-- Stores user medications with AI-extracted information from photos

-- migrate:up
BEGIN;

-- ============================================================================
-- MEDICATIONS TABLE
-- Stores all medication information for users
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Medication Information (extracted from label)
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  brand_name TEXT,
  dosage TEXT, -- e.g., "500mg", "10ml"
  dosage_form TEXT, -- e.g., "tablet", "capsule", "liquid"
  strength TEXT, -- e.g., "500mg"

  -- Instructions
  instructions TEXT, -- e.g., "Take twice daily with food"
  frequency TEXT, -- e.g., "twice daily", "every 8 hours"
  route TEXT, -- e.g., "oral", "topical", "injection"

  -- Prescription Information
  prescribed_by TEXT, -- Doctor name
  prescribed_date DATE,
  prescription_number TEXT,

  -- Pharmacy Information
  pharmacy_name TEXT,
  pharmacy_phone TEXT,

  -- Refill Information
  quantity INTEGER, -- Number of pills/doses
  refills_remaining INTEGER,
  last_refill_date DATE,
  next_refill_date DATE,

  -- Additional Information
  ndc_code TEXT, -- National Drug Code
  purpose TEXT, -- What it's for (extracted or user-added)
  side_effects TEXT[], -- Common side effects
  warnings TEXT[], -- Important warnings
  interactions TEXT[], -- Drug interactions to watch for

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed')),
  discontinued_date DATE,
  discontinued_reason TEXT,

  -- AI Extraction Metadata
  ai_confidence NUMERIC(3,2), -- 0.00 to 1.00 confidence score
  extraction_notes TEXT, -- Notes from AI about extraction quality
  needs_review BOOLEAN DEFAULT false, -- Flag if AI wasn't confident
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes for common queries
  CONSTRAINT valid_confidence CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

-- ============================================================================
-- MEDICATION REMINDERS TABLE
-- Tracks when users should take medications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.medication_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Reminder Schedule
  time_of_day TIME NOT NULL, -- e.g., 08:00, 20:00
  days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday, 6=Saturday

  -- Reminder Settings
  enabled BOOLEAN DEFAULT true,
  notification_method TEXT DEFAULT 'push' CHECK (notification_method IN ('push', 'sms', 'email', 'all')),

  -- Tracking
  last_reminded_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MEDICATION DOSES TAKEN TABLE
-- Tracks when users actually take their medications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.medication_doses_taken (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES public.medication_reminders(id) ON DELETE SET NULL,

  -- Dose Information
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_time TIMESTAMPTZ, -- When it was supposed to be taken
  dose_amount TEXT, -- e.g., "1 tablet", "10ml"

  -- Status
  status TEXT NOT NULL DEFAULT 'taken' CHECK (status IN ('taken', 'missed', 'skipped')),
  skip_reason TEXT,

  -- Notes
  notes TEXT,
  side_effects_noted TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- MEDICATION IMAGES TABLE (Optional - for storing image metadata only)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.medication_image_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,

  -- Image metadata (not the actual image)
  image_size INTEGER, -- bytes
  image_type TEXT, -- e.g., "image/jpeg"
  extraction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- AI Extraction Results
  raw_extraction_data JSONB, -- Full AI response
  confidence_score NUMERIC(3,2),
  extraction_success BOOLEAN DEFAULT true,
  extraction_error TEXT,

  -- Processing info
  processing_time_ms INTEGER,
  model_used TEXT, -- e.g., "claude-3-5-sonnet-20241022"

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Medications indexes
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON public.medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_status ON public.medications(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_medications_needs_review ON public.medications(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_medications_next_refill ON public.medications(next_refill_date) WHERE next_refill_date IS NOT NULL AND status = 'active';

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_medication_reminders_user_id ON public.medication_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_medication_id ON public.medication_reminders(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_enabled ON public.medication_reminders(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_medication_reminders_next_reminder ON public.medication_reminders(next_reminder_at) WHERE enabled = true;

-- Doses taken indexes
CREATE INDEX IF NOT EXISTS idx_medication_doses_user_id ON public.medication_doses_taken(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_doses_medication_id ON public.medication_doses_taken(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_doses_taken_at ON public.medication_doses_taken(taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_doses_status ON public.medication_doses_taken(status);

-- Extractions indexes
CREATE INDEX IF NOT EXISTS idx_medication_extractions_user_id ON public.medication_image_extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_extractions_medication_id ON public.medication_image_extractions(medication_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION public.update_medications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_medications_updated_at ON public.medications;
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medications_updated_at();

DROP TRIGGER IF EXISTS update_medication_reminders_updated_at ON public.medication_reminders;
CREATE TRIGGER update_medication_reminders_updated_at
  BEFORE UPDATE ON public.medication_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medications_updated_at();

-- Auto-calculate next reminder time
CREATE OR REPLACE FUNCTION public.calculate_next_medication_reminder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enabled = true THEN
    -- Simple calculation: add 1 day to current time at the scheduled time
    NEW.next_reminder_at := (CURRENT_DATE + INTERVAL '1 day' + NEW.time_of_day);
  ELSE
    NEW.next_reminder_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_next_medication_reminder ON public.medication_reminders;
CREATE TRIGGER set_next_medication_reminder
  BEFORE INSERT OR UPDATE ON public.medication_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_next_medication_reminder();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_doses_taken ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_image_extractions ENABLE ROW LEVEL SECURITY;

-- Medications policies
DROP POLICY IF EXISTS "medications_user_select" ON public.medications;
CREATE POLICY "medications_user_select"
  ON public.medications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "medications_user_insert" ON public.medications;
CREATE POLICY "medications_user_insert"
  ON public.medications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "medications_user_update" ON public.medications;
CREATE POLICY "medications_user_update"
  ON public.medications FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "medications_user_delete" ON public.medications;
CREATE POLICY "medications_user_delete"
  ON public.medications FOR DELETE
  USING (user_id = auth.uid());

-- Admin access to all medications
DROP POLICY IF EXISTS "medications_admin_all" ON public.medications;
CREATE POLICY "medications_admin_all"
  ON public.medications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver')
    )
  );

-- Medication reminders policies
DROP POLICY IF EXISTS "medication_reminders_user_all" ON public.medication_reminders;
CREATE POLICY "medication_reminders_user_all"
  ON public.medication_reminders FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "medication_reminders_admin_all" ON public.medication_reminders;
CREATE POLICY "medication_reminders_admin_all"
  ON public.medication_reminders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver')
    )
  );

-- Doses taken policies
DROP POLICY IF EXISTS "medication_doses_user_all" ON public.medication_doses_taken;
CREATE POLICY "medication_doses_user_all"
  ON public.medication_doses_taken FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "medication_doses_admin_all" ON public.medication_doses_taken;
CREATE POLICY "medication_doses_admin_all"
  ON public.medication_doses_taken FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'caregiver')
    )
  );

-- Image extractions policies
DROP POLICY IF EXISTS "medication_extractions_user_all" ON public.medication_image_extractions;
CREATE POLICY "medication_extractions_user_all"
  ON public.medication_image_extractions FOR ALL
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "medication_extractions_admin_all" ON public.medication_image_extractions;
CREATE POLICY "medication_extractions_admin_all"
  ON public.medication_image_extractions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get all active medications for a user
CREATE OR REPLACE FUNCTION public.get_active_medications(user_id_param UUID)
RETURNS SETOF public.medications
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.medications
  WHERE user_id = user_id_param
    AND status = 'active'
  ORDER BY medication_name;
END;
$$;

-- Get medication adherence rate
CREATE OR REPLACE FUNCTION public.get_medication_adherence_rate(
  user_id_param UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  medication_id UUID,
  medication_name TEXT,
  total_scheduled INTEGER,
  total_taken INTEGER,
  adherence_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.medication_name,
    COUNT(*) FILTER (WHERE mdt.scheduled_time IS NOT NULL)::INTEGER AS total_scheduled,
    COUNT(*) FILTER (WHERE mdt.status = 'taken')::INTEGER AS total_taken,
    CASE
      WHEN COUNT(*) FILTER (WHERE mdt.scheduled_time IS NOT NULL) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE mdt.status = 'taken')::NUMERIC /
               COUNT(*) FILTER (WHERE mdt.scheduled_time IS NOT NULL)::NUMERIC) * 100, 2)
      ELSE 0
    END AS adherence_rate
  FROM public.medications m
  LEFT JOIN public.medication_doses_taken mdt ON m.id = mdt.medication_id
    AND mdt.taken_at >= NOW() - (days_back || ' days')::INTERVAL
  WHERE m.user_id = user_id_param
    AND m.status = 'active'
  GROUP BY m.id, m.medication_name
  ORDER BY m.medication_name;
END;
$$;

-- Get medications needing refill soon
CREATE OR REPLACE FUNCTION public.get_medications_needing_refill(
  user_id_param UUID,
  days_threshold INTEGER DEFAULT 7
)
RETURNS SETOF public.medications
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.medications
  WHERE user_id = user_id_param
    AND status = 'active'
    AND next_refill_date IS NOT NULL
    AND next_refill_date <= CURRENT_DATE + (days_threshold || ' days')::INTERVAL
  ORDER BY next_refill_date;
END;
$$;

-- Get upcoming medication reminders
CREATE OR REPLACE FUNCTION public.get_upcoming_reminders(
  user_id_param UUID,
  hours_ahead INTEGER DEFAULT 24
)
RETURNS TABLE (
  reminder_id UUID,
  medication_id UUID,
  medication_name TEXT,
  dosage TEXT,
  instructions TEXT,
  next_reminder_at TIMESTAMPTZ,
  time_of_day TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mr.id,
    m.id,
    m.medication_name,
    m.dosage,
    m.instructions,
    mr.next_reminder_at,
    mr.time_of_day
  FROM public.medication_reminders mr
  JOIN public.medications m ON mr.medication_id = m.id
  WHERE mr.user_id = user_id_param
    AND mr.enabled = true
    AND m.status = 'active'
    AND mr.next_reminder_at <= NOW() + (hours_ahead || ' hours')::INTERVAL
  ORDER BY mr.next_reminder_at;
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_upcoming_reminders(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_medications_needing_refill(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_medication_adherence_rate(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_active_medications(UUID);
DROP FUNCTION IF EXISTS public.calculate_next_medication_reminder();
DROP FUNCTION IF EXISTS public.update_medications_updated_at();

-- Drop tables
DROP TABLE IF EXISTS public.medication_image_extractions CASCADE;
DROP TABLE IF EXISTS public.medication_doses_taken CASCADE;
DROP TABLE IF EXISTS public.medication_reminders CASCADE;
DROP TABLE IF EXISTS public.medications CASCADE;

COMMIT;
