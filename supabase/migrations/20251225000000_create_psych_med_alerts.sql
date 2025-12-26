-- Create psych_med_alerts table for tracking psychiatric medication safety alerts
-- This supports detection of multiple psych med usage, interactions, and other safety concerns

CREATE TABLE IF NOT EXISTS psych_med_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Alert classification
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'multiple_psych_meds',
    'high_dose',
    'drug_interaction',
    'contraindication',
    'duplicate_therapy',
    'elderly_caution',
    'fall_risk',
    'cognitive_impact',
    'serotonin_syndrome_risk',
    'anticholinergic_burden',
    'other'
  )),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Alert details
  title TEXT NOT NULL,
  description TEXT,
  medications JSONB DEFAULT '[]'::jsonb,  -- Array of medication names/IDs involved
  clinical_notes TEXT,
  
  -- AI analysis (if applicable)
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence NUMERIC(5,4) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  ai_reasoning TEXT,
  
  -- Resolution tracking
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  
  -- Acknowledgment (for alerts that need clinical review)
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns (from error logs)
CREATE INDEX idx_psych_med_alerts_user_id ON psych_med_alerts(user_id);
CREATE INDEX idx_psych_med_alerts_user_resolved ON psych_med_alerts(user_id, resolved);
CREATE INDEX idx_psych_med_alerts_user_type_resolved ON psych_med_alerts(user_id, alert_type, resolved);
CREATE INDEX idx_psych_med_alerts_tenant ON psych_med_alerts(tenant_id);
CREATE INDEX idx_psych_med_alerts_severity ON psych_med_alerts(severity) WHERE resolved = false;
CREATE INDEX idx_psych_med_alerts_created ON psych_med_alerts(created_at DESC);

-- RLS policies
ALTER TABLE psych_med_alerts ENABLE ROW LEVEL SECURITY;

-- Users can view their own alerts
CREATE POLICY "Users can view own psych med alerts"
  ON psych_med_alerts FOR SELECT
  USING (auth.uid() = user_id);

-- Clinical staff and admins can view all alerts
CREATE POLICY "Clinical staff can view all psych med alerts"
  ON psych_med_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'clinician', 'nurse', 'provider')
    )
  );

-- Clinical staff can insert alerts
CREATE POLICY "Clinical staff can create psych med alerts"
  ON psych_med_alerts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'clinician', 'nurse', 'provider')
    )
  );

-- Clinical staff can update alerts (resolve/acknowledge)
CREATE POLICY "Clinical staff can update psych med alerts"
  ON psych_med_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'staff', 'clinician', 'nurse', 'provider')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_psych_med_alerts_updated_at
  BEFORE UPDATE ON psych_med_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON psych_med_alerts TO authenticated;
GRANT INSERT, UPDATE ON psych_med_alerts TO authenticated;

COMMENT ON TABLE psych_med_alerts IS 'Tracks psychiatric medication safety alerts including multiple med usage, interactions, and other clinical concerns';
