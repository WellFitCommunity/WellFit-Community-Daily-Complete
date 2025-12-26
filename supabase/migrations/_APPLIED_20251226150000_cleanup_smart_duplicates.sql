-- Migration: Cleanup duplicate SMART on FHIR policies and indexes
-- Purpose: Remove duplicate RLS policies and indexes created by overlapping migrations
-- Applied: 2025-12-26

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP: Duplicate RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════

-- smart_access_tokens: kept smart_access_tokens_service_only
DROP POLICY IF EXISTS smart_tokens_service_all ON smart_access_tokens;
DROP POLICY IF EXISTS smart_tokens_patient_view ON smart_access_tokens;

-- smart_auth_codes: kept smart_auth_codes_service_only
DROP POLICY IF EXISTS smart_auth_codes_service_all ON smart_auth_codes;

-- smart_authorizations: kept smart_authorizations_patient_select
DROP POLICY IF EXISTS smart_authorizations_patient_view ON smart_authorizations;
DROP POLICY IF EXISTS smart_authorizations_service_all ON smart_authorizations;

-- smart_registered_apps: kept smart_registered_apps_public_read
DROP POLICY IF EXISTS smart_apps_public_view ON smart_registered_apps;
DROP POLICY IF EXISTS smart_apps_service_all ON smart_registered_apps;

-- smart_audit_log: kept consistent naming
DROP POLICY IF EXISTS smart_audit_service_all ON smart_audit_log;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP: Duplicate Indexes (kept longer, more descriptive names)
-- ═══════════════════════════════════════════════════════════════════════════════

-- smart_access_tokens
DROP INDEX IF EXISTS idx_smart_tokens_access;
DROP INDEX IF EXISTS idx_smart_tokens_app;
DROP INDEX IF EXISTS idx_smart_tokens_patient;
DROP INDEX IF EXISTS idx_smart_tokens_refresh;
DROP INDEX IF EXISTS idx_smart_tokens_expires;

-- smart_audit_log
DROP INDEX IF EXISTS idx_smart_audit_app;
DROP INDEX IF EXISTS idx_smart_audit_event;
DROP INDEX IF EXISTS idx_smart_audit_patient;
DROP INDEX IF EXISTS idx_smart_audit_time;

-- smart_auth_codes
DROP INDEX IF EXISTS idx_smart_auth_codes_expires;

-- smart_authorizations
DROP INDEX IF EXISTS idx_smart_auth_app;
DROP INDEX IF EXISTS idx_smart_auth_patient;
DROP INDEX IF EXISTS idx_smart_auth_status;
DROP INDEX IF EXISTS idx_smart_auth_consent;

-- smart_registered_apps
DROP INDEX IF EXISTS idx_smart_apps_client_id;
DROP INDEX IF EXISTS idx_smart_apps_status;
DROP INDEX IF EXISTS idx_smart_apps_tenant;
DROP INDEX IF EXISTS idx_smart_apps_type;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FINAL STATE AFTER CLEANUP
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Policies (9 total, no duplicates):
--   smart_access_tokens:   1 policy  (service_only)
--   smart_audit_log:       2 policies (admin_select, service_insert)
--   smart_auth_codes:      1 policy  (service_only)
--   smart_authorizations:  3 policies (admin_all, patient_select, patient_update)
--   smart_registered_apps: 2 policies (admin_all, public_read)
--
-- Indexes (38 total, no duplicates):
--   smart_access_tokens:   10 indexes
--   smart_audit_log:       7 indexes
--   smart_auth_codes:      7 indexes
--   smart_authorizations:  7 indexes
--   smart_registered_apps: 7 indexes
