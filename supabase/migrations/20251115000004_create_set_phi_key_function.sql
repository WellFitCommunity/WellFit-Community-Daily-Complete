-- ============================================================================
-- Create set_phi_key() function for Edge Functions
-- ============================================================================
-- Purpose: Allow Edge Functions to set the PHI encryption key from Vault
-- Called by: supabase/functions/get-risk-assessments/index.ts
-- Date: 2025-11-15
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.set_phi_key(TEXT);

-- ============================================================================
-- Function: set_phi_key
-- ============================================================================
-- Sets the PHI encryption key for the current database session
-- This allows Edge Functions to pass the key from Vault to the database
CREATE OR REPLACE FUNCTION public.set_phi_key(k TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set the encryption key for this session
  -- This key is used by decrypted views (e.g., risk_assessments_decrypted)
  PERFORM set_config('app.phi_encryption_key', k, false);
END;
$$;

-- Grant execute permissions to service role (used by Edge Functions)
GRANT EXECUTE ON FUNCTION public.set_phi_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_phi_key(TEXT) TO authenticated;

COMMENT ON FUNCTION public.set_phi_key IS 'Sets PHI encryption key for current session (called by Edge Functions with vault key)';
