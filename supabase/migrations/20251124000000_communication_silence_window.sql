-- Communication Silence Window Algorithm Tables
-- Patent Pending - WellFit Community / Envision VirtualEdge Group LLC
--
-- A novel predictive factor that detects engagement gaps indicating
-- elevated readmission risk. This proprietary algorithm monitors patient
-- communication patterns to trigger proactive interventions.
--
-- migrate:up
begin;

-- =====================================================
-- 1. COMMUNICATION SILENCE WINDOW TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.communication_silence_window (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Input metrics (communication patterns)
  days_since_last_contact integer NOT NULL DEFAULT 0,
  missed_outreach_calls integer NOT NULL DEFAULT 0,
  missed_appointments integer NOT NULL DEFAULT 0,
  unread_messages integer NOT NULL DEFAULT 0,
  days_since_last_check_in integer,
  patient_messages_sent_30_day integer,
  portal_logins_30_day integer,

  -- Calculated scores (0-100 scale)
  silence_score integer NOT NULL CHECK (silence_score BETWEEN 0 AND 100),
  risk_level text NOT NULL CHECK (risk_level IN ('normal', 'elevated', 'critical')),
  alert_triggered boolean NOT NULL DEFAULT false,

  -- Component scores for transparency (0-100 scale)
  day_score integer NOT NULL CHECK (day_score BETWEEN 0 AND 100),
  call_score integer NOT NULL CHECK (call_score BETWEEN 0 AND 100),
  appt_score integer NOT NULL CHECK (appt_score BETWEEN 0 AND 100),
  msg_score integer NOT NULL CHECK (msg_score BETWEEN 0 AND 100),

  -- Metadata
  data_confidence integer NOT NULL CHECK (data_confidence BETWEEN 0 AND 100),
  weights_applied jsonb NOT NULL DEFAULT '{
    "daysSinceContact": 0.35,
    "missedCalls": 0.25,
    "missedAppointments": 0.25,
    "unreadMessages": 0.15
  }'::jsonb,
  recommended_actions jsonb DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one assessment per patient per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_silence_window_unique_patient_day
  ON public.communication_silence_window(patient_id, assessment_date);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookup: patient + date
CREATE INDEX IF NOT EXISTS idx_silence_window_patient_date
  ON public.communication_silence_window(patient_id, assessment_date DESC);

-- Tenant isolation
CREATE INDEX IF NOT EXISTS idx_silence_window_tenant
  ON public.communication_silence_window(tenant_id);

-- Alert dashboard: find triggered alerts
CREATE INDEX IF NOT EXISTS idx_silence_window_alerts
  ON public.communication_silence_window(tenant_id, alert_triggered, risk_level)
  WHERE alert_triggered = true;

-- High-risk patient monitoring
CREATE INDEX IF NOT EXISTS idx_silence_window_critical
  ON public.communication_silence_window(tenant_id, silence_score DESC)
  WHERE risk_level IN ('elevated', 'critical');

-- Trend analysis: recent scores
CREATE INDEX IF NOT EXISTS idx_silence_window_recent
  ON public.communication_silence_window(patient_id, assessment_date DESC)
  WHERE assessment_date >= (CURRENT_DATE - INTERVAL '30 days');

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.communication_silence_window ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read/write all, patients can read own
DROP POLICY IF EXISTS "silence_window_admin_rw_patient_r" ON public.communication_silence_window;
CREATE POLICY "silence_window_admin_rw_patient_r" ON public.communication_silence_window
  USING (
    public.is_admin(auth.uid()) OR
    patient_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
  );

-- =====================================================
-- 4. UPDATED_AT TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS trg_silence_window_uat ON public.communication_silence_window;
CREATE TRIGGER trg_silence_window_uat
BEFORE UPDATE ON public.communication_silence_window
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 5. OUTREACH LOGS TABLE (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.outreach_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,

  -- Outreach details
  outreach_type text NOT NULL CHECK (outreach_type IN ('phone', 'text', 'email', 'portal', 'home_visit')),
  outcome text NOT NULL CHECK (outcome IN ('answered', 'no_answer', 'voicemail', 'callback_scheduled', 'completed')),
  notes text,

  -- Staff info
  staff_id uuid REFERENCES auth.users(id),

  -- Timestamps
  attempt_at timestamptz NOT NULL DEFAULT now(),
  callback_scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_logs_patient
  ON public.outreach_logs(patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outreach_logs_outcome
  ON public.outreach_logs(patient_id, outcome)
  WHERE outcome = 'no_answer';

ALTER TABLE public.outreach_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "outreach_logs_admin_only" ON public.outreach_logs;
CREATE POLICY "outreach_logs_admin_only" ON public.outreach_logs
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- 6. VIEWS FOR DASHBOARD
-- =====================================================

-- View: Current silence window status for all patients
CREATE OR REPLACE VIEW public.v_patient_silence_status AS
SELECT DISTINCT ON (csw.patient_id)
  csw.patient_id,
  csw.tenant_id,
  pr.first_name,
  pr.last_name,
  csw.silence_score,
  csw.risk_level,
  csw.alert_triggered,
  csw.days_since_last_contact,
  csw.missed_outreach_calls,
  csw.missed_appointments,
  csw.unread_messages,
  csw.day_score,
  csw.call_score,
  csw.appt_score,
  csw.msg_score,
  csw.data_confidence,
  csw.recommended_actions,
  csw.assessment_date,
  csw.created_at
FROM public.communication_silence_window csw
LEFT JOIN public.profiles pr ON csw.patient_id = pr.id
ORDER BY csw.patient_id, csw.assessment_date DESC;

GRANT SELECT ON public.v_patient_silence_status TO authenticated;

-- View: Critical and elevated alerts for care team dashboard
CREATE OR REPLACE VIEW public.v_silence_window_alerts AS
SELECT
  csw.patient_id,
  csw.tenant_id,
  pr.first_name,
  pr.last_name,
  csw.silence_score,
  csw.risk_level,
  csw.days_since_last_contact,
  csw.missed_appointments,
  csw.recommended_actions,
  csw.assessment_date,
  -- Calculate urgency based on risk and time
  CASE
    WHEN csw.risk_level = 'critical' AND csw.days_since_last_contact >= 7 THEN 'IMMEDIATE'
    WHEN csw.risk_level = 'critical' THEN 'URGENT'
    WHEN csw.risk_level = 'elevated' AND csw.days_since_last_contact >= 14 THEN 'URGENT'
    ELSE 'STANDARD'
  END AS urgency_level
FROM public.communication_silence_window csw
JOIN public.profiles pr ON csw.patient_id = pr.id
WHERE csw.alert_triggered = true
  AND csw.assessment_date >= (CURRENT_DATE - INTERVAL '7 days')
ORDER BY
  CASE csw.risk_level
    WHEN 'critical' THEN 1
    WHEN 'elevated' THEN 2
    ELSE 3
  END,
  csw.silence_score DESC;

GRANT SELECT ON public.v_silence_window_alerts TO authenticated;

-- =====================================================
-- 7. FUNCTIONS FOR SILENCE WINDOW
-- =====================================================

-- Function: Get patient silence window trend
CREATE OR REPLACE FUNCTION public.get_silence_window_trend(
  p_patient_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  assessment_date date,
  silence_score integer,
  risk_level text,
  alert_triggered boolean,
  day_score integer,
  call_score integer,
  appt_score integer,
  msg_score integer
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    csw.assessment_date::date,
    csw.silence_score,
    csw.risk_level,
    csw.alert_triggered,
    csw.day_score,
    csw.call_score,
    csw.appt_score,
    csw.msg_score
  FROM public.communication_silence_window csw
  WHERE csw.patient_id = p_patient_id
    AND csw.assessment_date >= (CURRENT_DATE - (p_days || ' days')::interval)
  ORDER BY csw.assessment_date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_silence_window_trend(uuid, integer) TO authenticated;

-- Function: Calculate silence window metrics from raw data
CREATE OR REPLACE FUNCTION public.calculate_silence_window_from_raw(
  p_patient_id uuid,
  p_tenant_id uuid
)
RETURNS TABLE (
  days_since_contact integer,
  missed_calls integer,
  missed_appointments integer,
  unread_messages integer,
  calculated_score integer,
  risk_level text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_last_contact date;
  v_days_since integer;
  v_missed_calls integer;
  v_missed_appts integer;
  v_unread_msgs integer;
  v_day_score integer;
  v_call_score integer;
  v_appt_score integer;
  v_msg_score integer;
  v_total_score integer;
  v_risk text;
BEGIN
  -- Get last check-in date
  SELECT MAX(created_at::date) INTO v_last_contact
  FROM public.check_ins
  WHERE user_id = p_patient_id;

  v_days_since := COALESCE(CURRENT_DATE - v_last_contact, 30);

  -- Count missed outreach calls (last 30 days)
  SELECT COUNT(*) INTO v_missed_calls
  FROM public.outreach_logs
  WHERE patient_id = p_patient_id
    AND outcome = 'no_answer'
    AND created_at >= (CURRENT_DATE - INTERVAL '30 days');

  -- Count missed appointments (last 30 days)
  SELECT COUNT(*) INTO v_missed_appts
  FROM public.encounters
  WHERE patient_id = p_patient_id
    AND status = 'no_show'
    AND date_of_service >= (CURRENT_DATE - INTERVAL '30 days');

  -- Count unread messages
  SELECT COUNT(*) INTO v_unread_msgs
  FROM public.messages
  WHERE recipient_id = p_patient_id
    AND read = false;

  -- Normalize scores (0-100)
  v_day_score := LEAST(ROUND(v_days_since::numeric / 30 * 100), 100)::integer;
  v_call_score := LEAST(ROUND(v_missed_calls::numeric / 5 * 100), 100)::integer;
  v_appt_score := LEAST(ROUND(v_missed_appts::numeric / 3 * 100), 100)::integer;
  v_msg_score := LEAST(ROUND(v_unread_msgs::numeric / 10 * 100), 100)::integer;

  -- Calculate weighted score
  v_total_score := ROUND(
    v_day_score * 0.35 +
    v_call_score * 0.25 +
    v_appt_score * 0.25 +
    v_msg_score * 0.15
  )::integer;

  -- Determine risk level
  IF v_total_score >= 70 THEN
    v_risk := 'critical';
  ELSIF v_total_score >= 40 THEN
    v_risk := 'elevated';
  ELSE
    v_risk := 'normal';
  END IF;

  RETURN QUERY SELECT
    v_days_since,
    v_missed_calls,
    v_missed_appts,
    v_unread_msgs,
    v_total_score,
    v_risk;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_silence_window_from_raw(uuid, uuid) TO authenticated;

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.communication_silence_window IS
'Communication Silence Window Algorithm - Patent Pending
Tracks patient communication patterns to detect engagement gaps that predict health decline.
Novel predictive factor for readmission risk.';

COMMENT ON COLUMN public.communication_silence_window.silence_score IS
'Overall silence window score (0-100). Higher = more concerning silence pattern.
70+ = Critical, 40-69 = Elevated, <40 = Normal';

COMMENT ON COLUMN public.communication_silence_window.alert_triggered IS
'Whether this score triggered a care team alert (score >= 40)';

COMMENT ON VIEW public.v_patient_silence_status IS
'Current silence window status for all patients. Shows most recent assessment.';

COMMENT ON VIEW public.v_silence_window_alerts IS
'Active alerts requiring care team attention. Filtered to recent elevated/critical cases.';

COMMENT ON FUNCTION public.get_silence_window_trend IS
'Get historical silence window scores for trend analysis and visualization.';

COMMENT ON FUNCTION public.calculate_silence_window_from_raw IS
'Calculate silence window metrics from raw database tables. Used for real-time scoring.';

commit;

-- migrate:down
begin;

DROP FUNCTION IF EXISTS public.calculate_silence_window_from_raw(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_silence_window_trend(uuid, integer);
DROP VIEW IF EXISTS public.v_silence_window_alerts;
DROP VIEW IF EXISTS public.v_patient_silence_status;
DROP TABLE IF EXISTS public.outreach_logs CASCADE;
DROP TABLE IF EXISTS public.communication_silence_window CASCADE;

commit;
