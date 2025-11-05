-- ==============================================================================
-- Migration: Consecutive Check-In Tracking for Alert System
-- Date: 2025-11-05
-- Author: System Administrator
--
-- PURPOSE:
-- Implement a graduated alert system for users who miss consecutive check-ins:
-- - Day 3: Firebase push notification (sweet reminder)
-- - Day 5: SMS text message reminder
-- - Day 7: Email to caregiver/emergency contact
--
-- APPROACH:
-- Creates a tracking table and materialized view to efficiently calculate
-- consecutive missed days without expensive queries on check_ins table.
--
-- TABLES:
-- 1. consecutive_missed_checkins_log: Tracks alert history to prevent duplicates
-- 2. emergency_email column: Added to profiles for caregiver notification
--
-- VIEWS:
-- 1. user_consecutive_missed_days: Materialized view for fast lookups
--
-- FUNCTIONS:
-- 1. refresh_consecutive_missed_days(): Updates materialized view
-- 2. calculate_consecutive_missed_days(): Helper to compute streak
--
-- INDEXES:
-- Optimized for alert queries and caregiver lookups
-- ==============================================================================

-- migrate:up
BEGIN;

-- ============================================================================
-- Step 1: Add emergency_email column to profiles
-- ============================================================================
-- This is the caregiver email address that will receive Day 7 alerts
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS emergency_email text;

-- Index for fast caregiver email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_emergency_email
  ON public.profiles (emergency_email)
  WHERE emergency_email IS NOT NULL;

COMMENT ON COLUMN public.profiles.emergency_email IS
  'Caregiver/emergency contact email for missed check-in alerts. Receives notification after 7 consecutive missed days.';

-- ============================================================================
-- Step 2: Create alert tracking log table
-- ============================================================================
-- Tracks when alerts are sent to prevent duplicate notifications
CREATE TABLE IF NOT EXISTS public.consecutive_missed_checkins_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consecutive_days integer NOT NULL CHECK (consecutive_days >= 0),
  alert_type text NOT NULL CHECK (alert_type IN ('push', 'sms', 'email')),
  alert_sent_at timestamptz DEFAULT now() NOT NULL,
  alert_successful boolean DEFAULT true NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for querying alert history
CREATE INDEX IF NOT EXISTS idx_consecutive_log_user_id
  ON public.consecutive_missed_checkins_log (user_id);

CREATE INDEX IF NOT EXISTS idx_consecutive_log_alert_type
  ON public.consecutive_missed_checkins_log (alert_type);

CREATE INDEX IF NOT EXISTS idx_consecutive_log_sent_at
  ON public.consecutive_missed_checkins_log (alert_sent_at DESC);

-- Composite index for "has this alert been sent?" queries
CREATE INDEX IF NOT EXISTS idx_consecutive_log_user_alert
  ON public.consecutive_missed_checkins_log (user_id, alert_type, alert_sent_at DESC);

COMMENT ON TABLE public.consecutive_missed_checkins_log IS
  'Tracks consecutive missed check-in alerts (Day 3 push, Day 5 SMS, Day 7 email). Prevents duplicate notifications.';

COMMENT ON COLUMN public.consecutive_missed_checkins_log.consecutive_days IS
  'Number of consecutive days missed when this alert was triggered (3, 5, or 7).';

COMMENT ON COLUMN public.consecutive_missed_checkins_log.alert_type IS
  'Type of alert sent: push (Firebase), sms (Twilio), or email (MailerSend).';

-- ============================================================================
-- Step 3: Create function to calculate consecutive missed days
-- ============================================================================
-- This function calculates how many consecutive days a user has missed check-ins
-- A "day" is defined as a 24-hour period in Chicago timezone
CREATE OR REPLACE FUNCTION public.calculate_consecutive_missed_days(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  last_checkin_date date;
  today_date date;
  days_diff integer;
BEGIN
  -- Get today's date in Chicago timezone
  SELECT CURRENT_DATE AT TIME ZONE 'America/Chicago' INTO today_date;

  -- Get the most recent check-in date for this user
  SELECT DATE(timestamp AT TIME ZONE 'America/Chicago')
  INTO last_checkin_date
  FROM public.check_ins
  WHERE user_id = p_user_id
  ORDER BY timestamp DESC
  LIMIT 1;

  -- If no check-ins exist, return 0 (not tracking users who never checked in)
  IF last_checkin_date IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate days between last check-in and today
  days_diff := today_date - last_checkin_date;

  -- If they checked in today, consecutive missed days = 0
  IF days_diff <= 0 THEN
    RETURN 0;
  END IF;

  -- Return the number of consecutive missed days
  RETURN days_diff;
END;
$$;

COMMENT ON FUNCTION public.calculate_consecutive_missed_days IS
  'Calculates consecutive days since last check-in for a user. Returns 0 if checked in today or no check-ins exist.';

-- ============================================================================
-- Step 4: Create materialized view for fast lookups
-- ============================================================================
-- This view is refreshed periodically to avoid expensive real-time calculations
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_consecutive_missed_days AS
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.phone,
  p.emergency_email,
  p.caregiver_first_name,
  p.caregiver_last_name,
  p.caregiver_phone,
  COALESCE(public.calculate_consecutive_missed_days(p.user_id), 0) AS consecutive_missed_days,
  (
    SELECT MAX(timestamp)
    FROM public.check_ins ci
    WHERE ci.user_id = p.user_id
  ) AS last_checkin_at,
  now() AS last_refreshed_at
FROM public.profiles p
WHERE p.role IN ('senior', 'patient') -- Only track community members, not staff
  AND EXISTS (
    SELECT 1 FROM public.check_ins ci WHERE ci.user_id = p.user_id
  ); -- Only include users who have checked in at least once

-- Index for alert threshold queries (Day 3, 5, 7)
CREATE UNIQUE INDEX IF NOT EXISTS idx_consecutive_missed_user_id
  ON public.user_consecutive_missed_days (user_id);

CREATE INDEX IF NOT EXISTS idx_consecutive_missed_days
  ON public.user_consecutive_missed_days (consecutive_missed_days)
  WHERE consecutive_missed_days >= 3;

COMMENT ON MATERIALIZED VIEW public.user_consecutive_missed_days IS
  'Cached view of users with consecutive missed check-ins. Refreshed hourly by alert system.';

-- ============================================================================
-- Step 5: Create refresh function for materialized view
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_consecutive_missed_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_consecutive_missed_days;
END;
$$;

COMMENT ON FUNCTION public.refresh_consecutive_missed_days IS
  'Refreshes the user_consecutive_missed_days materialized view. Called by alert system Edge Functions.';

-- ============================================================================
-- Step 6: Enable RLS on new tables
-- ============================================================================
ALTER TABLE public.consecutive_missed_checkins_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own alert logs
DROP POLICY IF EXISTS "consecutive_log_select_own" ON public.consecutive_missed_checkins_log;
CREATE POLICY "consecutive_log_select_own"
ON public.consecutive_missed_checkins_log FOR SELECT
USING (user_id = auth.uid());

-- Only service role can insert (alerts sent by Edge Functions)
DROP POLICY IF EXISTS "consecutive_log_insert_service" ON public.consecutive_missed_checkins_log;
CREATE POLICY "consecutive_log_insert_service"
ON public.consecutive_missed_checkins_log FOR INSERT
WITH CHECK (true); -- Service role bypasses RLS anyway, but explicit policy for clarity

-- Staff can view all alert logs (for monitoring)
DROP POLICY IF EXISTS "consecutive_log_staff_all" ON public.consecutive_missed_checkins_log;
CREATE POLICY "consecutive_log_staff_all"
ON public.consecutive_missed_checkins_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin', 'staff', 'nurse')
  )
);

-- ============================================================================
-- Step 7: Grant permissions for service role
-- ============================================================================
-- Edge Functions need to read profiles and write alert logs
GRANT SELECT ON public.profiles TO service_role;
GRANT SELECT ON public.check_ins TO service_role;
GRANT SELECT ON public.fcm_tokens TO service_role;
GRANT INSERT ON public.consecutive_missed_checkins_log TO service_role;
GRANT SELECT ON public.user_consecutive_missed_days TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_consecutive_missed_days() TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_consecutive_missed_days(uuid) TO service_role;

COMMIT;

-- migrate:down
BEGIN;

-- Drop policies
DROP POLICY IF EXISTS "consecutive_log_staff_all" ON public.consecutive_missed_checkins_log;
DROP POLICY IF EXISTS "consecutive_log_insert_service" ON public.consecutive_missed_checkins_log;
DROP POLICY IF EXISTS "consecutive_log_select_own" ON public.consecutive_missed_checkins_log;

-- Drop indexes
DROP INDEX IF EXISTS idx_consecutive_missed_days;
DROP INDEX IF EXISTS idx_consecutive_missed_user_id;
DROP INDEX IF EXISTS idx_consecutive_log_user_alert;
DROP INDEX IF EXISTS idx_consecutive_log_sent_at;
DROP INDEX IF EXISTS idx_consecutive_log_alert_type;
DROP INDEX IF EXISTS idx_consecutive_log_user_id;
DROP INDEX IF EXISTS idx_profiles_emergency_email;

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS public.user_consecutive_missed_days;

-- Drop functions
DROP FUNCTION IF EXISTS public.refresh_consecutive_missed_days();
DROP FUNCTION IF EXISTS public.calculate_consecutive_missed_days(uuid);

-- Drop table
DROP TABLE IF EXISTS public.consecutive_missed_checkins_log;

-- Remove emergency_email column (careful - will lose data!)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS emergency_email;

COMMIT;
