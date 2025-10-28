-- ============================================================================
-- Patient Daily Check-Ins Table (for PatientOutreachService)
-- ============================================================================
-- Purpose: Store daily wellness check-in responses (separate from vitals check_ins)
-- This is for the discharge-to-wellness workflow
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.patient_daily_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Patient info
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_plan_id UUID, -- Can link to fhir_care_plans if needed
  discharge_plan_id UUID REFERENCES public.discharge_plans(id) ON DELETE SET NULL,

  -- Check-in details
  check_in_date DATE NOT NULL,
  check_in_method TEXT NOT NULL CHECK (check_in_method IN ('sms', 'app', 'phone_call', 'automated')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'missed', 'escalated')),

  -- Questions and responses
  questions_asked JSONB DEFAULT '[]'::jsonb,
  responses JSONB DEFAULT '{}'::jsonb,
  response_time TIMESTAMPTZ,

  -- Alert tracking
  alert_triggered BOOLEAN DEFAULT FALSE,
  alert_type TEXT,
  alert_severity TEXT CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),
  requires_follow_up BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  concern_flags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- AI analysis
  ai_analysis_summary TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_patient_daily_check_ins_patient ON public.patient_daily_check_ins(patient_id);
CREATE INDEX idx_patient_daily_check_ins_date ON public.patient_daily_check_ins(check_in_date);
CREATE INDEX idx_patient_daily_check_ins_status ON public.patient_daily_check_ins(status);
CREATE INDEX idx_patient_daily_check_ins_discharge_plan ON public.patient_daily_check_ins(discharge_plan_id) WHERE discharge_plan_id IS NOT NULL;
CREATE INDEX idx_patient_daily_check_ins_alert ON public.patient_daily_check_ins(alert_triggered) WHERE alert_triggered = TRUE;

-- Unique constraint: one check-in per patient per day
CREATE UNIQUE INDEX idx_patient_daily_check_ins_patient_date ON public.patient_daily_check_ins(patient_id, check_in_date);

-- RLS Policies
ALTER TABLE public.patient_daily_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own check-ins"
  ON public.patient_daily_check_ins FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Users can create their own check-ins"
  ON public.patient_daily_check_ins FOR INSERT
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Care team can view all check-ins"
  ON public.patient_daily_check_ins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role_code IN ('ADMIN', 'CARE_COORD', 'PHYSICIAN', 'NURSE', 'BEHAVIORAL_HEALTH')
    )
  );

CREATE POLICY "System can manage check-ins"
  ON public.patient_daily_check_ins FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Trigger for updated_at
CREATE TRIGGER update_patient_daily_check_ins_updated_at
BEFORE UPDATE ON public.patient_daily_check_ins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.patient_daily_check_ins TO authenticated;
GRANT SELECT, INSERT ON public.patient_daily_check_ins TO anon;

-- Comment
COMMENT ON TABLE public.patient_daily_check_ins IS 'Daily wellness check-in responses for discharged patients (separate from vitals check_ins table)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ patient_daily_check_ins table created successfully!';
END $$;
