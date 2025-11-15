-- ============================================================================
-- SECURITY FIX: Remove Hard-Coded Salt Vulnerability
-- Date: 2025-11-15
-- ============================================================================
--
-- ISSUE: Previous implementation used hard-coded salts in crypto.ts:
--   - const SALT = "wellfit_admin_pin_salt_2025_secure"
--   - const PASSWORD_SALT = "wellfit_password_salt_2025_secure_v1"
--
-- RISK: Hard-coded salts defeat the purpose of salting:
--   - Same password/PIN = same hash across all users
--   - Vulnerable to rainbow table attacks
--   - HIPAA/SOC2 compliance violation
--
-- FIX: Updated crypto.ts to generate random 16-byte salt per hash
--   - New format: base64(salt):base64(hash)
--   - Each user gets unique salt (even with same PIN/password)
--   - Industry standard PBKDF2 with 100,000 iterations
--
-- IMPACT: All existing PIN hashes are incompatible with new format
--   - Staff will need to re-set their PINs
--   - Security improvement outweighs inconvenience
--
-- ============================================================================

BEGIN;

-- Temporarily drop NOT NULL constraint to allow clearing old hashes
ALTER TABLE public.staff_pins
  ALTER COLUMN pin_hash DROP NOT NULL;

-- Clear all existing PIN hashes (incompatible format)
-- Users will need to re-set their PINs using the secure random salt method
UPDATE public.staff_pins
SET pin_hash = NULL
WHERE pin_hash IS NOT NULL
  AND pin_hash NOT LIKE '%:%'; -- Only clear old format (no colon separator)

-- Add comment to table explaining security upgrade
COMMENT ON COLUMN public.staff_pins.pin_hash IS
'PBKDF2 hash with random salt. Format: base64(salt):base64(hash).
Migrated 2025-11-15 to fix hard-coded salt vulnerability.';

-- Log the security fix in audit logs (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (
      event_type,
      event_category,
      actor_user_id,
      operation,
      resource_type,
      success,
      metadata
    ) VALUES (
      'SECURITY_MIGRATION_HARDCODED_SALT_FIX',
      'SYSTEM',
      NULL, -- System operation
      'MIGRATE',
      'staff_pins',
      TRUE,
      jsonb_build_object(
        'migration', '20251115000000_fix_hardcoded_salt_security',
        'description', 'Removed hard-coded salt vulnerability',
        'impact', 'All staff must re-set PINs with new secure random salt',
        'security_improvement', 'Unique random salt per PIN (16 bytes)',
        'compliance', 'HIPAA/SOC2 security best practices'
      )
    );
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- 1. Staff members will need to re-set their PINs
-- 2. New PINs will use cryptographically random salts (16 bytes)
-- 3. Hash format: base64(random_salt):base64(pbkdf2_hash)
-- 4. Same PIN for different users = different hashes (secure)
-- 5. No user passwords affected (passwords stored temporarily in plaintext
--    during SMS verification flow, not hashed with the vulnerable function)
--
-- ============================================================================
