-- Migration: Create AI Progress Notes Table
-- Skill #21 - Progress Note Synthesizer
-- Stores AI-generated progress notes synthesized from patient check-ins

-- Create the ai_progress_notes table
CREATE TABLE IF NOT EXISTS ai_progress_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id),

  -- Time period covered
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'routine' CHECK (note_type IN ('routine', 'focused', 'comprehensive')),

  -- Aggregated data (JSONB for flexibility)
  vitals_trends JSONB DEFAULT '[]'::jsonb,
  mood_summary JSONB DEFAULT '{}'::jsonb,
  activity_summary JSONB DEFAULT '{}'::jsonb,
  concern_flags JSONB DEFAULT '[]'::jsonb,

  -- Generated content
  summary JSONB NOT NULL, -- Contains subjective, objective, assessment, plan
  key_findings TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',

  -- AI metadata
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  requires_review BOOLEAN NOT NULL DEFAULT true,
  review_reasons TEXT[] DEFAULT '{}',
  data_quality TEXT NOT NULL DEFAULT 'fair' CHECK (data_quality IN ('excellent', 'good', 'fair', 'poor')),

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'finalized')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  finalized_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_patient_id ON ai_progress_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_provider_id ON ai_progress_notes(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_status ON ai_progress_notes(status);
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_created_at ON ai_progress_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_progress_notes_note_id ON ai_progress_notes(note_id);

-- Enable RLS
ALTER TABLE ai_progress_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Providers can view notes they created or for patients they have access to
CREATE POLICY "ai_progress_notes_provider_select" ON ai_progress_notes
  FOR SELECT
  TO authenticated
  USING (
    provider_id = auth.uid()
    OR reviewed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_progress_notes.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

-- Providers can insert notes for their patients
CREATE POLICY "ai_progress_notes_provider_insert" ON ai_progress_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_progress_notes.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

-- Providers can update notes they created or are reviewing
CREATE POLICY "ai_progress_notes_provider_update" ON ai_progress_notes
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
CREATE POLICY "ai_progress_notes_admin_all" ON ai_progress_notes
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
CREATE OR REPLACE FUNCTION update_ai_progress_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_progress_notes_updated_at ON ai_progress_notes;
CREATE TRIGGER trigger_ai_progress_notes_updated_at
  BEFORE UPDATE ON ai_progress_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_progress_notes_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_progress_notes TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE ai_progress_notes IS 'AI-generated progress notes synthesized from patient check-in data (Skill #21)';
