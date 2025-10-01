# Migration and Multi-Tenancy Notes

## Date: 2025-10-01

This document explains the changes made and their impact on your white-label multi-tenant application.

---

## 1. Migration Safety

### What Was Changed Directly in Database
The following changes were applied directly to your local Supabase database to fix immediate issues:
- ✅ Created `community_moments` table
- ✅ Created `affirmations` table
- ✅ Created `community-moments` storage bucket
- ✅ Added caregiver/emergency contact columns to `profiles`
- ✅ Created `check_ins` table
- ✅ Added missing columns to `self_reports` table

### Migration Files Created
To prevent conflicts when running migrations on other environments, the following migration files were created:

1. **20251001000000_create_community_moments_and_affirmations.sql**
   - Creates community moments functionality
   - Creates affirmations for daily motivation
   - Sets up storage bucket and RLS policies

2. **20251001000001_add_emergency_caregiver_contacts.sql**
   - Adds emergency contact phone to profiles
   - Adds caregiver contact information fields

3. **20251001000002_create_check_ins_table.sql**
   - Creates check_ins table for daily wellness tracking
   - Includes crisis intervention support

4. **20251001000003_add_self_reports_missing_columns.sql**
   - Adds missing health tracking fields
   - Adds care team review tracking

### What To Do Next

#### For Development/Local Environment
✅ Already applied - no action needed

#### For Production/Staging Environments
When you're ready to deploy these changes:

```bash
# Option 1: Using Supabase CLI (recommended)
supabase db push

# Option 2: Apply migrations manually
supabase migration up

# Option 3: Let your CI/CD pipeline handle it
# (if you have automated migrations set up)
```

**IMPORTANT**: These migrations are **idempotent** (safe to run multiple times) because they use:
- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- `DROP POLICY IF EXISTS` before `CREATE POLICY`
- `ON CONFLICT DO NOTHING` for data inserts

---

## 2. Multi-Tenancy Impact

### Your Multi-Tenancy Model

Based on code review, your app uses **subdomain-based branding** with **shared database** architecture:

```
houston.yourdomain.com    → WellFit Houston (red/gold branding)
miami.yourdomain.com      → WellFit Miami (teal/coral branding)
phoenix.yourdomain.com    → WellFit Phoenix (desert colors)
seattle.yourdomain.com    → WellFit Seattle (evergreen/blue)
yourdomain.com            → WellFit Community (default blue/green)
```

### Data Isolation Level

**You have SHARED DATA across all tenants** with the following isolation:

1. **User-Level Isolation** (via RLS):
   - Users can only see their own data
   - Admins can see all users within their permission scope
   - Caregivers can see patients they have grants for

2. **NO Tenant-Level Isolation**:
   - All tenants share the same database tables
   - No `tenant_id` or `organization_id` columns
   - Data is separated by `user_id`, not by tenant

### Impact on Your Tenants

#### ✅ What Works Cross-Tenant (Good)
All the changes made are **tenant-agnostic** and will work identically for all tenants:

1. **Community Moments**:
   - All tenants get the feature
   - Houston seniors can share moments
   - Miami users can share moments
   - Data is isolated by `user_id` (RLS)

2. **Crisis Intervention**:
   - 988 suicide prevention line works for all US tenants
   - 911 emergency works for all tenants
   - Each user's emergency contact is from their own profile

3. **Check-ins & Health Data**:
   - Each tenant's users track their own health
   - Care teams see only their patients
   - Doctor's view shows correct data per user

#### ⚠️ Potential Concerns

1. **Shared Affirmations**:
   - All 10 affirmations are shared across tenants
   - If Houston wants custom affirmations, you'd need to add a `tenant_id` or `subdomain` column
   - **Recommendation**: Add tenant-specific affirmations later if needed

2. **Storage Bucket**:
   - All community moment photos go to same `community-moments` bucket
   - Files are organized by `user_id/timestamp_filename.jpg`
   - **This is fine** - users can't access other users' photos due to RLS

3. **Crisis Resources**:
   - Currently hardcoded to US resources (988, 911)
   - **Consideration**: If you expand internationally, you'll need:
     - Regional crisis line numbers
     - Country-specific emergency numbers
     - Could add to tenant branding config

### Recommended Enhancements for Multi-Tenancy

If you want stronger tenant isolation in the future, consider:

```sql
-- Add tenant tracking (optional future enhancement)
ALTER TABLE public.profiles
ADD COLUMN tenant_subdomain text;

-- Then update RLS policies to include tenant checks
CREATE POLICY "users_select_same_tenant"
ON some_table FOR SELECT
USING (
  user_id = auth.uid()
  OR tenant_subdomain = get_current_tenant()
);
```

But for now, **the current user-level isolation is sufficient** for most white-label SaaS applications.

---

## 3. Testing Recommendations

### Per-Tenant Testing Checklist

Test these features on each tenant subdomain to ensure branding works correctly:

- [ ] Community Moments displays with tenant colors
- [ ] Crisis intervention modals use tenant branding
- [ ] Check-in buttons match tenant theme
- [ ] Doctor's view shows proper tenant header/colors
- [ ] Emergency contact phone numbers save/load correctly

### Data Isolation Testing

Verify RLS is working:

```sql
-- As User A (houston.yourdomain.com)
SELECT * FROM community_moments; -- Should only see User A's moments

-- As Admin at Miami tenant
SELECT * FROM check_ins WHERE user_id = 'user_from_phoenix';
-- Should work if admin has cross-tenant permissions
-- Should fail if admin is tenant-restricted
```

---

## 4. Rollback Plan

If something goes wrong:

### Local Development
```bash
# Reset local database
supabase db reset

# Reapply all migrations
supabase migration up
```

### Production
```sql
-- Rollback individual migrations (in reverse order)
-- DROP TABLE IF EXISTS community_moments CASCADE;
-- DROP TABLE IF EXISTS affirmations CASCADE;
-- DROP TABLE IF EXISTS check_ins CASCADE;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS emergency_contact_phone;
-- etc.
```

Better approach: **Test thoroughly in staging first!**

---

## 5. Future Considerations

### If You Want Per-Tenant Data Isolation

Option A: **Add tenant column** (simpler)
```sql
ALTER TABLE community_moments ADD COLUMN tenant_subdomain text;
CREATE INDEX idx_community_moments_tenant ON community_moments(tenant_subdomain);
```

Option B: **Separate schemas per tenant** (more complex)
```sql
CREATE SCHEMA houston;
CREATE SCHEMA miami;
-- Copy table structures to each schema
```

Option C: **Separate databases per tenant** (most isolated)
- Each tenant gets own Supabase project
- Requires more infrastructure management
- Better for compliance (HIPAA, GDPR per tenant)

### Current Recommendation

**Stay with current model** (shared database, user-level isolation) because:
1. ✅ Simpler to maintain
2. ✅ Lower infrastructure costs
3. ✅ Easier to add features across all tenants
4. ✅ RLS provides adequate security
5. ✅ Scales well for most SaaS apps

Only move to per-tenant databases if:
- Regulatory requirements demand it
- Tenants need custom schema modifications
- You have 100+ tenants with millions of records each

---

## Summary

✅ **Migrations are safe** - all changes use idempotent SQL
✅ **Multi-tenancy works** - features work for all tenants via shared tables
✅ **Data is isolated** - RLS prevents cross-user data access
⚠️ **Affirmations are shared** - consider tenant-specific ones later
⚠️ **Crisis lines are US-only** - internationalize if expanding globally

**Action Items:**
1. Test all features on each tenant subdomain
2. Apply migrations to staging environment
3. Test with real user accounts per tenant
4. Deploy to production when confident
5. Monitor for any RLS policy issues

**Need Help?**
- Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'your_table';`
- Test as specific user: `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims.sub = 'user_id';`
- Review logs: `SELECT * FROM auth.audit_log_entries;`
