/**
 * Link Super Admins to Auth Users
 *
 * This migration links Akima and Maria's auth.users accounts to super_admin_users.
 * Required for Supabase auth-based Envision portal login.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- LINK AKIMA AND MARIA TO SUPER_ADMIN_USERS
-- ============================================================================

-- User IDs from auth.users:
-- Akima Taylor: 06ce7189-1da3-4e22-a6b2-ede88aa1445a
-- Maria LeBlanc: ba4f20ad-2707-467b-a87f-d46fe9255d2f

-- Insert or update super_admin_users records for Akima
INSERT INTO super_admin_users (
  id,
  user_id,
  email,
  full_name,
  role,
  permissions,
  is_active
)
SELECT
  gen_random_uuid(),
  '06ce7189-1da3-4e22-a6b2-ede88aa1445a'::UUID,
  'Akima@thewellfitcommunity.org',
  'Akima Taylor',
  'super_admin',
  '["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]'::jsonb,
  true
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = '06ce7189-1da3-4e22-a6b2-ede88aa1445a'
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active;

-- Insert or update super_admin_users records for Maria
INSERT INTO super_admin_users (
  id,
  user_id,
  email,
  full_name,
  role,
  permissions,
  is_active
)
SELECT
  gen_random_uuid(),
  'ba4f20ad-2707-467b-a87f-d46fe9255d2f'::UUID,
  'Maria@thewellfitcommunity.org',
  'Maria LeBlanc',
  'super_admin',
  '["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]'::jsonb,
  true
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
)
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  is_active = EXCLUDED.is_active;

-- Verify the link
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM super_admin_users
  WHERE user_id IN (
    '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
    'ba4f20ad-2707-467b-a87f-d46fe9255d2f'
  ) AND is_active = true;
  
  IF v_count >= 1 THEN
    RAISE NOTICE 'Successfully linked % super admin(s) to auth.users', v_count;
  ELSE
    RAISE WARNING 'No super admins were linked. Verify auth.users records exist.';
  END IF;
END $$;
