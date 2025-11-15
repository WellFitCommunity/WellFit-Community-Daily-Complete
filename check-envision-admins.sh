#!/bin/bash
# Check Envision Super Admin Account Status
# Queries Supabase to verify Maria and Akima's account configuration

set -e

echo "================================================"
echo "Envision Super Admin Account Status Check"
echo "================================================"
echo ""

# Check if SUPABASE_DB_URL is set
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ ERROR: SUPABASE_DB_URL environment variable not set"
  echo ""
  echo "To set it, run:"
  echo "  export SUPABASE_DB_URL='postgresql://postgres:[password]@[project-ref].supabase.co:5432/postgres'"
  echo ""
  exit 1
fi

echo "✓ Database connection configured"
echo ""

# Step 1: Check auth.users
echo "================================================"
echo "STEP 1: Checking auth.users table"
echo "================================================"
echo ""
echo "Maria@thewellfitcommunity.org:"
psql "$SUPABASE_DB_URL" -c "
  SELECT
    id as user_id,
    email,
    created_at,
    email_confirmed_at IS NOT NULL as email_confirmed,
    last_sign_in_at
  FROM auth.users
  WHERE email = 'Maria@thewellfitcommunity.org';
" || echo "❌ Not found in auth.users"

echo ""
echo "Akima@thewellfitcommunity.org:"
psql "$SUPABASE_DB_URL" -c "
  SELECT
    id as user_id,
    email,
    created_at,
    email_confirmed_at IS NOT NULL as email_confirmed,
    last_sign_in_at
  FROM auth.users
  WHERE email = 'Akima@thewellfitcommunity.org';
" || echo "❌ Not found in auth.users"

echo ""
echo "================================================"
echo "STEP 2: Checking super_admin_users table"
echo "================================================"
echo ""
psql "$SUPABASE_DB_URL" -c "
  SELECT
    sa.id,
    u.email,
    sa.role,
    sa.is_active,
    sa.permissions,
    sa.created_at as super_admin_since,
    sa.last_login_at
  FROM super_admin_users sa
  JOIN auth.users u ON u.id = sa.user_id
  WHERE u.email IN ('Maria@thewellfitcommunity.org', 'Akima@thewellfitcommunity.org')
  ORDER BY u.email;
" || echo "❌ No Envision super admins found"

echo ""
echo "================================================"
echo "STEP 3: Recent Envision Login Attempts"
echo "================================================"
echo ""
psql "$SUPABASE_DB_URL" -c "
  SELECT
    event_type,
    category,
    metadata->>'email' as email,
    created_at,
    metadata->>'reason' as reason
  FROM audit_logs
  WHERE event_type LIKE 'ENVISION_%'
  ORDER BY created_at DESC
  LIMIT 10;
" || echo "ℹ No Envision login attempts logged yet"

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. If users missing from auth.users: Create accounts in Supabase Dashboard"
echo "2. If users missing from super_admin_users: Run setup-envision-admins.sql"
echo "3. Test login at: /envision"
echo ""
