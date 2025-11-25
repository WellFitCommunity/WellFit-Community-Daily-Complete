-- Migration: Add function to check if phone exists in auth.users
-- Date: 2025-11-25
-- Purpose: Fix SMS verification error by properly checking phone uniqueness
--          in auth.users table before attempting user creation
--
-- This addresses the "Database error creating new user" error that occurs when:
-- 1. A previous registration failed after creating auth user but before profile
-- 2. Phone exists in auth.users but not in profiles (data inconsistency)
-- 3. The code only checked profiles table, missing the auth.users constraint

-- Create a SECURITY DEFINER function to safely check auth.users.phone
-- This allows the sms-verify-code edge function to check for existing phones
-- without exposing the entire auth.users table
CREATE OR REPLACE FUNCTION public.check_phone_exists_in_auth(phone_to_check TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Check if the phone exists in auth.users
  -- The phone column in auth.users has a unique constraint
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE phone = phone_to_check
  );
END;
$$;

-- Grant execute permission to service_role (used by edge functions)
GRANT EXECUTE ON FUNCTION public.check_phone_exists_in_auth(TEXT) TO service_role;

-- Also grant to authenticated for potential client-side checks
GRANT EXECUTE ON FUNCTION public.check_phone_exists_in_auth(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_phone_exists_in_auth(TEXT) IS
'Safely checks if a phone number exists in auth.users table.
Used during registration to detect existing users and handle
shared phone scenarios properly. Returns TRUE if phone exists.';
