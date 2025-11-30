-- ============================================================================
-- SECURITY FIX: Drop legacy admin_role_pins table with plaintext PINs
-- ============================================================================
-- Problem: admin_role_pins stores PINs in plaintext (column: "pin" TEXT)
-- This is a security vulnerability - PINs must be hashed.
--
-- Solution: Drop this legacy table entirely.
-- The correct table is staff_pins which stores pin_hash (PBKDF2 hashed).
--
-- admin_role_pins was a legacy role-based PIN system (PIN per role_id)
-- staff_pins is the current user-based PIN system (PIN per user_id + role)
-- ============================================================================

-- First, check if any data exists and log it (for audit purposes)
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO row_count FROM admin_role_pins;
  IF row_count > 0 THEN
    RAISE NOTICE 'SECURITY: Dropping admin_role_pins table with % rows of plaintext PINs', row_count;
  END IF;
END $$;

-- Drop RLS policies first
DROP POLICY IF EXISTS "admin_role_pins_tenant" ON admin_role_pins;
DROP POLICY IF EXISTS "admin_role_pins_admin_all" ON admin_role_pins;

-- Drop the table with plaintext PINs
DROP TABLE IF EXISTS admin_role_pins CASCADE;

-- Log the security fix
DO $$
BEGIN
  RAISE NOTICE 'SECURITY FIX: Removed legacy admin_role_pins table with plaintext PIN storage';
  RAISE NOTICE 'All PIN authentication now uses staff_pins table with PBKDF2 hashing';
END $$;
