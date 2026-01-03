-- =============================================================================
-- Migration: Add Missing Enrollment Columns to Profiles
-- =============================================================================
-- Purpose: Fix community senior enrollment by adding columns the edge function expects
-- Issue: enrollClient edge function fails because these columns don't exist
-- =============================================================================

BEGIN;

-- Add emergency_contact_phone (was missing)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
COMMENT ON COLUMN profiles.emergency_contact_phone IS 'Emergency contact phone number (E.164 format)';

-- Add is_test_user flag for easy test patient management
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.is_test_user IS 'True if this is a test patient (can be bulk deleted)';

-- Add test_tag for grouping test patients
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS test_tag TEXT;
COMMENT ON COLUMN profiles.test_tag IS 'Tag for grouping test patients (e.g., demo-2025, training-batch)';

-- Log migration
INSERT INTO audit_logs (event_type, event_category, metadata)
VALUES (
  'SCHEMA_MIGRATION',
  'SYSTEM_EVENT',
  jsonb_build_object(
    'migration', '20260103100000_add_missing_enrollment_columns',
    'columns_added', jsonb_build_array(
      'emergency_contact_phone',
      'is_test_user',
      'test_tag'
    ),
    'purpose', 'Fix community senior enrollment'
  )
);

COMMIT;
