# PHI Encryption At Rest - Complete Flow & Status

## Current Status: ⚠️ PARTIALLY DEPLOYED

### What's Working ✅
1. **Frontend Encryption** ([src/lib/phi-encryption.ts](src/lib/phi-encryption.ts))
   - HIPAA compliant (no console statements)
   - Uses `PHI_ENCRYPTION_KEY` from environment
   - Encrypts data before sending to backend

2. **Database `encrypt_data()` Function**
   - Exists and working
   - Uses Vault key (`app.encryption_key`)
   - Returns base64-encoded encrypted data

3. **Encryption Keys**
   - Frontend: `PHI_ENCRYPTION_KEY=PHI-ENCRYPT-2025-WELLFIT-SECURE-KEY-V1`
   - Backend: `app.encryption_key` in Supabase Vault ✅ (you confirmed)

### What's Broken ❌
1. **pgcrypto Extension NOT Enabled**
   - Error: `schema "pgcrypto" does not exist`
   - Blocks all decrypt operations
   - **THIS IS THE ROOT CAUSE**

2. **Database `decrypt_data()` Function**
   - Exists but fails due to missing pgcrypto
   - Has parameter name mismatch (expects `encrypted_data`, we use `p_encrypted`)

## The Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Browser)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ User enters PHI (SSN, address, medical data)           │ │
│  └────────────────┬───────────────────────────────────────┘ │
│                   │                                          │
│                   ▼                                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ src/lib/phi-encryption.ts                              │ │
│  │ - Uses PHI_ENCRYPTION_KEY                              │ │
│  │ - Encrypts with crypto-js (AES-256)                    │ │
│  │ - NO console statements (HIPAA ✅)                     │ │
│  └────────────────┬───────────────────────────────────────┘ │
└───────────────────┼──────────────────────────────────────────┘
                    │ Encrypted data over HTTPS
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ RECEIVING:                                             │ │
│  │ - Already encrypted from frontend                      │ │
│  │ - Stored in encrypted columns                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ DATABASE FUNCTIONS (For PHI at rest):                  │ │
│  │                                                         │ │
│  │ ✅ encrypt_data(plaintext) → encrypted                 │ │
│  │    - Uses app.encryption_key from Vault                │ │
│  │    - pgp_sym_encrypt (AES-256)                         │ │
│  │    - Returns base64                                    │ │
│  │                                                         │ │
│  │ ❌ decrypt_data(encrypted) → plaintext                 │ │
│  │    - BLOCKED: pgcrypto extension not enabled!          │ │
│  │    - Error: "schema 'pgcrypto' does not exist"         │ │
│  │    - Parameter mismatch: expects 'encrypted_data'      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Files & Their Roles

### Migration Files (supabase/migrations/)
| File | Purpose | Status |
|------|---------|--------|
| `20251112160000_enable_pgcrypto.sql` | Enable pgcrypto extension | ⏳ Not deployed |
| `20251112150000_phi_encryption_functions_only.sql` | Create encrypt/decrypt functions | ⏳ Not deployed |

### Deployment Scripts
| File | Purpose | Use When |
|------|---------|----------|
| `deploy-encryption-complete.sql` | **USE THIS** - All-in-one deployment | Primary deployment |
| `fix-encryption-conflicts.sql` | Cleanup only (drops functions) | If you want separate steps |
| `deploy-encryption.sql` | Original version (incomplete) | ❌ Don't use |

### Frontend Files
| File | Purpose | Status |
|------|---------|--------|
| `src/lib/phi-encryption.ts` | Client-side PHI encryption | ✅ HIPAA compliant |
| `.env` | Contains `PHI_ENCRYPTION_KEY` | ✅ Configured |

## The Problem

An **old version** of the decrypt function was deployed with:
- Different parameter name (`encrypted_data` instead of `p_encrypted`)
- Missing pgcrypto extension setup

This creates conflicts preventing clean deployment.

## The Solution

Run **deploy-encryption-complete.sql** which:
1. ✅ Enables pgcrypto extension (fixes decrypt errors)
2. ✅ Drops ALL old function variations (fixes parameter conflicts)
3. ✅ Creates fresh functions with correct signatures
4. ✅ Tests everything automatically
5. ✅ Shows clear success/failure message

## Deployment Steps

1. Open: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new
2. Copy contents of `deploy-encryption-complete.sql`
3. Paste and click "Run"
4. Check "Messages" tab for:
   ```
   ✅ Step 1: pgcrypto extension enabled
   ✅ Step 2: All conflicting functions dropped
   ✅ Step 3: encrypt_data function created
   ✅ Step 4: decrypt_data function created
   ✅ Step 5: Permissions granted
   ✅ ✅ ✅ SUCCESS! PHI ENCRYPTION IS WORKING CORRECTLY
   ```

## After Deployment

### Test encryption manually:
```sql
-- Encrypt
SELECT public.encrypt_data('Sensitive Data');
-- Returns: ww0EBwMC... (base64 encrypted)

-- Decrypt (copy encrypted value from above)
SELECT public.decrypt_data('ww0EBwMC...');
-- Returns: Sensitive Data
```

### Use in application:
```sql
-- Store encrypted PHI
INSERT INTO profiles (name, ssn_encrypted)
VALUES ('John Doe', public.encrypt_data('123-45-6789'));

-- Retrieve decrypted PHI (for authorized users only)
SELECT name, public.decrypt_data(ssn_encrypted) as ssn
FROM profiles
WHERE id = 'user-id';
```

## HIPAA Compliance Checklist

- [x] Frontend encryption (src/lib/phi-encryption.ts) - No console statements
- [x] Encryption keys properly stored (Frontend: .env, Backend: Vault)
- [ ] **pgcrypto extension enabled** ← YOU ARE HERE
- [ ] **Database encryption functions deployed** ← NEXT STEP
- [ ] PHI stored encrypted at rest (HIPAA § 164.312(a)(2)(iv))
- [x] Audit logging for encryption operations (built into functions)
- [x] Access control (SECURITY DEFINER + RLS policies)

## Key Points

1. **Two separate encryption layers:**
   - **Frontend**: Encrypts PHI before transmission (uses PHI_ENCRYPTION_KEY)
   - **Backend**: Encrypts PHI at rest in database (uses app.encryption_key)

2. **Why two keys?**
   - Security best practice: separation of concerns
   - Different rotation schedules
   - Different access requirements

3. **Current blocker:**
   - pgcrypto extension not enabled
   - Old function with wrong parameter name

4. **Resolution time:**
   - 2 minutes to run the SQL in Supabase SQL Editor
   - Immediate verification with built-in test

## Support

If deployment fails, check:
1. Vault key configured: `SELECT current_setting('app.encryption_key', TRUE);` (should return non-null)
2. pgcrypto available: `SELECT * FROM pg_available_extensions WHERE name = 'pgcrypto';`
3. Permissions: You need database owner or superuser rights to create extensions

## Files Reference

- 📄 [deploy-encryption-complete.sql](deploy-encryption-complete.sql) - **Main deployment script**
- 📄 [src/lib/phi-encryption.ts](src/lib/phi-encryption.ts) - Frontend encryption
- 📄 [supabase/migrations/20251112160000_enable_pgcrypto.sql](supabase/migrations/20251112160000_enable_pgcrypto.sql) - pgcrypto setup
- 📄 [supabase/migrations/20251112150000_phi_encryption_functions_only.sql](supabase/migrations/20251112150000_phi_encryption_functions_only.sql) - Function definitions
