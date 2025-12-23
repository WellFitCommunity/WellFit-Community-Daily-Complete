-- Migration: Create AI Referral Letters Table
-- Skill #22 - Referral Letter Generator
-- Stores AI-generated referral letters for specialist consultations

-- Create the ai_referral_letters table
CREATE TABLE IF NOT EXISTS ai_referral_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_provider_id UUID NOT NULL REFERENCES profiles(id),

  -- Referral target
  to_specialty TEXT NOT NULL,
  to_provider_id UUID REFERENCES profiles(id),

  -- Clinical content
  clinical_reason TEXT NOT NULL,
  clinical_notes TEXT,
  diagnoses TEXT[] DEFAULT '{}',
  medications TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  urgency TEXT NOT NULL DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergent')),

  -- Generated content (JSONB for full letter structure)
  generated_letter JSONB NOT NULL,
  formatted_letter TEXT NOT NULL,

  -- AI metadata
  model_used TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20250919',
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  requires_review BOOLEAN NOT NULL DEFAULT true,
  review_reasons TEXT[] DEFAULT '{"All referral letters require physician review before sending"}',

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'archived')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Insurance/billing (optional)
  insurance_payer TEXT,
  insurance_notes TEXT,

  -- Multi-tenant support
  tenant_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_patient_id ON ai_referral_letters(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_from_provider_id ON ai_referral_letters(from_provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_to_specialty ON ai_referral_letters(to_specialty);
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_status ON ai_referral_letters(status);
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_created_at ON ai_referral_letters(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_urgency ON ai_referral_letters(urgency);
CREATE INDEX IF NOT EXISTS idx_ai_referral_letters_tenant_id ON ai_referral_letters(tenant_id);

-- Enable RLS
ALTER TABLE ai_referral_letters ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Providers can view letters they created or are the recipient
CREATE POLICY "ai_referral_letters_provider_select" ON ai_referral_letters
  FOR SELECT
  TO authenticated
  USING (
    from_provider_id = auth.uid()
    OR to_provider_id = auth.uid()
    OR approved_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_referral_letters.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

-- Providers can insert letters for their patients
CREATE POLICY "ai_referral_letters_provider_insert" ON ai_referral_letters
  FOR INSERT
  TO authenticated
  WITH CHECK (
    from_provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM care_team_members
      WHERE care_team_members.patient_id = ai_referral_letters.patient_id
      AND care_team_members.member_id = auth.uid()
    )
  );

-- Providers can update letters they created or are approving
CREATE POLICY "ai_referral_letters_provider_update" ON ai_referral_letters
  FOR UPDATE
  TO authenticated
  USING (
    from_provider_id = auth.uid()
    OR approved_by = auth.uid()
  )
  WITH CHECK (
    from_provider_id = auth.uid()
    OR approved_by = auth.uid()
  );

-- Admins have full access
CREATE POLICY "ai_referral_letters_admin_all" ON ai_referral_letters
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
CREATE OR REPLACE FUNCTION update_ai_referral_letters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ai_referral_letters_updated_at ON ai_referral_letters;
CREATE TRIGGER trigger_ai_referral_letters_updated_at
  BEFORE UPDATE ON ai_referral_letters
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_referral_letters_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_referral_letters TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE ai_referral_letters IS 'AI-generated referral letters for specialist consultations (Skill #22)';
