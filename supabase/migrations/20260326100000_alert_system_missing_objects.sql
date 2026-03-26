-- Migration: Create missing database objects for the check-in alert system
-- These objects are required by 3 deployed edge functions:
--   1. send-consecutive-missed-alerts (10 AM CT) — needs: user_consecutive_missed_days, consecutive_missed_checkins_log, refresh function
--   2. notify-stale-checkins (11 AM CT) — needs: latest_checkin view, inactivity_reminder_log
--   3. send-checkin-reminders (9 AM CT) — needs: cron job only (fcm_tokens table already exists)
--
-- Also adds pg_cron jobs for the two functions that don't have them yet.

-- ============================================================
-- 1. latest_checkin view (alias for v_latest_check_in)
--    notify-stale-checkins queries "latest_checkin" but the DB
--    has "v_latest_check_in". Create a thin alias view.
-- ============================================================
CREATE OR REPLACE VIEW public.latest_checkin
WITH (security_invoker = on) AS
SELECT
  user_id,
  "timestamp" AS last_checkin
FROM public.v_latest_check_in;

COMMENT ON VIEW public.latest_checkin IS 'Alias for v_latest_check_in — used by notify-stale-checkins edge function';

-- ============================================================
-- 2. user_consecutive_missed_days materialized view
--    Calculates how many consecutive calendar days each user
--    has missed their daily check-in (CT timezone).
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_consecutive_missed_days AS
WITH last_checkins AS (
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    p.phone,
    p.caregiver_email AS emergency_email,
    p.caregiver_first_name,
    p.caregiver_last_name,
    p.caregiver_phone,
    p.tenant_id,
    MAX(ci."timestamp") AS last_checkin_at
  FROM public.profiles p
  LEFT JOIN public.check_ins ci ON ci.user_id = p.user_id
  WHERE p.user_id IS NOT NULL
  GROUP BY p.user_id, p.first_name, p.last_name, p.phone,
           p.caregiver_email, p.caregiver_first_name,
           p.caregiver_last_name, p.caregiver_phone, p.tenant_id
)
SELECT
  user_id,
  first_name,
  last_name,
  phone,
  emergency_email,
  caregiver_first_name,
  caregiver_last_name,
  caregiver_phone,
  tenant_id,
  last_checkin_at,
  -- Days since last check-in (or since account creation if never checked in)
  GREATEST(
    EXTRACT(DAY FROM (NOW() AT TIME ZONE 'America/Chicago') -
      COALESCE(last_checkin_at AT TIME ZONE 'America/Chicago', '2025-01-01'::timestamp))::int,
    0
  ) AS consecutive_missed_days
FROM last_checkins;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ucmd_user_id
  ON public.user_consecutive_missed_days (user_id);

COMMENT ON MATERIALIZED VIEW public.user_consecutive_missed_days
  IS 'Consecutive missed check-in days per user — refreshed daily by send-consecutive-missed-alerts';

-- ============================================================
-- 3. refresh_consecutive_missed_days() function
--    Called by send-consecutive-missed-alerts before querying.
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_consecutive_missed_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_consecutive_missed_days;
END;
$$;

COMMENT ON FUNCTION public.refresh_consecutive_missed_days()
  IS 'Refreshes the user_consecutive_missed_days materialized view concurrently';

-- ============================================================
-- 4. consecutive_missed_checkins_log table
--    Tracks which alerts were sent (dedup/cooldown + audit trail).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.consecutive_missed_checkins_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  consecutive_days INT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('push', 'sms', 'email')),
  alert_successful BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  alert_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consecutive_missed_checkins_log ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) can read/write
CREATE POLICY "Service role full access" ON public.consecutive_missed_checkins_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cmcl_user_alert
  ON public.consecutive_missed_checkins_log (user_id, alert_type, alert_sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_cmcl_sent_at
  ON public.consecutive_missed_checkins_log (alert_sent_at DESC);

COMMENT ON TABLE public.consecutive_missed_checkins_log
  IS 'Audit log for consecutive missed check-in alerts — used for cooldown dedup and compliance';

-- ============================================================
-- 5. inactivity_reminder_log table
--    Weekly cooldown for notify-stale-checkins email alerts.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inactivity_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  week_start_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

ALTER TABLE public.inactivity_reminder_log ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) can read/write
CREATE POLICY "Service role full access" ON public.inactivity_reminder_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_irl_user_week
  ON public.inactivity_reminder_log (user_id, week_start_date);

COMMENT ON TABLE public.inactivity_reminder_log
  IS 'Weekly cooldown log for stale check-in email notifications — prevents duplicate emails';

-- ============================================================
-- 6. pg_cron jobs for the two missing scheduled functions
--    Job 27 already exists for send-consecutive-missed-alerts.
--    Adding: send-checkin-reminders (9 AM CT) and
--            notify-stale-checkins (11 AM CT).
--
--    CT = UTC-6 (CST) or UTC-5 (CDT). Using UTC times:
--    - 9 AM CT  = 14:00 UTC (CDT) / 15:00 UTC (CST)
--    - 11 AM CT = 16:00 UTC (CDT) / 17:00 UTC (CST)
--    The edge functions have their own time-window gating,
--    so we schedule at both possible UTC hours to cover DST.
-- ============================================================

-- send-checkin-reminders: 9 AM CT (14:00 and 15:00 UTC to cover DST)
SELECT cron.schedule(
  'send-checkin-reminders-utc14',
  '0 14 * * *',
  $$SELECT net.http_post(
    'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-checkin-reminders',
    '{"Content-Type": "application/json"}'::jsonb,
    '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'send-checkin-reminders-utc15',
  '0 15 * * *',
  $$SELECT net.http_post(
    'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/send-checkin-reminders',
    '{"Content-Type": "application/json"}'::jsonb,
    '{}'::jsonb
  );$$
);

-- notify-stale-checkins: 11 AM CT (16:00 and 17:00 UTC to cover DST)
SELECT cron.schedule(
  'notify-stale-checkins-utc16',
  '0 16 * * *',
  $$SELECT net.http_post(
    'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/notify-stale-checkins',
    '{"Content-Type": "application/json"}'::jsonb,
    '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'notify-stale-checkins-utc17',
  '0 17 * * *',
  $$SELECT net.http_post(
    'https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/notify-stale-checkins',
    '{"Content-Type": "application/json"}'::jsonb,
    '{}'::jsonb
  );$$
);

-- ============================================================
-- Done. After this migration:
--   - send-checkin-reminders fires at 9 AM CT (push via FCM)
--   - send-consecutive-missed-alerts fires at 10 AM CT (graduated push→SMS→email)
--   - notify-stale-checkins fires at 11 AM CT (email after 7 days silence)
-- ============================================================
