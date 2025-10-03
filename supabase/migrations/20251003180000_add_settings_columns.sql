-- ==============================================================================
-- Migration: Add Settings Columns to Profiles Table
-- Date: 2025-10-03
-- Author: System Administrator
--
-- PURPOSE:
-- Add user preference columns to profiles table for the SettingsPage
--
-- COLUMNS ADDED:
-- - font_size: User's preferred text size (small, medium, large, extra-large)
-- - notifications_enabled: Master toggle for all notifications
-- - timezone: User's timezone for scheduling reminders
-- - daily_reminder_time: When to send daily check-in reminders
-- - care_team_notifications: Toggle for care team message notifications
-- - community_notifications: Toggle for community updates notifications
-- ==============================================================================

-- migrate:up
begin;

-- Add font size preference
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS font_size text
  CHECK (font_size IN ('small', 'medium', 'large', 'extra-large'))
  DEFAULT 'medium';

-- Add notifications toggle
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_enabled boolean
  DEFAULT true;

-- Add timezone preference
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone text
  DEFAULT 'America/New_York';

-- Add daily reminder time
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_reminder_time text
  DEFAULT '09:00';

-- Add care team notifications toggle
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS care_team_notifications boolean
  DEFAULT true;

-- Add community notifications toggle
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS community_notifications boolean
  DEFAULT true;

-- Add helpful comments
COMMENT ON COLUMN public.profiles.font_size IS
  'User preferred text size: small, medium, large, or extra-large';

COMMENT ON COLUMN public.profiles.notifications_enabled IS
  'Master toggle for all notifications';

COMMENT ON COLUMN public.profiles.timezone IS
  'User timezone for scheduling reminders (e.g., America/New_York)';

COMMENT ON COLUMN public.profiles.daily_reminder_time IS
  'Time for daily check-in reminder in HH:MM format (e.g., 09:00)';

COMMENT ON COLUMN public.profiles.care_team_notifications IS
  'Toggle for care team message notifications';

COMMENT ON COLUMN public.profiles.community_notifications IS
  'Toggle for community updates and photos notifications';

commit;

-- migrate:down
begin;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS community_notifications;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS care_team_notifications;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS daily_reminder_time;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS timezone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notifications_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS font_size;

commit;
