# Security Alerting Setup Guide

## Overview

This document outlines the steps to complete the security alerting automation setup for SOC2 compliance (CC6.1, CC7.2, CC7.3).

**Status:** Code is complete and deployed. Configuration required in Supabase Dashboard.

---

## What Was Implemented

### 1. Database Functions & Triggers
- `check_failed_login_threshold()` - Auto-creates alert after 5 failed logins in 15 minutes
- `create_alert_from_security_event()` - Creates alerts from CRITICAL/HIGH security events
- `create_alert_from_anomaly()` - Creates alerts from anomaly detection
- `check_alert_escalation()` - Escalates unacknowledged alerts after 15 minutes
- `get_security_alert_stats()` - Dashboard statistics
- `acknowledge_security_alert()` / `resolve_security_alert()` - Alert management
- `pending_security_alerts` view - Prioritized alert queue

### 2. Edge Function
- `security-alert-processor` - Sends notifications via Email, SMS, Slack, PagerDuty

### 3. Test Coverage
- 29 tests passing in `src/services/__tests__/securityAutomationService.test.ts`

---

## Configuration Steps

### Step 1: Set Supabase Secrets

Run these commands in your terminal (replace with actual values):

```bash
# MailerSend (Email)
npx supabase secrets set MAILERSEND_API_KEY=your_mailersend_api_key
npx supabase secrets set MAILERSEND_FROM_EMAIL=noreply@thewellfitcommunity.org

# Twilio (SMS)
npx supabase secrets set TWILIO_ACCOUNT_SID=your_twilio_account_sid
npx supabase secrets set TWILIO_AUTH_TOKEN=your_twilio_auth_token
npx supabase secrets set TWILIO_FROM_NUMBER=+1234567890

# NOTE: Slack and PagerDuty are NOT used
# We use the in-house SOC Dashboard at /soc-dashboard instead

# Recipients
npx supabase secrets set SECURITY_ALERT_EMAILS=security@thewellfitcommunity.org,admin@thewellfitcommunity.org
npx supabase secrets set SECURITY_ALERT_PHONES=+1234567890,+0987654321
```

### Step 2: Configure Edge Function Cron Job

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn
2. Navigate to **Database > Extensions**
3. Enable `pg_net` extension (if not already enabled)
4. Navigate to **Database > Scheduled Jobs** (or use SQL Editor)
5. Create a new scheduled job:

```sql
-- Run this in SQL Editor
SELECT cron.schedule(
  'process-security-alerts',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/security-alert-processor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Step 3: Verify Deployment

```bash
# Check edge function is deployed
npx supabase functions list | grep security-alert-processor

# Check database functions exist
npx supabase db dump --schema public 2>&1 | grep -E "check_failed_login_threshold|check_alert_escalation"
```

---

## Git Commit Steps

After completing configuration:

```bash
# Stage all changes
git add -A

# Review what's being committed
git status

# Commit
git commit -m "feat: implement real-time security alerting automation

- Add SecurityAutomationService for threshold monitoring and automated responses
- Add database triggers for failed login detection and security event alerts
- Add security-alert-processor edge function for multi-channel notifications
- Add check_alert_escalation() for 15-minute auto-escalation
- Add pending_security_alerts view for prioritized alert queue
- Update .env.example with security alerting configuration
- Add 29 passing tests for security automation service

SOC2 Compliance: CC6.1, CC7.2, CC7.3

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin main
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/securityAutomationService.ts` | New - Automation service |
| `src/services/__tests__/securityAutomationService.test.ts` | New - 29 tests |
| `src/services/guardian-agent/SecurityAlertNotifier.ts` | Updated - Real notifications |
| `supabase/migrations/20251203000002_security_alerting_automation.sql` | New - DB functions |
| `supabase/functions/security-alert-processor/index.ts` | New - Edge function |
| `.env.example` | Updated - Security config vars |

---

## Testing the Setup

### Test Failed Login Alert

```sql
-- Insert test failed login attempts
INSERT INTO login_attempts (identifier, success, ip_address, user_agent, created_at)
VALUES
  ('test@example.com', false, '192.168.1.1', 'Test Agent', NOW()),
  ('test@example.com', false, '192.168.1.1', 'Test Agent', NOW() - interval '1 minute'),
  ('test@example.com', false, '192.168.1.1', 'Test Agent', NOW() - interval '2 minutes'),
  ('test@example.com', false, '192.168.1.1', 'Test Agent', NOW() - interval '3 minutes'),
  ('test@example.com', false, '192.168.1.1', 'Test Agent', NOW() - interval '4 minutes');

-- Check if alert was created
SELECT * FROM security_alerts WHERE alert_type = 'brute_force_attack' ORDER BY created_at DESC LIMIT 5;
```

### Test Edge Function Manually

```bash
curl -X POST 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/security-alert-processor' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### View Pending Alerts

```sql
SELECT * FROM pending_security_alerts;
```

---

## Notification Channels by Severity

| Severity | Email | SOC Dashboard | SMS |
|----------|-------|---------------|-----|
| Critical | ✅ | ✅ (with audio alert) | ✅ |
| High | ✅ | ✅ (with audio alert) | ❌ |
| Medium | ✅ | ✅ | ❌ |
| Low | ✅ | ✅ | ❌ |
| Escalated | ✅ | ✅ (with audio alert) | ✅ |

**Note:** The in-house SOC Dashboard at `/soc-dashboard` replaces Slack/PagerDuty.
Operators get browser notifications and audio alerts based on their preferences.

---

## Troubleshooting

### Edge Function Not Receiving Requests
- Check pg_net extension is enabled
- Verify cron job is scheduled: `SELECT * FROM cron.job;`
- Check function logs in Supabase Dashboard

### Notifications Not Sending
- Verify secrets are set: `npx supabase secrets list`
- Check edge function logs for errors
- Test individual channels with `testNotification()` method

### Alerts Not Being Created
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname LIKE '%login%';`
- Verify login_attempts table has required columns
- Check for errors in Supabase logs

---

## Related Documentation

- [SOC2 Security Dashboard](/admin/security-dashboard)
- [Guardian Agent Documentation](../src/services/guardian-agent/README.md)
- [Audit Logger](../src/services/auditLogger.ts)
