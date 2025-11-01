-- ============================================================================
-- Fix Audit Functions - Zero Tech Debt
-- ============================================================================
--
-- PURPOSE: Properly drop and recreate audit functions with correct signatures
--
-- APPROACH: Drop all existing overloads, create single canonical version
--
-- AUTHOR: Healthcare Systems Architect
-- DATE: 2025-11-01
-- VERSION: 1.2
-- ============================================================================

-- ============================================================================
-- 1. DROP ALL EXISTING FUNCTION OVERLOADS
-- ============================================================================

-- Drop all log_phi_access overloads
DROP FUNCTION IF EXISTS log_phi_access(UUID, TEXT, TEXT, UUID, UUID, TEXT[], INET, TEXT);
DROP FUNCTION IF EXISTS log_phi_access(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT);

-- Drop all log_security_event overloads
DROP FUNCTION IF EXISTS log_security_event(TEXT, TEXT, TEXT, TEXT, UUID, INET, JSONB);
DROP FUNCTION IF EXISTS log_security_event(TEXT, TEXT, TEXT, JSONB, BOOLEAN, BOOLEAN);

-- ============================================================================
-- 2. CREATE CANONICAL PHI ACCESS LOGGING FUNCTION
-- ============================================================================

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
    SELECT COALESCE(role, 'unknown') INTO v_role
    FROM profiles
    WHERE id = p_user_id;

    -- Generate integrity hash
    v_hash := encode(
        digest(
            COALESCE(p_user_id::TEXT, '') ||
            COALESCE(p_action, '') ||
            COALESCE(p_resource_type, '') ||
            COALESCE(p_resource_id::TEXT, '') ||
            NOW()::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Insert audit log
    INSERT INTO phi_access_logs (
        user_id,
        user_role,
        action,
        resource_type,
        resource_id,
        patient_id,
        phi_fields_accessed,
        data_sensitivity,
        authorization_result,
        ip_address,
        purpose,
        hash,
        timestamp
    ) VALUES (
        p_user_id,
        v_role,
        p_action,
        p_resource_type,
        p_resource_id,
        p_patient_id,
        p_phi_fields,
        'restricted',
        'granted',
        p_ip_address,
        p_purpose,
        v_hash,
        NOW()
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the operation
        RAISE WARNING 'Failed to log PHI access: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CREATE CANONICAL SECURITY EVENT LOGGING FUNCTION
-- ============================================================================

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
            COALESCE(p_event_type, '') ||
            COALESCE(p_severity, '') ||
            COALESCE(p_description, '') ||
            NOW()::TEXT,
            'sha256'
        ),
        'hex'
    );

    -- Insert security event
    INSERT INTO security_events (
        event_type,
        severity,
        category,
        description,
        user_id,
        ip_address,
        detection_method,
        detected_by,
        metadata,
        hash,
        timestamp
    ) VALUES (
        p_event_type,
        UPPER(p_severity), -- Normalize to uppercase
        p_category,
        p_description,
        p_user_id,
        p_ip_address,
        'automated',
        'guardian-agent',
        COALESCE(p_metadata, '{}'::JSONB),
        v_hash,
        NOW()
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the operation
        RAISE WARNING 'Failed to log security event: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. FIX MISSING INDEXES (CREATE IF NOT EXISTS)
-- ============================================================================

-- Fix system_audit_logs indexes
DROP INDEX IF EXISTS idx_system_audit_timestamp;
DROP INDEX IF EXISTS idx_system_audit_user_id;
DROP INDEX IF EXISTS idx_system_audit_resource;
DROP INDEX IF EXISTS idx_system_audit_failures;

CREATE INDEX idx_system_audit_timestamp ON system_audit_logs(timestamp DESC);
CREATE INDEX idx_system_audit_user_id ON system_audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_system_audit_resource ON system_audit_logs(resource_type, resource_id);
CREATE INDEX idx_system_audit_failures ON system_audit_logs(success) WHERE success = FALSE;

-- Fix file_upload_audit indexes
DROP INDEX IF EXISTS idx_file_upload_timestamp;
DROP INDEX IF EXISTS idx_file_upload_user_id;
DROP INDEX IF EXISTS idx_file_upload_status;
DROP INDEX IF EXISTS idx_file_upload_phi;

CREATE INDEX idx_file_upload_timestamp ON file_upload_audit(timestamp DESC);
CREATE INDEX idx_file_upload_user_id ON file_upload_audit(user_id);
CREATE INDEX idx_file_upload_status ON file_upload_audit(status);
CREATE INDEX idx_file_upload_phi ON file_upload_audit(contains_phi) WHERE contains_phi = TRUE;

-- ============================================================================
-- 5. FIX RLS POLICIES (DROP AND RECREATE)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS admin_system_audit ON system_audit_logs;
DROP POLICY IF EXISTS admin_file_upload ON file_upload_audit;
DROP POLICY IF EXISTS user_own_file_upload ON file_upload_audit;

-- Create correct policies
CREATE POLICY admin_system_audit ON system_audit_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

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
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION log_phi_access(UUID, TEXT, TEXT, UUID, UUID, TEXT[], INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event(TEXT, TEXT, TEXT, TEXT, UUID, INET, JSONB) TO authenticated;

-- Grant table permissions
GRANT SELECT ON system_audit_logs TO authenticated;
GRANT SELECT ON file_upload_audit TO authenticated;

-- ============================================================================
-- 7. ADD HELPFUL COMMENTS
-- ============================================================================

COMMENT ON FUNCTION log_phi_access(UUID, TEXT, TEXT, UUID, UUID, TEXT[], INET, TEXT) IS
'SOC 2 CC6.1: Canonical PHI access logging function with integrity hashing and error handling';

COMMENT ON FUNCTION log_security_event(TEXT, TEXT, TEXT, TEXT, UUID, INET, JSONB) IS
'SOC 2 CC7.3: Canonical security event logging function with integrity hashing and error handling';

-- ============================================================================
-- MIGRATION COMPLETE - ZERO TECH DEBT
-- ============================================================================
