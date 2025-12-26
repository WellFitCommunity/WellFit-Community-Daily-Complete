-- Migration: Add missing RPC functions and tables
-- Created: 2025-12-25

-- ============================================================================
-- check_in_count_last_7_days RPC function
-- ============================================================================

CREATE OR REPLACE FUNCTION check_in_count_last_7_days(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_count INTEGER;
  v_user_id UUID;
BEGIN
  -- Use provided user_id or fall back to current user
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM check_ins
  WHERE user_id = v_user_id
    AND created_at >= (NOW() - INTERVAL '7 days');

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION check_in_count_last_7_days(UUID) TO authenticated;
COMMENT ON FUNCTION check_in_count_last_7_days IS 'Returns the number of check-ins for a user in the last 7 days';

-- ============================================================================
-- provider_burnout_risk table
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_burnout_risk (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,

  -- Risk metrics
  risk_score NUMERIC(5,2) CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),

  -- Contributing factors (based on Maslach Burnout Inventory)
  workload_score NUMERIC(5,2),
  emotional_exhaustion_score NUMERIC(5,2),
  depersonalization_score NUMERIC(5,2),
  personal_accomplishment_score NUMERIC(5,2),

  -- Work metrics
  hours_worked_last_week NUMERIC(5,1),
  patient_count_last_week INTEGER,
  overtime_hours NUMERIC(5,1),
  missed_breaks_count INTEGER,

  -- AI analysis
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence NUMERIC(5,4),
  ai_recommendations JSONB DEFAULT '[]'::jsonb,

  -- Assessment tracking
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assessed_by UUID REFERENCES auth.users(id),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_burnout_risk_user_id ON provider_burnout_risk(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_burnout_risk_tenant ON provider_burnout_risk(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_burnout_risk_date ON provider_burnout_risk(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_burnout_risk_level ON provider_burnout_risk(risk_level) WHERE risk_level IN ('high', 'critical');

-- RLS
ALTER TABLE provider_burnout_risk ENABLE ROW LEVEL SECURITY;

-- Users can view their own risk assessments
CREATE POLICY "Users can view own burnout risk"
  ON provider_burnout_risk FOR SELECT
  USING (auth.uid() = user_id);

-- Admins and clinical staff can view all
CREATE POLICY "Clinical staff can view all burnout risk"
  ON provider_burnout_risk FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'clinician', 'nurse', 'provider')
    )
  );

-- Clinical staff can insert/update
CREATE POLICY "Clinical staff can manage burnout risk"
  ON provider_burnout_risk FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'clinician')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_provider_burnout_risk_updated_at
  BEFORE UPDATE ON provider_burnout_risk
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grants
GRANT SELECT ON provider_burnout_risk TO authenticated;
GRANT INSERT, UPDATE ON provider_burnout_risk TO authenticated;

COMMENT ON TABLE provider_burnout_risk IS 'Tracks burnout risk metrics for healthcare providers using validated assessment scales';
