# Supabase Encryption Key Setup - Step-by-Step Guide
**For**: WellFit Community Daily - SOC 2 FHIR Backend
**Platform**: Supabase (NOT AWS)
**Time Required**: 10 minutes
**Difficulty**: Easy - Just copy/paste and click buttons

---

## What We're Doing (In Plain English)

We need to create a secret "password" (encryption key) that the database will use to encrypt sensitive patient data. Think of it like the master key to a vault - without it, encrypted data stays locked.

**Important**: This key will be stored INSIDE Supabase's database settings, NOT in AWS or Azure. Supabase handles the security for us.

---

## Step 1: Generate Your Encryption Key (2 minutes)

### Option A: Using Your Terminal (Mac/Linux)

1. Open your terminal in VS Code (bottom panel)
2. Copy and paste this command:

```bash
openssl rand -base64 32
```

3. You'll see output like this:
```
a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==
```

4. **COPY THIS ENTIRE STRING** - we'll use it in the next step

### Option B: Using Online Generator (If terminal command doesn't work)

1. Go to: https://generate-random.org/encryption-key-generator
2. Set: **Key Length** = 256 bits
3. Set: **Output Format** = Base64
4. Click: **Generate**
5. **COPY THE KEY** (looks like: `a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==`)

### Option C: Using VS Code Terminal (Windows)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Step 2: Save Your Key Somewhere Safe (1 minute)

⚠️ **CRITICAL**: You need this key to decrypt data. If you lose it, encrypted data is GONE FOREVER.

**Save it in TWO places:**

1. **Password Manager** (1Password, LastPass, Bitwarden, etc.)
   - Title: "WellFit Production Encryption Key"
   - Note: Copy your key here

2. **Secure Note in Your Repository** (for team access)
   - Create: `.env.vault` (this file is in `.gitignore`, won't be committed)
   - Add:
     ```
     # PRODUCTION ENCRYPTION KEY - DO NOT COMMIT TO GIT
     # Generated: 2025-10-18
     ENCRYPTION_KEY=a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==
     ```

---

## Step 3: Add Key to Supabase (5 minutes)

### 3.1: Open Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Log in to your account
3. Click on your **WellFit project** (the one with your database)

### 3.2: Navigate to Database Settings

1. On the left sidebar, click: **Project Settings** (⚙️ icon at bottom)
2. Click: **Database** (in the settings menu)
3. Scroll down to: **Custom PostgreSQL Configuration**

### 3.3: Add the Encryption Key Parameter

1. You'll see a section that says "Add custom PostgreSQL parameters"
2. Click: **Add parameter** (or **New parameter**)
3. Fill in:
   - **Name**: `app.encryption_key`
   - **Value**: `a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==` (YOUR key from Step 1)
   - **Restart required**: Check the box (if shown)

4. Click: **Save** or **Add parameter**

**Screenshot of what it looks like:**
```
┌─────────────────────────────────────────────────────────┐
│ Custom PostgreSQL Configuration                         │
├─────────────────────────────────────────────────────────┤
│ Parameter Name:    app.encryption_key                   │
│ Parameter Value:   a1B2c3D4e5F6g7H8i9J0k1L2m3...        │
│ [✓] Restart database after saving                       │
│                                                          │
│                    [Cancel]  [Save]                      │
└─────────────────────────────────────────────────────────┘
```

### 3.4: Restart Your Database

⚠️ **IMPORTANT**: The database needs to restart for the key to take effect.

1. Supabase may restart automatically (you'll see a notification)
2. If not, go to: **Project Settings** → **General**
3. Scroll to: **Danger Zone**
4. Click: **Pause project** then **Resume project**

**Wait time**: 2-3 minutes for restart

---

## Step 4: Verify the Key Works (2 minutes)

### 4.1: Open Supabase SQL Editor

1. In Supabase dashboard, click: **SQL Editor** (left sidebar)
2. Click: **New query**

### 4.2: Test Encryption

Copy and paste this into the SQL editor:

```sql
-- Test 1: Check if key is set
SHOW app.encryption_key;
```

**Click: Run**

**Expected Result**: You should see your encryption key displayed (this proves it's configured)

Now test encryption:

```sql
-- Test 2: Encrypt some test data
SELECT public.encrypt_data('Hello World');
```

**Click: Run**

**Expected Result**: You'll see encrypted gibberish like:
```
wcBMA1234abcd5678...
```

Now test decryption:

```sql
-- Test 3: Encrypt then decrypt (should get "Hello World" back)
SELECT public.decrypt_data(
  public.encrypt_data('Hello World')
);
```

**Click: Run**

**Expected Result**: You should see:
```
Hello World
```

✅ **If you see "Hello World", encryption is working!**

---

## Step 5: Deploy the Security Migrations (2 minutes)

Now that encryption is configured, let's deploy the security features.

### 5.1: Link Your Supabase Project (if not already linked)

In your VS Code terminal:

```bash
# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF
```

**Where to find YOUR_PROJECT_REF**:
- Go to Supabase Dashboard → Project Settings → General
- Look for "Reference ID" (looks like: `xkybsjnvuohpqpbkikyn`)
- Copy that and replace `YOUR_PROJECT_REF` above

### 5.2: Push Migrations

```bash
npx supabase db push
```

**What you'll see**:
```
Applying migration 20251018160000_soc2_security_foundation.sql...
Applying migration 20251018160001_soc2_field_encryption.sql...
Applying migration 20251018160002_soc2_audit_triggers.sql...
Applying migration 20251018160003_soc2_data_retention.sql...
Applying migration 20251018160004_soc2_monitoring_views.sql...
✓ All migrations applied successfully
```

**Time**: ~30 seconds

⚠️ **If you get an error about project not linked**:
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```
Then try `npx supabase db push` again.

---

## Step 6: Verify Everything Works (3 minutes)

### 6.1: Check Compliance Status

In Supabase SQL Editor, run:

```sql
SELECT * FROM public.compliance_status;
```

**Expected Result**: You should see a table like this:

| control_area | soc2_criterion | status | details | test_result |
|--------------|----------------|--------|---------|-------------|
| Audit Logging | CC7.3 | COMPLIANT | Last audit log: 0 seconds ago | PASS |
| Data Encryption | PI1.4 | COMPLIANT | 100.0% of credentials encrypted | PASS |
| Access Controls | CC6.1 | COMPLIANT | 15 RLS policies active | PASS |
| Security Monitoring | CC7.2 | COMPLIANT | 0 security events logged (24h) | PASS |
| Data Retention | PI1.5 | COMPLIANT | 7 active retention policies | PASS |
| Incident Response | CC7.4 | COMPLIANT | 0 pending investigations | PASS |

✅ **All rows should show "COMPLIANT" or "PASS"**

### 6.2: Test the Security Dashboard

```sql
SELECT * FROM public.security_monitoring_dashboard;
```

**Expected Result**: You'll see a dashboard with metrics like:
- `total_security_events_24h`: 0
- `critical_events_24h`: 0
- `phi_accesses_24h`: 0
- `fhir_tokens_encrypted_pct`: 100.0
- `profiles_encrypted_pct`: 0.0 (will increase as data is added)

---

## What Just Happened? (Summary)

1. ✅ **Generated encryption key** - Your secret "password" for encrypting data
2. ✅ **Saved key securely** - In password manager + `.env.vault`
3. ✅ **Configured Supabase** - Added `app.encryption_key` to database settings
4. ✅ **Tested encryption** - Verified encrypt/decrypt works
5. ✅ **Deployed migrations** - Added all security tables and functions
6. ✅ **Verified compliance** - All SOC 2 controls passing

---

## FAQ / Troubleshooting

### Q: What if I lose my encryption key?

**A**: Encrypted data is **PERMANENTLY UNRECOVERABLE**. This is why we saved it in two places (password manager + `.env.vault`).

**Recovery steps if lost**:
1. Check password manager
2. Check `.env.vault` file
3. Check Supabase dashboard (Project Settings → Database → Custom Config)

If truly lost, you'll need to:
1. Generate a new key
2. Re-encrypt all existing data (requires old key)
3. If old key is lost, encrypted data is gone forever

### Q: Can I change the encryption key later?

**A**: Yes, but it's a complex process:
1. Generate new key
2. Set as `app.encryption_key_new`
3. Run re-encryption migration (decrypts with old key, encrypts with new)
4. Switch keys
5. Remove old key

**Frequency**: Once per year recommended

### Q: Is my encryption key secure in Supabase?

**A**: Yes! Supabase stores it in PostgreSQL's configuration, which:
- Is NOT accessible via API
- Requires database admin access to view
- Is encrypted at rest by Supabase
- Is NOT sent to the client

### Q: What if `npx supabase db push` fails?

**Common errors**:

1. **"Project not linked"**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **"Migration already applied"**
   - This is OK! It means migrations were already run
   - Migrations are idempotent (safe to run multiple times)

3. **"Encryption key not set"**
   - Go back to Step 3 and verify the key is configured
   - Make sure you restarted the database

4. **"Permission denied"**
   - Make sure you're logged in: `npx supabase login`
   - Make sure you have owner/admin role on the project

### Q: Can I test this in a development environment first?

**A**: YES, HIGHLY RECOMMENDED!

1. Create a separate Supabase project called "WellFit Dev"
2. Generate a DIFFERENT encryption key for dev
3. Follow this same guide for the dev project
4. Test everything there first
5. Once confident, deploy to production

### Q: What if my database restarts during business hours?

**A**:
- Restart takes 2-3 minutes
- Your app will be unavailable during restart
- Best time: Schedule during low-traffic hours (2-4 AM)
- Supabase sends notifications to connected clients

---

## Next Steps After Setup

1. **Encrypt Existing Data** (if you have any):
   ```sql
   -- Encrypt existing FHIR tokens
   UPDATE fhir_connections
   SET access_token_encrypted = public.encrypt_data(access_token),
       access_token = NULL
   WHERE access_token IS NOT NULL;
   ```

2. **Update Application Code**:
   - Import the security service: `import { ErrorSanitizer, AuditLogger } from './services/fhirSecurityService';`
   - Replace error handling with sanitized errors
   - Add audit logging to sensitive operations

3. **Set Up Monitoring**:
   - Schedule daily review of security dashboard
   - Set up alerts for critical security events
   - Review audit logs weekly

4. **Schedule Maintenance**:
   - Weekly: Check token expiration
   - Monthly: Review audit logs
   - Quarterly: Test backup/recovery

---

## Need Help?

If you get stuck:

1. **Check the error message carefully**
2. **Review this guide again** - Most issues are covered in FAQ
3. **Check Supabase status**: https://status.supabase.com
4. **Ask me!** I'm here to help troubleshoot

---

**You're doing great!** This is complex security stuff, but we're taking it one step at a time. Once the encryption key is set up, the rest is automatic.

Let me know when you've completed Step 1 (generating the key) and I'll help you through the rest! 🚀
