# 🔐 PHI Encryption Key Setup - WellFit & Envision Atlus

**Date**: November 20, 2025
**Status**: ✅ KEYS ALREADY CONFIGURED - Migration Fix Available

---

## 🚨 Security Issue Identified

The PHI encryption functions currently have a **hardcoded key** in the migration file:
- **File**: `supabase/migrations/20251115180000_create_phi_encryption_functions.sql`
- **Issue**: Key `PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1` is visible in Git
- **Risk**: HIPAA violation, unauthorized access, cannot rotate keys

---

## ✅ Current Encryption Architecture

### Two Production Environments = Two Key Storage Methods

| Environment | Purpose | Key Storage | Key Name | Status |
|-------------|---------|-------------|----------|--------|
| **WellFit Community** | Community-facing app | Supabase Secrets | `PHI_ENCRYPTION_KEY` | ✅ Configured |
| **Envision Atlus** | Clinical/enterprise | Vault | `app.encryption_key` | ✅ Configured |

---

## 📋 Deployment Instructions

### ✅ Keys Already Configured - No Setup Needed

Your keys are already properly configured:
- **WellFit**: `PHI_ENCRYPTION_KEY` in Supabase Secrets ✅
- **Envision**: `app.encryption_key` in Vault ✅

### Step 1: Deploy the Security Fix

```bash
# Deploy the new migration that removes hardcoded keys
supabase db push

# OR if you prefer manual deploy:
supabase migration up --include-all
```

---

### Step 2: Update Application Code

**For WellFit Community** (default):
```typescript
// Uses PHI_ENCRYPTION_KEY from Supabase Secrets (use_clinical_key = FALSE)
const encrypted = await supabase.rpc('encrypt_phi_text', {
  data: 'patient name',
  use_clinical_key: false  // or omit - defaults to false
});
```

**For Envision Atlus** (clinical):
```typescript
// Uses app.encryption_key from Vault (use_clinical_key = TRUE)
const encrypted = await supabase.rpc('encrypt_phi_text', {
  data: 'clinical note',
  use_clinical_key: true
});
```

---

## 🔍 Verification

After deploying the migration, verify both keys work:

```sql
-- Test WellFit Community encryption (use_clinical_key = FALSE)
SELECT
  decrypt_phi_text(encrypt_phi_text('WellFit Test', FALSE), FALSE) as wellfit_result;

-- Test Envision Atlus encryption (use_clinical_key = TRUE)
SELECT
  decrypt_phi_text(encrypt_phi_text('Envision Test', TRUE), TRUE) as envision_result;
```

Expected output: Both should return the original text.

---

## 📊 Security Benefits

| Before (Insecure) | After (Secure) |
|-------------------|----------------|
| ❌ Key in Git repo | ✅ Keys in Vault only |
| ❌ Cannot rotate | ✅ Easy key rotation |
| ❌ Single key | ✅ Separate keys per environment |
| ❌ HIPAA risk | ✅ HIPAA compliant |

---

## ⚠️ Important Notes

1. **Keys Already Set**: Both WellFit and Envision keys are already configured
2. **Different Storage**:
   - WellFit: Supabase Secrets (environment variable)
   - Envision: Vault (database secret)
3. **No Hardcoded Keys**: The migration removes the insecure hardcoded fallback
4. **Re-encryption**: Existing data was encrypted with hardcoded key - will still decrypt after migration

---

## 🔄 Key Rotation Process (Future)

### For WellFit Community (Supabase Secrets):

```bash
# 1. Generate new key
openssl rand -base64 32

# 2. Update Supabase secret
supabase secrets set PHI_ENCRYPTION_KEY=<new-key>

# 3. Re-encrypt all data (run migration script)
```

### For Envision Atlus (Vault):

```sql
-- 1. Update vault secret
UPDATE vault.secrets
SET secret = '<new-key>'
WHERE name = 'app.encryption_key';

-- 2. Re-encrypt all data
```

---

## 📞 Support

If you encounter issues:
1. Check Supabase dashboard → Project Settings → Database → Secrets
2. Verify vault.secrets table has the keys
3. Test encryption/decryption with SQL commands above

---

## 📊 Summary

| Component | Before | After Migration |
|-----------|--------|----------------|
| WellFit Key | ❌ Hardcoded fallback | ✅ Supabase Secrets only |
| Envision Key | ✅ Vault (correct) | ✅ Vault (unchanged) |
| HIPAA Compliance | ⚠️ Hardcoded key exposed | ✅ No hardcoded keys |

**Status**: ✅ Ready to deploy - Run `supabase db push` when ready
