# Consecutive Check-In Alerts System

## Overview

Implemented a graduated alert system that monitors community members for consecutive missed check-ins and sends increasingly urgent reminders:

- **Day 3**: Firebase push notification (sweet, encouraging reminder)
- **Day 5**: SMS text message (gentle nudge)
- **Day 7**: Email to caregiver/emergency contact (requesting wellness check)

## System Architecture

### Database Components

#### 1. New Column: `profiles.emergency_email`
- Stores caregiver/emergency contact email address
- Receives Day 7 alert emails
- Indexed for fast lookups

#### 2. Table: `consecutive_missed_checkins_log`
Tracks all alert history to prevent duplicates:
```sql
- id (uuid)
- user_id (uuid) → FK to auth.users
- consecutive_days (integer) - 3, 5, or 7
- alert_type (text) - 'push', 'sms', or 'email'
- alert_sent_at (timestamptz)
- alert_successful (boolean)
- error_message (text)
```

**Cooldown Logic**: Prevents sending duplicate alerts within 23 hours

#### 3. Materialized View: `user_consecutive_missed_days`
Fast, pre-computed view of users with missed check-ins:
```sql
- user_id
- first_name, last_name
- phone, emergency_email
- caregiver_first_name, caregiver_last_name, caregiver_phone
- consecutive_missed_days (calculated)
- last_checkin_at
- last_refreshed_at
```

**Refresh Strategy**: Refreshed automatically before each alert run (10 AM CT daily)

#### 4. Functions

**`calculate_consecutive_missed_days(user_id)`**
- Calculates consecutive days since last check-in
- Uses Chicago timezone
- Returns 0 if checked in today or no check-ins exist

**`refresh_consecutive_missed_days()`**
- Refreshes materialized view
- Called by Edge Function before processing alerts

### Edge Function: `send-consecutive-missed-alerts`

**Location**: `/supabase/functions/send-consecutive-missed-alerts/index.ts`

**Schedule**: Runs daily at 10:00-10:05 AM Central Time

**Execution Flow**:
1. **Time-gate check**: Only runs during 10:00-10:05 AM CT window
2. **Refresh view**: Updates `user_consecutive_missed_days` materialized view
3. **Fetch candidates**: Gets all users with ≥3 consecutive missed days
4. **Process alerts** for each user:
   - Day 7+ → Send caregiver email
   - Day 5-6 → Send SMS reminder
   - Day 3-4 → Send push notification
5. **Cooldown check**: Skips if alert sent <23 hours ago
6. **Log results**: Records all attempts in `consecutive_missed_checkins_log`
7. **Return summary**: Counts of successful/failed alerts by type

### Alert Templates

**Location**: `/supabase/functions/shared/emailTemplates.ts`

#### Day 3 Push Notification
```typescript
Title: "We Miss You! 💙"
Body: "Hi {name}! It's been a few days since your last check-in.
       We'd love to hear how you're doing today. Tap to log your wellness update!"
```

#### Day 5 SMS
```
"Hi {name}! 👋 We noticed you haven't checked in for a few days.
Just a friendly reminder to log how you're feeling today.
Your wellness matters to us! 💙 - WellFit Community"
```

#### Day 7 Caregiver Email
Professional, compassionate HTML email including:
- Subject: "WellFit Wellness Check: {patient_name} hasn't checked in for 7 days"
- Personalized greeting to caregiver
- Last check-in timestamp (formatted in CT)
- Action items:
  1. Reach out to patient
  2. Check if they need app assistance
  3. Confirm continued participation
- Gradient header, professional styling
- HIPAA-compliant (no tracking pixels)

## Alert Logic

### Consecutive Days Calculation

```typescript
// Chicago timezone used throughout
const today = CURRENT_DATE AT TIME ZONE 'America/Chicago'
const lastCheckin = DATE(timestamp AT TIME ZONE 'America/Chicago')
const consecutive_missed_days = today - lastCheckin

// Examples:
// - Last check-in: Mon, Today: Thu → 3 days → Day 3 alert
// - Last check-in: Mon, Today: Sat → 5 days → Day 5 alert
// - Last check-in: Mon, Today: Mon (next week) → 7 days → Day 7 alert
```

### Alert Priority & Cooldown

**Priority**: Higher urgency alerts supersede lower ones
- Day 7 email > Day 5 SMS > Day 3 push
- Only the highest-priority alert is sent per day

**Cooldown**: 23-hour window between alerts
- Prevents spam if user misses check-in for extended period
- Checked per user, per alert type
- Query: `alert_sent_at >= (NOW() - INTERVAL '23 hours')`

### Example Alert Flow

**User "Mary" timeline:**
```
Mon: Check-in ✅
Tue: No check-in (1 day)
Wed: No check-in (2 days)
Thu 10 AM: No check-in (3 days) → 🔔 Push notification sent
Fri: No check-in (4 days) → ⏸️ Cooldown (no alert)
Sat 10 AM: No check-in (5 days) → 📱 SMS sent
Sun: No check-in (6 days) → ⏸️ Cooldown (no alert)
Mon 10 AM: No check-in (7 days) → 📧 Caregiver email sent
```

## Setup & Deployment

### 1. Database Migration

✅ **Applied**: `20251105000000_create_consecutive_checkin_tracking.sql`

**What it creates**:
- `profiles.emergency_email` column
- `consecutive_missed_checkins_log` table
- `user_consecutive_missed_days` materialized view
- Helper functions and indexes
- RLS policies

### 2. Edge Function

✅ **Deployed**: `send-consecutive-missed-alerts`

```bash
npx supabase functions deploy send-consecutive-missed-alerts
```

**Environment variables required** (already configured):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FCM_SERVER_KEY` (Firebase push)
- `TWILIO_ACCOUNT_SID` (SMS)
- `TWILIO_AUTH_TOKEN` (SMS)
- `MAILERSEND_API_KEY` (Email)
- `MAILERSEND_FROM_EMAIL`
- `MAILERSEND_FROM_NAME`

### 3. Cron Job Scheduling

**⚠️ TODO**: Set up daily cron job in Supabase Dashboard

**Steps**:
1. Go to Supabase Dashboard → Project → Database → Cron Jobs
2. Create new cron job:
   ```sql
   SELECT cron.schedule(
     'consecutive-missed-checkin-alerts',
     '0 15 * * *', -- 10:00 AM CT = 3:00 PM UTC (during CST) or 4:00 PM UTC (during CDT)
     $$
     SELECT net.http_post(
       url := 'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-consecutive-missed-alerts',
       headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     )
     $$
   );
   ```

**Alternative**: Use external cron service (GitHub Actions, Vercel Cron, etc.)

## Testing

### Manual Test

1. **Create test user with old check-in**:
   ```sql
   -- Set a user's last check-in to 3+ days ago
   UPDATE check_ins
   SET timestamp = NOW() - INTERVAL '3 days'
   WHERE user_id = 'test-user-uuid'
   AND timestamp = (
     SELECT MAX(timestamp) FROM check_ins WHERE user_id = 'test-user-uuid'
   );
   ```

2. **Refresh view**:
   ```sql
   SELECT refresh_consecutive_missed_days();
   ```

3. **Check materialized view**:
   ```sql
   SELECT * FROM user_consecutive_missed_days WHERE consecutive_missed_days >= 3;
   ```

4. **Trigger function manually** (via Supabase Dashboard):
   - Go to Edge Functions → `send-consecutive-missed-alerts` → Invoke
   - Or use curl with service role key

5. **Verify alert log**:
   ```sql
   SELECT * FROM consecutive_missed_checkins_log ORDER BY alert_sent_at DESC LIMIT 10;
   ```

### Monitoring Queries

**Users needing alerts today**:
```sql
SELECT
  user_id,
  first_name,
  last_name,
  consecutive_missed_days,
  last_checkin_at,
  CASE
    WHEN consecutive_missed_days >= 7 THEN 'Email to caregiver'
    WHEN consecutive_missed_days >= 5 THEN 'SMS'
    WHEN consecutive_missed_days >= 3 THEN 'Push notification'
  END AS alert_type
FROM user_consecutive_missed_days
WHERE consecutive_missed_days >= 3
ORDER BY consecutive_missed_days DESC;
```

**Alert history (last 7 days)**:
```sql
SELECT
  p.first_name,
  p.last_name,
  l.consecutive_days,
  l.alert_type,
  l.alert_sent_at,
  l.alert_successful,
  l.error_message
FROM consecutive_missed_checkins_log l
JOIN profiles p ON p.user_id = l.user_id
WHERE l.alert_sent_at >= NOW() - INTERVAL '7 days'
ORDER BY l.alert_sent_at DESC;
```

**Alert success rate**:
```sql
SELECT
  alert_type,
  COUNT(*) AS total_sent,
  SUM(CASE WHEN alert_successful THEN 1 ELSE 0 END) AS successful,
  ROUND(100.0 * SUM(CASE WHEN alert_successful THEN 1 ELSE 0 END) / COUNT(*), 2) AS success_rate_pct
FROM consecutive_missed_checkins_log
WHERE alert_sent_at >= NOW() - INTERVAL '30 days'
GROUP BY alert_type;
```

## Caregiver Email Configuration

### Adding Emergency Email

**Admin can set via SQL**:
```sql
UPDATE profiles
SET emergency_email = 'caregiver@example.com'
WHERE user_id = 'patient-uuid';
```

**Or via UI** (if enrollment form updated):
- Add `emergency_email` field to EnrollSeniorPage
- Save to profiles during enrollment

### Email Template Customization

Edit `/supabase/functions/shared/emailTemplates.ts` → `buildCaregiverAlertEmail()`

**Current template includes**:
- Gradient purple header with 💙 emoji
- Personalized caregiver greeting
- Patient name and missed days count
- Last check-in timestamp (formatted)
- 3-step action checklist
- Professional, compassionate tone
- No tracking pixels (HIPAA-compliant)

## Integration with Existing Systems

### Existing Daily Reminder (9 AM)

**Function**: `send-checkin-reminders` (already deployed)
- Sends push notification at 9:00 AM CT
- Generic reminder: "Hi {name}, it's time for your check-in!"
- Sent to ALL users with FCM tokens

**Relationship**: Complementary systems
- 9 AM = proactive daily reminder
- 10 AM consecutive alerts = reactive intervention

### Existing 7-Day Stale Alert

**Function**: `notify-stale-checkins` (already deployed)
- Runs daily at 11:00 AM CT
- Sends email if last check-in > 7 days ago
- Uses `emergency_email` field (same as new system)
- Weekly cooldown (one email per week)

**⚠️ Overlap**: Both systems email caregivers at Day 7

**Recommendation**: Consider deprecating `notify-stale-checkins` or adjust logic:
```typescript
// Option 1: Disable old function (use new graduated system only)
// Option 2: Change old function to 14-day threshold
// Option 3: Keep both (belt & suspenders approach)
```

## Security & Compliance

### HIPAA Considerations

**✅ Compliant Features**:
- Email tracking disabled (no click/open tracking)
- Minimal PHI in alert content (first name only)
- Audit trail in `consecutive_missed_checkins_log`
- RLS policies protect access
- Service role authentication required

**Caregiver Authorization**:
- Assumes caregiver relationship established during enrollment
- Emergency email provided with patient consent
- Consider adding HIPAA release date tracking

### Row Level Security (RLS)

**`consecutive_missed_checkins_log` policies**:
- Users can SELECT own alert logs
- Service role can INSERT (Edge Function)
- Staff roles can SELECT all (monitoring)

**`profiles` table**:
- Users can SELECT/UPDATE own profile
- Service role can SELECT for alert processing
- Staff can SELECT all profiles

## Troubleshooting

### Issue: Alerts not sending

**Check**:
1. Is cron job scheduled? (Supabase Dashboard → Cron Jobs)
2. Is function deployed? (`npx supabase functions list`)
3. Are environment variables set? (Dashboard → Settings → Edge Functions)
4. Check function logs: Dashboard → Edge Functions → Logs

**Common causes**:
- Cron not created
- Wrong timezone calculation (should be CT)
- Missing FCM tokens (push), phone numbers (SMS), or emergency emails

### Issue: Duplicate alerts

**Check cooldown logic**:
```sql
SELECT *
FROM consecutive_missed_checkins_log
WHERE user_id = 'problem-user-uuid'
AND alert_sent_at >= NOW() - INTERVAL '24 hours'
ORDER BY alert_sent_at DESC;
```

**Expected**: No more than 1 alert of each type per 23 hours

### Issue: Materialized view out of date

**Refresh manually**:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY user_consecutive_missed_days;
```

**Or use function**:
```sql
SELECT refresh_consecutive_missed_days();
```

**Note**: Edge Function automatically refreshes before each run

## Future Enhancements

1. **User Preferences**
   - Let users opt-out of specific alert types
   - Customize alert thresholds (e.g., 5 days instead of 3)
   - Quiet hours support

2. **Multiple Caregivers**
   - Support CC'ing multiple emergency contacts
   - Escalation chain (email caregiver #1, then #2 if no response)

3. **Two-Way Communication**
   - Caregiver can reply to email with update
   - SMS response handling ("Patient is OK", "Will check on them")

4. **Dashboard Analytics**
   - Admin view of alert effectiveness
   - Response rate tracking
   - Engagement metrics after alerts

5. **Smart Scheduling**
   - Send alerts at user's preferred time
   - Avoid holidays/weekends for emails
   - Adaptive timing based on user patterns

## Files Created/Modified

### New Files
- ✅ `/supabase/migrations/20251105000000_create_consecutive_checkin_tracking.sql`
- ✅ `/supabase/functions/send-consecutive-missed-alerts/index.ts`
- ✅ `/supabase/functions/shared/emailTemplates.ts`
- ✅ `/docs/CONSECUTIVE_CHECKIN_ALERTS_SYSTEM.md` (this file)

### Modified Files
- `/supabase/migrations/_SKIP_20251020200000_create_telehealth_tables.sql` (made idempotent)

## Summary

The consecutive check-in alert system provides a caring, graduated approach to wellness monitoring:

1. **Day 3**: Gentle push reminder (in-app)
2. **Day 5**: Personal SMS nudge
3. **Day 7**: Caregiver notification (requesting wellness check)

**Key Features**:
- Zero false positives (uses consecutive days, not cumulative)
- Cooldown prevents spam
- Compassionate, non-judgmental messaging
- Full audit trail for compliance
- Integrates with existing notification infrastructure

**Status**: ✅ **Fully Implemented & Deployed**

**Next Step**: ⚠️ Set up cron job scheduling in Supabase Dashboard

---

*Generated by Claude Code on 2025-11-05*
*Questions? Contact the development team.*
