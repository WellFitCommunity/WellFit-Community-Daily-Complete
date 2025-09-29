-- Smart Medical Scribe System
-- HIPAA-compliant medical transcription and AI coding assistance

-- Scribe sessions table (encrypted)
CREATE TABLE IF NOT EXISTS scribe_sessions (
    id TEXT PRIMARY KEY,
    patient_id UUID REFERENCES auth.users(id),
    provider_id UUID NOT NULL REFERENCES auth.users(id),
    session_type TEXT NOT NULL CHECK (session_type IN ('consultation', 'assessment', 'notes', 'dictation')),

    -- Encrypted transcript and AI results
    transcript TEXT, -- Will be encrypted by trigger
    ai_summary TEXT,
    medical_codes JSONB,
    action_items JSONB,
    clinical_notes TEXT,
    recommendations JSONB,

    -- Metadata
    duration_seconds INTEGER DEFAULT 0,
    audio_url TEXT, -- Reference to secure storage
    status TEXT DEFAULT 'completed' CHECK (status IN ('recording', 'processing', 'completed', 'error')),
    confidence_score DECIMAL(3,2),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Audit fields
    created_by UUID REFERENCES auth.users(id),
    ip_address INET
);

-- Scribe audit log (for compliance and monitoring)
CREATE TABLE IF NOT EXISTS scribe_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT REFERENCES scribe_sessions(id),
    session_type TEXT,
    transcript_length INTEGER,
    duration_seconds INTEGER,
    ai_model_used TEXT DEFAULT 'claude-3-sonnet',
    codes_suggested INTEGER DEFAULT 0,
    processing_time_ms BIGINT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    user_id UUID REFERENCES auth.users(id),
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encrypted scribe sessions view (for reading decrypted data)
CREATE OR REPLACE VIEW scribe_sessions_decrypted AS
SELECT
    id,
    patient_id,
    provider_id,
    session_type,
    CASE
        WHEN transcript IS NOT NULL THEN
            pgp_sym_decrypt(decode(transcript, 'base64'), current_setting('app.phi_encryption_key', true))
        ELSE NULL
    END AS transcript,
    ai_summary,
    medical_codes,
    action_items,
    clinical_notes,
    recommendations,
    duration_seconds,
    audio_url,
    status,
    confidence_score,
    created_at,
    updated_at,
    created_by,
    ip_address
FROM scribe_sessions;

-- Encryption trigger for scribe sessions
CREATE OR REPLACE FUNCTION encrypt_scribe_transcript()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt transcript if provided
    IF NEW.transcript IS NOT NULL AND NEW.transcript != '' THEN
        NEW.transcript := encode(
            pgp_sym_encrypt(NEW.transcript, current_setting('app.phi_encryption_key', true)),
            'base64'
        );
    END IF;

    -- Set audit fields
    NEW.updated_at := NOW();

    -- Get current user and IP for audit
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.ip_address := COALESCE(NEW.ip_address, inet_client_addr());

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply encryption trigger
DROP TRIGGER IF EXISTS trigger_encrypt_scribe_transcript ON scribe_sessions;
CREATE TRIGGER trigger_encrypt_scribe_transcript
    BEFORE INSERT OR UPDATE ON scribe_sessions
    FOR EACH ROW
    EXECUTE FUNCTION encrypt_scribe_transcript();

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_scribe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_scribe_updated_at ON scribe_sessions;
CREATE TRIGGER trigger_update_scribe_updated_at
    BEFORE UPDATE ON scribe_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_scribe_updated_at();

-- Audit log trigger for scribe sessions
CREATE OR REPLACE FUNCTION audit_scribe_session()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO scribe_audit_log (
        session_id,
        session_type,
        transcript_length,
        duration_seconds,
        user_id,
        ip_address,
        success
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.session_type, OLD.session_type),
        CASE
            WHEN NEW.transcript IS NOT NULL THEN length(NEW.transcript)
            ELSE NULL
        END,
        COALESCE(NEW.duration_seconds, OLD.duration_seconds),
        auth.uid(),
        inet_client_addr(),
        true
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_scribe_session ON scribe_sessions;
CREATE TRIGGER trigger_audit_scribe_session
    AFTER INSERT OR UPDATE OR DELETE ON scribe_sessions
    FOR EACH ROW
    EXECUTE FUNCTION audit_scribe_session();

-- RLS Policies for scribe_sessions
ALTER TABLE scribe_sessions ENABLE ROW LEVEL SECURITY;

-- Providers can access their own sessions
CREATE POLICY "Providers can manage their scribe sessions"
    ON scribe_sessions FOR ALL
    TO authenticated
    USING (provider_id = auth.uid())
    WITH CHECK (provider_id = auth.uid());

-- Admins can access all sessions
CREATE POLICY "Admins can view all scribe sessions"
    ON scribe_sessions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- RLS Policies for scribe_audit_log
ALTER TABLE scribe_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view scribe audit logs"
    ON scribe_audit_log FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
    ON scribe_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scribe_sessions_provider_id ON scribe_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_scribe_sessions_patient_id ON scribe_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_scribe_sessions_created_at ON scribe_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_scribe_sessions_session_type ON scribe_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_scribe_audit_log_created_at ON scribe_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_scribe_audit_log_session_id ON scribe_audit_log(session_id);

-- Storage bucket for audio recordings (if not exists)
INSERT INTO storage.buckets (id, name)
VALUES (
    'medical-recordings',
    'medical-recordings'
) ON CONFLICT (id) DO NOTHING;

-- RLS for medical recordings storage
CREATE POLICY "Authenticated users can upload recordings"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'medical-recordings');

CREATE POLICY "Users can access their own recordings"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'medical-recordings'
        AND (auth.uid()::text = (storage.foldername(name))[1])
    );

-- Admins can access all recordings
CREATE POLICY "Admins can access all recordings"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'medical-recordings'
        AND EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Function to cleanup old recordings (HIPAA compliance)
CREATE OR REPLACE FUNCTION cleanup_old_recordings()
RETURNS void AS $$
BEGIN
    -- Delete recordings older than 30 days
    DELETE FROM storage.objects
    WHERE bucket_id = 'medical-recordings'
    AND created_at < NOW() - INTERVAL '30 days';

    -- Log cleanup activity
    INSERT INTO scribe_audit_log (
        session_type,
        success,
        processing_time_ms,
        user_id
    ) VALUES (
        'cleanup',
        true,
        extract(epoch from now()) * 1000,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE scribe_sessions IS 'HIPAA-compliant medical transcription sessions with encrypted PHI';
COMMENT ON TABLE scribe_audit_log IS 'Audit trail for all scribe system activities';
COMMENT ON VIEW scribe_sessions_decrypted IS 'Decrypted view of scribe sessions for authorized access';
COMMENT ON FUNCTION encrypt_scribe_transcript() IS 'Encrypts PHI data in scribe transcripts';
COMMENT ON FUNCTION cleanup_old_recordings() IS 'HIPAA-compliant cleanup of old audio recordings';