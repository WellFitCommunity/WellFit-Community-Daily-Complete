# 🔧 Manual Migration Steps for Community Moments

## Problem
The `community_moments` table migration shows as "applied" in the migration history, but the table is not actually in the database. This causes the "Failed to load moments" error.

## Root Cause
Migration history was out of sync between local and remote. After repair, the migration needs to be reapplied.

---

## ✅ Solution: Apply Migration Manually

### Step 1: Go to Supabase SQL Editor
Open this URL in your browser:
```
https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new
```

### Step 2: Copy the Migration SQL
Open the file:
```
supabase/migrations/20250923150000_add_missing_community_features.sql
```

Copy **EVERYTHING** from that file.

### Step 3: Paste and Execute
1. Paste the SQL into the Supabase SQL editor
2. Click **Run** (or press Cmd/Ctrl + Enter)
3. Wait for it to complete (should take 2-5 seconds)

### Step 4: Verify Success
You should see messages like:
- `ALTER TABLE`
- `CREATE INDEX`
- `CREATE TABLE`
- `INSERT 0 10` (affirmations)
- `CREATE POLICY`

### Step 5: Test Community Moments
Run this command to verify:
```bash
node scripts/verify-community-tables.js
```

You should see:
```
✅ SUCCESS! Table is accessible
✅ SUCCESS! Table is accessible
✅ RLS SELECT policy working correctly
✅ ALL TESTS PASSED!
```

---

## Alternative: CLI Method (if above doesn't work)

### Option A: Use psql directly
If you have `psql` installed:
```bash
psql "$DATABASE_URL" < supabase/migrations/20250923150000_add_missing_community_features.sql
```

### Option B: Reset and reapply all migrations
```bash
# WARNING: This will reset your local database
npx supabase db reset
npx supabase db push
```

---

## What This Migration Does

Creates two new tables:

### 1. `community_moments` table
- Stores user-shared photos and moments
- Has RLS policies so everyone can view, but only owners can edit
- Includes fields: title, description, emoji, tags, file paths
- Admin feature toggle (`is_gallery_high`)

### 2. `affirmations` table
- Daily positive messages for seniors
- Includes 10 default affirmations
- RLS allows everyone to read, only admins to modify

### 3. Profile enhancements
- Adds caregiver contact fields to profiles table
- `caregiver_first_name`, `caregiver_last_name`
- `caregiver_phone`, `caregiver_relationship`

---

## After Migration is Applied

1. Community Moments page will load successfully
2. Users can share photos
3. Daily affirmations will display
4. Caregiver contact info can be saved

---

## Troubleshooting

### "Failed to load moments" still appears
1. Wait 2-3 minutes for PostgREST cache to refresh
2. Hard refresh your browser (Ctrl+Shift+R / Cmd+Shift+R)
3. Run: `node scripts/reload-schema-cache.js`

### Table already exists error
If you get "table already exists":
```sql
-- Run this first to clean up
DROP TABLE IF EXISTS public.community_moments CASCADE;
DROP TABLE IF EXISTS public.affirmations CASCADE;

-- Then run the migration again
```

### Permission denied error
Make sure you're using the correct Supabase project and have admin access.

---

## Quick Check Commands

```bash
# Check if tables exist in PostgreSQL
node scripts/check-table-exists-db.js

# Verify full access
node scripts/verify-community-tables.js

# Test the exact query used by the app
node scripts/test-community-query.js

# Reload PostgREST cache
node scripts/reload-schema-cache.js
```

---

## Contact
If you continue having issues after following these steps, the migration SQL is valid and tested. The issue would be with database permissions or connection.

Project: `xkybsjnvuohpqpbkikyn`
Migration file: `supabase/migrations/20250923150000_add_missing_community_features.sql`