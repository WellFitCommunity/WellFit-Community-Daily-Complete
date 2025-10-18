-- ============================================================================
-- Emergency Handoff Bypass System
-- ============================================================================
-- Purpose: Allow nurses to override system validation when technology fails
-- Design: Log all bypasses, flag after 3 in 7 days, full audit trail
-- Philosophy: Trust but verify - protect nurses from system bugs, detect abuse
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: BYPASS AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_handoff_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who bypassed
  nurse_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nurse_name TEXT NOT NULL, -- Snapshot at time of bypass
  nurse_email TEXT NOT NULL, -- For notification purposes

  -- When and where
  override_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'evening', 'night')),

  -- What was the issue
  pending_patients_count INTEGER NOT NULL, -- How many patients system said were unreviewed
  pending_patient_ids JSONB NOT NULL DEFAULT '[]', -- Array of patient UUIDs
  pending_patient_names TEXT[], -- Human-readable names for review

  -- Why they bypassed
  override_reason TEXT NOT NULL CHECK (override_reason IN (
    'system_glitch',
    'network_issue',
    'patient_emergency',
    'time_critical',
    'other'
  )),
  override_explanation TEXT NOT NULL, -- Required free text explanation

  -- Identity confirmation
  nurse_signature TEXT NOT NULL, -- Typed full name

  -- Technical audit
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB, -- Browser, OS, etc.

  -- Abuse tracking
  bypass_number_this_week INTEGER NOT NULL, -- "This is your Nth bypass"
  weekly_bypass_count INTEGER NOT NULL, -- Total bypasses in last 7 days (at time of override)

  -- Manager notification
  manager_notified BOOLEAN DEFAULT FALSE,
  manager_notified_at TIMESTAMPTZ,
  manager_id UUID REFERENCES auth.users(id),

  -- Resolution
  reviewed_by UUID REFERENCES auth.users(id), -- Manager who reviewed
  reviewed_at TIMESTAMPTZ,
  review_outcome TEXT CHECK (review_outcome IN ('legitimate', 'abuse', 'training_needed', 'system_bug')),
  review_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_handoff_overrides_nurse ON public.shift_handoff_overrides(nurse_id);
CREATE INDEX idx_handoff_overrides_timestamp ON public.shift_handoff_overrides(override_timestamp DESC);
CREATE INDEX idx_handoff_overrides_flagged ON public.shift_handoff_overrides(weekly_bypass_count)
  WHERE weekly_bypass_count >= 3;

-- RLS Policies
ALTER TABLE public.shift_handoff_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurses can view their own bypasses"
  ON public.shift_handoff_overrides FOR SELECT
  USING (auth.uid() = nurse_id);

CREATE POLICY "Admins and managers can view all bypasses"
  ON public.shift_handoff_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse_manager')
    )
  );

CREATE POLICY "Nurses can insert their own bypasses"
  ON public.shift_handoff_overrides FOR INSERT
  WITH CHECK (auth.uid() = nurse_id);

CREATE POLICY "Managers can update bypasses for review"
  ON public.shift_handoff_overrides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse_manager')
    )
  );

-- ============================================================================
-- PART 2: BYPASS COUNTING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_nurse_bypass_count_last_7_days(
  p_nurse_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.shift_handoff_overrides
  WHERE nurse_id = p_nurse_id
  AND override_timestamp >= NOW() - INTERVAL '7 days';

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ============================================================================
-- PART 3: LOG BYPASS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_handoff_override(
  p_shift_date DATE,
  p_shift_type TEXT,
  p_pending_count INTEGER,
  p_pending_patient_ids JSONB,
  p_pending_patient_names TEXT[],
  p_override_reason TEXT,
  p_override_explanation TEXT,
  p_nurse_signature TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nurse_id UUID;
  v_nurse_name TEXT;
  v_nurse_email TEXT;
  v_weekly_count INTEGER;
  v_bypass_id UUID;
  v_should_notify BOOLEAN := FALSE;
BEGIN
  -- Get current user
  v_nurse_id := auth.uid();
  IF v_nurse_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Get nurse info
  SELECT
    COALESCE(first_name || ' ' || last_name, 'Unknown Nurse'),
    email
  INTO v_nurse_name, v_nurse_email
  FROM profiles
  WHERE id = v_nurse_id;

  -- Get current bypass count for this week
  v_weekly_count := public.get_nurse_bypass_count_last_7_days(v_nurse_id);

  -- Check if this bypass will trigger notification (3rd one)
  IF v_weekly_count + 1 >= 3 THEN
    v_should_notify := TRUE;
  END IF;

  -- Insert bypass record
  INSERT INTO public.shift_handoff_overrides (
    nurse_id,
    nurse_name,
    nurse_email,
    shift_date,
    shift_type,
    pending_patients_count,
    pending_patient_ids,
    pending_patient_names,
    override_reason,
    override_explanation,
    nurse_signature,
    ip_address,
    user_agent,
    bypass_number_this_week,
    weekly_bypass_count,
    manager_notified
  ) VALUES (
    v_nurse_id,
    v_nurse_name,
    v_nurse_email,
    p_shift_date,
    p_shift_type,
    p_pending_count,
    p_pending_patient_ids,
    p_pending_patient_names,
    p_override_reason,
    p_override_explanation,
    p_nurse_signature,
    p_ip_address,
    p_user_agent,
    v_weekly_count + 1,
    v_weekly_count + 1,
    v_should_notify
  )
  RETURNING id INTO v_bypass_id;

  -- Return bypass info for UI display
  RETURN jsonb_build_object(
    'bypass_id', v_bypass_id,
    'bypass_number', v_weekly_count + 1,
    'weekly_total', v_weekly_count + 1,
    'should_notify_manager', v_should_notify,
    'nurse_name', v_nurse_name
  );
END;
$$;

-- ============================================================================
-- PART 4: GET FLAGGED NURSES (for admin dashboard)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_flagged_bypass_nurses()
RETURNS TABLE (
  nurse_id UUID,
  nurse_name TEXT,
  nurse_email TEXT,
  bypass_count_7_days INTEGER,
  most_recent_bypass TIMESTAMPTZ,
  manager_notified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sho.nurse_id,
    sho.nurse_name,
    sho.nurse_email,
    COUNT(*)::INTEGER AS bypass_count_7_days,
    MAX(sho.override_timestamp) AS most_recent_bypass,
    BOOL_OR(sho.manager_notified) AS manager_notified
  FROM public.shift_handoff_overrides sho
  WHERE sho.override_timestamp >= NOW() - INTERVAL '7 days'
  GROUP BY sho.nurse_id, sho.nurse_name, sho.nurse_email
  HAVING COUNT(*) >= 3
  ORDER BY bypass_count_7_days DESC, most_recent_bypass DESC;
END;
$$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.shift_handoff_overrides IS 'Audit log for emergency handoff bypasses. Tracks when nurses override system validation, logs reason, flags abuse patterns.';
COMMENT ON FUNCTION public.get_nurse_bypass_count_last_7_days IS 'Returns number of bypasses a nurse has used in the last 7 days.';
COMMENT ON FUNCTION public.log_handoff_override IS 'Logs an emergency bypass, calculates weekly count, determines if manager notification needed.';
COMMENT ON FUNCTION public.get_flagged_bypass_nurses IS 'Returns nurses with 3+ bypasses in 7 days (for manager review dashboard).';

COMMIT;
