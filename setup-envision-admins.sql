/**
 * Setup Script: Envision Super Admin Accounts
 *
 * Configures Maria and Akima as Envision VirtualEdge Group super administrators
 * for access to the Master Panel via /envision route
 *
 * Emails:
 * - Maria@thewellfitcommunity.org
 * - Akima@thewellfitcommunity.org
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

-- ============================================================================
-- STEP 1: Check Current Status
-- ============================================================================

-- Check if Maria exists in auth.users
SELECT
  id as user_id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'Maria@thewellfitcommunity.org';

-- Check if Akima exists in auth.users
SELECT
  id as user_id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'Akima@thewellfitcommunity.org';

-- Check if they exist in super_admin_users table
SELECT
  sa.id,
  sa.user_id,
  u.email,
  sa.role,
  sa.is_active,
  sa.permissions,
  sa.created_at,
  sa.last_login_at
FROM super_admin_users sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email IN ('Maria@thewellfitcommunity.org', 'Akima@thewellfitcommunity.org');

-- ============================================================================
-- STEP 2: Add to super_admin_users (if auth accounts already exist)
-- ============================================================================

-- Insert Maria as super admin
INSERT INTO super_admin_users (
  user_id,
  email,
  role,
  is_active,
  permissions,
  created_at,
  updated_at
)
VALUES (
  'ba4f20ad-2707-467b-a87f-d46fe9255d2f',
  'Maria@thewellfitcommunity.org',
  'super_admin',
  true,
  '["full_access", "manage_tenants", "view_analytics", "manage_users"]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
  is_active = true,
  email = EXCLUDED.email,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- Insert Akima as super admin
INSERT INTO super_admin_users (
  user_id,
  email,
  role,
  is_active,
  permissions,
  created_at,
  updated_at
)
VALUES (
  '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
  'Akima@thewellfitcommunity.org',
  'super_admin',
  true,
  '["full_access", "manage_tenants", "view_analytics", "manage_users"]'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO UPDATE
SET
  is_active = true,
  email = EXCLUDED.email,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

-- Verify both accounts are properly configured
SELECT
  sa.id,
  u.email,
  sa.role,
  sa.is_active,
  sa.permissions,
  sa.created_at as super_admin_since
FROM super_admin_users sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email IN ('Maria@thewellfitcommunity.org', 'Akima@thewellfitcommunity.org')
ORDER BY u.email;

-- ============================================================================
-- NOTES FOR MANUAL SETUP (if auth accounts don't exist yet)
-- ============================================================================

/*
If Maria or Akima do NOT have auth.users accounts yet, they need to:

1. Go to the /envision login page in a browser
2. Try to log in with their email + a temporary PIN
3. This will fail, but you'll see the email in the logs
4. Create their auth account manually in Supabase Dashboard:
   - Go to Authentication > Users
   - Click "Invite user" or "Add user"
   - Email: Maria@thewellfitcommunity.org (or Akima's)
   - Send magic link OR set a temporary password
5. Once they have an auth.users entry, run STEP 2 queries above
6. They can then log in at /envision with:
   - Email: their email
   - PIN: their password (4-8 digits recommended for security)

SECURITY NOTES:
- PINs should be 4-8 digits as enforced by the login form
- All login attempts are audited in audit_logs table
- Failed attempts are logged with category AUTHENTICATION
- Unauthorized access attempts are logged with category SECURITY_EVENT
- Successful logins update last_login_at in super_admin_users table
*/
