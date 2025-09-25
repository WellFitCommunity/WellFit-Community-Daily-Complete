-- Create check_ins table with PHI encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create check_ins table with encrypted columns
CREATE TABLE IF NOT EXISTS public.check_ins (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp timestamptz DEFAULT now() NOT NULL,
  label text NOT NULL,
  is_emergency boolean DEFAULT false NOT NULL,

  -- Original columns (will be cleared by trigger after encryption)
  emotional_state text,
  heart_rate integer CHECK (heart_rate > 0 AND heart_rate < 300),
  pulse_oximeter integer CHECK (pulse_oximeter >= 0 AND pulse_oximeter <= 100),
  bp_systolic integer CHECK (bp_systolic > 0 AND bp_systolic < 300),
  bp_diastolic integer CHECK (bp_diastolic > 0 AND bp_diastolic < 200),
  glucose_mg_dl integer CHECK (glucose_mg_dl > 0 AND glucose_mg_dl < 1000),

  -- Encrypted columns (where actual data is stored)
  emotional_state_encrypted text,
  heart_rate_encrypted text,
  pulse_oximeter_encrypted text,
  bp_systolic_encrypted text,
  bp_diastolic_encrypted text,
  glucose_mg_dl_encrypted text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON public.check_ins (user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_timestamp ON public.check_ins (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON public.check_ins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_emergency ON public.check_ins (is_emergency) WHERE is_emergency = true;

-- Enable RLS
ALTER TABLE public.check_ins ENABLE row level security;

-- Create RLS policies for check_ins
CREATE POLICY "check_ins_select_own"
ON public.check_ins
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "check_ins_insert_own"
ON public.check_ins
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin can see all check-ins
CREATE POLICY "check_ins_admin_all"
ON public.check_ins
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role_code IN (1, 2, 3) -- admin, super_admin, staff
  )
);