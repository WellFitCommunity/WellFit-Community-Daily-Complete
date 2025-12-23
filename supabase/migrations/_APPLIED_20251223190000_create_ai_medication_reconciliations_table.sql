-- ============================================================================
-- AI Medication Reconciliation Table
-- Skill #26 - Stores AI-enhanced medication reconciliation results
-- ============================================================================

-- Create the ai_medication_reconciliations table
CREATE TABLE IF NOT EXISTS ai_medication_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    provider_id UUID NOT NULL,
    encounter_type TEXT NOT NULL DEFAULT 'ambulatory',

    -- Input data
    medication_sources JSONB NOT NULL,
    allergies JSONB DEFAULT '[]'::jsonb,
    active_conditions JSONB DEFAULT '[]'::jsonb,
    lab_values JSONB DEFAULT '{}'::jsonb,
    patient_age INTEGER,

    -- AI result
    result JSONB NOT NULL,
    confidence NUMERIC(3,2) NOT NULL DEFAULT 0.75,

    -- Review workflow
    requires_review BOOLEAN NOT NULL DEFAULT true,
    review_reasons JSONB DEFAULT '[]'::jsonb,
    pharmacist_review_required BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending_review',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Metadata
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('pending_review', 'reviewed', 'approved', 'rejected')),
    CONSTRAINT valid_encounter_type CHECK (encounter_type IN ('admission', 'discharge', 'transfer', 'ambulatory')),
    CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_patient_id ON ai_medication_reconciliations(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_provider_id ON ai_medication_reconciliations(provider_id);
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_status ON ai_medication_reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_created_at ON ai_medication_reconciliations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_encounter_type ON ai_medication_reconciliations(encounter_type);
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_pharmacist_review ON ai_medication_reconciliations(pharmacist_review_required) WHERE pharmacist_review_required = true;
CREATE INDEX IF NOT EXISTS idx_ai_med_recon_tenant ON ai_medication_reconciliations(tenant_id);

-- Enable RLS
ALTER TABLE ai_medication_reconciliations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Authenticated users can view their own patients' reconciliations
CREATE POLICY "ai_medication_reconciliations_select_policy" ON ai_medication_reconciliations
    FOR SELECT
    TO authenticated
    USING (
        provider_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'physician', 'nurse', 'pharmacist')
        )
    );

-- Providers can insert reconciliations for their patients
CREATE POLICY "ai_medication_reconciliations_insert_policy" ON ai_medication_reconciliations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        provider_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'physician', 'nurse', 'pharmacist')
        )
    );

-- Providers can update reconciliations they created or have access to
CREATE POLICY "ai_medication_reconciliations_update_policy" ON ai_medication_reconciliations
    FOR UPDATE
    TO authenticated
    USING (
        provider_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'physician', 'pharmacist')
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_medication_reconciliations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_medication_reconciliations_updated_at_trigger ON ai_medication_reconciliations;
CREATE TRIGGER ai_medication_reconciliations_updated_at_trigger
    BEFORE UPDATE ON ai_medication_reconciliations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_medication_reconciliations_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_medication_reconciliations TO authenticated;
GRANT SELECT ON ai_medication_reconciliations TO anon;

-- Add comment
COMMENT ON TABLE ai_medication_reconciliations IS 'AI-enhanced medication reconciliation results with clinical reasoning and deprescribing opportunities';
