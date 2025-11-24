# Registration Database Debug Script

## The Real Problem

Based on the logs, Twilio SMS verification **IS WORKING** ✅
- Message sent successfully at 00:11:26
- Verification succeeded

The actual error is: **"Database error creating new user"** at 00:11:27

This means `supabase.auth.admin.createUser()` is failing.

---

## Run These Queries to Diagnose

### 1. Check if the phone number already exists in auth
```sql
SELECT
  id,
  phone,
  email,
  created_at,
  phone_confirmed_at,
  email_confirmed_at
FROM auth.users
WHERE phone = '+15551234567';  -- Replace with actual phone number
```

**If this returns a row:** User already exists! That's why registration fails.

---

### 2. Check pending registrations
```sql
SELECT
  id,
  phone,
  first_name,
  last_name,
  email,
  created_at,
  expires_at,
  password_encrypted IS NOT NULL as has_encrypted_password,
  password_plaintext IS NOT NULL as has_plaintext_password
FROM pending_registrations
WHERE phone = '+15551234567';  -- Replace with actual phone number
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Should show recent pending registration

---

### 3. Check profiles table for orphaned records
```sql
SELECT
  user_id,
  phone,
  first_name,
  last_name,
  created_at
FROM profiles
WHERE phone = '+15551234567';  -- Replace with actual phone number
```

**If this returns rows but auth.users doesn't:** Orphaned profile (data inconsistency)

---

### 4. Check service role permissions
```sql
-- This should work as service role
SELECT 1 FROM auth.users LIMIT 1;
```

**If this fails:** Service role key doesn't have proper permissions

---

## Most Likely Scenarios

### Scenario A: User Already Exists (Most Common)
**Symptom:** Phone number found in auth.users
**Cause:** Previous registration succeeded but user didn't know
**Fix:**
1. User should use "Login" instead of "Register"
2. OR delete user and try again:
   ```sql
   -- Delete from Supabase Auth Dashboard > Authentication > Users
   -- Or use SQL:
   DELETE FROM auth.users WHERE phone = '+15551234567';
   ```

### Scenario B: Partial Registration (Data Corruption)
**Symptom:** User exists in profiles but not in auth.users (or vice versa)
**Cause:** Previous registration failed halfway
**Fix:**
```sql
-- Clean up orphaned records
DELETE FROM profiles WHERE phone = '+15551234567'
  AND user_id NOT IN (SELECT id FROM auth.users);

-- Then try registration again
```

### Scenario C: Password Decryption Failure
**Symptom:** pending_registrations exists but password can't be decrypted
**Cause:** Encryption key mismatch or missing key
**Fix:**
```sql
-- Check if decryption works
SELECT decrypt_pending_password(password_encrypted)
FROM pending_registrations
WHERE phone = '+15551234567';

-- If this returns NULL or errors, encryption key is wrong
```

### Scenario D: Service Role Permissions
**Symptom:** createUser fails with permission error
**Cause:** Service role key is invalid or doesn't have admin.createUser permission
**Fix:**
1. Verify service role key in Supabase Dashboard
2. Regenerate if necessary
3. Update Edge Function secrets

---

## Quick Diagnostic Commands

### Check if user exists
```bash
# From Supabase SQL Editor
SELECT COUNT(*) as user_exists
FROM auth.users
WHERE phone = '+15551234567';
```

### View recent errors from Edge Functions
```sql
-- If you have audit_logs table
SELECT
  created_at,
  event_type,
  event_category,
  error_message,
  metadata
FROM audit_logs
WHERE event_category = 'SYSTEM_EVENT'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Solution Based on Error Analysis

The error log shows:
```
"Failed to create user account: Database error creating new user"
```

This is from line 196-220 in sms-verify-code/index.ts. The fix I just implemented:

1. ✅ Checks if phone already exists BEFORE calling createUser
2. ✅ Returns 409 error with clear message if duplicate
3. ✅ Logs full error details (code, message, status)
4. ✅ Cleans up pending_registrations automatically

---

## Next Debugging Steps

1. **Find the actual phone number** from the error logs (look for the phone field)
2. **Run Query #1 above** to check if user exists
3. **Check Supabase Edge Function logs** for the full error message with details
4. **Look for** `errorCode`, `errorStatus` fields in logs (new logging added)

---

## The Fix I Just Applied

**File:** `supabase/functions/sms-verify-code/index.ts`

**Changes:**
1. Lines 178-199: Added duplicate phone check
2. Lines 218-236: Enhanced error logging with codes and details
3. Lines 92-105: Better Twilio error detection

**Result:**
- Will show "Phone number already registered" if duplicate
- Will show specific error message from Supabase Auth
- Will log complete error details for debugging

---

## Deploy and Test

```bash
# Build the project
npm run build

# Commit and push (will auto-deploy to Supabase)
git add supabase/functions/sms-verify-code/index.ts
git commit -m "fix: add duplicate phone check and better error messages for registration"
git push

# Wait 1-2 minutes for Edge Functions to redeploy
# Then test registration again
```

---

**The error logs will now show EXACTLY what's failing** instead of generic "Database error".

Look for these new log fields:
- `errorCode`: Supabase Auth error code
- `errorStatus`: HTTP status from auth service
- `error`: Full error message
- `errorMessage`: Specific user-friendly message
