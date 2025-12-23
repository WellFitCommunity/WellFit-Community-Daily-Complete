-- ============================================================================
-- AI Appointment Prep Instructions Table
-- Skill #27 - Stores AI-generated appointment preparation instructions
-- ============================================================================

-- Create the ai_appointment_prep_instructions table
CREATE TABLE IF NOT EXISTS ai_appointment_prep_instructions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prep_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,

    -- Appointment details
    appointment_type TEXT NOT NULL,
    appointment_date_time TIMESTAMPTZ NOT NULL,
    specialty TEXT,
    provider_name TEXT,
    location TEXT,

    -- Context used for generation
    patient_context JSONB DEFAULT '{}'::jsonb,

    -- AI result
    result JSONB NOT NULL,
    language TEXT NOT NULL DEFAULT 'English',

    -- Delivery tracking
    sent_via TEXT,
    sent_at TIMESTAMPTZ,

    -- Metadata
    tenant_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_sent_via CHECK (sent_via IS NULL OR sent_via IN ('sms', 'email', 'app', 'print'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_appt_prep_patient_id ON ai_appointment_prep_instructions(patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_appt_prep_appointment_date ON ai_appointment_prep_instructions(appointment_date_time);
CREATE INDEX IF NOT EXISTS idx_ai_appt_prep_type ON ai_appointment_prep_instructions(appointment_type);
CREATE INDEX IF NOT EXISTS idx_ai_appt_prep_unsent ON ai_appointment_prep_instructions(appointment_date_time)
    WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_appt_prep_created_at ON ai_appointment_prep_instructions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_appt_prep_tenant ON ai_appointment_prep_instructions(tenant_id);

-- Enable RLS
ALTER TABLE ai_appointment_prep_instructions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view prep instructions for their patients
CREATE POLICY "ai_appointment_prep_select_policy" ON ai_appointment_prep_instructions
    FOR SELECT
    TO authenticated
    USING (
        patient_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'physician', 'nurse', 'medical_assistant', 'scheduler')
        )
    );

-- Staff can insert prep instructions
CREATE POLICY "ai_appointment_prep_insert_policy" ON ai_appointment_prep_instructions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'physician', 'nurse', 'medical_assistant', 'scheduler')
        )
    );

-- Staff can update prep instructions
CREATE POLICY "ai_appointment_prep_update_policy" ON ai_appointment_prep_instructions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.role IN ('super_admin', 'admin', 'physician', 'nurse', 'medical_assistant', 'scheduler')
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_appointment_prep_instructions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_appointment_prep_instructions_updated_at_trigger ON ai_appointment_prep_instructions;
CREATE TRIGGER ai_appointment_prep_instructions_updated_at_trigger
    BEFORE UPDATE ON ai_appointment_prep_instructions
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_appointment_prep_instructions_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ai_appointment_prep_instructions TO authenticated;
GRANT SELECT ON ai_appointment_prep_instructions TO anon;

-- Add comment
COMMENT ON TABLE ai_appointment_prep_instructions IS 'AI-generated personalized appointment preparation instructions for patients';
