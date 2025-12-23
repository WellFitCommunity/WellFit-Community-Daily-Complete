-- Migration: Create AI Contraindication Checks Table
-- Skill #25 - Contraindication Detector
-- Stores AI-generated contraindication check results for medication safety

-- Create the ai_contraindication_checks table
CREATE TABLE IF NOT EXISTS ai_contraindication_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id),

  -- Medication being checked
  medication_rxcui TEXT,
  medication_name TEXT NOT NULL,
  indication TEXT,
  proposed_dosage TEXT,

  -- Analysis results
  overall_assessment TEXT NOT NULL CHECK (overall_assessment IN ('safe', 'caution', 'warning', 'contraindicated')),
  requires_clinical_review BOOLEAN NOT NULL DEFAULT true,
  review_reasons TEXT[] DEFAULT '{}',

  -- Findings (JSONB for flexibility)
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings_summary JSONB DEFAULT '{}'::jsonb,

  -- Patient context snapshot (for audit trail)
  patient_context JSONB NOT NULL,

  -- AI metadata
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  clinical_summary TEXT NOT NULL,
  model_used TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',

  -- Review workflow
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_decision TEXT CHECK (review_decision IN ('approved', 'rejected', 'modified')),
  review_notes TEXT,

  -- Multi-tenant support
  tenant_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_patient_id ON ai_contraindication_checks(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_provider_id ON ai_contraindication_checks(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_medication ON ai_contraindication_checks(medication_name);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_assessment ON ai_contraindication_checks(overall_assessment);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_created_at ON ai_contraindication_checks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_rxcui ON ai_contraindication_checks(medication_rxcui);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_review ON ai_contraindication_checks(review_decision);
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_tenant_id ON ai_contraindication_checks(tenant_id);

-- GIN index for JSONB findings search
CREATE INDEX IF NOT EXISTS idx_ai_contraindication_checks_findings ON ai_contraindication_checks USING GIN (findings);

-- Enable RLS
ALTER TABLE ai_contraindication_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Providers can view checks they requested or for patients they have access to
CREATE POLICY "ai_contraindication_checks_provider_select" ON ai_contraindication_checks
  FOR SELECT
  TO authenticated
  USING (
    provider_id = auth.uid()
    OR reviewed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_contraindication_checks.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

-- Providers can insert checks for their patients
CREATE POLICY "ai_contraindication_checks_provider_insert" ON ai_contraindication_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_contraindication_checks.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

-- Providers can update checks they created or are reviewing
CREATE POLICY "ai_contraindication_checks_provider_update" ON ai_contraindication_checks
  FOR UPDATE
  TO authenticated
  USING (
    provider_id = auth.uid()
    OR reviewed_by = auth.uid()
  )
  WITH CHECK (
    provider_id = auth.uid()
    OR reviewed_by = auth.uid()
  );

-- Admins have full access
CREATE POLICY "ai_contraindication_checks_admin_all" ON ai_contraindication_checks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_contraindication_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_contraindication_checks_updated_at ON ai_contraindication_checks;
CREATE TRIGGER trigger_ai_contraindication_checks_updated_at
  BEFORE UPDATE ON ai_contraindication_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_contraindication_checks_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_contraindication_checks TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE ai_contraindication_checks IS 'AI-generated contraindication check results for medication safety (Skill #25)';
