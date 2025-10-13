# Billing System 403 Forbidden Error - Fix Guide

## Problem

You're seeing these errors in the browser console:

```
GET .../rest/v1/billing_providers?select=*&order=organization_name.asc 403 (Forbidden)
GET .../rest/v1/claims?select=status%2Ctotal_charge 403 (Forbidden)
GET .../rest/v1/claims?select=*&limit=10&order=created_at.desc 403 (Forbidden)
```

## Root Cause

The Row Level Security (RLS) policies on the `billing_providers` and `claims` tables are either:
1. Missing
2. Misconfigured
3. Not allowing access to the current user

## Quick Fix (5 minutes)

### Option 1: Run SQL Script in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `FIX_BILLING_RLS_NOW.sql`
4. Click **Run**
5. Refresh your app

### Option 2: Manual Fix via Supabase Dashboard

1. Go to **Database** → **Policies**
2. Find the `billing_providers` table
3. Click "New Policy" and add:
   ```sql
   Policy name: billing_providers_select
   Command: SELECT
   Target roles: authenticated
   USING expression: true
   ```

4. Find the `claims` table
5. Add these two policies:

   **Policy 1:**
   ```sql
   Policy name: claims_admin
   Command: ALL
   Target roles: authenticated
   USING expression: public.is_admin()
   WITH CHECK expression: public.is_admin()
   ```

   **Policy 2:**
   ```sql
   Policy name: claims_select_own
   Command: SELECT
   Target roles: authenticated
   USING expression: created_by = auth.uid()
   ```

## What the Fix Does

### billing_providers table
- ✅ All authenticated users can **read** (SELECT) all providers
- ✅ Only admins can create/update/delete providers

### claims table
- ✅ Admins can see and manage **ALL** claims
- ✅ Regular users can see **their own** claims (where `created_by = their user ID`)
- ✅ Regular users can create new claims

## Verify the Fix

After applying the fix, test in your browser console:

```javascript
// Should work now
const { data, error } = await supabase
  .from('billing_providers')
  .select('*');

console.log('Providers:', data, error);

// Should work for admins or show your own claims
const { data: claims, error: claimsError } = await supabase
  .from('claims')
  .select('*');

console.log('Claims:', claims, claimsError);
```

## Why This Happened

The billing system requires RLS policies to be properly configured. Without them, Supabase blocks all access (403 Forbidden) even if you're logged in. The policies control:

- **WHO** can access the data (admins vs regular users)
- **WHAT** operations they can perform (read, write, etc.)
- **WHICH** rows they can see (all rows vs own rows)

## Troubleshooting

### Still getting 403 after applying fix?

1. **Check your user's role:**
   ```sql
   SELECT role FROM profiles WHERE user_id = auth.uid();
   ```
   Should return 'admin', 'super_admin', or 'senior'

2. **Check if is_admin() works:**
   ```sql
   SELECT public.is_admin();
   ```
   Should return `true` for admin users, `false` for others

3. **Check if RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename IN ('billing_providers', 'claims');
   ```
   Both should show `rowsecurity = true`

4. **Check if policies exist:**
   ```sql
   SELECT tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('billing_providers', 'claims');
   ```
   Should show the policies we just created

### Error: "function is_admin() does not exist"

Run this first:
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.profiles
  WHERE user_id = auth.uid();

  RETURN user_role IN ('admin', 'super_admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
```

## Files

- `FIX_BILLING_RLS_NOW.sql` - Complete SQL fix script
- `supabase/migrations/20251007010000_fix_billing_rls_permissions.sql` - Full migration (for future deployments)

## Support

If you're still having issues:
1. Check the browser console for the exact error message
2. Check Supabase Dashboard → Logs for server-side errors
3. Verify you're logged in as an admin user
4. Try logging out and back in to refresh your session
