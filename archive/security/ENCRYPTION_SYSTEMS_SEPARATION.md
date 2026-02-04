# Encryption Systems Separation - WellFit vs Envision Atlus

## Current Situation

You have TWO separate encryption systems that got mixed up in recent commit `18bca0d`.

---

## System 1: WellFit Community (PHI Encryption)

### Purpose
Encrypt PHI data for community-facing WellFit application

### Components
- **Edge Function**: `supabase/functions/phi-encrypt/index.ts`
- **Client Library**: `src/utils/phiEncryptionClient.ts`
- **Database Functions**: `encrypt_phi_text()`, `decrypt_phi_text()`
- **Migration**: `supabase/migrations/20251115180000_create_phi_encryption_functions.sql`

### Key Storage (CORRECT Setup)
- **Key Name**: `PHI_ENCRYPTION_KEY`
- **Where**: **Supabase Project Settings → Edge Function Secrets**
  - Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/settings/functions
  - Add secret: `PHI_ENCRYPTION_KEY` = your community key
- **NOT in Vault** - Edge Functions use Secrets, not Vault

### How it Works
1. Client calls `encryptPHI()` from `phiEncryptionClient.ts`
2. Edge Function gets `PHI_ENCRYPTION_KEY` from `Deno.env.get('PHI_ENCRYPTION_KEY')`
3. Edge Function passes key as parameter to `encrypt_phi_text(data, encryption_key)`
4. Database function uses the passed key (not a database setting)

### Current Status
✅ **Architecture is correct** - Edge Function passes key to database functions
⚠️ **Setup incomplete** - Need to add `PHI_ENCRYPTION_KEY` to Edge Function Secrets

---

## System 2: Envision Atlus Clinical (Clinical Encryption)

### Purpose
Encrypt clinical data for Envision Atlus clinical-facing system

### Components
- **Database Functions**: `encrypt_data()`, `decrypt_data()`
- **Migration**: `supabase/migrations/20251112150000_phi_encryption_functions_only.sql`
- **Also used by**: `supabase/migrations/20251115000001_secure_pending_registrations.sql`

### Key Storage (Current Confusion)
- **Key Name in Code**: `app.encryption_key` (database setting)
- **Where It Should Be**: **Supabase Project Settings → Database → Custom PostgreSQL Configuration**
  - Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/settings/database
  - Scroll to "Custom PostgreSQL Configuration"
  - Add parameter: `app.encryption_key` = your clinical key

### The Problem
- In **Supabase Vault** you have:
  - `encryption_key` = value A
  - `ENCRYPTION_KEY` or `app_encryption_key` = value B
- But these **won't work** because:
  - Vault secrets ≠ PostgreSQL database settings
  - The functions need `app.encryption_key` as a **PostgreSQL setting**, not a Vault secret

### How it Should Work
1. Set `app.encryption_key` in **Database Settings** (not Vault)
2. Function calls `encrypt_data('some data')`
3. Function reads `current_setting('app.encryption_key', TRUE)`
4. Encrypts data using that key

### Current Status
❌ **Key is in wrong place** - It's in Vault, should be in Database Settings
❌ **Functions will fail** - `app.encryption_key` is not set as PostgreSQL setting

---

## Summary of Key Locations

| System | Key Name | Should Be In | Currently In | Fix Needed |
|--------|----------|--------------|--------------|------------|
| **WellFit Community** | `PHI_ENCRYPTION_KEY` | Edge Function Secrets | ❓ Unknown | Add to Edge Function Secrets |
| **Envision Atlus Clinical** | `app.encryption_key` | Database Settings (PostgreSQL) | ❌ Vault (wrong place) | Move to Database Settings |

---

## Supabase: Vault vs Secrets vs Database Settings

### 1. Vault (For Storing Sensitive Data)
- **URL**: https://supabase.com/dashboard/project/[id]/settings/vault
- **Purpose**: Store encrypted secrets in the database itself
- **Access**: Via SQL `vault.decrypted_secrets`
- **Your current setup**: `encryption_key`, `app_encryption_key` here (but not being used)

### 2. Edge Function Secrets (Environment Variables for Deno)
- **URL**: https://supabase.com/dashboard/project/[id]/settings/functions
- **Purpose**: Environment variables for Edge Functions (Deno runtime)
- **Access**: Via `Deno.env.get('SECRET_NAME')`
- **Needed for**: WellFit `PHI_ENCRYPTION_KEY`

### 3. Database Settings (PostgreSQL Configuration)
- **URL**: https://supabase.com/dashboard/project/[id]/settings/database
- **Purpose**: Custom PostgreSQL runtime configuration
- **Access**: Via `current_setting('app.setting_name')`
- **Needed for**: Clinical `app.encryption_key`

---

## Action Plan to Fix Both Issues

### Issue 1: Determine Which Clinical Key is Correct

Run this SQL in Supabase SQL Editor to test your current setup:

```sql
-- Copy and paste the entire contents of /tmp/test-clinical-encryption.sql
```

This will tell you if `app.encryption_key` is set and working.

### Issue 2: Set Up Keys in Correct Locations

#### Step A: WellFit Community Key
1. Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/settings/functions
2. Click "Add Secret"
3. Name: `PHI_ENCRYPTION_KEY`
4. Value: Your WellFit community encryption key (from your .env line 66: `PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1`)
5. Save
6. Redeploy Edge Function: `npx supabase functions deploy phi-encrypt`

#### Step B: Clinical Key (CRITICAL)
1. Decide which value from Vault is correct:
   - `encryption_key` value A
   - `ENCRYPTION_KEY` / `app_encryption_key` value B
2. Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/settings/database
3. Scroll to "Custom PostgreSQL Configuration"
4. Click "Add Parameter"
5. Name: `app.encryption_key` (exact name, lowercase)
6. Value: The correct clinical encryption key from step 1
7. Save changes
8. **Database will restart** (takes 2-3 minutes)
9. Test again with the SQL script

---

## How to Determine Which Vault Value is Correct

### Option 1: Test with Existing Encrypted Data
If you have clinical data that's already encrypted:

```sql
-- Try decrypting with value A
SELECT decrypt_data('your_encrypted_value_here');

-- If it works, value A is correct
-- If it returns NULL or [DECRYPTION ERROR], try value B
```

### Option 2: Check When Keys Were Created
Look at Vault timestamps - the clinical system probably uses the **older** key.

### Option 3: Check Your Password Manager
If you saved keys separately for "Clinical" vs "Community", use the clinical one.

---

## Quick Reference Card

**Need to encrypt WellFit community PHI?**
→ Use: `encryptPHI()` from `phiEncryptionClient.ts`
→ Key location: Edge Function Secrets → `PHI_ENCRYPTION_KEY`
→ Used by: Community-facing WellFit app

**Need to encrypt Envision Atlus clinical data?**
→ Use: `encrypt_data()` SQL function
→ Key location: Database Settings → `app.encryption_key`
→ Used by: Clinical-facing Envision Atlus system

---

## What NOT to Do

❌ Don't use Vault for `PHI_ENCRYPTION_KEY` (it's for Edge Functions, not Vault)
❌ Don't use Vault for `app.encryption_key` (it's a PostgreSQL setting, not Vault)
❌ Don't delete your Vault keys yet (might have other uses)
❌ Don't mix up WellFit and Clinical keys

✅ DO keep them separate - different systems, different purposes
✅ DO test thoroughly after setting up
✅ DO save both keys in your password manager

---

## Next Steps

1. **Run the diagnostic SQL** (from /tmp/test-clinical-encryption.sql)
2. **Tell me the results** - I'll help interpret them
3. **Determine which Vault value is correct** for clinical
4. **Set up both keys** in their proper locations
5. **Test both systems** to confirm working

Would you like me to help you run these tests?
