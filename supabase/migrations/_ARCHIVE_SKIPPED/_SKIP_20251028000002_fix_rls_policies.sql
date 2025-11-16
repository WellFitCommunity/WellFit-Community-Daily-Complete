-- ============================================================================
-- Fix RLS Policies - Use role field (text) instead of role_code (integer)
-- ============================================================================

-- Fix patient_daily_check_ins policy
CREATE POLICY "Care team can view all check-ins"
  ON public.patient_daily_check_ins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
    )
  );

-- Fix wellness_enrollments policy (drop and recreate)
DROP POLICY IF EXISTS "Care team can manage wellness enrollments" ON public.wellness_enrollments;

CREATE POLICY "Care team can manage wellness enrollments"
  ON public.wellness_enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
    )
  );

-- Fix mental_health_screening_triggers policy (drop and recreate)
DROP POLICY IF EXISTS "Care team can view all screening triggers" ON public.mental_health_screening_triggers;

CREATE POLICY "Care team can view all screening triggers"
  ON public.mental_health_screening_triggers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
    )
  );

-- Now create enhanced_check_in_responses table (this failed before)
CREATE TABLE IF NOT EXISTS public.enhanced_check_in_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Relationships
  check_in_id UUID REFERENCES public.patient_daily_check_ins(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discharge_plan_id UUID REFERENCES public.discharge_plans(id) ON DELETE SET NULL,

  -- Readmission risk analysis
  readmission_risk_level TEXT CHECK (readmission_risk_level IN ('low', 'medium', 'high', 'critical')),
  readmission_risk_score INTEGER CHECK (readmission_risk_score BETWEEN 0 AND 100),
  warning_signs_detected TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Diagnosis-specific concerns
  diagnosis_category TEXT,
  diagnosis_specific_warnings JSONB DEFAULT '[]'::jsonb,

  -- AI analysis
  ai_analysis_summary TEXT,
  ai_confidence_score NUMERIC(3,2),

  -- Care team actions
  requires_immediate_intervention BOOLEAN DEFAULT FALSE,
  recommended_actions TEXT[] DEFAULT ARRAY[]::TEXT[],
  care_team_notified BOOLEAN DEFAULT FALSE,
  care_team_notification_sent_at TIMESTAMPTZ,
  care_team_responded_at TIMESTAMPTZ,
  care_team_response_notes TEXT,

  -- Mental health triggers
  mental_health_screening_triggered BOOLEAN DEFAULT FALSE,
  mental_health_screening_type TEXT CHECK (mental_health_screening_type IN ('PHQ9', 'GAD7', 'both')),
  mental_health_screening_reason TEXT,

  -- Metadata
  analysis_metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for enhanced_check_in_responses
CREATE INDEX idx_enhanced_check_in_patient ON public.enhanced_check_in_responses(patient_id);
CREATE INDEX idx_enhanced_check_in_discharge_plan ON public.enhanced_check_in_responses(discharge_plan_id);
CREATE INDEX idx_enhanced_check_in_risk ON public.enhanced_check_in_responses(readmission_risk_level);
CREATE INDEX idx_enhanced_check_in_needs_intervention ON public.enhanced_check_in_responses(requires_immediate_intervention) WHERE requires_immediate_intervention = TRUE;
CREATE INDEX idx_enhanced_check_in_mental_health_trigger ON public.enhanced_check_in_responses(mental_health_screening_triggered) WHERE mental_health_screening_triggered = TRUE;
CREATE INDEX idx_enhanced_check_in_warnings_gin ON public.enhanced_check_in_responses USING GIN(diagnosis_specific_warnings);

-- Full-text search
ALTER TABLE public.enhanced_check_in_responses
ADD COLUMN ai_analysis_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', COALESCE(ai_analysis_summary, ''))) STORED;

CREATE INDEX idx_enhanced_check_in_fts ON public.enhanced_check_in_responses USING GIN(ai_analysis_tsv);

-- RLS
ALTER TABLE public.enhanced_check_in_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own enhanced check-in responses"
  ON public.enhanced_check_in_responses FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Care team can view all enhanced check-in responses"
  ON public.enhanced_check_in_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'contractor_nurse')
    )
  );

CREATE POLICY "System can create enhanced check-in responses"
  ON public.enhanced_check_in_responses FOR INSERT
  WITH CHECK (TRUE);

-- Trigger
CREATE TRIGGER update_enhanced_check_in_responses_updated_at
BEFORE UPDATE ON public.enhanced_check_in_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Permissions
GRANT SELECT, INSERT, UPDATE ON public.enhanced_check_in_responses TO authenticated, anon;

COMMENT ON TABLE public.enhanced_check_in_responses IS 'AI-enhanced analysis of daily patient check-ins with diagnosis-specific warning detection';

-- Success
DO $$
BEGIN
  RAISE NOTICE '✅ All RLS policies fixed and enhanced_check_in_responses table created!';
END $$;
