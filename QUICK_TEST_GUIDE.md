# Quick Testing Guide - Logging Implementation

**Status:** ✅ All code committed and pushed to GitHub
**Branch:** main
**Commit:** 14e9a77

---

## WHAT GOT DEPLOYED

All 10 Edge Functions are LIVE in production right now:
- login ✅
- admin-login ✅
- register ✅
- passkey-auth-start ✅
- passkey-auth-finish ✅
- verify-admin-pin ✅
- coding-suggest ✅
- sdoh-coding-suggest ✅
- generate-837p ✅
- realtime_medical_transcription ✅

---

## QUICK 5-MINUTE TEST

### Step 1: Test Database Infrastructure

```bash
# Run the automated smoke test
./scripts/test-logging.sh
```

**Expected:** All ✓ green checkmarks (except "recent activity" which will warn if no usage yet)

### Step 2: Test Authentication Logging

**Option A: From Your Working Environment**
1. Open your application
2. Try to login with wrong password
3. Then login successfully

**Option B: Direct API Test**
```bash
# Failed login test
curl -X POST https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/login \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"phone": "+15555551234", "password": "wrongpassword"}'
```

### Step 3: Check the Database

```sql
-- Check for login events
SELECT
  event_type,
  success,
  actor_ip_address,
  timestamp,
  metadata
FROM audit_logs
WHERE event_category = 'AUTHENTICATION'
ORDER BY timestamp DESC
LIMIT 10;
```

**Expected:** You should see entries for your login attempts

### Step 4: Test Admin Panel PHI Logging

1. Login as admin to your application
2. Navigate to Users List (admin panel)
3. Click on a user to view details

```sql
-- Check for admin panel access
SELECT * FROM audit_logs
WHERE event_type = 'ADMIN_VIEW_USER_LIST'
ORDER BY timestamp DESC LIMIT 5;

-- Check for individual PHI access
SELECT * FROM phi_access_log
ORDER BY accessed_at DESC LIMIT 5;
```

**Expected:** Entries showing admin viewed user list and individual user

---

## IF TABLES ARE STILL EMPTY

**This is EXPECTED if:**
- No one has used the application since deployment
- You haven't run the tests above yet

**DO THIS:**
1. Make ONE login attempt (success or failure)
2. Run: `SELECT COUNT(*) FROM audit_logs;`
3. If count is still 0:
   - Check Edge Function logs in Supabase dashboard
   - Check for errors: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/functions

---

## FULL DATABASE CHECK

```sql
-- Get row counts from all audit tables
SELECT
  'audit_logs' as table_name,
  COUNT(*) as row_count
FROM audit_logs
UNION ALL
SELECT 'claude_api_audit', COUNT(*)
FROM claude_api_audit
UNION ALL
SELECT 'phi_access_log', COUNT(*)
FROM phi_access_log
UNION ALL
SELECT 'security_events', COUNT(*)
FROM security_events;

-- Show most recent events from each table
SELECT 'audit_logs' as source, event_type as event, timestamp as time
FROM audit_logs
ORDER BY timestamp DESC LIMIT 5
UNION ALL
SELECT 'claude_api_audit', request_type, created_at
FROM claude_api_audit
ORDER BY created_at DESC LIMIT 5
UNION ALL
SELECT 'phi_access_log', phi_type, accessed_at
FROM phi_access_log
ORDER BY accessed_at DESC LIMIT 5
UNION ALL
SELECT 'security_events', event_type, timestamp
FROM security_events
ORDER BY timestamp DESC LIMIT 5;
```

---

## WHAT TO LOOK FOR

### ✅ SUCCESS INDICATORS
- `audit_logs` table has entries after login attempts
- `event_type` matches actions (USER_LOGIN_SUCCESS, USER_LOGIN_FAILED)
- `actor_ip_address` is populated
- `timestamp` is recent
- `success` boolean matches actual outcome

### ❌ FAILURE INDICATORS
- Tables stay empty after using the application
- Error messages in Edge Function logs
- RLS policy errors when querying tables

---

## IF SOMETHING BREAKS

### Problem: Tables are empty after using app
**Check:**
1. Supabase Function logs: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/functions
2. Look for errors like "permission denied" or "RLS policy"
3. Verify you're using service role key in Edge Functions

### Problem: Can't query tables
**Fix:**
```sql
-- Make sure you're logged in as admin
-- Or use service role key to bypass RLS
```

### Problem: Functions aren't deployed
**Redeploy:**
```bash
npx supabase functions deploy FUNCTION_NAME --project-ref xkybsjnvuohpqpbkikyn
```

---

## ROLLBACK (IF NEEDED)

If the logging breaks something:

```bash
# Revert to previous commit
git revert HEAD

# Redeploy affected function
npx supabase functions deploy FUNCTION_NAME --project-ref xkybsjnvuohpqpbkikyn
```

**BUT:** Logging is wrapped in try/catch, so failures won't break your app!

---

## NEXT STEPS AFTER TESTING

1. ✅ Confirm audit tables populate correctly
2. ✅ Monitor for 24-48 hours
3. ⏱️ Add remaining PHI logging (see LOGGING_COMPLETE_HANDOFF.md)
4. ⏱️ Complete admin action logging
5. ⏱️ Set up compliance dashboards

---

## SUPPORT DOCS

- **Technical Details:** [docs/LOGGING_FINAL_ASSESSMENT.md](docs/LOGGING_FINAL_ASSESSMENT.md)
- **Deployment Info:** [docs/DEPLOYMENT_VERIFICATION.md](docs/DEPLOYMENT_VERIFICATION.md)
- **Complete Handoff:** [docs/LOGGING_COMPLETE_HANDOFF.md](docs/LOGGING_COMPLETE_HANDOFF.md)
- **Executive Summary:** [docs/LOGGING_STATUS_SUMMARY.md](docs/LOGGING_STATUS_SUMMARY.md)

---

**Everything is deployed and ready to test!**

Pull the latest code from GitHub and start testing in your working environment.
