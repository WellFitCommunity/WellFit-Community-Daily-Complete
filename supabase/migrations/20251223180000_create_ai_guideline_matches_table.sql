-- Migration: Create AI Guideline Matches Table
-- Skill #24 - Clinical Guideline Matcher
-- Stores AI-generated clinical guideline matches and adherence gaps

-- Create the ai_guideline_matches table
CREATE TABLE IF NOT EXISTS ai_guideline_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Match results (JSONB for flexibility)
  matched_guidelines JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  adherence_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  preventive_screenings JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Summary statistics
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI metadata
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  review_reasons TEXT[] DEFAULT '{}',
  disclaimer TEXT,

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Audit
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_guideline_matches_patient_id ON ai_guideline_matches(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_guideline_matches_status ON ai_guideline_matches(status);
CREATE INDEX IF NOT EXISTS idx_ai_guideline_matches_created_at ON ai_guideline_matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_guideline_matches_created_by ON ai_guideline_matches(created_by);

-- Enable RLS
ALTER TABLE ai_guideline_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "ai_guideline_matches_provider_select" ON ai_guideline_matches
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR reviewed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_guideline_matches.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

CREATE POLICY "ai_guideline_matches_provider_insert" ON ai_guideline_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_guideline_matches.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

CREATE POLICY "ai_guideline_matches_provider_update" ON ai_guideline_matches
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR reviewed_by = auth.uid())
  WITH CHECK (created_by = auth.uid() OR reviewed_by = auth.uid());

CREATE POLICY "ai_guideline_matches_admin_all" ON ai_guideline_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_guideline_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_guideline_matches_updated_at ON ai_guideline_matches;
CREATE TRIGGER trigger_ai_guideline_matches_updated_at
  BEFORE UPDATE ON ai_guideline_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_guideline_matches_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_guideline_matches TO authenticated;

COMMENT ON TABLE ai_guideline_matches IS 'AI-generated clinical guideline matches with adherence gap detection (Skill #24)';
