-- ============================================================================
-- SMART SHIFT HANDOFF RISK PRIORITIZATION SYSTEM
-- ============================================================================
-- Purpose: AI-assisted nurse handoff with auto-scoring + human oversight
-- Use Case: Prioritize which hospital patients to see first during rounds
-- Design: System does 80% (auto-score), nurse does 20% (confirm/adjust)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: SHIFT HANDOFF RISK SCORES (Auto-calculated + Nurse-adjusted)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_handoff_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient identification
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_id UUID, -- FK to patient_admissions if that table exists

  -- Shift metadata
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('day', 'evening', 'night')),
  scoring_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Auto-calculated risk scores (0-100)
  auto_medical_acuity_score INTEGER CHECK (auto_medical_acuity_score BETWEEN 0 AND 100),
  auto_stability_score INTEGER CHECK (auto_stability_score BETWEEN 0 AND 100),
  auto_early_warning_score INTEGER CHECK (auto_early_warning_score BETWEEN 0 AND 100), -- MEWS/NEWS
  auto_event_risk_score INTEGER CHECK (auto_event_risk_score BETWEEN 0 AND 100),

  -- Composite auto score (weighted average)
  auto_composite_score INTEGER GENERATED ALWAYS AS (
    ROUND((
      COALESCE(auto_medical_acuity_score, 0) * 0.30 +
      COALESCE(auto_stability_score, 0) * 0.25 +
      COALESCE(auto_early_warning_score, 0) * 0.30 +
      COALESCE(auto_event_risk_score, 0) * 0.15
    ))
  ) STORED,

  -- Auto risk level (before nurse review)
  auto_risk_level TEXT GENERATED ALWAYS AS (
    CASE
      WHEN (
        COALESCE(auto_medical_acuity_score, 0) * 0.30 +
        COALESCE(auto_stability_score, 0) * 0.25 +
        COALESCE(auto_early_warning_score, 0) * 0.30 +
        COALESCE(auto_event_risk_score, 0) * 0.15
      ) >= 75 THEN 'CRITICAL'
      WHEN (
        COALESCE(auto_medical_acuity_score, 0) * 0.30 +
        COALESCE(auto_stability_score, 0) * 0.25 +
        COALESCE(auto_early_warning_score, 0) * 0.30 +
        COALESCE(auto_event_risk_score, 0) * 0.15
      ) >= 50 THEN 'HIGH'
      WHEN (
        COALESCE(auto_medical_acuity_score, 0) * 0.30 +
        COALESCE(auto_stability_score, 0) * 0.25 +
        COALESCE(auto_early_warning_score, 0) * 0.30 +
        COALESCE(auto_event_risk_score, 0) * 0.15
      ) >= 25 THEN 'MEDIUM'
      ELSE 'LOW'
    END
  ) STORED,

  -- Nurse review (human oversight)
  nurse_reviewed BOOLEAN DEFAULT FALSE,
  nurse_id UUID REFERENCES auth.users(id), -- Nurse who reviewed
  nurse_reviewed_at TIMESTAMPTZ,

  -- Nurse-adjusted risk level (overrides auto if set)
  nurse_risk_level TEXT CHECK (nurse_risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  nurse_adjustment_reason TEXT, -- Optional: why nurse changed it

  -- Final risk level (nurse override wins, else auto)
  final_risk_level TEXT GENERATED ALWAYS AS (
    COALESCE(nurse_risk_level,
      CASE
        WHEN (
          COALESCE(auto_medical_acuity_score, 0) * 0.30 +
          COALESCE(auto_stability_score, 0) * 0.25 +
          COALESCE(auto_early_warning_score, 0) * 0.30 +
          COALESCE(auto_event_risk_score, 0) * 0.15
        ) >= 75 THEN 'CRITICAL'
        WHEN (
          COALESCE(auto_medical_acuity_score, 0) * 0.30 +
          COALESCE(auto_stability_score, 0) * 0.25 +
          COALESCE(auto_early_warning_score, 0) * 0.30 +
          COALESCE(auto_event_risk_score, 0) * 0.15
        ) >= 50 THEN 'HIGH'
        WHEN (
          COALESCE(auto_medical_acuity_score, 0) * 0.30 +
          COALESCE(auto_stability_score, 0) * 0.25 +
          COALESCE(auto_early_warning_score, 0) * 0.30 +
          COALESCE(auto_event_risk_score, 0) * 0.15
        ) >= 25 THEN 'MEDIUM'
        ELSE 'LOW'
      END
    )
  ) STORED,

  -- Risk factors detected (array of flags)
  risk_factors TEXT[] DEFAULT '{}',
  -- Examples: 'unstable_vitals', 'neuro_changes', 'post_cardiac_arrest', 'sepsis_risk', 'fall_risk'

  -- Key clinical data snapshot (for handoff report)
  clinical_snapshot JSONB DEFAULT '{}',
  -- Example: {
  --   "bp_trend": "190/110 → 170/95 (improving)",
  --   "o2_sat": "94% on 2L",
  --   "recent_events": ["Confused at 1900", "Family reports agitation"],
  --   "prn_meds_today": 3,
  --   "last_assessment": "2 hours ago"
  -- }

  -- Handoff priority (1 = see first, higher = can wait)
  handoff_priority INTEGER,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_handoff_risk_patient ON public.shift_handoff_risk_scores(patient_id);
CREATE INDEX idx_handoff_risk_shift ON public.shift_handoff_risk_scores(shift_date DESC, shift_type);
CREATE INDEX idx_handoff_risk_final_level ON public.shift_handoff_risk_scores(final_risk_level);
CREATE INDEX idx_handoff_risk_priority ON public.shift_handoff_risk_scores(handoff_priority);
CREATE INDEX idx_handoff_risk_nurse_review ON public.shift_handoff_risk_scores(nurse_reviewed) WHERE nurse_reviewed = FALSE;

-- Updated at trigger
DROP TRIGGER IF EXISTS trg_handoff_risk_uat ON public.shift_handoff_risk_scores;
CREATE TRIGGER trg_handoff_risk_uat
BEFORE UPDATE ON public.shift_handoff_risk_scores
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies
ALTER TABLE public.shift_handoff_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurses and admins can view handoff scores"
  ON public.shift_handoff_risk_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager')
    )
  );

CREATE POLICY "Nurses and admins can insert handoff scores"
  ON public.shift_handoff_risk_scores FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse')
    )
  );

CREATE POLICY "Nurses can update handoff scores"
  ON public.shift_handoff_risk_scores FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- ============================================================================
-- PART 2: SHIFT HANDOFF EVENTS (What happened this shift)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shift_handoff_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  risk_score_id UUID NOT NULL REFERENCES public.shift_handoff_risk_scores(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event metadata
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'vital_change', 'medication_given', 'prn_administered', 'lab_result',
    'imaging_ordered', 'code_blue', 'rapid_response', 'fall',
    'neuro_change', 'behavioral_issue', 'family_concern', 'other'
  )),

  -- Event details
  event_severity TEXT NOT NULL CHECK (event_severity IN ('minor', 'moderate', 'major', 'critical')),
  event_description TEXT NOT NULL,

  -- Impact on risk score
  increases_risk BOOLEAN DEFAULT TRUE,
  risk_weight INTEGER DEFAULT 10, -- How much this event impacts the score (0-100)

  -- Response taken
  action_taken TEXT,
  action_by UUID REFERENCES auth.users(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL DEFAULT auth.uid()
);

CREATE INDEX idx_handoff_events_risk_score ON public.shift_handoff_events(risk_score_id);
CREATE INDEX idx_handoff_events_patient ON public.shift_handoff_events(patient_id);
CREATE INDEX idx_handoff_events_time ON public.shift_handoff_events(event_time DESC);
CREATE INDEX idx_handoff_events_type ON public.shift_handoff_events(event_type);

ALTER TABLE public.shift_handoff_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nurses and admins can view handoff events"
  ON public.shift_handoff_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager')
    )
  );

CREATE POLICY "Nurses can create handoff events"
  ON public.shift_handoff_events FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get current shift handoff summary
CREATE OR REPLACE FUNCTION public.get_current_shift_handoff(
  p_shift_type TEXT DEFAULT 'night'
)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  final_risk_level TEXT,
  auto_risk_level TEXT,
  nurse_reviewed BOOLEAN,
  nurse_adjusted BOOLEAN,
  handoff_priority INTEGER,
  risk_factors TEXT[],
  clinical_snapshot JSONB,
  recent_events JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hrs.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown Patient') AS patient_name,
    p.room_number::TEXT,
    hrs.final_risk_level,
    hrs.auto_risk_level,
    hrs.nurse_reviewed, -- TRUE if nurse confirmed OR adjusted
    (hrs.nurse_risk_level IS NOT NULL) AS nurse_adjusted, -- TRUE only if nurse changed the score
    hrs.handoff_priority,
    hrs.risk_factors,
    hrs.clinical_snapshot,

    -- Get recent events for this patient (last 8 hours)
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'event_time', she.event_time,
          'event_type', she.event_type,
          'event_severity', she.event_severity,
          'event_description', she.event_description,
          'action_taken', she.action_taken
        ) ORDER BY she.event_time DESC
      )
      FROM public.shift_handoff_events she
      WHERE she.patient_id = hrs.patient_id
      AND she.event_time >= NOW() - INTERVAL '8 hours'
      LIMIT 10
    ) AS recent_events

  FROM public.shift_handoff_risk_scores hrs
  LEFT JOIN public.profiles p ON p.id = hrs.patient_id
  WHERE hrs.shift_date = CURRENT_DATE
  AND hrs.shift_type = p_shift_type
  ORDER BY
    CASE hrs.final_risk_level
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      ELSE 5
    END,
    hrs.handoff_priority NULLS LAST,
    hrs.auto_composite_score DESC;
END;
$$;

-- Function: Nurse quick review (one-click confirm/adjust)
CREATE OR REPLACE FUNCTION public.nurse_review_handoff_risk(
  p_risk_score_id UUID,
  p_nurse_risk_level TEXT DEFAULT NULL, -- NULL = confirm auto, else override
  p_adjustment_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nurse_id UUID;
BEGIN
  -- Get current user (must be a nurse)
  v_nurse_id := auth.uid();

  -- Update the risk score with nurse review
  UPDATE public.shift_handoff_risk_scores
  SET
    nurse_reviewed = TRUE,
    nurse_id = v_nurse_id,
    nurse_reviewed_at = NOW(),
    nurse_risk_level = p_nurse_risk_level,
    nurse_adjustment_reason = p_adjustment_reason,
    updated_at = NOW()
  WHERE id = p_risk_score_id;

  RETURN FOUND;
END;
$$;

-- Function: Auto-calculate early warning score (MEWS/NEWS simplified)
CREATE OR REPLACE FUNCTION public.calculate_early_warning_score(
  p_systolic_bp INTEGER,
  p_heart_rate INTEGER,
  p_respiratory_rate INTEGER,
  p_temperature DECIMAL,
  p_oxygen_sat INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INTEGER := 0;
BEGIN
  -- Systolic BP score
  IF p_systolic_bp < 90 THEN v_score := v_score + 3;
  ELSIF p_systolic_bp BETWEEN 90 AND 100 THEN v_score := v_score + 2;
  ELSIF p_systolic_bp BETWEEN 101 AND 110 THEN v_score := v_score + 1;
  ELSIF p_systolic_bp BETWEEN 200 AND 220 THEN v_score := v_score + 1;
  ELSIF p_systolic_bp > 220 THEN v_score := v_score + 3;
  END IF;

  -- Heart rate score
  IF p_heart_rate < 40 THEN v_score := v_score + 3;
  ELSIF p_heart_rate BETWEEN 40 AND 50 THEN v_score := v_score + 1;
  ELSIF p_heart_rate BETWEEN 100 AND 110 THEN v_score := v_score + 1;
  ELSIF p_heart_rate BETWEEN 111 AND 130 THEN v_score := v_score + 2;
  ELSIF p_heart_rate > 130 THEN v_score := v_score + 3;
  END IF;

  -- Respiratory rate score
  IF p_respiratory_rate < 9 THEN v_score := v_score + 3;
  ELSIF p_respiratory_rate BETWEEN 9 AND 11 THEN v_score := v_score + 1;
  ELSIF p_respiratory_rate BETWEEN 21 AND 24 THEN v_score := v_score + 2;
  ELSIF p_respiratory_rate > 24 THEN v_score := v_score + 3;
  END IF;

  -- Temperature score
  IF p_temperature < 35.0 THEN v_score := v_score + 3;
  ELSIF p_temperature BETWEEN 35.0 AND 36.0 THEN v_score := v_score + 1;
  ELSIF p_temperature BETWEEN 38.1 AND 39.0 THEN v_score := v_score + 1;
  ELSIF p_temperature > 39.0 THEN v_score := v_score + 2;
  END IF;

  -- O2 saturation score
  IF p_oxygen_sat < 92 THEN v_score := v_score + 3;
  ELSIF p_oxygen_sat BETWEEN 92 AND 94 THEN v_score := v_score + 2;
  ELSIF p_oxygen_sat BETWEEN 94 AND 96 THEN v_score := v_score + 1;
  END IF;

  -- Normalize to 0-100 scale (MEWS typically 0-14)
  RETURN LEAST(100, (v_score * 7));
END;
$$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.shift_handoff_risk_scores IS 'AI-assisted shift handoff risk prioritization. System auto-scores patients, nurses review/adjust in 30 seconds.';
COMMENT ON TABLE public.shift_handoff_events IS 'Clinical events during shift (vitals, meds, codes) that impact handoff risk score.';
COMMENT ON FUNCTION public.get_current_shift_handoff IS 'Returns prioritized handoff list for incoming nurse (CRITICAL → HIGH → MEDIUM → LOW).';
COMMENT ON FUNCTION public.nurse_review_handoff_risk IS 'One-click nurse review: confirm auto-score or override with human judgment.';
COMMENT ON FUNCTION public.calculate_early_warning_score IS 'Modified Early Warning Score (MEWS) calculator based on vitals.';

COMMIT;
