# Guardian Cron Job Setup Guide

This guide walks you through enabling the Guardian Agent's automated monitoring system.

## Prerequisites

- Access to Supabase Dashboard (https://supabase.com/dashboard)
- Project: `xkybsjnvuohpqpbkikyn`

---

## Step 1: Enable Required Extensions

### Via Supabase Dashboard (Easiest)

1. Go to **Supabase Dashboard** → **Database** → **Extensions**
2. Search for and enable:
   - `pg_cron` - For scheduled jobs
   - `pg_net` - For HTTP requests from database
   - `pgcrypto` - For encryption (should already be enabled)

### Via SQL Editor (Alternative)

If you prefer SQL, go to **SQL Editor** and run:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify they're enabled
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'pgcrypto');
```

---

## Step 2: Verify Cron Jobs Exist

Run this in the SQL Editor:

```sql
-- Check if Guardian cron jobs are scheduled
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'guardian%';
```

**Expected output:**
| jobname | schedule | active |
|---------|----------|--------|
| guardian-automated-monitoring | */5 * * * * | t |
| guardian-daily-summary | 0 8 * * * | t |

---

## Step 3: If Cron Jobs Are Missing

If Step 2 returns no rows, create them:

```sql
-- Schedule Guardian to run every 5 minutes
SELECT cron.schedule(
  'guardian-automated-monitoring',
  '*/5 * * * *',
  $$SELECT trigger_guardian_monitoring();$$
);

-- Schedule daily summary at 8 AM UTC
SELECT cron.schedule(
  'guardian-daily-summary',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/guardian-agent',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"action": "analyze"}'::jsonb
  );
  $$
);
```

---

## Step 4: Configure SB_SECRET_KEY (Important!)

The cron job needs the `SB_SECRET_KEY` (formerly called `service_role_key`) to authenticate with the Guardian edge function.

> **Note:** Supabase has deprecated the old key naming. The new convention is:
> - `SB_PUBLISHABLE_KEY` (formerly `anon` key) - for client-side
> - `SB_SECRET_KEY` (formerly `service_role` key) - for server-side

### Option A: Use Supabase Vault (Recommended - Most Secure)

1. Go to **Supabase Dashboard** → **Settings** → **Vault**
2. Add a new secret:
   - Name: `sb_secret_key`
   - Value: Your SB_SECRET_KEY from Settings → API (starts with `sb_secret_...`)

The `trigger_guardian_monitoring()` function automatically checks Vault first for the key.

### Option B: Set via Database Config (Dashboard)

Since `ALTER DATABASE` requires superuser privileges, use the Supabase Dashboard:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this SQL (you may need to contact Supabase support or use the dashboard settings):

```sql
-- This requires admin privileges
-- If you can't run this, use Vault instead (Option A)
ALTER DATABASE postgres SET app.sb_secret_key = 'your-sb-secret-key-here';
SELECT pg_reload_conf();
```

### Key Lookup Order

The `trigger_guardian_monitoring()` function tries these sources in order:

1. **Vault** - `vault.decrypted_secrets WHERE name = 'sb_secret_key'`
2. **App Setting (New)** - `current_setting('app.sb_secret_key')`
3. **App Setting (Legacy)** - `current_setting('app.service_role_key')` (backwards compatible)

---

## Step 5: Test the Setup

### Manual Test

```sql
-- Manually trigger Guardian monitoring
SELECT trigger_guardian_monitoring();

-- Check if it logged
SELECT * FROM guardian_cron_log
ORDER BY executed_at DESC
LIMIT 5;
```

### Verify in Dashboard

1. Go to your app's **Super Admin Dashboard**
2. Click the **Guardian** tab
3. Status should show **ONLINE** (green) if cron ran in last 10 minutes

---

## Step 6: Monitor Cron Execution

### View Recent Executions

```sql
SELECT
  job_name,
  executed_at,
  status,
  details
FROM guardian_cron_log
ORDER BY executed_at DESC
LIMIT 20;
```

### View Cron Job History (pg_cron built-in)

```sql
SELECT
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

---

## Troubleshooting

### Guardian Shows "OFFLINE"

1. Check if cron jobs exist: `SELECT * FROM cron.job WHERE jobname LIKE 'guardian%';`
2. Check recent executions: `SELECT * FROM guardian_cron_log ORDER BY executed_at DESC LIMIT 5;`
3. Check for errors: `SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC LIMIT 5;`

### Cron Jobs Not Running

1. Verify pg_cron is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
2. Check if jobs are active: `SELECT jobname, active FROM cron.job;`
3. Enable if inactive: `UPDATE cron.job SET active = true WHERE jobname LIKE 'guardian%';`

### HTTP Requests Failing

1. Verify pg_net is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_net';`
2. Check if service_role_key is set: `SHOW app.service_role_key;`
3. Test edge function manually via curl

### Quick Fix: Make Guardian Show Online

If you just need Guardian to show as online immediately:

```sql
-- Insert a manual log entry
INSERT INTO guardian_cron_log (job_name, status, details)
VALUES ('guardian-manual-trigger', 'success',
        jsonb_build_object('source', 'manual', 'timestamp', now()));
```

---

## Summary Checklist

- [ ] Enable `pg_cron` extension
- [ ] Enable `pg_net` extension
- [ ] Verify cron jobs exist
- [ ] Set `sb_secret_key` in Vault (or database config)
- [ ] Test with `SELECT trigger_guardian_monitoring();`
- [ ] Verify Guardian shows ONLINE in dashboard

---

## SB_SECRET_KEY Location

To find your SB_SECRET_KEY:

1. Go to **Supabase Dashboard**
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **SB_SECRET_KEY** (formerly called `service_role` key)
   - It starts with `sb_secret_...`
   - NOT the `SB_PUBLISHABLE_KEY` (starts with `sb_publishable_...`)

**IMPORTANT:** Never expose the SB_SECRET_KEY in client-side code. It's only for server-side/database use.
