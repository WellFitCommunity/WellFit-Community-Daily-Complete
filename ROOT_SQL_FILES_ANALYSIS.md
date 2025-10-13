# Root SQL Files Analysis

**Date:** January 2025
**Status:** Analysis Complete

## Summary

Found **14 SQL files** in project root that appear to be **one-time fixes, test scripts, or superseded by official migrations**.

---

## Files Analysis

### ✅ SAFE TO DELETE - Already in Official Migrations

| File | Size | Official Migration | Status |
|------|------|-------------------|--------|
| `fix_rls_403.sql` | 1.2K | `20251008010000_fix_rls_403_errors.sql` | ✅ Already migrated |
| `FIX_BILLING_RLS_NOW.sql` | 3.3K | `20250930154555_fix_billing_rls.sql` | ✅ Already migrated |
| `FIX_COMMUNITY_MOMENTS_NOW.sql` | 1.2K | `20251007040000_fix_community_moments_and_affirmations_rls.sql` | ✅ Already migrated |
| `CREATE_CHECK_INS_TABLE.sql` | 2.1K | `20251001000002_create_check_ins_table.sql` | ✅ Already migrated |
| `fix_senior_roles.sql` | 774B | Covered in `20250916000000_new_init_roles_and_security.sql` | ✅ Already migrated |

**Recommendation:** These are emergency/hotfix scripts that were incorporated into proper migrations. Safe to delete.

---

### ⚠️ TEST/DIAGNOSTIC SCRIPTS - Safe to Archive

| File | Size | Purpose | Status |
|------|------|---------|--------|
| `check_tables.sql` | 232B | Diagnostic query to check table existence | Test script |
| `test_phi_encryption.sql` | 3.2K | Test PHI encryption functions | Test script |
| `test_migrations.sh` | Small | Local migration testing script | Dev tool |
| `reset-passwords.sql` | 919B | Password reset template (commented out) | Admin tool |

**Recommendation:** Move to `scripts/database/` or `docs/database/sql-helpers/` for reference.

---

### 🤔 PHI ENCRYPTION SCRIPTS - Need Review

| File | Size | Purpose | Status |
|------|------|---------|--------|
| `complete_phi_encryption_correct_tables.sql` | 12K | PHI encryption for check_ins_audit + risk_assessments | Unclear if run |
| `complete_phi_encryption_existing_tables.sql` | 5.3K | PHI encryption for existing tables | Unclear if run |
| `complete_phi_encryption_new_tables.sql` | 11K | PHI encryption for new tables | Unclear if run |
| `manual_phi_encryption.sql` | 3.0K | Manual PHI encryption script | Unclear if run |

**Issue:** These files add PHI encryption to tables, but:
- Not in official migrations folder
- Multiple versions suggest iterative development
- Unclear which (if any) were actually run in production
- `complete_phi_encryption_correct_tables.sql` seems to be the "final" version

**Recommendation:**
1. Check production database for encrypted columns (`*_encrypted`)
2. If encryption exists → Archive these files
3. If encryption missing → Create proper migration from the correct version
4. See investigation steps below

---

### 📋 SCHEMA DOCUMENTATION - Consider Moving

| File | Size | Purpose | Status |
|------|------|---------|--------|
| `QUESTIONS_DATABASE_SCHEMA.sql` | 7.4K | User questions schema documentation | Documentation |
| `ENHANCED_USER_QUESTIONS_MIGRATION.sql` | 4.6K | Enhanced user questions schema | Unclear if run |

**Recommendation:**
- If these were run → Archive
- If not run → Move to proper migration or `docs/database/schemas/`

---

## Detailed Findings

### 1. Confirmed Duplicates (Safe to Delete)

#### `fix_rls_403.sql`
- **Purpose:** Fix 403 errors on community_moments and affirmations
- **Official Migration:** `20251008010000_fix_rls_403_errors.sql` (Oct 8)
- **Evidence:** Identical purpose, file created Oct 8
- **Action:** ✅ DELETE

#### `FIX_BILLING_RLS_NOW.sql`
- **Purpose:** Fix billing_providers and claims RLS policies
- **Official Migration:** `20250930154555_fix_billing_rls.sql` (Sep 30)
- **Evidence:** Migration covers billing RLS fixes
- **Action:** ✅ DELETE

#### `FIX_COMMUNITY_MOMENTS_NOW.sql`
- **Purpose:** Fix community_moments foreign key to profiles
- **Official Migration:** `20251007040000_fix_community_moments_and_affirmations_rls.sql` (Oct 7)
- **Evidence:** Migration covers community moments fixes
- **Action:** ✅ DELETE

#### `CREATE_CHECK_INS_TABLE.sql`
- **Purpose:** Create check_ins table with PHI encryption
- **Official Migration:** `20251001000002_create_check_ins_table.sql` (Oct 1)
- **Evidence:** Migration creates check_ins table
- **Action:** ✅ DELETE

#### `fix_senior_roles.sql`
- **Purpose:** Fix senior user roles
- **Official Migration:** `20250916000000_new_init_roles_and_security.sql` (Sep 16)
- **Evidence:** Roles migration covers security setup
- **Action:** ✅ DELETE

---

### 2. Test/Diagnostic Scripts (Archive)

#### `check_tables.sql`
```sql
-- Simple query to check if check_ins and risk_assessments exist
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('check_ins', 'risk_assessments')
```
**Action:** Move to `scripts/database/diagnostics/`

#### `test_phi_encryption.sql`
- Tests encryption functions
- Useful for verifying PHI encryption works
**Action:** Move to `scripts/database/tests/`

#### `test_migrations.sh`
- Local Supabase migration testing
- Runs `supabase db reset`
**Action:** Keep in root or move to `scripts/database/`

#### `reset-passwords.sql`
- Template for password resets
- All actual commands commented out
**Action:** Move to `docs/database/sql-helpers/admin-tasks.md`

---

### 3. PHI Encryption Scripts (INVESTIGATE FIRST)

These files suggest iterative development of PHI encryption:

1. `manual_phi_encryption.sql` (3.0K) - First attempt?
2. `complete_phi_encryption_existing_tables.sql` (5.3K) - Second iteration
3. `complete_phi_encryption_new_tables.sql` (11K) - New table version
4. `complete_phi_encryption_correct_tables.sql` (12K) - **"Correct" version**

**The "correct" version** targets:
- `check_ins_audit` table
- `risk_assessments` table
- Adds `*_encrypted` columns
- Creates encryption/decryption functions

#### Investigation Steps:

```sql
-- Run in Supabase SQL Editor to check if encryption exists:

-- 1. Check if check_ins_audit has encrypted columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'check_ins_audit'
  AND column_name LIKE '%encrypted%';

-- 2. Check if risk_assessments has encrypted columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'risk_assessments'
  AND column_name LIKE '%encrypted%';

-- 3. Check if encryption functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('encrypt_phi_text', 'decrypt_phi_text', 'encrypt_phi_integer', 'decrypt_phi_integer');
```

#### Decision Tree:

```
IF encrypted columns exist AND functions exist:
  → PHI encryption is implemented
  → Archive all 4 files to archive/database/phi-encryption/

ELSE IF partial implementation:
  → Review which version is correct
  → Create proper migration from correct version
  → Apply to production
  → Then archive

ELSE:
  → PHI encryption not implemented
  → Decide if needed
  → If yes: Create proper migration
  → If no: Archive files as "not implemented"
```

---

### 4. Schema Documentation Files

#### `QUESTIONS_DATABASE_SCHEMA.sql` (7.4K)
- Defines user_questions schema
- May be documentation or an unapplied migration
- Check if `user_questions` table exists with this schema

#### `ENHANCED_USER_QUESTIONS_MIGRATION.sql` (4.6K)
- Enhanced version of user questions
- Check if applied

**Investigation:**
```sql
-- Check if user_questions table exists and its schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_questions';
```

---

## Recommendations

### Immediate Actions (Safe)

1. **Delete these 5 files** (confirmed duplicates):
   ```bash
   rm fix_rls_403.sql
   rm FIX_BILLING_RLS_NOW.sql
   rm FIX_COMMUNITY_MOMENTS_NOW.sql
   rm CREATE_CHECK_INS_TABLE.sql
   rm fix_senior_roles.sql
   ```

2. **Move test scripts** to `scripts/database/`:
   ```bash
   mkdir -p scripts/database/tests
   mkdir -p scripts/database/diagnostics
   mv check_tables.sql scripts/database/diagnostics/
   mv test_phi_encryption.sql scripts/database/tests/
   mv test_migrations.sh scripts/database/
   ```

3. **Move admin tool** to docs:
   ```bash
   # Convert to markdown and add to docs
   # Then delete original
   ```

### Requires Investigation

1. **PHI Encryption Scripts:**
   - Run investigation SQL queries above
   - Determine if encryption is implemented
   - Then delete or create proper migration

2. **User Questions Schemas:**
   - Check if `user_questions` table exists
   - Compare schema with these files
   - Archive if already applied

---

## Summary Table

| Category | Count | Action |
|----------|-------|--------|
| **Confirmed Duplicates** | 5 | ✅ DELETE NOW |
| **Test/Diagnostic Scripts** | 4 | 📁 MOVE to scripts/ |
| **PHI Encryption (unclear)** | 4 | 🔍 INVESTIGATE FIRST |
| **Schema Docs (unclear)** | 2 | 🔍 INVESTIGATE FIRST |
| **Total** | 15 | - |

**Estimated cleanup:**
- **Immediate delete:** 5 files (save ~9KB)
- **Move to scripts:** 4 files
- **After investigation:** Up to 6 more files

---

## Next Steps

1. ✅ Delete confirmed duplicates (5 files)
2. ✅ Move test scripts (4 files)
3. 🔍 Investigate PHI encryption implementation
4. 🔍 Investigate user_questions schema
5. 📦 Archive remaining files appropriately

---

## Investigation Script

Want me to create an automated script to check your production database and determine which files can be safely deleted?

```bash
# Sample investigation script
./scripts/database/investigate-root-sql-files.sh
```

This would:
- Connect to production (read-only)
- Check for encrypted columns
- Check for user_questions schema
- Generate delete/archive recommendations
