# Master Panel Setup Guide

This guide will help you set up the new Envision Atlas Master Panel with all features including AI cost tracking, Guardian monitoring, and multi-tenant access.

## Prerequisites

- Supabase project: `xkybsjnvuohpqpbkikyn`
- Supabase CLI installed or access to Supabase dashboard
- Super admin access to the database

## Step 1: Run Database Migrations

### Option A: Using Supabase CLI (Recommended)

```bash
# Link to your Supabase project
npx supabase link --project-ref xkybsjnvuohpqpbkikyn

# Push all new migrations
npx supabase db push
```

### Option B: Using Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new
2. Run these migrations in order:

#### Migration 1: Super Admin System (if not already run)
```sql
-- Copy contents from: supabase/migrations/20251111120000_super_admin_system.sql
-- This creates super_admin_users, system_feature_flags, tenant_system_status, etc.
```

#### Migration 2: AI Cost Tracking System
```sql
-- Copy contents from: supabase/migrations/20251114000000_ai_cost_tracking_system.sql
-- This creates ai_usage_logs table and cost tracking functions
```

#### Migration 3: Multi-Tenant Assignments
```sql
-- Copy contents from: supabase/migrations/20251114000001_super_admin_multi_tenant_assignments.sql
-- This creates super_admin_tenant_assignments table and functions
```

### Option C: Using psql (Direct Database Access)

```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:[password]@db.xkybsjnvuohpqpbkikyn.supabase.co:5432/postgres"

# Run migrations
psql $DATABASE_URL -f supabase/migrations/20251111120000_super_admin_system.sql
psql $DATABASE_URL -f supabase/migrations/20251114000000_ai_cost_tracking_system.sql
psql $DATABASE_URL -f supabase/migrations/20251114000001_super_admin_multi_tenant_assignments.sql
```

## Step 2: Create WellFit Tenant (if not exists)

```sql
-- Insert WellFit tenant with code WF-001
INSERT INTO tenants (name, subdomain, tenant_code)
VALUES ('WellFit Community', 'wellfit', 'WF-001')
ON CONFLICT (subdomain) DO UPDATE SET tenant_code = 'WF-001';
```

## Step 3: Add Super Admins (Maria & Akima)

```sql
-- First, Maria and Akima need to sign up through the app
-- Then get their auth.users IDs and run:

-- Add Maria as super admin
INSERT INTO super_admin_users (
  user_id,
  email,
  full_name,
  role,
  permissions,
  is_active
)
SELECT
  id,
  'maria@thewellfitcommunity.org',
  'Maria',
  'super_admin',
  '["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]'::jsonb,
  true
FROM auth.users
WHERE email = 'maria@thewellfitcommunity.org'
ON CONFLICT (user_id) DO NOTHING;

-- Add Akima as super admin
INSERT INTO super_admin_users (
  user_id,
  email,
  full_name,
  role,
  permissions,
  is_active
)
SELECT
  id,
  'akima@thewellfitcommunity.org',
  'Akima',
  'super_admin',
  '["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]'::jsonb,
  true
FROM auth.users
WHERE email = 'akima@thewellfitcommunity.org'
ON CONFLICT (user_id) DO NOTHING;
```

## Step 4: Assign Maria & Akima to WellFit Tenant

```sql
-- Assign Maria to WellFit with full access
SELECT assign_super_admin_to_tenant(
  'maria@thewellfitcommunity.org',
  (SELECT id FROM tenants WHERE tenant_code = 'WF-001'),
  'full',
  'WellFit tenant owner'
);

-- Assign Akima to WellFit with full access
SELECT assign_super_admin_to_tenant(
  'akima@thewellfitcommunity.org',
  (SELECT id FROM tenants WHERE tenant_code = 'WF-001'),
  'full',
  'WellFit tenant owner'
);
```

## Step 5: Verify Guardian Tables Exist

Guardian monitoring requires these tables (should already exist from earlier migrations):

```sql
-- Check if guardian tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('guardian_alerts', 'guardian_cron_log');
```

If they don't exist, run:
```sql
-- Copy from: supabase/migrations/20251107180000_guardian_cron_monitoring.sql
```

## Step 6: Test Login

1. Navigate to your app URL
2. Login as Maria or Akima using their @thewellfitcommunity.org emails
3. You should be redirected to the **Envision Atlas Master panel** with teal background
4. Verify you can see all tabs:
   - Overview
   - Tenants
   - Feature Flags
   - API Keys
   - **AI Cost & Usage** (NEW)
   - Platform SOC2
   - **Guardian Agent** (NEW)
   - System Health
   - Audit Logs

## Step 7: Configure Multi-Tenant Monitoring

1. Click on the **Multi-Tenant** button (if added to navigation)
2. Select tenants you want to monitor (up to 4 at once)
3. View HIPAA-compliant system metrics (NO patient data visible)

## Features Available

### ✅ Platform AI Cost Dashboard
- Cross-tenant AI usage tracking
- Shows total costs across ALL tenants
- Tenant-by-tenant breakdown
- Filters: 24h, 7d, 30d

### ✅ Tenant AI Usage Dashboard
- Top 5 users by AI cost (highlighted with trophy icons)
- Staff-only visibility (HIPAA compliant)
- Per-user metrics: tokens, requests, cost

### ✅ Guardian Agent Monitoring
- Real-time agent status (online/degraded/offline)
- Critical alerts tracking
- Cron job execution history
- Manual health check trigger

### ✅ Multi-Tenant Monitoring
- Select up to 4 tenants simultaneously
- Split-screen grid layout
- **HIPAA-COMPLIANT**: Shows ONLY aggregate metrics
- NO patient names, NO business details visible

### ✅ Platform SOC2 Dashboard
- Cross-tenant compliance scores
- HIPAA/MFA/Audit status per tenant
- Platform-wide metrics

## Troubleshooting

### "Super admin users table does not exist"
Run migration: `20251111120000_super_admin_system.sql`

### "AI usage logs table does not exist"
Run migration: `20251114000000_ai_cost_tracking_system.sql`

### "Cannot access multi-tenant selector"
Ensure you ran: `20251114000001_super_admin_multi_tenant_assignments.sql`

### "Guardian dashboard shows no data"
Check that guardian_alerts and guardian_cron_log tables exist.
Run migration from: `supabase/migrations/` (look for guardian files)

### "Not redirected to Master Panel after login"
Verify you are in the super_admin_users table:
```sql
SELECT * FROM super_admin_users WHERE email = 'your-email@thewellfitcommunity.org';
```

## Security Notes

- ✅ All dashboards are HIPAA-compliant
- ✅ No PHI (Protected Health Information) exposed to platform admins
- ✅ RLS policies enforce tenant isolation
- ✅ All super admin actions are audit logged
- ✅ Multi-tenant monitoring shows ONLY system metrics

## Next Steps

1. Run the migrations
2. Create users and assign roles
3. Test login to Master Panel
4. Configure multi-tenant assignments as needed
5. Monitor AI costs and Guardian alerts

---

Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
