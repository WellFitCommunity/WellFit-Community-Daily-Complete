# Envision Atlas Multi-Tenant Setup Guide

## Overview
This guide helps you set up the multi-tenant monitoring system for Envision VirtualEdge Group staff members (Maria, Akima, and others).

---

## Step 1: Verify WellFit Tenant Exists

### Check if WellFit tenant is in the database:

```sql
-- Run in Supabase SQL Editor
SELECT id, name, subdomain, tenant_code
FROM tenants
WHERE tenant_code = 'WF-001'
   OR name ILIKE '%wellfit%';
```

### If WellFit doesn't exist, create it:

```sql
-- Create WellFit tenant
INSERT INTO tenants (name, subdomain, tenant_code, created_at)
VALUES ('WellFit Community', 'wellfit', 'WF-001', NOW())
RETURNING id, name, tenant_code;
```

**Save the `id` from the result - you'll need it below!**

---

## Step 2: Verify Super Admin Users

### Check if Maria and Akima are super admins:

```sql
-- Check super admin status
SELECT
  sa.id,
  sa.email,
  sa.full_name,
  sa.role,
  sa.is_active
FROM super_admin_users sa
WHERE sa.email IN ('maria@thewellfitcommunity.org', 'akima@thewellfitcommunity.org');
```

### If they don't exist, add them:

First, get their user IDs from auth.users:

```sql
-- Get user IDs
SELECT id, email FROM auth.users
WHERE email IN ('maria@thewellfitcommunity.org', 'akima@thewellfitcommunity.org');
```

Then add to super_admin_users:

```sql
-- Add Maria (replace <MARIA_USER_ID> with actual ID)
INSERT INTO super_admin_users (user_id, email, full_name, role, is_active, created_at)
VALUES (
  '<MARIA_USER_ID>',
  'maria@thewellfitcommunity.org',
  'Maria',
  'super_admin',
  true,
  NOW()
);

-- Add Akima (replace <AKIMA_USER_ID> with actual ID)
INSERT INTO super_admin_users (user_id, email, full_name, role, is_active, created_at)
VALUES (
  '<AKIMA_USER_ID>',
  'akima@thewellfitcommunity.org',
  'Akima',
  'super_admin',
  true,
  NOW()
);
```

---

## Step 3: Assign WellFit Tenant to Maria & Akima

Update their profiles to include WellFit's tenant_id:

```sql
-- First, get WellFit's tenant ID
SELECT id FROM tenants WHERE tenant_code = 'WF-001';

-- Update Maria's profile (replace <WELLFIT_TENANT_ID> with actual ID)
UPDATE profiles
SET tenant_id = '<WELLFIT_TENANT_ID>'
WHERE email = 'maria@thewellfitcommunity.org';

-- Update Akima's profile
UPDATE profiles
SET tenant_id = '<WELLFIT_TENANT_ID>'
WHERE email = 'akima@thewellfitcommunity.org';
```

---

## Step 4: Test the System

### 4.1 Login as Maria or Akima

### 4.2 Navigate to Tenant Selector

Go to: `http://localhost:3000/tenant-selector`

You should see:
- ✅ **Master Panel** button (red, for super admins)
- ✅ **WellFit** button (with code "WF-001")
- ✅ Any other tenants you're assigned to

### 4.3 Test Master Panel Access

Click **Master Panel** → Should see:
- Overview tab
- Tenants tab (showing all tenants)
- Feature Flags
- API Keys
- **Platform SOC2** (new!)
- System Health
- Audit Logs

### 4.4 Test Multi-Tenant Monitoring

1. Go back to `/tenant-selector`
2. Click on WellFit (and optionally another tenant)
3. Click **"Open Multi-View"**
4. Should see split-screen with tenant admin panels side-by-side

---

## Step 5: Add Other Envision Staff

For other Envision employees (IT, Support, etc.):

```sql
-- Example: Add Sarah (IT Staff) with access to WellFit and Methodist

-- 1. Get Sarah's user_id from auth.users
SELECT id FROM auth.users WHERE email = 'sarah@envisionvirtualedge.com';

-- 2. Add to super_admin_users with appropriate role
INSERT INTO super_admin_users (user_id, email, full_name, role, is_active, created_at)
VALUES (
  '<SARAH_USER_ID>',
  'sarah@envisionvirtualedge.com',
  'Sarah',
  'system_operator',  -- or 'auditor' for read-only
  true,
  NOW()
);

-- 3. Assign to tenant (if needed for tenant-specific admin access)
UPDATE profiles
SET tenant_id = '<WELLFIT_TENANT_ID>'  -- or Methodist's ID
WHERE email = 'sarah@envisionvirtualedge.com';
```

---

## Step 6: Assign Staff to Multiple Tenants (Future Enhancement)

**Current Limitation:** Each profile can only have ONE `tenant_id`.

**To monitor multiple tenants:**
- Super admins (you & Akima) can access **all** tenants through Master Panel
- For other staff, you'll need to create a `super_admin_tenant_assignments` table (future enhancement)

**Workaround for now:**
- Give staff member `super_admin` or `system_operator` role
- They can access all tenants through the Master Panel
- Use the Multi-Tenant Monitor to watch specific tenants

---

## Routes Reference

| Route | Purpose | Who Can Access |
|-------|---------|---------------|
| `/super-admin` | Master Panel (cross-tenant control) | Super Admins only |
| `/tenant-selector` | Choose tenants to monitor | Envision staff with assignments |
| `/multi-tenant-monitor?tenants=id1,id2` | Split-screen monitor | Assigned staff |
| `/admin` | Tenant-specific admin panel | Tenant admins + Envision staff |

---

## Troubleshooting

### "No tenants assigned"
- Check: `SELECT * FROM profiles WHERE id = '<YOUR_USER_ID>';`
- Ensure `tenant_id` is set to WellFit's ID

### "You don't have access"
- Check: `SELECT * FROM super_admin_users WHERE user_id = '<YOUR_USER_ID>';`
- Ensure `is_active = true`

### "WellFit doesn't show up"
- Check: `SELECT * FROM tenants WHERE tenant_code = 'WF-001';`
- Ensure tenant exists and is active

### Master Panel button doesn't appear
- Check: `SELECT role FROM super_admin_users WHERE user_id = '<YOUR_USER_ID>';`
- Ensure role is `super_admin`, not just `system_operator`

---

## Next Steps

✅ Database setup complete
✅ Routes configured
✅ UI components ready

**What to do next:**
1. Run the SQL queries above to set up WellFit tenant
2. Verify Maria and Akima are in `super_admin_users`
3. Assign them to WellFit tenant
4. Test the tenant selector at `/tenant-selector`
5. Report any issues

---

## Security Notes

- ✅ RLS policies enforce tenant isolation
- ✅ Super admins can see all tenants (by design)
- ✅ Regular tenant admins can only see their tenant's data
- ✅ All actions are logged via auditLogger
- ✅ No console.log statements (HIPAA compliant)

**Methodist Hospital's admin CANNOT see Miami Health's data** (enforced by RLS policies on profiles.tenant_id)

---

## Contact

Questions? Issues? Reach out to the development team!

**Built with ❤️ by Claude for Envision VirtualEdge Group LLC**
