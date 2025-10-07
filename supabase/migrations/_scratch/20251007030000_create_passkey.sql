-- ============================================================================
-- PASSKEY/BIOMETRIC AUTHENTICATION SYSTEM
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================
-- This creates tables for Touch ID, Face ID, Windows Hello, Fingerprint login
-- Edge Functions are already deployed ✅
-- ============================================================================

-- Create passkey_credentials table
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    authenticator_type TEXT,
    transports TEXT[],
    backup_eligible BOOLEAN DEFAULT false,
    backup_state BOOLEAN DEFAULT false,
    device_name TEXT,
    user_agent TEXT,
    aaguid TEXT,
    attestation_format TEXT,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_authenticator_type CHECK (authenticator_type IN ('platform', 'cross-platform'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_last_used ON passkey_credentials(last_used_at DESC);

-- Create passkey_challenges table
CREATE TABLE IF NOT EXISTS passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires ON passkey_challenges(expires_at) WHERE NOT used;

-- Create passkey_audit_log table
CREATE TABLE IF NOT EXISTS passkey_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    credential_id TEXT,
    action TEXT NOT NULL,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_audit_user ON passkey_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passkey_audit_action ON passkey_audit_log(action, created_at DESC);

-- Enable RLS
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for passkey_credentials
DROP POLICY IF EXISTS passkey_credentials_select_own ON passkey_credentials;
DROP POLICY IF EXISTS passkey_credentials_insert_own ON passkey_credentials;
DROP POLICY IF EXISTS passkey_credentials_delete_own ON passkey_credentials;
DROP POLICY IF EXISTS passkey_credentials_update_own ON passkey_credentials;

CREATE POLICY passkey_credentials_select_own ON passkey_credentials
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY passkey_credentials_insert_own ON passkey_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY passkey_credentials_delete_own ON passkey_credentials
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY passkey_credentials_update_own ON passkey_credentials
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for passkey_challenges
DROP POLICY IF EXISTS passkey_challenges_select_own ON passkey_challenges;
DROP POLICY IF EXISTS passkey_challenges_insert_service ON passkey_challenges;

CREATE POLICY passkey_challenges_select_own ON passkey_challenges
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY passkey_challenges_insert_service ON passkey_challenges
    FOR INSERT WITH CHECK (true);

-- RLS Policies for passkey_audit_log
DROP POLICY IF EXISTS passkey_audit_select_own ON passkey_audit_log;
DROP POLICY IF EXISTS passkey_audit_insert_service ON passkey_audit_log;
DROP POLICY IF EXISTS passkey_audit_select_admin ON passkey_audit_log;

CREATE POLICY passkey_audit_select_own ON passkey_audit_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY passkey_audit_insert_service ON passkey_audit_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY passkey_audit_select_admin ON passkey_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
        )
    );

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_passkey_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS passkey_credentials_updated_at ON passkey_credentials;
CREATE TRIGGER passkey_credentials_updated_at
    BEFORE UPDATE ON passkey_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_passkey_credentials_updated_at();

-- Cleanup function for expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_passkey_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM passkey_challenges
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE passkey_credentials IS 'WebAuthn/Passkey credentials for biometric authentication';
COMMENT ON TABLE passkey_challenges IS 'Temporary WebAuthn challenges to prevent replay attacks';
COMMENT ON TABLE passkey_audit_log IS 'Security audit log for all passkey operations';

-- Verify tables were created
SELECT
  'passkey_credentials' as table_name,
  COUNT(*) as row_count,
  '✅ Created' as status
FROM passkey_credentials
UNION ALL
SELECT
  'passkey_challenges' as table_name,
  COUNT(*) as row_count,
  '✅ Created' as status
FROM passkey_challenges
UNION ALL
SELECT
  'passkey_audit_log' as table_name,
  COUNT(*) as row_count,
  '✅ Created' as status
FROM passkey_audit_log;
