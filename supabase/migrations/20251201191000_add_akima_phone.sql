/**
 * Add Akima's Phone Number
 *
 * Updates Akima Taylor's auth.users record with her phone number.
 * Note: We skip profiles table update due to app_owners trigger dependency.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- Update auth.users phone for Akima
-- This is the primary phone storage for Supabase auth
UPDATE auth.users
SET phone = '+17132911639',
    updated_at = NOW()
WHERE id = '06ce7189-1da3-4e22-a6b2-ede88aa1445a';

-- Verify
DO $$
DECLARE
  v_phone TEXT;
BEGIN
  SELECT phone INTO v_phone FROM auth.users WHERE id = '06ce7189-1da3-4e22-a6b2-ede88aa1445a';
  IF v_phone = '+17132911639' THEN
    RAISE NOTICE 'Successfully added phone number for Akima Taylor: %', v_phone;
  ELSE
    RAISE WARNING 'Phone update may have failed. Current value: %', COALESCE(v_phone, 'NULL');
  END IF;
END $$;
