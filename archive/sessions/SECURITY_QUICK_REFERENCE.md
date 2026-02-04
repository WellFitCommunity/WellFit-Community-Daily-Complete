# Security Quick Reference Guide

**For**: WellFit Development & Operations Team
**Purpose**: Quick answers to common security questions

---

## Session Timeouts

| User Type | Timeout Duration | Notes |
|-----------|------------------|-------|
| Seniors | 8 hours | Balances security with usability |
| Staff (Admin PIN) | 2 hours | More frequent re-auth for privileged access |
| General Auth | 8 hours | Base Supabase session |

**To Change**: Update `DEFAULT_TIMEOUT_MS` in `src/contexts/SessionTimeoutContext.tsx:17`

---

## Password Requirements

✅ **Minimum**: 8 characters
✅ **Must Include**:
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*...)

❌ **Not Allowed**:
- Common passwords (password, admin123, etc.)
- Passwords over 128 characters

**Password Expiration**: 90 days (warning at 14 days remaining)

---

## Account Lockout Policy

**Trigger**: 5 failed login attempts in 15 minutes
**Lockout Duration**: 15 minutes (automatic unlock)
**Scope**: Per identifier (email or phone)

### Manual Unlock (Admin Only)

```sql
SELECT unlock_account('user@example.com', auth.uid(), 'Admin override');
```

---

## Common Security Tasks

### Check if Account is Locked

```sql
SELECT is_account_locked('user@example.com');
```

### View Recent Failed Logins

```sql
SELECT identifier, COUNT(*) as failures
FROM login_attempts
WHERE success = FALSE
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY identifier
HAVING COUNT(*) >= 3
ORDER BY COUNT(*) DESC;
```

### Check Password Expiration Status

```sql
SELECT
  email,
  password_expires_at,
  days_until_password_expires(user_id) as days_remaining
FROM profiles
WHERE password_expires_at < NOW() + INTERVAL '14 days'
  AND password_never_expires = FALSE
ORDER BY password_expires_at;
```

### View Active Lockouts

```sql
SELECT
  identifier,
  locked_at,
  locked_until,
  EXTRACT(EPOCH FROM (locked_until - NOW()))/60 as minutes_remaining
FROM account_lockouts
WHERE unlocked_at IS NULL
  AND locked_until > NOW()
ORDER BY locked_at DESC;
```

---

## MFA Enforcement

**Mandatory for**: admin, super_admin, physician, nurse, billing, case_manager

**Grace Period**: 7 days for new staff

### Check MFA Status

```sql
SELECT
  user_id,
  role,
  mfa_enabled,
  enforcement_status,
  grace_period_ends
FROM mfa_enrollment
WHERE user_id = 'USER_UUID';
```

---

## Audit Queries

### Login Activity Report (Last 7 Days)

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_logins,
  COUNT(CASE WHEN success THEN 1 END) as successful,
  COUNT(CASE WHEN NOT success THEN 1 END) as failed,
  COUNT(DISTINCT identifier) as unique_users
FROM login_attempts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Most Failed Login Attempts

```sql
SELECT
  identifier,
  COUNT(*) as failed_count,
  MAX(created_at) as last_attempt,
  ARRAY_AGG(DISTINCT ip_address) as ip_addresses
FROM login_attempts
WHERE success = FALSE
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY identifier
HAVING COUNT(*) >= 5
ORDER BY failed_count DESC
LIMIT 20;
```

### Admin Enrollment Audit

```sql
SELECT
  ae.admin_id,
  ap.email as admin_email,
  ae.user_id as enrolled_user_id,
  up.email as enrolled_email,
  ae.created_at
FROM admin_enroll_audit ae
JOIN profiles ap ON ap.user_id = ae.admin_id
JOIN profiles up ON up.user_id = ae.user_id
WHERE ae.created_at > NOW() - INTERVAL '30 days'
ORDER BY ae.created_at DESC;
```

---

## Security Incident Response

### If Account is Compromised

1. **Immediately Lock Account**:
```sql
INSERT INTO account_lockouts (user_id, identifier, lockout_type, locked_until, locked_by)
VALUES (
  'COMPROMISED_USER_ID',
  'user@example.com',
  'security_event',
  NOW() + INTERVAL '24 hours',
  auth.uid()
);
```

2. **Force Password Reset**:
```sql
UPDATE profiles
SET force_password_change = TRUE
WHERE user_id = 'COMPROMISED_USER_ID';
```

3. **Review Audit Logs**:
```sql
SELECT *
FROM login_attempts
WHERE user_id = 'COMPROMISED_USER_ID'
ORDER BY created_at DESC
LIMIT 100;
```

---

## Environment Variables

```bash
# Session Timeout (milliseconds)
REACT_APP_INACTIVITY_TIMEOUT_MS=28800000  # 8 hours

# Warning before timeout (milliseconds)
REACT_APP_TIMEOUT_WARNING_MS=300000  # 5 minutes

# Database Connection
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
```

---

## Troubleshooting

### "Account temporarily locked" message

**Cause**: Too many failed login attempts
**Solution**: Wait 15 minutes OR admin can manually unlock
**Prevention**: Ensure correct credentials

### "Password has expired" message

**Cause**: Password older than 90 days
**Solution**: User must reset password
**Exemption**: Set `password_never_expires = TRUE` for service accounts

### Login attempts not being recorded

**Check**:
1. Database function exists: `SELECT * FROM pg_proc WHERE proname = 'record_login_attempt';`
2. Permissions granted: `GRANT EXECUTE ON FUNCTION record_login_attempt TO service_role;`
3. RLS policy allows insert: Check `account_lockouts` and `login_attempts` policies

---

## Contact

**Security Questions**: Contact System Administrator
**Audit Questions**: Refer to `docs/SOC2_SECURITY_CONTROLS.md`
**Bug Reports**: GitHub Issues

---

*Last Updated: October 24, 2025*
