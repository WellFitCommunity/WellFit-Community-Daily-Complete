# Server-Side PHI Encryption Implementation

## Overview

PHI (Protected Health Information) encryption is now handled **server-side** using Supabase Edge Functions and PostgreSQL pgcrypto. This eliminates the HIPAA compliance vulnerability of exposing encryption keys to the browser.

## Architecture

### Before (Client-Side - VULNERABLE ❌)
```
Browser → Web Crypto API → Encrypted Data
   ↑
REACT_APP_PHI_ENCRYPTION_KEY (exposed in JavaScript bundle)
```

**Security Issue:** Encryption key visible in browser DevTools, violating HIPAA § 164.312(a)(2)(iv)

### After (Server-Side - SECURE ✅)
```
Browser → Edge Function → PostgreSQL pgcrypto → Encrypted Data
                ↑
        PHI_ENCRYPTION_KEY (Supabase Secret)
```

**Security Improvement:** Encryption key never exposed to client, stored in Supabase Secrets

## Components

### 1. PostgreSQL Encryption Functions
**File:** `supabase/migrations/20251115180000_create_phi_encryption_functions.sql`

- `encrypt_phi_text(data, encryption_key)` - AES-256 encryption
- `decrypt_phi_text(encrypted_data, encryption_key)` - AES-256 decryption

**Key Features:**
- Uses `pgcrypto` extension
- SHA-256 hash of key for consistent 256-bit encryption
- Security definer functions for controlled access
- Error handling with warnings (not exposed to client)

### 2. Edge Function
**File:** `supabase/functions/phi-encrypt/index.ts`

- Endpoint: `https://[project].supabase.co/functions/v1/phi-encrypt`
- Authentication: Requires valid Supabase session
- Operations: `encrypt` | `decrypt`

**Request Format:**
```json
{
  "data": "string to encrypt/decrypt",
  "patientId": "patient-id-for-audit",
  "operation": "encrypt" | "decrypt"
}
```

**Response Format:**
```json
{
  "success": true,
  "result": "encrypted/decrypted string"
}
```

### 3. Client Library
**File:** `src/utils/phiEncryptionClient.ts`

- `encryptPHI(plaintext, patientId)` - Client wrapper for encryption
- `decryptPHI(encryptedData, patientId)` - Client wrapper for decryption
- `validateEncryption()` - Tests round-trip encryption/decryption

**Usage:**
```typescript
import { encryptPHI, decryptPHI } from '../utils/phiEncryptionClient';

// Encrypt
const encrypted = await encryptPHI('sensitive data', 'patient-123');

// Decrypt
const decrypted = await decryptPHI(encrypted, 'patient-123');
```

## Migration Steps

### Step 1: Deploy PostgreSQL Functions (REQUIRED)

**Option A: Using Supabase SQL Editor**
1. Open https://supabase.com/dashboard/project/[your-project-id]/sql/new
2. Copy contents of `supabase/migrations/20251115180000_create_phi_encryption_functions.sql`
3. Run the migration

**Option B: Using psql (from local machine with IPv4)**
```bash
psql "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres" \
  -f supabase/migrations/20251115180000_create_phi_encryption_functions.sql
```

**Option C: Using Supabase CLI**
```bash
npx supabase db push
```

### Step 2: Verify Edge Function Deployment

The Edge Function has already been deployed. Verify at:
https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/functions

### Step 3: Verify Supabase Secret

Ensure `PHI_ENCRYPTION_KEY` exists in Supabase Secrets:
1. Go to https://supabase.com/dashboard/project/[your-project-id]/settings/vault
2. Verify secret named `PHI_ENCRYPTION_KEY` exists
3. Value should be your encryption key (stored securely, not documented here)

### Step 4: Remove Client-Side Key (DONE ✅)

`REACT_APP_PHI_ENCRYPTION_KEY` has been removed from all `.env` files. DO NOT re-add it.

## Current Usage

### Files Using Server-Side Encryption

1. **HandoffService** (`src/services/handoffService.ts`)
   - Already uses PostgreSQL `encrypt_phi_text`/`decrypt_phi_text` functions
   - Encrypts patient names and DOBs

2. **CHW Service** (`src/services/chwService.ts`)
   - Updated to use `phiEncryptionClient`
   - Encrypts medication photos

## HIPAA Compliance

### Before
- ❌ Encryption key in browser JavaScript
- ❌ Key extractable via DevTools
- ❌ Violation of § 164.312(a)(2)(iv)

### After
- ✅ Encryption key server-side only
- ✅ Key stored in Supabase Secrets
- ✅ Compliant with § 164.312(a)(2)(iv)
- ✅ Audit trail via Edge Function logs

## Testing

### Test Encryption Round-Trip
```typescript
import { validateEncryption } from '../utils/phiEncryptionClient';

// Returns true if encryption/decryption works correctly
const isWorking = await validateEncryption();
console.log('Encryption working:', isWorking);
```

### Manual Test via Edge Function
```bash
curl -X POST https://[project-id].supabase.co/functions/v1/phi-encrypt \
  -H "Authorization: Bearer [session-token]" \
  -H "Content-Type: application/json" \
  -d '{
    "data": "test data",
    "patientId": "test-patient",
    "operation": "encrypt"
  }'
```

## Troubleshooting

### Error: "Encryption key not configured"
- Verify `PHI_ENCRYPTION_KEY` exists in Supabase Secrets
- Check Edge Function logs for details

### Error: "Failed to decrypt PHI data"
- Data may have been encrypted with different key
- Check if migration was run on correct database

### Error: "Authentication required for PHI encryption"
- User session expired
- Ensure `supabase.auth.getSession()` returns valid session

## Security Best Practices

1. **Never log decrypted PHI** - Only log encrypted strings or error messages
2. **Rotate keys annually** - Update `PHI_ENCRYPTION_KEY` and re-encrypt data
3. **Monitor Edge Function logs** - Watch for failed encryption attempts
4. **Audit access** - Track who is calling encrypt/decrypt functions

## Migration Summary

| Component | Before | After |
|-----------|--------|-------|
| Encryption Location | Browser | Server (Edge Function + PostgreSQL) |
| Key Storage | `.env` (client-side) | Supabase Secrets (server-side) |
| Key Exposure | ❌ Visible in browser | ✅ Never exposed |
| HIPAA Compliance | ❌ Violation | ✅ Compliant |
| Implementation | `src/utils/phiEncryption.ts` | `src/utils/phiEncryptionClient.ts` + Edge Function |

## References

- HIPAA § 164.312(a)(2)(iv) - Encryption and Decryption
- PostgreSQL pgcrypto: https://www.postgresql.org/docs/current/pgcrypto.html
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Secrets: https://supabase.com/docs/guides/functions/secrets
