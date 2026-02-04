# Envision Admin Panel Access Guide

**Date:** 2025-11-16
**Status:** ✅ Complete Setup Instructions
**Copyright:** © 2025 Envision VirtualEdge Group LLC

---

## Overview

The **Envision Atlas Master Panel** is a powerful super admin dashboard that provides cross-tenant management, monitoring, and control capabilities for the WellFit white-label platform.

**Key Features:**
- 🏢 Multi-tenant management and monitoring
- 🚨 Feature flag controls with emergency kill switches
- 📊 AI cost tracking across all tenants
- 🔒 HIPAA-compliant system metrics (no PHI exposure)
- 🛡️ Guardian agent monitoring
- 📋 Platform-wide SOC2 compliance dashboard
- 📝 Comprehensive audit logging

---

## Quick Access Summary

| What | Where |
|------|-------|
| **Login URL** | `https://yourdomain.com/envision` |
| **Dashboard URL** | `https://yourdomain.com/super-admin` (after login) |
| **Required Credentials** | Email + 4-8 digit PIN |
| **Authentication Table** | `super_admin_users` |
| **Authorized Users** | Maria@thewellfitcommunity.org, Akima@thewellfitcommunity.org |

---

## Step-by-Step Access Instructions

### Step 1: Navigate to the Envision Login Page

1. Open your browser
2. Navigate to: `https://yourdomain.com/envision`
   - Replace `yourdomain.com` with your actual domain
   - Example: `https://wellfit.com/envision`

**Note:** This URL is intentionally not linked anywhere in the public UI. Only Envision staff know about this secret entry point.

---

### Step 2: Enter Your Credentials

The login page will display:
- **Email Address** field
- **PIN** field (4-8 digits)

**Expected Credentials:**
- **Maria:** Maria@thewellfitcommunity.org + your PIN
- **Akima:** Akima@thewellfitcommunity.org + your PIN

**Security Notes:**
- All login attempts are logged to `audit_logs` table
- Failed attempts are logged with category `AUTHENTICATION`
- Unauthorized access attempts trigger `SECURITY_EVENT` logs

---

### Step 3: Authentication Flow

When you submit the login form, the system:

1. **Authenticates against Supabase Auth** using email + PIN as password
2. **Verifies super admin status** by checking `super_admin_users` table
3. **Checks if account is active** (`is_active = true`)
4. **Logs successful login** to audit trail
5. **Updates last_login_at** timestamp
6. **Redirects to Master Panel** at `/super-admin`

---

## First-Time Setup (If You Don't Have Access Yet)

### Option A: Check If Your Account Exists

Run this SQL query in Supabase Dashboard:

```sql
-- Check if you exist in auth.users
SELECT
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email IN ('Maria@thewellfitcommunity.org', 'Akima@thewellfitcommunity.org');

-- Check if you exist in super_admin_users
SELECT
  sa.id,
  sa.user_id,
  u.email,
  sa.role,
  sa.is_active,
  sa.permissions,
  sa.last_login_at
FROM super_admin_users sa
JOIN auth.users u ON u.id = sa.user_id
WHERE u.email IN ('Maria@thewellfitcommunity.org', 'Akima@thewellfitcommunity.org');
```

---

### Option B: Create Super Admin Account (If Doesn't Exist)

#### Step 1: Create Auth User (if needed)

If you don't have an auth.users account:

1. Go to Supabase Dashboard → Authentication → Users
2. Click **"Add user"** or **"Invite user"**
3. Enter email: `Maria@thewellfitcommunity.org` (or Akima's)
4. Set a temporary password OR send magic link
5. Save the `user_id` (UUID) that gets created

**Or use this SQL:**

```sql
-- This creates a user with a temporary password
-- Replace 'TEMP_PASSWORD_HERE' with a secure password
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'Maria@thewellfitcommunity.org',
  crypt('TEMP_PASSWORD_HERE', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);
```

#### Step 2: Add User to super_admin_users Table

Once you have a `user_id` from auth.users, run:

```sql
-- Add Maria as super admin
INSERT INTO super_admin_users (
  user_id,
  email,
  full_name,
  role,
  permissions,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  'Maria@thewellfitcommunity.org',
  'Maria',
  'super_admin',
  '["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]'::jsonb,
  true,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'Maria@thewellfitcommunity.org'
ON CONFLICT (user_id) DO UPDATE
SET
  is_active = true,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

-- Add Akima as super admin
INSERT INTO super_admin_users (
  user_id,
  email,
  full_name,
  role,
  permissions,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  'Akima@thewellfitcommunity.org',
  'Akima',
  'super_admin',
  '["tenants.manage", "features.toggle", "system.kill_switch", "users.manage", "audit.view"]'::jsonb,
  true,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'Akima@thewellfitcommunity.org'
ON CONFLICT (user_id) DO UPDATE
SET
  is_active = true,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();
```

#### Step 3: Verify Setup

```sql
-- Confirm both accounts are properly configured
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
```

---

## Master Panel Features

Once logged in at `/super-admin`, you'll see:

### 📊 Overview Tab
- Total tenants (active, suspended)
- Total users and patients
- Critical health issues
- Recent audit events

### 🏢 Tenants Tab
- List all white-label tenants
- View tenant status and activity
- Suspend/activate tenants
- Assign resource limits

### 🚨 Feature Flags Tab
- Global feature configuration
- Emergency kill switches
- Per-tenant feature overrides
- Category-based organization (core, healthcare, law_enforcement, billing)

### 🔑 API Keys Tab
- Manage API integrations
- View API usage statistics
- Revoke/regenerate keys

### 💰 AI Cost & Usage Tab
- Platform-wide AI cost tracking
- Tenant-by-tenant breakdown
- Top users by AI consumption
- Token usage analytics

### 🛡️ Platform SOC2 Tab
- Cross-tenant compliance scores
- HIPAA/MFA/Audit status
- Security posture dashboard

### 🤖 Guardian Agent Tab
- Real-time agent monitoring
- Critical alerts
- Cron job execution logs
- Manual health check triggers

### 🏥 System Health Tab
- Database health
- API endpoint status
- Storage metrics
- Cache performance

### 📝 Audit Logs Tab
- Platform-wide audit trail
- Super admin actions
- Security events
- Compliance reports

---

## Super Admin Roles and Permissions

### Available Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `super_admin` | Full control of platform | Read/Write/Delete all |
| `system_operator` | Day-to-day operations | Read/Write (limited delete) |
| `auditor` | Compliance and reporting | Read-only access |

### Permission Strings

Super admin permissions are stored as JSONB array:

```json
[
  "tenants.manage",
  "features.toggle",
  "system.kill_switch",
  "users.manage",
  "audit.view",
  "full_access"
]
```

**Common Permissions:**
- `tenants.manage` - Create, suspend, configure tenants
- `features.toggle` - Enable/disable feature flags
- `system.kill_switch` - Emergency disable features globally
- `users.manage` - Manage super admin users
- `audit.view` - View audit logs
- `full_access` - Unrestricted access to all features

---

## Security and Compliance

### Audit Logging

All super admin actions are logged to `super_admin_audit_log` table:

```sql
-- View recent super admin actions
SELECT
  sa.email as admin_email,
  sal.action,
  sal.target_type,
  sal.target_name,
  sal.reason,
  sal.severity,
  sal.created_at
FROM super_admin_audit_log sal
JOIN super_admin_users sa ON sa.id = sal.super_admin_id
ORDER BY sal.created_at DESC
LIMIT 50;
```

**Severity Levels:**
- `info` - Routine actions (viewing dashboards, reading data)
- `warning` - Configuration changes (feature toggles, user updates)
- `critical` - High-impact actions (tenant suspension, emergency kill switches)

### HIPAA Compliance

**Super admins CANNOT see:**
- ❌ Patient names or PHI (Protected Health Information)
- ❌ Medical records or clinical notes
- ❌ Specific patient check-in data
- ❌ Individual billing details

**Super admins CAN see:**
- ✅ Aggregate system metrics
- ✅ Tenant-level statistics (counts only)
- ✅ System health and performance
- ✅ Feature usage analytics
- ✅ Compliance scores

This ensures **HIPAA compliance** - super admins have administrative access without PHI exposure.

---

## Troubleshooting

### Problem: "Invalid email or PIN"

**Causes:**
1. Typo in email or PIN
2. Account not in auth.users table
3. Incorrect PIN/password

**Solution:**
1. Double-check email spelling (case-sensitive)
2. Verify account exists in auth.users (see SQL above)
3. Reset password in Supabase Dashboard if needed

---

### Problem: "Unauthorized: Super admin access required"

**Causes:**
1. User authenticated but not in super_admin_users table
2. Account exists but is_active = false

**Solution:**
```sql
-- Check if you're in super_admin_users
SELECT * FROM super_admin_users
WHERE user_id = 'YOUR_USER_ID_HERE';

-- If missing, run the INSERT statement from Step 2 above

-- If exists but inactive, activate:
UPDATE super_admin_users
SET is_active = true, updated_at = NOW()
WHERE user_id = 'YOUR_USER_ID_HERE';
```

---

### Problem: "Page not found" when navigating to /envision

**Causes:**
1. Route not deployed
2. Frontend build issue

**Solution:**
1. Check `src/App.tsx` for `/envision` route
2. Rebuild frontend: `npm run build`
3. Verify deployment includes latest code

---

### Problem: Can't see Master Panel after login

**Causes:**
1. Redirect issue
2. `/super-admin` route not configured

**Solution:**
1. Manually navigate to `/super-admin` after login
2. Check browser console for errors
3. Verify `MasterPanel` component exists in src/

---

## Emergency Kill Switch Usage

If a critical issue arises with a feature, super admins can use the emergency kill switch:

### Via UI (Recommended)
1. Login to Master Panel
2. Go to **Feature Flags** tab
3. Find the problematic feature
4. Click **"Emergency Disable"**
5. Enter reason for audit trail
6. Confirm action

### Via SQL (Direct Database)
```sql
-- Emergency disable a feature globally
SELECT emergency_disable_feature(
  'healthcare.ehr_integration',  -- feature_key
  'Production incident: EHR adapter causing data corruption',  -- reason
  (SELECT id FROM super_admin_users WHERE email = 'Maria@thewellfitcommunity.org')  -- super_admin_id
);
```

**This will:**
- ✅ Set `force_disabled = true` on the feature flag
- ✅ Disable the feature for **ALL tenants** immediately
- ✅ Log critical audit event
- ✅ Send alert to monitoring systems (if configured)

---

## Multi-Tenant Monitoring

Super admins can monitor up to 4 tenants simultaneously:

1. Login to Master Panel
2. Click **"Multi-Tenant View"** button
3. Select tenants from dropdown (up to 4)
4. View split-screen dashboard with:
   - System health metrics
   - User counts
   - API usage
   - Feature status
   - Recent activity

**HIPAA Note:** Only aggregate metrics shown - no patient data.

---

## Support and Resources

### Documentation Files
- `MASTER_PANEL_SETUP.md` - Complete setup guide
- `ENVISION_MULTI_TENANT_SETUP.md` - Multi-tenant configuration
- `setup-envision-admins.sql` - SQL setup scripts

### Database Tables
- `super_admin_users` - Super admin accounts
- `super_admin_audit_log` - Action audit trail
- `system_feature_flags` - Global feature flags
- `tenant_system_status` - Tenant activation status
- `system_health_checks` - Monitoring data
- `system_metrics` - Platform statistics

### Helper Functions
- `is_super_admin()` - Check if current user is super admin
- `get_system_overview()` - Get platform stats
- `get_all_tenants_with_status()` - List all tenants
- `emergency_disable_feature()` - Kill switch
- `suspend_tenant()` - Suspend a tenant

---

## Next Steps After First Login

1. ✅ **Verify Access** - Confirm you can see all dashboard tabs
2. ✅ **Review Tenants** - Check all white-label deployments
3. ✅ **Check Feature Flags** - Ensure proper configuration
4. ✅ **Monitor AI Costs** - Review platform-wide usage
5. ✅ **Review Audit Logs** - Check for any security events
6. ✅ **Test Emergency Features** - Practice using kill switches in staging
7. ✅ **Configure Alerts** - Set up notifications for critical events

---

## Quick Reference Commands

### Check Super Admin Status
```sql
SELECT is_super_admin();  -- Returns true/false
```

### Get Platform Overview
```sql
SELECT get_system_overview();
```

### List All Tenants
```sql
SELECT * FROM get_all_tenants_with_status();
```

### Recent Audit Events
```sql
SELECT action, target_name, severity, created_at
FROM super_admin_audit_log
ORDER BY created_at DESC
LIMIT 20;
```

---

## Contact Information

**Envision VirtualEdge Group LLC**

**Support:**
- Email: support@envisionvirtualedge.com
- Phone: +1-555-ENVISION
- Emergency (24/7): Enterprise customers only

**Documentation:**
- All deployment guides in root directory
- Feature catalog: `COMPREHENSIVE_FEATURES_CATALOG.md`
- Database schema: `DATABASE_SCHEMA_REFERENCE.md`

---

## Summary

**To access the Envision Admin Panel:**

1. Navigate to `/envision`
2. Login with your @thewellfitcommunity.org email + PIN
3. Access Master Panel at `/super-admin`
4. Manage platform, tenants, features, and compliance

**You now have:**
- ✅ Cross-tenant super admin access
- ✅ Emergency kill switch capabilities
- ✅ HIPAA-compliant monitoring
- ✅ Complete audit trail visibility
- ✅ Platform-wide control and oversight

---

**Congratulations!** You now have full access to the Envision Atlas Master Panel for managing your white-label WellFit platform.
