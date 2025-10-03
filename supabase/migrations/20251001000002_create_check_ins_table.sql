-- Create or update check_ins table for daily wellness check-ins
-- This table stores user check-ins with vitals and emotional state
-- Date: 2025-10-01

-- Create check_ins table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.check_ins (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  label text NOT NULL,
  notes text,
  is_emergency boolean DEFAULT false NOT NULL,

  -- Health metrics
  emotional_state text,
  heart_rate integer CHECK (heart_rate > 0 AND heart_rate < 300),
  pulse_oximeter integer CHECK (pulse_oximeter >= 0 AND pulse_oximeter <= 100),
  bp_systolic integer CHECK (bp_systolic > 0 AND bp_systolic < 300),
  bp_diastolic integer CHECK (bp_diastolic > 0 AND bp_diastolic < 200),
  glucose_mg_dl integer CHECK (glucose_mg_dl > 0 AND glucose_mg_dl < 1000),

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'reviewed_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.check_ins ADD COLUMN reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'reviewed_by_name' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.check_ins ADD COLUMN reviewed_by_name text;
  END IF;
END$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON public.check_ins (user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_timestamp ON public.check_ins (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON public.check_ins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_emergency ON public.check_ins (is_emergency) WHERE is_emergency = true;

-- Create index for reviewed_at only if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'reviewed_at' AND table_schema = 'public'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_check_ins_reviewed_at ON public.check_ins (reviewed_at) WHERE reviewed_at IS NOT NULL;
  END IF;
END$$;

-- Enable RLS
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "check_ins_select_own" ON public.check_ins;
CREATE POLICY "check_ins_select_own"
ON public.check_ins FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "check_ins_insert_own" ON public.check_ins;
CREATE POLICY "check_ins_insert_own"
ON public.check_ins FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "check_ins_admin_all" ON public.check_ins;
CREATE POLICY "check_ins_admin_all"
ON public.check_ins FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'staff', 'nurse')
  )
);

-- Caregiver access policy
DROP POLICY IF EXISTS "check_ins_caregiver_view" ON public.check_ins;
CREATE POLICY "check_ins_caregiver_view"
ON public.check_ins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.caregiver_view_grants cvg
    WHERE cvg.senior_user_id = check_ins.user_id
    AND cvg.caregiver_user_id = auth.uid()
    AND cvg.expires_at > now()
  )
);

COMMENT ON TABLE public.check_ins IS 'Daily wellness check-ins with vitals and emotional state tracking';
COMMENT ON COLUMN public.check_ins.label IS 'Check-in type label (e.g., "Feeling Great Today", "Not Feeling My Best")';
COMMENT ON COLUMN public.check_ins.is_emergency IS 'Indicates if this check-in triggered emergency protocols';
COMMENT ON COLUMN public.check_ins.reviewed_at IS 'Timestamp when care team reviewed this check-in';
COMMENT ON COLUMN public.check_ins.reviewed_by_name IS 'Name of care team member who reviewed';
