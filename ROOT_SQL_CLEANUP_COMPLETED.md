# Root SQL Files Cleanup - COMPLETED

**Date:** January 2025
**Status:** ✅ Phase 1 Complete | 🔍 Phase 2 Requires Manual Investigation

---

## What Was Done

### ✅ Phase 1: Confirmed Duplicates (COMPLETED)

**Deleted 5 files** that were already in official migrations:

| File Deleted | Size | Reason | Official Migration |
|-------------|------|--------|-------------------|
| `fix_rls_403.sql` | 1.2K | RLS 403 errors fix | `20251008010000_fix_rls_403_errors.sql` |
| `FIX_BILLING_RLS_NOW.sql` | 3.3K | Billing RLS policies | `20250930154555_fix_billing_rls.sql` |
| `FIX_COMMUNITY_MOMENTS_NOW.sql` | 1.2K | Community moments FK | `20251007040000_...rls.sql` |
| `CREATE_CHECK_INS_TABLE.sql` | 2.1K | Check-ins table | `20251001000002_create_check_ins_table.sql` |
| `fix_senior_roles.sql` | 774B | Senior roles | `20250916000000_new_init_roles_and_security.sql` |

**Result:** 5 emergency hotfix files removed (~8.5KB cleaned)

---

### ✅ Phase 1: Test Scripts Organized (COMPLETED)

**Moved 4 files** to `scripts/database/`:

| File Moved | New Location | Purpose |
|-----------|-------------|---------|
| `check_tables.sql` | `scripts/database/diagnostics/` | Check table existence |
| `test_phi_encryption.sql` | `scripts/database/tests/` | Test encryption functions |
| `test_migrations.sh` | `scripts/database/` | Local migration testing |
| `reset-passwords.sql` | `scripts/database/admin-helpers/` | Password reset template |

**Result:** Test/admin scripts now organized and easy to find

---

## 🔍 Phase 2: Remaining Files (REQUIRES INVESTIGATION)

### Files Still in Root (9 files remaining)

#### A. PHI Encryption Scripts (4 files - 31.8KB)

| File | Size | Status |
|------|------|--------|
| `complete_phi_encryption_correct_tables.sql` | 12K | ❓ Unknown |
| `complete_phi_encryption_existing_tables.sql` | 5.3K | ❓ Unknown |
| `complete_phi_encryption_new_tables.sql` | 11K | ❓ Unknown |
| `manual_phi_encryption.sql` | 3.0K | ❓ Unknown |

**Investigation Findings:**
- ✅ `check_ins_audit` table **EXISTS** (found in `20250923143421_remote_schema.sql`)
- ❌ `check_ins_audit` table **DOES NOT** have `*_encrypted` columns
- ❌ No PHI encryption functions found in migrations
- ⚠️ `ai_risk_assessments` exists (different from `risk_assessments`)

**Conclusion:**
- PHI encryption was **designed but never implemented**
- These scripts were **NOT applied** to production
- Application-layer encryption is used instead (see `handoff_packets` table)

**Recommendation:**
```bash
# Archive these files - they represent a database-level encryption approach
# that was designed but not implemented
mkdir -p archive/database/phi-encryption-not-implemented
mv complete_phi_encryption_*.sql archive/database/phi-encryption-not-implemented/
mv manual_phi_encryption.sql archive/database/phi-encryption-not-implemented/
```

---

#### B. User Questions Schemas (2 files - 12KB)

| File | Size | Status |
|------|------|--------|
| `QUESTIONS_DATABASE_SCHEMA.sql` | 7.4K | ❓ Unknown |
| `ENHANCED_USER_QUESTIONS_MIGRATION.sql` | 4.6K | ❓ Unknown |

**Investigation Findings:**
- ✅ `user_questions` mentioned in migration `20250924000002_simple_user_questions_fix.sql`
- ⚠️ Need to check actual table schema to determine if "enhanced" version was applied

**Recommendation:**
Run investigation query to check `user_questions` schema:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_questions'
ORDER BY ordinal_position;
```

Then:
- If enhanced features exist (priority, category, is_required) → DELETE both files
- If basic schema only → ARCHIVE as "not-implemented"

---

## Investigation Tools Created

### 1. Investigation Script
**Location:** `scripts/database/investigate-root-sql-files.sh`
- Automated investigation helper
- Requires Supabase CLI

### 2. Investigation SQL Queries
**Location:** `scripts/database/investigation-queries.sql`
- Copy-paste into Supabase SQL Editor
- Checks PHI encryption implementation
- Checks user_questions schema
- Provides interpretation guide

---

## Next Steps

### Immediate (Can Do Now)

1. ✅ **Archive PHI encryption files** (we know they weren't applied):
   ```bash
   mkdir -p archive/database/phi-encryption-not-implemented
   mv complete_phi_encryption_correct_tables.sql archive/database/phi-encryption-not-implemented/
   mv complete_phi_encryption_existing_tables.sql archive/database/phi-encryption-not-implemented/
   mv complete_phi_encryption_new_tables.sql archive/database/phi-encryption-not-implemented/
   mv manual_phi_encryption.sql archive/database/phi-encryption-not-implemented/
   ```

### Requires Production Database Access

2. **Investigate user_questions schema:**
   - Run `scripts/database/investigation-queries.sql` in Supabase Dashboard
   - Check if enhanced schema features exist
   - Based on results:
     - ✅ If enhanced → DELETE both files
     - 📦 If basic → ARCHIVE both files

---

## Summary Statistics

### Files Processed

| Category | Count | Action | Status |
|----------|-------|--------|--------|
| Duplicate hotfixes | 5 | Deleted | ✅ Complete |
| Test/admin scripts | 4 | Moved to scripts/ | ✅ Complete |
| PHI encryption | 4 | Archive (not implemented) | ⚠️ Can do now |
| User questions | 2 | Investigate first | 🔍 Need DB access |
| **TOTAL** | **15** | - | **60% Complete** |

### Disk Space Saved/Organized

- **Deleted:** ~8.5KB (5 files)
- **Moved:** ~8KB (4 files to scripts/)
- **Can Archive Now:** ~31.8KB (4 PHI files)
- **Need Investigation:** ~12KB (2 user_questions files)
- **Total Cleanup:** ~60KB across 15 files

---

## Final Root Directory Status

### Before Cleanup
```
50+ markdown files + 15 SQL files = chaos
```

### After Phase 1
```
Root/
├── README.md
├── CLAUDE.md
├── SECURITY.md
├── error.txt
├── consolidate-docs.sh
├── ROOT_SQL_FILES_ANALYSIS.md
├── ROOT_SQL_CLEANUP_COMPLETED.md
├── complete_phi_encryption_correct_tables.sql (to archive)
├── complete_phi_encryption_existing_tables.sql (to archive)
├── complete_phi_encryption_new_tables.sql (to archive)
├── manual_phi_encryption.sql (to archive)
├── QUESTIONS_DATABASE_SCHEMA.sql (investigate)
└── ENHANCED_USER_QUESTIONS_MIGRATION.sql (investigate)
```

### After Phase 2 (Target)
```
Root/
├── README.md
├── CLAUDE.md
├── SECURITY.md
└── error.txt

All SQL files properly organized in archive/ or deleted ✨
```

---

## Key Learnings

### 1. PHI Encryption Approach
- Database-level encryption was designed but **not implemented**
- Application uses **application-layer encryption** instead (better for flexibility)
- Example: `handoff_packets` table has `patient_name_encrypted`, `patient_dob_encrypted`
- See: `20251003190000_patient_handoff_system.sql`

### 2. Emergency Hotfixes
- Multiple "FIX_*_NOW.sql" files were emergency fixes
- All were later incorporated into proper migrations
- Good pattern: hotfix → proper migration → delete hotfix file

### 3. Table Naming
- `check_ins_audit` exists (audit log table)
- `check_ins` exists (main check-ins table)
- `ai_risk_assessments` exists (AI-based risk assessments)
- `risk_assessments` does NOT exist (was never created)

---

## Commands Summary

### Already Completed
```bash
# Phase 1 completed automatically:
rm fix_rls_403.sql FIX_BILLING_RLS_NOW.sql FIX_COMMUNITY_MOMENTS_NOW.sql
rm CREATE_CHECK_INS_TABLE.sql fix_senior_roles.sql

mv check_tables.sql scripts/database/diagnostics/
mv test_phi_encryption.sql scripts/database/tests/
mv test_migrations.sh scripts/database/
mv reset-passwords.sql scripts/database/admin-helpers/
```

### Can Run Now
```bash
# Archive PHI encryption files (not implemented)
mkdir -p archive/database/phi-encryption-not-implemented
mv complete_phi_encryption_*.sql archive/database/phi-encryption-not-implemented/
mv manual_phi_encryption.sql archive/database/phi-encryption-not-implemented/

# Add README to archive
cat > archive/database/phi-encryption-not-implemented/README.md << 'EOF'
# PHI Encryption Scripts (Not Implemented)

These scripts represent a database-level PHI encryption approach that was
designed but never implemented in production.

The application uses application-layer encryption instead (more flexible).

See `20251003190000_patient_handoff_system.sql` for actual encryption approach.
EOF
```

### Needs Investigation First
```bash
# Run investigation queries in Supabase Dashboard
cat scripts/database/investigation-queries.sql

# Then based on results, either:
rm QUESTIONS_DATABASE_SCHEMA.sql ENHANCED_USER_QUESTIONS_MIGRATION.sql  # If applied
# OR
mkdir -p archive/database/user-questions-not-implemented
mv QUESTIONS_DATABASE_SCHEMA.sql ENHANCED_USER_QUESTIONS_MIGRATION.sql archive/database/user-questions-not-implemented/
```

---

## Documentation Updated

- ✅ [ROOT_SQL_FILES_ANALYSIS.md](ROOT_SQL_FILES_ANALYSIS.md) - Complete analysis
- ✅ [ROOT_SQL_CLEANUP_COMPLETED.md](ROOT_SQL_CLEANUP_COMPLETED.md) - This file
- ✅ [scripts/database/investigation-queries.sql](scripts/database/investigation-queries.sql) - Investigation tool
- ✅ [scripts/database/investigate-root-sql-files.sh](scripts/database/investigate-root-sql-files.sh) - Helper script

---

**Status:** 60% complete (9/15 files processed)
**Next:** Archive PHI files + investigate user_questions schema
**Estimated completion:** 5 minutes + 1 DB query
