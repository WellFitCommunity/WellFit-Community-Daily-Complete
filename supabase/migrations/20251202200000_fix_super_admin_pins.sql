-- ============================================================================
-- Fix Super Admin PINs - Correct Hash Format
-- Date: 2025-12-02
--
-- Issue: PINs were stored with bcrypt format ($2a$...) but the verify-admin-pin
--        edge function expects PBKDF2 format (base64salt:base64hash)
--
-- This migration replaces the incorrectly formatted hashes with proper PBKDF2
-- hashes for PIN '1234' (temporary - users should change after login)
--
-- The hash is generated from client-side SHA-256 of 'wellfit-admin-pin-v1:1234'
-- then server-side PBKDF2 with 100,000 iterations
-- ============================================================================

-- Maria's super_admin PIN (PIN: 1234)
UPDATE public.staff_pins
SET
  pin_hash = 'X+iDoq8r+eoXsyp0fa9AwA==:FK14bV915p9b9eyxd6T4LqlF/M/Ijpr5IZmPaiuNbw0=',
  updated_at = NOW()
WHERE user_id = 'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
  AND role = 'super_admin';

-- Akima's super_admin PIN (PIN: 1234)
UPDATE public.staff_pins
SET
  pin_hash = 'iLphIs+EJdFcPV38GWaRXA==:VFj5okB7SWQqHv3OxE2mShFQYwLFpp54MwVkyaOP5kI=',
  updated_at = NOW()
WHERE user_id = '06ce7189-1da3-4e22-a6b2-ede88aa1445a'
  AND role = 'super_admin';

-- Verify the updates
DO $$
DECLARE
  maria_hash TEXT;
  akima_hash TEXT;
BEGIN
  SELECT pin_hash INTO maria_hash FROM public.staff_pins
  WHERE user_id = 'ba4f20ad-2707-467b-a87f-d46fe9255d2f' AND role = 'super_admin';

  SELECT pin_hash INTO akima_hash FROM public.staff_pins
  WHERE user_id = '06ce7189-1da3-4e22-a6b2-ede88aa1445a' AND role = 'super_admin';

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Super Admin PINs Fixed!';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Maria PIN hash: %', LEFT(maria_hash, 30) || '...';
  RAISE NOTICE 'Akima PIN hash: %', LEFT(akima_hash, 30) || '...';
  RAISE NOTICE '';
  RAISE NOTICE 'Both users can now login with PIN: 1234';
  RAISE NOTICE 'IMPORTANT: Change PIN after first login!';
  RAISE NOTICE '================================================================';
END $$;
