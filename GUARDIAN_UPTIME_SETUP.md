# Guardian Uptime Monitoring Setup Guide

**Status:** ✅ Code Complete | 🚀 Ready to Deploy
**Cost:** $0/month (using free tools)
**Time to Deploy:** 30-45 minutes

---

## What We Built

### 1. Guardian Email Alerts ✅
**What it does:**
- Automatically emails you when critical or high-severity issues are detected
- Includes alert details: severity, category, title, message
- Uses your existing `send-email` function

**Files Modified:**
- [supabase/functions/guardian-agent/index.ts](supabase/functions/guardian-agent/index.ts) - Added `sendAlertEmail()` function

### 2. Automated Health Checks ✅
**What it does:**
- Guardian runs automatically every 5 minutes
- Monitors: failed logins, database errors, PHI access, slow queries
- Logs results to `security_alerts` table
- Daily summary email at 8 AM UTC

**Files Created:**
- [supabase/migrations/20251107180000_guardian_cron_monitoring.sql](supabase/migrations/20251107180000_guardian_cron_monitoring.sql) - Cron job setup

### 3. Public Status Endpoint ✅
**What it does:**
- Public URL Methodist can monitor: `/functions/v1/system-status`
- Returns: "operational", "degraded", or "down"
- Checks: Database, API, Guardian
- UptimeRobot can ping this every minute

**Files Created:**
- [supabase/functions/system-status/index.ts](supabase/functions/system-status/index.ts) - Public health check

---

## Deployment Steps

### Step 1: Deploy Guardian Updates (5 minutes)

```bash
# Navigate to project root
cd /workspaces/WellFit-Community-Daily-Complete

# Deploy updated Guardian function
cd supabase
supabase functions deploy guardian-agent

# Deploy new system-status function
supabase functions deploy system-status

# Push database migration (creates cron jobs)
supabase db push
```

**Verify deployment:**
```bash
# Check function status
supabase functions list | grep -E "guardian-agent|system-status"

# Should show ACTIVE for both
```

---

### Step 2: Set Admin Email (2 minutes)

Guardian needs to know where to send alerts:

```bash
# Set admin email in Supabase secrets
supabase secrets set ADMIN_EMAIL=your-email@example.com

# Redeploy Guardian to pick up new secret
supabase functions deploy guardian-agent
```

**Alternative:** Set in Supabase Dashboard:
1. Go to https://app.supabase.com/project/xkybsjnvuohpqpbkikyn/settings/functions
2. Click "guardian-agent"
3. Add secret: `ADMIN_EMAIL` = `your-email@example.com`
4. Save

---

### Step 3: Test Guardian Email Alerts (5 minutes)

```bash
# Test Guardian monitoring manually
# (This should trigger email if any critical alerts exist)

# Option A: Via Supabase SQL Editor
# Go to: https://app.supabase.com/project/xkybsjnvuohpqpbkikyn/sql/new
# Run:
SELECT trigger_guardian_monitoring();

# Option B: Create a test alert
INSERT INTO security_alerts (severity, category, title, message, status)
VALUES ('critical', 'test', 'Test Alert', 'Testing Guardian email notifications', 'pending');

# Then run monitoring:
SELECT trigger_guardian_monitoring();
```

**Expected result:**
- Email sent to your admin email with alert details
- Check spam folder if not received within 5 minutes

---

### Step 4: Test Public Status Endpoint (2 minutes)

```bash
# Test the status endpoint
curl https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/system-status

# Expected output:
{
  "status": "operational",
  "timestamp": "2025-11-07T...",
  "checks": [
    {
      "name": "database",
      "status": "operational",
      "responseTime": 123
    },
    {
      "name": "api",
      "status": "operational",
      "responseTime": 456
    },
    {
      "name": "guardian",
      "status": "operational",
      "responseTime": 789,
      "message": "Active"
    }
  ],
  "uptime_seconds": 12345
}
```

**If status is "down" or "degraded":**
- Check the "checks" array to see which component failed
- Review logs in Supabase Dashboard

---

### Step 5: Verify Cron Jobs Running (3 minutes)

```bash
# Check if cron jobs were created
# In Supabase SQL Editor:

SELECT * FROM guardian_cron_status;

# Expected output:
jobname                         | schedule    | active | last_run | next_run
--------------------------------|-------------|--------|----------|----------
guardian-automated-monitoring   | */5 * * * * | t      | ...      | ...
guardian-daily-summary          | 0 8 * * *   | t      | ...      | ...
```

**If cron jobs not showing:**
- Run the migration again: `supabase db push`
- Check if pg_cron extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`

**Wait 5 minutes, then check:**
```sql
-- See if Guardian has run
SELECT * FROM guardian_cron_log
ORDER BY executed_at DESC
LIMIT 10;
```

---

### Step 6: Set Up UptimeRobot (15 minutes) - FREE

**Sign up:**
1. Go to https://uptimerobot.com/
2. Sign up for free account (no credit card required)
3. Free tier: 50 monitors, 5-minute checks

**Add Monitor 1: Main Site**
1. Click "Add New Monitor"
2. Monitor Type: HTTP(s)
3. Friendly Name: "WellFit Main Site"
4. URL: `https://your-domain.com` (or your Vercel URL)
5. Monitoring Interval: 5 minutes
6. Click "Create Monitor"

**Add Monitor 2: System Status API**
1. Add New Monitor
2. Monitor Type: HTTP(s)
3. Friendly Name: "WellFit System Status"
4. URL: `https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/system-status`
5. Keyword: `operational` (will alert if not found in response)
6. Monitoring Interval: 5 minutes
7. Click "Create Monitor"

**Add Monitor 3: Guardian Agent**
1. Add New Monitor
2. Monitor Type: Keyword
3. Friendly Name: "Guardian Monitoring"
4. URL: `https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/system-status`
5. Keyword: `"guardian".*"operational"` (check Guardian is running)
6. Monitoring Interval: 5 minutes
7. Click "Create Monitor"

**Add Monitor 4: Database Health**
1. Add New Monitor
2. Monitor Type: Keyword
3. Friendly Name: "Database Health"
4. URL: `https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/system-status`
5. Keyword: `"database".*"operational"`
6. Monitoring Interval: 5 minutes
7. Click "Create Monitor"

**Set Up Alert Contacts:**
1. Go to "My Settings" → "Alert Contacts"
2. Add your email address
3. Verify email (check inbox)
4. **Recommended:** Add SMS alert (50 SMS/month free):
   - Click "Add Alert Contact" → "SMS"
   - Enter phone number
   - Verify via SMS

**Configure Alerts:**
1. Go back to "Monitors"
2. For each monitor, click "Edit"
3. Check "Alert Contacts to Notify"
4. Select your email/SMS contact
5. Save

---

### Step 7: Create Status Page (Optional, 5 minutes)

UptimeRobot Free includes 1 public status page!

**Create Status Page:**
1. In UptimeRobot, go to "Public Status Pages"
2. Click "Add New Status Page"
3. Friendly Name: "WellFit System Status"
4. Custom URL: `wellfit-status` (creates: wellfit-status.uptimerobot.com)
5. Select monitors to show: All 4 monitors
6. Click "Create Status Page"

**Share with Methodist:**
- URL: `https://wellfit-status.uptimerobot.com`
- Methodist can bookmark this to check system status anytime
- Shows uptime %, response times, incident history

---

## What Methodist Will See

**When they visit your status page:**
```
WellFit System Status

All Systems Operational ✅

Current Status:
- WellFit Main Site: ✅ Operational (99.99% uptime)
- System Status API: ✅ Operational
- Guardian Monitoring: ✅ Operational
- Database Health: ✅ Operational

Last 90 Days Uptime: 99.9%
```

---

## Monitoring Summary

### What You Have Now (Cost: $0/month)

| Component | Purpose | Alert Method | Check Interval |
|-----------|---------|--------------|----------------|
| **Guardian Internal** | Backend errors, security, performance | Email | Every 5 minutes (cron) |
| **UptimeRobot External** | Site uptime, API health | Email + SMS | Every 5 minutes |
| **system-status API** | Public health check | Methodist can ping | On-demand |
| **Status Page** | Public visibility | Methodist bookmarks | Real-time |

---

## Testing Checklist

Before telling Methodist "we have monitoring":

- [ ] Guardian email alerts work (test by creating critical alert)
- [ ] Cron jobs are running (check `guardian_cron_log` table)
- [ ] system-status endpoint returns "operational"
- [ ] UptimeRobot is pinging endpoints every 5 minutes
- [ ] Email/SMS alerts configured in UptimeRobot
- [ ] Status page is public and shows all monitors

---

## Troubleshooting

### Guardian emails not sending

**Check 1: Is send-email function deployed?**
```bash
supabase functions list | grep send-email
```

**Check 2: Is ADMIN_EMAIL set?**
```bash
# In Supabase Dashboard → Project Settings → Edge Functions
# Check guardian-agent secrets for ADMIN_EMAIL
```

**Check 3: Are there critical alerts?**
```sql
SELECT * FROM security_alerts
WHERE severity IN ('critical', 'high')
ORDER BY created_at DESC
LIMIT 5;
```

**Check 4: Guardian logs**
```bash
# In Supabase Dashboard → Edge Functions → guardian-agent → Logs
# Look for: "Alert email sent" or errors
```

---

### Cron jobs not running

**Check 1: Is pg_cron installed?**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- Should return 1 row
```

**Check 2: Are jobs scheduled?**
```sql
SELECT * FROM cron.job WHERE jobname LIKE 'guardian%';
-- Should return 2 rows
```

**Check 3: Manually trigger**
```sql
SELECT trigger_guardian_monitoring();
-- Should execute without error
```

**Fix: Reinstall cron jobs**
```bash
# Re-run migration
supabase db push
```

---

### UptimeRobot showing "down"

**Check 1: Is system-status function deployed?**
```bash
supabase functions list | grep system-status
```

**Check 2: Test endpoint manually**
```bash
curl https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/system-status
```

**Check 3: UptimeRobot keyword match**
- Make sure keyword is: `operational` (not "operational" with quotes)
- Check "Keyword exists" vs "Keyword doesn't exist"

---

## What to Tell Methodist

**"How do you monitor uptime?"**

> "We have a multi-layered monitoring system:
>
> **Internal Monitoring (Guardian):**
> - Runs automated health checks every 5 minutes
> - Monitors security, performance, and database health
> - Immediate email alerts for critical issues
> - Tracks failed logins, PHI access patterns, slow queries
>
> **External Monitoring (UptimeRobot):**
> - Third-party uptime monitoring from multiple locations
> - Checks system status every 5 minutes
> - Email and SMS alerts if site goes down
> - Public status page you can bookmark
>
> **Public Status Endpoint:**
> - Real-time health check API
> - Returns system status: operational, degraded, or down
> - You can integrate with your own monitoring tools
>
> **Status Page:**
> - https://wellfit-status.uptimerobot.com
> - Shows real-time status and 90-day uptime history
> - Updated every 5 minutes"

---

## Cost Breakdown

| Service | Plan | Cost | What You Get |
|---------|------|------|--------------|
| Guardian | Custom | $0 | Internal monitoring, email alerts |
| UptimeRobot | Free | $0 | 50 monitors, 5-min checks, 1 status page, 50 SMS/month |
| Supabase Cron | Included | $0 | Automated job scheduling |
| system-status | Edge Function | $0 | Public health check API |
| **Total** | - | **$0/month** | **Professional-grade monitoring** |

**Savings vs. paid services:**
- Better Uptime: $10/month saved
- StatusPage.io: $29/month saved
- **Total savings: $39/month = $468/year**

---

## Next Steps

1. **Deploy everything** (30 minutes)
   - Follow deployment steps above
   - Test each component

2. **Configure UptimeRobot** (15 minutes)
   - Set up 4 monitors
   - Add email/SMS alerts
   - Create status page

3. **Test end-to-end** (10 minutes)
   - Create test alert → verify email
   - Wait 5 minutes → verify cron ran
   - Check UptimeRobot dashboard

4. **Share with Methodist** (5 minutes)
   - Send status page URL
   - Explain monitoring capabilities
   - Show them it's professional-grade

---

## Maintenance

**Weekly:**
- Check UptimeRobot dashboard for any downtime
- Review Guardian alerts in SecurityPanel

**Monthly:**
- Review `guardian_cron_log` for job health
- Check UptimeRobot uptime % (should be > 99.9%)
- Test alert notifications (create test alert)

**Quarterly:**
- Review UptimeRobot SMS usage (50/month limit)
- Update ADMIN_EMAIL if team changes
- Review and cleanup old security alerts

---

**Status: Ready to Deploy!**

Run through deployment steps and you'll have professional-grade uptime monitoring for $0/month.
