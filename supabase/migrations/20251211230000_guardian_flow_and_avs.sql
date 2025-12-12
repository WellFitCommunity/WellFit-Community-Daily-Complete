-- ============================================================================
-- Migration: Guardian Flow Engine + Patient-Friendly AVS Tables
-- Date: 2025-12-11
-- Purpose: Add tables for ED crowding prediction and patient-friendly AVS
-- Part of: P1 AI/ML Scale Optimization
-- ============================================================================

-- ============================================================================
-- PART 1: ED CROWDING PREDICTIONS (Guardian Flow Engine)
-- ============================================================================

-- ED Crowding Predictions - stores predictions for accuracy tracking
CREATE TABLE IF NOT EXISTS ed_crowding_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,

  -- Prediction metadata
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prediction_horizon_hours INTEGER NOT NULL CHECK (prediction_horizon_hours IN (1, 4, 8)),

  -- Predicted values
  predicted_census INTEGER NOT NULL,
  predicted_boarding_hours DECIMAL(5,2),
  crowding_level TEXT NOT NULL CHECK (crowding_level IN ('green', 'yellow', 'orange', 'red')),
  confidence DECIMAL(3,2) CHECK (confidence BETWEEN 0 AND 1),

  -- Factors used (for transparency and debugging)
  factors_json JSONB,

  -- Actual values (filled in later for accuracy tracking)
  actual_census INTEGER,
  actual_boarding_hours DECIMAL(5,2),
  actual_crowding_level TEXT CHECK (actual_crowding_level IN ('green', 'yellow', 'orange', 'red')),

  -- Calculated accuracy (generated when actuals are recorded)
  prediction_accuracy DECIMAL(5,2),
  census_error INTEGER GENERATED ALWAYS AS (
    CASE WHEN actual_census IS NOT NULL THEN actual_census - predicted_census ELSE NULL END
  ) STORED,

  -- Timestamps
  actuals_recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ED crowding predictions
CREATE INDEX IF NOT EXISTS idx_ed_crowding_predictions_tenant
  ON ed_crowding_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ed_crowding_predictions_facility
  ON ed_crowding_predictions(facility_id);
CREATE INDEX IF NOT EXISTS idx_ed_crowding_predictions_predicted_at
  ON ed_crowding_predictions(predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ed_crowding_predictions_horizon
  ON ed_crowding_predictions(prediction_horizon_hours);

-- RLS for ED crowding predictions
ALTER TABLE ed_crowding_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ed_crowding_predictions_tenant_isolation ON ed_crowding_predictions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 2: STAFF WORKLOAD SNAPSHOTS (for load balancing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staff_workload_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES hospital_units(id) ON DELETE SET NULL,

  -- Snapshot data
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  patient_count INTEGER NOT NULL DEFAULT 0,
  total_acuity_score DECIMAL(5,2) DEFAULT 0,
  pending_tasks INTEGER DEFAULT 0,
  estimated_workload_score INTEGER CHECK (estimated_workload_score BETWEEN 0 AND 100),
  shift_hours_remaining DECIMAL(4,2),

  -- Role context
  role TEXT CHECK (role IN ('rn', 'lpn', 'tech', 'provider', 'charge')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for staff workload snapshots
CREATE INDEX IF NOT EXISTS idx_staff_workload_tenant
  ON staff_workload_snapshots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_workload_staff
  ON staff_workload_snapshots(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_workload_time
  ON staff_workload_snapshots(snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_staff_workload_unit
  ON staff_workload_snapshots(unit_id);

-- RLS for staff workload snapshots
ALTER TABLE staff_workload_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_workload_snapshots_tenant_isolation ON staff_workload_snapshots
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 3: PATIENT-FRIENDLY AVS RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS patient_friendly_avs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Source reference
  session_id UUID REFERENCES scribe_sessions(id) ON DELETE SET NULL,
  encounter_id UUID,
  visit_date DATE NOT NULL,

  -- Generation metadata
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Content (full AVS as JSON)
  content_json JSONB NOT NULL,

  -- Plain text version for printing
  plain_text_content TEXT,

  -- Quality metrics
  reading_grade_level DECIMAL(3,1) NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es')),
  ai_confidence DECIMAL(3,2) CHECK (ai_confidence BETWEEN 0 AND 1),

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'delivered', 'archived')),

  -- Delivery tracking
  delivery_method TEXT CHECK (delivery_method IN ('print', 'email', 'portal', 'sms')),
  delivered_at TIMESTAMPTZ,

  -- Patient feedback
  patient_feedback TEXT CHECK (patient_feedback IN ('helpful', 'confusing', 'incomplete')),
  feedback_notes TEXT,
  feedback_recorded_at TIMESTAMPTZ,

  -- AI processing metadata
  tokens_used INTEGER,
  processing_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for patient-friendly AVS
CREATE INDEX IF NOT EXISTS idx_patient_avs_tenant
  ON patient_friendly_avs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_avs_patient
  ON patient_friendly_avs(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_avs_session
  ON patient_friendly_avs(session_id);
CREATE INDEX IF NOT EXISTS idx_patient_avs_visit_date
  ON patient_friendly_avs(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_patient_avs_status
  ON patient_friendly_avs(status);
CREATE INDEX IF NOT EXISTS idx_patient_avs_generated_at
  ON patient_friendly_avs(generated_at DESC);

-- RLS for patient-friendly AVS
ALTER TABLE patient_friendly_avs ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_friendly_avs_tenant_isolation ON patient_friendly_avs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_patient_avs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_avs_updated_at_trigger
  BEFORE UPDATE ON patient_friendly_avs
  FOR EACH ROW
  EXECUTE FUNCTION update_patient_avs_updated_at();

-- ============================================================================
-- PART 4: GUARDIAN FLOW CONFIG (per-facility configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS guardian_flow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,

  -- Crowding thresholds (percentage of capacity)
  yellow_threshold INTEGER NOT NULL DEFAULT 70,
  orange_threshold INTEGER NOT NULL DEFAULT 85,
  red_threshold INTEGER NOT NULL DEFAULT 95,

  -- Boarding thresholds (hours)
  boarding_hours_threshold DECIMAL(4,2) NOT NULL DEFAULT 4.0,

  -- Feature flags
  auto_surge_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_diversion_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Diversion policy
  default_diversion_policy TEXT NOT NULL DEFAULT 'moderate'
    CHECK (default_diversion_policy IN ('conservative', 'moderate', 'aggressive')),

  -- Historical data window
  historical_window_hours INTEGER NOT NULL DEFAULT 168, -- 7 days

  -- Active/inactive
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One config per facility (or tenant-wide if facility_id is null)
  UNIQUE NULLS NOT DISTINCT (tenant_id, facility_id)
);

-- RLS for guardian flow config
ALTER TABLE guardian_flow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY guardian_flow_config_tenant_isolation ON guardian_flow_config
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 5: HELPER FUNCTIONS
-- ============================================================================

-- Function to get current ED census (if not already exists)
CREATE OR REPLACE FUNCTION get_ed_census(p_facility_id UUID DEFAULT NULL)
RETURNS TABLE (
  census INTEGER,
  boarding INTEGER,
  capacity INTEGER,
  occupancy_pct DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(ba.id)::INTEGER AS census,
    COUNT(ba.id) FILTER (WHERE ba.discharge_disposition = 'admit_pending')::INTEGER AS boarding,
    COALESCE(hu.total_beds, 50)::INTEGER AS capacity,
    ROUND((COUNT(ba.id)::DECIMAL / NULLIF(hu.total_beds, 0)) * 100, 2) AS occupancy_pct
  FROM bed_assignments ba
  JOIN beds b ON ba.bed_id = b.id
  JOIN hospital_units hu ON b.unit_id = hu.id
  WHERE hu.unit_type = 'ed'
    AND ba.is_active = true
    AND (p_facility_id IS NULL OR hu.facility_id = p_facility_id)
  GROUP BY hu.total_beds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record actual values for a prediction
CREATE OR REPLACE FUNCTION record_prediction_actuals(
  p_prediction_id UUID,
  p_actual_census INTEGER,
  p_actual_boarding_hours DECIMAL
)
RETURNS VOID AS $$
DECLARE
  v_predicted_census INTEGER;
  v_accuracy DECIMAL;
BEGIN
  -- Get predicted census
  SELECT predicted_census INTO v_predicted_census
  FROM ed_crowding_predictions
  WHERE id = p_prediction_id;

  -- Calculate accuracy (100 - absolute percentage error)
  IF v_predicted_census > 0 THEN
    v_accuracy := 100 - (ABS(p_actual_census - v_predicted_census)::DECIMAL / v_predicted_census * 100);
    v_accuracy := GREATEST(0, v_accuracy);
  ELSE
    v_accuracy := CASE WHEN p_actual_census = 0 THEN 100 ELSE 0 END;
  END IF;

  -- Update record
  UPDATE ed_crowding_predictions
  SET
    actual_census = p_actual_census,
    actual_boarding_hours = p_actual_boarding_hours,
    prediction_accuracy = v_accuracy,
    actuals_recorded_at = NOW()
  WHERE id = p_prediction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ed_crowding_predictions IS 'Stores ED crowding predictions for the Guardian Flow Engine with accuracy tracking';
COMMENT ON TABLE staff_workload_snapshots IS 'Point-in-time snapshots of staff workload for load balancing';
COMMENT ON TABLE patient_friendly_avs IS 'Patient-friendly After Visit Summaries generated from clinical documentation';
COMMENT ON TABLE guardian_flow_config IS 'Per-facility configuration for Guardian Flow Engine thresholds and policies';

COMMENT ON COLUMN ed_crowding_predictions.factors_json IS 'JSON containing all factors used in prediction for transparency';
COMMENT ON COLUMN ed_crowding_predictions.prediction_accuracy IS 'Calculated accuracy when actuals are recorded (100 - APE)';
COMMENT ON COLUMN patient_friendly_avs.reading_grade_level IS 'Flesch-Kincaid grade level achieved (target: 6.0 or lower)';
COMMENT ON COLUMN patient_friendly_avs.content_json IS 'Full AVS content as JSON (PatientFriendlyAVS type)';
