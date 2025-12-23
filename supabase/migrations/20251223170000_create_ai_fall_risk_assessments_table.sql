-- Migration: Create AI Fall Risk Assessments Table
-- Skill #30 - Fall Risk Predictor
-- Stores AI-generated fall risk assessments

-- Create the ai_fall_risk_assessments table
CREATE TABLE IF NOT EXISTS ai_fall_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessor_id UUID NOT NULL REFERENCES profiles(id),

  -- Assessment context
  assessment_date TIMESTAMPTZ NOT NULL,
  assessment_context TEXT NOT NULL DEFAULT 'routine' CHECK (assessment_context IN ('admission', 'routine', 'post_fall', 'discharge')),

  -- Risk scores
  overall_risk_score INTEGER NOT NULL CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
  risk_category TEXT NOT NULL CHECK (risk_category IN ('low', 'moderate', 'high', 'very_high')),
  morse_scale_estimate INTEGER CHECK (morse_scale_estimate >= 0 AND morse_scale_estimate <= 125),

  -- Patient demographics
  patient_age INTEGER,
  age_risk_category TEXT CHECK (age_risk_category IN ('low', 'moderate', 'high')),

  -- Risk analysis (JSONB)
  risk_factors JSONB DEFAULT '[]'::jsonb,
  protective_factors JSONB DEFAULT '[]'::jsonb,
  category_scores JSONB DEFAULT '{}'::jsonb,

  -- Recommendations
  interventions JSONB DEFAULT '[]'::jsonb,
  precautions TEXT[] DEFAULT '{}',
  monitoring_frequency TEXT DEFAULT 'standard' CHECK (monitoring_frequency IN ('standard', 'enhanced', 'intensive')),

  -- AI metadata
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  requires_review BOOLEAN NOT NULL DEFAULT true,
  review_reasons TEXT[] DEFAULT '{}',
  plain_language_explanation TEXT,

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_fall_risk_patient_id ON ai_fall_risk_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_fall_risk_assessor_id ON ai_fall_risk_assessments(assessor_id);
CREATE INDEX IF NOT EXISTS idx_ai_fall_risk_status ON ai_fall_risk_assessments(status);
CREATE INDEX IF NOT EXISTS idx_ai_fall_risk_score ON ai_fall_risk_assessments(overall_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_fall_risk_category ON ai_fall_risk_assessments(risk_category);
CREATE INDEX IF NOT EXISTS idx_ai_fall_risk_created_at ON ai_fall_risk_assessments(created_at DESC);

-- Enable RLS
ALTER TABLE ai_fall_risk_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "ai_fall_risk_provider_select" ON ai_fall_risk_assessments
  FOR SELECT TO authenticated
  USING (
    assessor_id = auth.uid()
    OR reviewed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_fall_risk_assessments.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

CREATE POLICY "ai_fall_risk_provider_insert" ON ai_fall_risk_assessments
  FOR INSERT TO authenticated
  WITH CHECK (
    assessor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_fall_risk_assessments.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

CREATE POLICY "ai_fall_risk_provider_update" ON ai_fall_risk_assessments
  FOR UPDATE TO authenticated
  USING (assessor_id = auth.uid() OR reviewed_by = auth.uid())
  WITH CHECK (assessor_id = auth.uid() OR reviewed_by = auth.uid());

CREATE POLICY "ai_fall_risk_admin_all" ON ai_fall_risk_assessments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_fall_risk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_fall_risk_updated_at ON ai_fall_risk_assessments;
CREATE TRIGGER trigger_ai_fall_risk_updated_at
  BEFORE UPDATE ON ai_fall_risk_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_fall_risk_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_fall_risk_assessments TO authenticated;

COMMENT ON TABLE ai_fall_risk_assessments IS 'AI-generated fall risk assessments using Morse Scale and evidence-based criteria (Skill #30)';
