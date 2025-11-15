# 🔑 Encryption Key Rotation Procedure

**Document Version**: 1.0
**Last Updated**: November 15, 2025
**Owner**: Security Team
**Review Frequency**: Annually or after security incident

---

## 📋 Overview

This document describes the procedure for rotating encryption keys used in the WellFit Community platform. Regular key rotation is a security best practice and may be required by:
- **HIPAA** § 164.312(a)(2)(iv) - Encryption and Decryption
- **SOC 2** - Cryptographic key management controls
- **Incident Response** - After suspected key compromise

---

## 🔐 Keys in Use

### 1. PHI Encryption Key (`REACT_APP_PHI_ENCRYPTION_KEY`)
- **Purpose**: Encrypts PHI data (photos, documents, sensitive fields)
- **Algorithm**: AES-256-GCM
- **Location**: Environment variables (.env, Vercel/hosting platform)
- **Rotation Frequency**: Annually or after security incident

### 2. Database Encryption Key (`app.settings.encryption_key`)
- **Purpose**: Encrypts pending registration passwords in database
- **Algorithm**: AES-256 via pgcrypto
- **Location**: PostgreSQL database configuration
- **Rotation Frequency**: Annually or after security incident

### 3. Service Role Keys (Supabase)
- **Purpose**: Backend authentication for Edge Functions
- **Location**: Supabase dashboard, GitHub Secrets
- **Rotation Frequency**: After suspected compromise only

---

## ⏰ When to Rotate Keys

### Scheduled Rotation (Annual)
- Rotate all encryption keys once per year
- Schedule rotation during low-traffic period (e.g., Sunday 2 AM)
- Plan for 2-4 hour maintenance window

### Incident-Based Rotation (Immediate)
Rotate immediately if:
- ✅ Key exposed in code repository (even if reverted)
- ✅ Key logged in error messages or debugging output
- ✅ Key sent via insecure channel (email, Slack, etc.)
- ✅ Employee with key access leaves company
- ✅ Suspected unauthorized access to servers/environment
- ✅ Security audit recommendation

---

## 🚨 Pre-Rotation Checklist

Before starting key rotation:

- [ ] **Backup**: Full database backup completed and verified
- [ ] **Backup**: Encrypted data backup stored securely
- [ ] **Notification**: Maintenance window scheduled and users notified
- [ ] **Access**: Confirm access to all systems (database, hosting, GitHub)
- [ ] **Testing**: Test environment configured for rotation testing
- [ ] **Rollback**: Rollback plan documented and tested
- [ ] **Team**: At least 2 people available for rotation (primary + backup)
- [ ] **Monitoring**: Error monitoring and logging ready

---

## 📝 Key Rotation Procedures

### Procedure 1: PHI Encryption Key Rotation

**Complexity**: High
**Downtime**: 30-60 minutes
**Risk**: Medium (requires re-encryption of existing PHI data)

#### Step 1: Generate New Key

```bash
# Generate a secure 256-bit key (32 bytes)
openssl rand -base64 32

# Example output: Jx3K9mN2pQ7rT5vW8yB1cD4eF6gH0iL9M+sU/VxYz==
# Save this as NEW_PHI_ENCRYPTION_KEY
```

#### Step 2: Backup Current Data

```bash
# Backup database (including encrypted PHI)
npx supabase db dump > backup_before_key_rotation_$(date +%Y%m%d).sql

# Verify backup file exists and has content
ls -lh backup_before_key_rotation_*.sql
```

#### Step 3: Deploy Re-Encryption Script

Create migration file: `supabase/migrations/YYYYMMDD_rotate_phi_encryption_key.sql`

```sql
-- ============================================================================
-- PHI Encryption Key Rotation
-- Date: YYYY-MM-DD
-- WARNING: This is a DESTRUCTIVE operation. Backup required before running.
-- ============================================================================

BEGIN;

-- Step 1: Verify backup exists (manual verification required)
DO $$
BEGIN
  RAISE NOTICE 'STOP! Have you verified the backup exists? (Y/n)';
  RAISE NOTICE 'Backup file: backup_before_key_rotation_YYYYMMDD.sql';
  RAISE NOTICE 'If not, CTRL+C now and create backup first!';

  -- Sleep to give operator time to cancel
  PERFORM pg_sleep(10);
END $$;

-- Step 2: Create re-encryption function
CREATE OR REPLACE FUNCTION reencrypt_phi_data(
  old_key TEXT,
  new_key TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  record_count INTEGER := 0;
  current_row RECORD;
BEGIN
  -- Example: Re-encrypt community_moments.photo_url
  -- Adjust table/column names based on your schema

  FOR current_row IN
    SELECT id, photo_url
    FROM community_moments
    WHERE photo_url IS NOT NULL
  LOOP
    BEGIN
      -- Decrypt with old key, re-encrypt with new key
      -- This is a simplified example - adjust based on your encryption implementation

      UPDATE community_moments
      SET photo_url = pgp_sym_encrypt(
        pgp_sym_decrypt(photo_url::bytea, old_key),
        new_key
      )
      WHERE id = current_row.id;

      record_count := record_count + 1;

      -- Log progress every 100 records
      IF record_count % 100 = 0 THEN
        RAISE NOTICE 'Re-encrypted % records...', record_count;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to re-encrypt record %: %', current_row.id, SQLERRM;
      -- Continue processing other records
    END;
  END LOOP;

  RETURN record_count;
END;
$$;

-- Step 3: Perform re-encryption
-- CRITICAL: Replace 'OLD_KEY_HERE' and 'NEW_KEY_HERE' with actual keys
-- DO NOT COMMIT THESE KEYS TO GIT
SELECT reencrypt_phi_data('OLD_KEY_HERE', 'NEW_KEY_HERE');

-- Step 4: Clean up
DROP FUNCTION reencrypt_phi_data(TEXT, TEXT);

-- Step 5: Log rotation event
INSERT INTO audit_logs (
  event_type,
  event_category,
  operation,
  resource_type,
  success,
  metadata
) VALUES (
  'PHI_ENCRYPTION_KEY_ROTATION',
  'SYSTEM',
  'ROTATE_KEY',
  'encryption_keys',
  TRUE,
  jsonb_build_object(
    'rotation_date', NOW(),
    'initiated_by', current_user,
    'records_reencrypted', 'See function output above'
  )
);

COMMIT;
```

#### Step 4: Update Environment Variables

```bash
# Update .env files
OLD_KEY=$(grep REACT_APP_PHI_ENCRYPTION_KEY .env | cut -d'=' -f2)
echo "OLD_KEY=$OLD_KEY" # Save this securely for rollback

# Update to new key
sed -i 's/REACT_APP_PHI_ENCRYPTION_KEY=.*/REACT_APP_PHI_ENCRYPTION_KEY=NEW_KEY_HERE/' .env
```

#### Step 5: Update Production Environment

**Vercel:**
```bash
# Update environment variable
vercel env rm REACT_APP_PHI_ENCRYPTION_KEY production
vercel env add REACT_APP_PHI_ENCRYPTION_KEY production
# Paste new key when prompted

# Redeploy
vercel --prod
```

**Netlify:**
```bash
# Via CLI
netlify env:set REACT_APP_PHI_ENCRYPTION_KEY "NEW_KEY_HERE" --scope deploys

# Or via Dashboard:
# Settings → Environment Variables → Edit REACT_APP_PHI_ENCRYPTION_KEY
```

**GitHub Actions (if using):**
```bash
# Update repository secret
gh secret set REACT_APP_PHI_ENCRYPTION_KEY --body "NEW_KEY_HERE"
```

#### Step 6: Verify Rotation

```bash
# Test encryption/decryption with new key
npm run test:encryption

# Check logs for errors
tail -f /var/log/application.log | grep -i encryption

# Verify audit log entry
psql $DATABASE_URL -c "
  SELECT * FROM audit_logs
  WHERE event_type = 'PHI_ENCRYPTION_KEY_ROTATION'
  ORDER BY created_at DESC
  LIMIT 1;
"
```

#### Step 7: Monitor for 24 Hours

- Watch error logs for decryption failures
- Check PHI data accessibility in UI
- Verify no user-reported issues
- Monitor performance metrics

#### Step 8: Document Completion

```bash
# Update key rotation log
echo "$(date): PHI encryption key rotated successfully" >> docs/KEY_ROTATION_LOG.txt
git add docs/KEY_ROTATION_LOG.txt
git commit -m "docs: log PHI encryption key rotation"
git push
```

---

### Procedure 2: Database Encryption Key Rotation

**Complexity**: Medium
**Downtime**: 15-30 minutes
**Risk**: Low (only affects pending registrations)

#### Step 1: Generate New Key

```bash
openssl rand -base64 32
# Save as NEW_DB_ENCRYPTION_KEY
```

#### Step 2: Update Database Configuration

```sql
-- Connect to database as superuser
psql $DATABASE_URL

-- Set new encryption key
ALTER DATABASE postgres -- Replace with your DB name
SET app.settings.encryption_key = 'NEW_DB_ENCRYPTION_KEY';

-- Verify
SHOW app.settings.encryption_key;
```

#### Step 3: Re-encrypt Pending Registrations

```sql
-- Re-encrypt all pending registrations with new key
DO $$
DECLARE
  old_key TEXT := 'OLD_DB_ENCRYPTION_KEY';
  new_key TEXT := 'NEW_DB_ENCRYPTION_KEY';
  record_count INTEGER := 0;
BEGIN
  UPDATE pending_registrations
  SET password_encrypted = pgp_sym_encrypt(
    pgp_sym_decrypt(password_encrypted, old_key),
    new_key
  )
  WHERE password_encrypted IS NOT NULL;

  GET DIAGNOSTICS record_count = ROW_COUNT;

  RAISE NOTICE 'Re-encrypted % pending registrations', record_count;

  -- Log rotation
  INSERT INTO audit_logs (
    event_type,
    event_category,
    operation,
    resource_type,
    success,
    metadata
  ) VALUES (
    'DB_ENCRYPTION_KEY_ROTATION',
    'SYSTEM',
    'ROTATE_KEY',
    'database_encryption',
    TRUE,
    jsonb_build_object(
      'rotation_date', NOW(),
      'records_reencrypted', record_count
    )
  );
END $$;
```

#### Step 4: Verify

```sql
-- Test encryption/decryption with new key
SELECT public.encrypt_pending_password('test123');
-- Should succeed

-- Test decryption
SELECT pgp_sym_decrypt(
  public.encrypt_pending_password('test123'),
  current_setting('app.settings.encryption_key')
);
-- Should return 'test123'
```

---

### Procedure 3: Service Role Key Rotation (Supabase)

**Complexity**: Low
**Downtime**: 5-10 minutes
**Risk**: Low

#### Step 1: Generate New Service Role Key

1. Go to Supabase Dashboard → Settings → API
2. Click "Reset Service Role Key"
3. Confirm reset
4. Copy new service role key

#### Step 2: Update GitHub Secrets

```bash
# Update GitHub Actions secret
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "NEW_SERVICE_ROLE_KEY"
```

#### Step 3: Update Edge Function Secrets

```bash
# Update secrets in Edge Functions
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=NEW_SERVICE_ROLE_KEY

# Redeploy functions
npx supabase functions deploy --all
```

#### Step 4: Verify

```bash
# Test cleanup function (uses service role key)
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/rest/v1/rpc/cleanup_expired_pending_registrations' \
  -H "apikey: NEW_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer NEW_SERVICE_ROLE_KEY"

# Should return: number (count of deleted records)
```

---

## 🔄 Rollback Procedure

If key rotation fails:

### Rollback PHI Encryption Key

```bash
# 1. Stop application
vercel env rm REACT_APP_PHI_ENCRYPTION_KEY production

# 2. Restore old key
vercel env add REACT_APP_PHI_ENCRYPTION_KEY production
# Paste OLD_KEY when prompted

# 3. Restore database from backup
psql $DATABASE_URL < backup_before_key_rotation_YYYYMMDD.sql

# 4. Redeploy
vercel --prod

# 5. Verify
curl https://your-app.com/health
```

### Rollback Database Encryption Key

```sql
-- Restore old key
ALTER DATABASE postgres
SET app.settings.encryption_key = 'OLD_DB_ENCRYPTION_KEY';

-- Verify pending registrations work
SELECT public.decrypt_pending_password(password_encrypted)
FROM pending_registrations
LIMIT 1;
```

---

## 📊 Post-Rotation Verification Checklist

After completing rotation:

- [ ] **Encryption**: Test encryption/decryption works with new key
- [ ] **Decryption**: Verify existing encrypted data can be decrypted
- [ ] **Logs**: Check for encryption/decryption errors
- [ ] **UI**: Verify PHI data displays correctly in application
- [ ] **Performance**: Confirm no performance degradation
- [ ] **Audit**: Key rotation event logged in audit_logs table
- [ ] **Documentation**: Rotation documented in KEY_ROTATION_LOG.txt
- [ ] **Monitoring**: 24-hour monitoring period scheduled
- [ ] **Old Keys**: Old keys securely deleted after 30-day retention

---

## 🗄️ Key Storage and Access Control

### Where Keys Are Stored

| Key Type | Storage Location | Access Control |
|----------|------------------|----------------|
| PHI Encryption Key | Vercel/Netlify Env Vars | Production deploy access only |
| Database Encryption Key | PostgreSQL config | Database superuser only |
| Service Role Key | GitHub Secrets | Repo admin + GitHub Actions |
| Backup Keys (30 days) | Password manager (1Password/LastPass) | CTO + Security Lead only |

### Access Logging

All key access should be logged:

```sql
-- Log key access events
INSERT INTO audit_logs (
  event_type,
  event_category,
  actor_user_id,
  operation,
  resource_type,
  metadata
) VALUES (
  'ENCRYPTION_KEY_ACCESS',
  'SECURITY',
  current_user,
  'VIEW_KEY',
  'encryption_keys',
  jsonb_build_object(
    'timestamp', NOW(),
    'accessed_by', current_user,
    'key_type', 'PHI_ENCRYPTION_KEY',
    'purpose', 'Key rotation procedure'
  )
);
```

---

## 📅 Key Rotation Schedule

| Key Type | Last Rotated | Next Scheduled | Frequency |
|----------|--------------|----------------|-----------|
| PHI Encryption Key | Never (new system) | 2026-11-15 | Annually |
| Database Encryption Key | Never (new system) | 2026-11-15 | Annually |
| Service Role Key | As needed | As needed | After compromise |

---

## 📞 Emergency Contacts

| Role | Contact | When to Contact |
|------|---------|-----------------|
| Security Lead | security@wellfit.org | Key compromise suspected |
| Database Admin | dba@wellfit.org | Database key rotation issues |
| DevOps Lead | devops@wellfit.org | Deployment/environment issues |
| HIPAA Compliance Officer | compliance@wellfit.org | HIPAA incident reporting |

---

## 🔗 Related Documentation

- [SECURITY_DEPLOYMENT_COMPLETE.md](../SECURITY_DEPLOYMENT_COMPLETE.md)
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)
- [ENCRYPTION_STATUS_REPORT.md](ENCRYPTION_STATUS_REPORT.md)
- [INCIDENT_RESPONSE_PLAN.md](INCIDENT_RESPONSE_PLAN.md)

---

**Last Reviewed**: November 15, 2025
**Next Review**: November 15, 2026
**Document Owner**: Security Team
