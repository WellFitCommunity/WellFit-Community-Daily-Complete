-- ============================================================================
-- FIX ADMIN PIN AUTHENTICATION
-- Date: 2025-11-21
-- Purpose: Fix broken PIN authentication (Invalid hash format error)
-- Issue: PIN hashes in database are malformed (missing salt:hash separator)
-- ============================================================================

-- Ensure staff_pins table exists (it might be called admin_pins)
CREATE TABLE IF NOT EXISTS public.staff_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.staff_pins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "staff_pins_service_only" ON public.staff_pins;
CREATE POLICY "staff_pins_service_only"
ON public.staff_pins
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add index
CREATE INDEX IF NOT EXISTS idx_staff_pins_user_role
ON public.staff_pins(user_id, role);

-- ============================================================================
-- IMPORTANT: Reset PINs for users with malformed hashes
-- ============================================================================

-- Delete any pins with malformed hashes (no colon separator)
DELETE FROM public.staff_pins
WHERE pin_hash NOT LIKE '%:%';

DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE '✅ Admin PIN Authentication Fixed!';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Table: staff_pins exists with proper schema';
  RAISE NOTICE 'RLS: Enabled (service_role only)';
  RAISE NOTICE 'Cleanup: Removed malformed PIN hashes';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  ACTION REQUIRED:';
  RAISE NOTICE 'Users need to SET NEW PINs using the admin panel';
  RAISE NOTICE 'Old malformed PINs have been cleared';
  RAISE NOTICE '================================================================';
END $$;
