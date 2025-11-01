-- ============================================================================
-- Enhance Existing Audit Tables for SOC 2 Compliance
-- ============================================================================
--
-- PURPOSE: Add missing SOC 2 required fields to existing audit tables
--
-- COMPLIANCE CONTROLS:
-- - CC7.2: System Monitoring - Enhanced monitoring capabilities
-- - CC6.1: Logical Access Controls - Complete access audit trail
-- - CC7.3: Security Incidents - Full incident lifecycle tracking
--
-- CHANGES:
-- 1. Add missing columns to phi_access_logs
-- 2. Add missing columns to security_events
-- 3. Create new tables: system_audit_logs, file_upload_audit
-- 4. Update helper functions to use correct column names
--
-- AUTHOR: Healthcare Systems Architect
-- DATE: 2025-11-01
-- VERSION: 1.1
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE PHI_ACCESS_LOGS
-- ============================================================================

-- Add missing SOC 2 required columns
ALTER TABLE phi_access_logs
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS resource_type TEXT,
ADD COLUMN IF NOT EXISTS resource_id UUID,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS request_path TEXT,
ADD COLUMN IF NOT EXISTS http_method TEXT,
ADD COLUMN IF NOT EXISTS authorization_result TEXT CHECK (authorization_result IN ('granted', 'denied', 'partial')),
ADD COLUMN IF NOT EXISTS denial_reason TEXT,
ADD COLUMN IF NOT EXISTS phi_fields_accessed TEXT[],
ADD COLUMN IF NOT EXISTS data_sensitivity TEXT CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
ADD COLUMN IF NOT EXISTS legal_basis TEXT,
ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'treatment',
ADD COLUMN IF NOT EXISTS hash TEXT;

-- Rename access_timestamp to timestamp for consistency
ALTER TABLE phi_access_logs
RENAME COLUMN access_timestamp TO timestamp;

-- Update existing rows with defaults
UPDATE phi_access_logs
SET
    authorization_result = 'granted',
    data_sensitivity = 'restricted',
    purpose = 'treatment'
WHERE authorization_result IS NULL;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_phi_access_resource
ON phi_access_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_phi_access_denied
ON phi_access_logs(authorization_result)
WHERE authorization_result = 'denied';

-- ============================================================================
-- 2. ENHANCE SECURITY_EVENTS
-- ============================================================================

-- Add missing SOC 2 required columns
ALTER TABLE security_events
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN (
    'authentication', 'authorization', 'data_access', 'configuration_change',
    'encryption', 'backup', 'vulnerability', 'malware', 'dos', 'intrusion',
    'policy_violation', 'compliance', 'other'
)),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS affected_resource_type TEXT,
ADD COLUMN IF NOT EXISTS affected_resource_id UUID,
ADD COLUMN IF NOT EXISTS affected_user_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS detection_method TEXT CHECK (detection_method IN (
    'automated', 'user_report', 'admin_review', 'external_scan', 'intrusion_detection'
)),
ADD COLUMN IF NOT EXISTS detected_by TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN (
    'new', 'investigating', 'contained', 'remediated', 'closed', 'false_positive'
)),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS response_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS response_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS data_breach BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS phi_exposed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS systems_affected TEXT[],
ADD COLUMN IF NOT EXISTS estimated_impact TEXT,
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_channels TEXT[],
ADD COLUMN IF NOT EXISTS notified_parties TEXT[],
ADD COLUMN IF NOT EXISTS remediation_actions TEXT[],
ADD COLUMN IF NOT EXISTS remediation_notes TEXT,
ADD COLUMN IF NOT EXISTS lessons_learned TEXT,
ADD COLUMN IF NOT EXISTS reportable_incident BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reported_to TEXT[],
ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hash TEXT;

-- Rename actor_user_id to user_id for new column (copy data)
UPDATE security_events
SET user_id = actor_user_id
WHERE user_id IS NULL;

-- Rename actor_ip_address column reference
ALTER TABLE security_events
RENAME COLUMN actor_ip_address TO ip_address;

-- Update existing rows with defaults
UPDATE security_events
SET
    category = 'other',
    detection_method = 'automated',
    detected_by = 'system',
    status = 'new'
WHERE category IS NULL;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_security_events_status
ON security_events(status)
WHERE status NOT IN ('closed', 'false_positive');

CREATE INDEX IF NOT EXISTS idx_security_events_category
ON security_events(category);

CREATE INDEX IF NOT EXISTS idx_security_events_data_breach
ON security_events(data_breach)
WHERE data_breach = TRUE;

-- ============================================================================
-- 3. CREATE SYSTEM_AUDIT_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Audit metadata
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id TEXT DEFAULT 'wellfit-primary',
    environment TEXT NOT NULL CHECK (environment IN ('production', 'staging', 'development')),

    -- Event information
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'create', 'read', 'update', 'delete', 'execute', 'configure', 'deploy', 'rollback'
    )),

    -- User context
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role TEXT,
    session_id TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Change tracking
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    version_before TEXT,
    version_after TEXT,
    changes JSONB,

    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    error_code TEXT,

    -- Additional context
    reason TEXT,
    metadata JSONB,

    -- Integrity
    hash TEXT
);

-- Indexes
CREATE INDEX idx_system_audit_timestamp ON system_audit_logs(timestamp DESC);
CREATE INDEX idx_system_audit_user_id ON system_audit_logs(user_id);
CREATE INDEX idx_system_audit_resource ON system_audit_logs(resource_type, resource_id);
CREATE INDEX idx_system_audit_failures ON system_audit_logs(success) WHERE success = FALSE;

-- RLS
ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_system_audit ON system_audit_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

-- ============================================================================
-- 4. CREATE FILE_UPLOAD_AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_upload_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Upload metadata
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    session_id TEXT NOT NULL,

    -- File information
    bucket_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,

    -- Upload details
    upload_method TEXT NOT NULL CHECK (upload_method IN ('direct', 'chunked', 'resumable')),
    chunks_total INTEGER,
    chunks_uploaded INTEGER,
    upload_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    upload_completed_at TIMESTAMPTZ,
    upload_duration_ms INTEGER,

    -- Security
    virus_scan_status TEXT CHECK (virus_scan_status IN ('pending', 'clean', 'infected', 'error')),
    virus_scan_result TEXT,
    file_hash_sha256 TEXT,
    encrypted BOOLEAN DEFAULT FALSE,

    -- Classification
    contains_phi BOOLEAN DEFAULT FALSE,
    data_classification TEXT CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),

    -- Status
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'failed', 'quarantined', 'deleted'
    )),
    error_message TEXT,

    -- Access context
    ip_address INET,
    user_agent TEXT,

    -- Compliance
    retention_policy TEXT,
    deletion_scheduled_at TIMESTAMPTZ,

    CONSTRAINT valid_completion CHECK (
        (status = 'completed' AND upload_completed_at IS NOT NULL) OR
        (status != 'completed')
    )
);

-- Indexes
CREATE INDEX idx_file_upload_timestamp ON file_upload_audit(timestamp DESC);
CREATE INDEX idx_file_upload_user_id ON file_upload_audit(user_id);
CREATE INDEX idx_file_upload_status ON file_upload_audit(status);
CREATE INDEX idx_file_upload_phi ON file_upload_audit(contains_phi) WHERE contains_phi = TRUE;

-- RLS
ALTER TABLE file_upload_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_file_upload ON file_upload_audit
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

CREATE POLICY user_own_file_upload ON file_upload_audit
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- 5. UPDATE HELPER FUNCTIONS
-- ============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS log_phi_access(UUID, TEXT, TEXT, UUID, UUID, TEXT[], INET, TEXT);

-- Recreate with correct column names
CREATE OR REPLACE FUNCTION log_phi_access(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID,
    p_patient_id UUID DEFAULT NULL,
    p_phi_fields TEXT[] DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_purpose TEXT DEFAULT 'treatment'
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_role TEXT;
    v_hash TEXT;
BEGIN
    -- Get user's current role
    SELECT role INTO v_role
    FROM profiles
    WHERE id = p_user_id;

    -- Generate integrity hash
    v_hash := encode(
        digest(
            p_user_id::TEXT || p_action || p_resource_type || p_resource_id::TEXT || NOW()::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Insert audit log
    INSERT INTO phi_access_logs (
        user_id, action, resource_type, resource_id, patient_id,
        phi_fields_accessed, data_sensitivity, user_role,
        authorization_result, ip_address, purpose, hash, timestamp
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id, p_patient_id,
        p_phi_fields, 'restricted', COALESCE(v_role, 'unknown'),
        'granted', p_ip_address, p_purpose, v_hash, NOW()
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing security event function
DROP FUNCTION IF EXISTS log_security_event(TEXT, TEXT, TEXT, TEXT, UUID, INET, JSONB);

-- Recreate with correct column names
CREATE OR REPLACE FUNCTION log_security_event(
    p_event_type TEXT,
    p_severity TEXT,
    p_category TEXT,
    p_description TEXT,
    p_user_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_hash TEXT;
BEGIN
    -- Generate integrity hash
    v_hash := encode(
        digest(
            p_event_type || p_severity || p_description || NOW()::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Insert security event
    INSERT INTO security_events (
        event_type, severity, category, description,
        user_id, ip_address, detection_method, detected_by,
        metadata, hash, timestamp
    ) VALUES (
        p_event_type, p_severity, p_category, p_description,
        p_user_id, p_ip_address, 'automated', 'guardian-agent',
        p_metadata, v_hash, NOW()
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION log_phi_access TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE system_audit_logs IS 'SOC 2 CC7.2: Comprehensive system monitoring and change tracking';
COMMENT ON TABLE file_upload_audit IS 'Enterprise file upload tracking with virus scanning and integrity verification';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
