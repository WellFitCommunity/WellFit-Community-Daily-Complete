/**
 * Tenant Identifier System
 *
 * Adds unique tenant codes for quick visual identification
 * Format: PREFIX-NUMBER (e.g., "MH-6702" for Methodist Hospital #6702)
 *
 * Super admin assigns:
 * - Prefix: 1-4 uppercase letters (e.g., "MH", "P3", "EVG")
 * - Number: 4-6 digits (e.g., "6702")
 *
 * Used for:
 * - Quick tenant identification in dashboards
 * - Support ticket references
 * - Audit log entries
 * - PIN authentication (TenantCode-PIN)
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- ADD TENANT_CODE COLUMN
-- ============================================================================

-- Add tenant_code field (nullable to allow existing tenants without codes)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS tenant_code VARCHAR(20) UNIQUE;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for quick tenant_code lookups (used in PIN authentication)
CREATE INDEX IF NOT EXISTS idx_tenants_tenant_code ON tenants(tenant_code)
WHERE tenant_code IS NOT NULL;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Format validation: PREFIX-NUMBER with hyphen
-- PREFIX: 1-4 uppercase letters
-- NUMBER: 4-6 digits
-- Examples: MH-6702, P3-1234, EVG-123456
ALTER TABLE tenants
DROP CONSTRAINT IF EXISTS chk_tenant_code_format;

ALTER TABLE tenants
ADD CONSTRAINT chk_tenant_code_format
CHECK (
  tenant_code IS NULL OR
  tenant_code ~ '^[A-Z]{1,4}-[0-9]{4,6}$'
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN tenants.tenant_code IS
'Unique tenant identifier in format PREFIX-NUMBER (e.g., MH-6702). Super admin assigns prefix and number. Used for quick identification and PIN authentication.';

-- ============================================================================
-- HELPER FUNCTION
-- ============================================================================

/**
 * Get tenant by tenant code
 * Used in PIN authentication to validate tenant code
 */
CREATE OR REPLACE FUNCTION get_tenant_by_code(p_tenant_code TEXT)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  tenant_code TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    t.tenant_code
  FROM tenants t
  WHERE t.tenant_code = UPPER(p_tenant_code)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_tenant_by_code IS
'Lookup tenant by tenant code (case-insensitive). Returns tenant_id, name, and code. Used in PIN authentication.';

-- Grant execute to authenticated users (needed for PIN validation)
GRANT EXECUTE ON FUNCTION get_tenant_by_code TO authenticated;
