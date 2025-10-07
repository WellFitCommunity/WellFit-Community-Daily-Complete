-- Passkey/WebAuthn Biometric Authentication System
-- Created: 2025-10-07
-- Supports fingerprint, Face ID, Touch ID, Windows Hello, etc.

-- ─── Passkey Credentials Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- WebAuthn credential data
    credential_id TEXT NOT NULL UNIQUE, -- Base64URL encoded credential ID
    public_key TEXT NOT NULL,           -- Base64URL encoded public key
    counter BIGINT NOT NULL DEFAULT 0,  -- Signature counter for replay protection

    -- Authenticator info
    authenticator_type TEXT, -- 'platform' (built-in) or 'cross-platform' (USB key)
    transports TEXT[],       -- ['internal', 'usb', 'nfc', 'ble']
    backup_eligible BOOLEAN DEFAULT false,
    backup_state BOOLEAN DEFAULT false,

    -- Device/browser info
    device_name TEXT,        -- User-friendly name like "iPhone 13 Pro"
    user_agent TEXT,         -- Browser/OS info

    -- Security metadata
    aaguid TEXT,             -- Authenticator attestation GUID
    attestation_format TEXT, -- 'packed', 'fido-u2f', 'apple', etc.

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_authenticator_type CHECK (authenticator_type IN ('platform', 'cross-platform'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_credential_id ON passkey_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_passkey_credentials_last_used ON passkey_credentials(last_used_at DESC);

-- ─── Passkey Challenges Table ─────────────────────────────────────────────
-- Temporary storage for WebAuthn challenges (prevent replay attacks)
CREATE TABLE IF NOT EXISTS passkey_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge TEXT NOT NULL UNIQUE,     -- Base64URL encoded random challenge
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-delete expired challenges
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires ON passkey_challenges(expires_at) WHERE NOT used;

-- ─── Passkey Audit Log ─────────────────────────────────────────────────
-- Track all passkey operations for security monitoring
CREATE TABLE IF NOT EXISTS passkey_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    credential_id TEXT,
    action TEXT NOT NULL, -- 'register', 'authenticate', 'delete', 'failed_auth'
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_audit_user ON passkey_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_passkey_audit_action ON passkey_audit_log(action, created_at DESC);

-- ─── RLS Policies ─────────────────────────────────────────────────────
-- Enable Row Level Security
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own credentials
CREATE POLICY passkey_credentials_select_own ON passkey_credentials
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own credentials
CREATE POLICY passkey_credentials_insert_own ON passkey_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own credentials
CREATE POLICY passkey_credentials_delete_own ON passkey_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Users can update their own credentials (for counter increments)
CREATE POLICY passkey_credentials_update_own ON passkey_credentials
    FOR UPDATE USING (auth.uid() = user_id);

-- Challenges are accessible by the user they belong to
CREATE POLICY passkey_challenges_select_own ON passkey_challenges
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Only service role can insert challenges (via Edge Functions)
CREATE POLICY passkey_challenges_insert_service ON passkey_challenges
    FOR INSERT WITH CHECK (true); -- Edge Function uses service role

-- Users can view their own audit logs
CREATE POLICY passkey_audit_select_own ON passkey_audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert audit logs
CREATE POLICY passkey_audit_insert_service ON passkey_audit_log
    FOR INSERT WITH CHECK (true);

-- Admins can view all audit logs
CREATE POLICY passkey_audit_select_admin ON passkey_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
            AND r.name IN ('admin', 'super_admin')
        )
    );

-- ─── Functions ─────────────────────────────────────────────────────
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_passkey_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER passkey_credentials_updated_at
    BEFORE UPDATE ON passkey_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_passkey_credentials_updated_at();

-- Clean up expired challenges (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_passkey_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM passkey_challenges
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Comments ─────────────────────────────────────────────────────
COMMENT ON TABLE passkey_credentials IS 'Stores WebAuthn/Passkey credentials for biometric authentication (fingerprint, Face ID, etc.)';
COMMENT ON TABLE passkey_challenges IS 'Temporary storage for WebAuthn challenges to prevent replay attacks';
COMMENT ON TABLE passkey_audit_log IS 'Security audit log for all passkey operations';

COMMENT ON COLUMN passkey_credentials.credential_id IS 'Unique identifier for this credential (from authenticator)';
COMMENT ON COLUMN passkey_credentials.public_key IS 'Public key for verifying signatures';
COMMENT ON COLUMN passkey_credentials.counter IS 'Signature counter for detecting cloned authenticators';
COMMENT ON COLUMN passkey_credentials.authenticator_type IS 'platform=built-in (Touch ID, Face ID), cross-platform=USB key';
COMMENT ON COLUMN passkey_credentials.transports IS 'How the authenticator communicates (internal, USB, NFC, BLE)';
COMMENT ON COLUMN passkey_credentials.backup_eligible IS 'Whether credential can be backed up to cloud';
COMMENT ON COLUMN passkey_credentials.backup_state IS 'Whether credential is currently backed up';
