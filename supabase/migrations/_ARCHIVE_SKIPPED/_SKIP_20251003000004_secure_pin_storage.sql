-- ==============================================================================
-- Migration: Secure PIN Storage for Caregiver Access
-- Date: 2025-10-03
-- Author: System Administrator
--
-- PURPOSE:
-- Replace plaintext PIN storage with securely hashed PINs using PBKDF2.
-- PINs are used for caregiver read-only access to senior patient progress.
--
-- SECURITY RATIONALE:
-- - HIPAA requires secure storage of access credentials
-- - Plaintext PINs pose a security risk if database is compromised
-- - PBKDF2 with 100k iterations is OWASP recommended for password storage
-- - Web Crypto API provides cryptographically secure implementation
--
-- WORKFLOW:
-- 1. Senior creates 4-digit PIN in DemographicsPage (Step 6)
-- 2. Frontend calls hash-pin Edge Function (Web Crypto PBKDF2)
-- 3. Hashed PIN stored in phone_auth.pin_hash (format: salt:hash)
-- 4. Caregiver enters PIN for view-only access
-- 5. System verifies PIN using hash-pin function with action=verify
--
-- CHANGES:
-- - Add pin_hash column (text, stores base64(salt):base64(hash))
-- - Keep pin column temporarily for backward compatibility
-- - Future migration will drop pin column after data migration
--
-- AFFECTED FILES:
-- - src/pages/DemographicsPage.tsx:296-320 (PIN creation)
-- - supabase/functions/hash-pin/index.ts (hashing logic)
--
-- COMPATIBILITY:
-- - Safe to run multiple times (uses IF NOT EXISTS)
-- - No data loss (keeps existing pin column)
-- - Backward compatible (apps can still read old pins during transition)
-- ==============================================================================

-- migrate:up
begin;

-- Add secure PIN hash column
ALTER TABLE public.phone_auth
ADD COLUMN IF NOT EXISTS pin_hash text;

-- Add index for PIN lookups (used during caregiver authentication)
CREATE INDEX IF NOT EXISTS idx_phone_auth_user_id
  ON public.phone_auth (user_id);

-- Add helpful comments for documentation
COMMENT ON COLUMN public.phone_auth.pin_hash IS
  'Securely hashed PIN for caregiver read-only access. Format: base64(salt):base64(hash). Uses PBKDF2 with 100k iterations, SHA-256, 16-byte salt. Hashed via hash-pin Edge Function using Web Crypto API.';

COMMENT ON COLUMN public.phone_auth.pin IS
  'DEPRECATED: Plaintext PIN storage. Use pin_hash instead. Will be removed in future migration after data migration is complete.';

COMMENT ON TABLE public.phone_auth IS
  'Stores phone verification and caregiver access PINs. PINs allow caregivers view-only access to senior progress. Seniors use passwords for full account access.';

-- Add constraint to ensure either pin or pin_hash exists (during transition)
-- This allows gradual migration from plaintext to hashed PINs
ALTER TABLE public.phone_auth
DROP CONSTRAINT IF EXISTS check_pin_or_pin_hash;

ALTER TABLE public.phone_auth
ADD CONSTRAINT check_pin_or_pin_hash
  CHECK (pin IS NOT NULL OR pin_hash IS NOT NULL);

commit;

-- migrate:down
begin;

-- Remove constraint
ALTER TABLE public.phone_auth
DROP CONSTRAINT IF EXISTS check_pin_or_pin_hash;

-- Drop index
DROP INDEX IF EXISTS idx_phone_auth_user_id;

-- Drop pin_hash column (WARNING: Data loss if not migrated back to pin)
ALTER TABLE public.phone_auth
DROP COLUMN IF EXISTS pin_hash;

commit;
