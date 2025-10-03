-- ==============================================================================
-- Migration: Create Admin Settings Table
-- Date: 2025-10-03
-- Author: System Administrator
--
-- PURPOSE:
-- Create a table to store admin-specific settings and preferences
--
-- COLUMNS:
-- - user_id: References auth.users(id) - the admin user
-- - theme: UI theme preference (light, dark, auto)
-- - email_notifications: Enable email notifications
-- - browser_notifications: Enable browser notifications
-- - emergency_alerts: Enable emergency alerts (always true)
-- - session_timeout: Session timeout in minutes
-- - require_pin_for_sensitive: Require PIN for sensitive actions
-- - enable_audit_logging: Enable audit logging
-- - compact_mode: Use compact UI mode
-- - show_advanced_metrics: Show advanced metrics
-- - default_dashboard_view: Default view when opening dashboard
-- - auto_backup: Enable automatic backups (super admin only)
-- - backup_frequency: Backup frequency (daily, weekly, monthly)
-- - enable_beta_features: Enable beta features (super admin only)
-- ==============================================================================

-- migrate:up
begin;

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS public.admin_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Appearance
  theme text CHECK (theme IN ('light', 'dark', 'auto')) DEFAULT 'light',
  compact_mode boolean DEFAULT false,
  show_advanced_metrics boolean DEFAULT true,
  default_dashboard_view text CHECK (default_dashboard_view IN ('overview', 'patients', 'billing')) DEFAULT 'overview',

  -- Notifications
  email_notifications boolean DEFAULT true,
  browser_notifications boolean DEFAULT true,
  emergency_alerts boolean DEFAULT true,

  -- Security
  session_timeout integer CHECK (session_timeout IN (15, 30, 60, 120)) DEFAULT 30,
  require_pin_for_sensitive boolean DEFAULT true,
  enable_audit_logging boolean DEFAULT true,

  -- System (super admin only)
  auto_backup boolean DEFAULT true,
  backup_frequency text CHECK (backup_frequency IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
  enable_beta_features boolean DEFAULT false,

  -- Timestamps
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add RLS policies
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view their own settings
CREATE POLICY "Admins can view own settings"
  ON public.admin_settings
  FOR SELECT
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Policy: Admins can insert their own settings
CREATE POLICY "Admins can insert own settings"
  ON public.admin_settings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Policy: Admins can update their own settings
CREATE POLICY "Admins can update own settings"
  ON public.admin_settings
  FOR UPDATE
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_user_id
  ON public.admin_settings (user_id);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_settings_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.admin_settings IS
  'Stores admin-specific settings and preferences';

COMMENT ON COLUMN public.admin_settings.theme IS
  'UI theme: light, dark, or auto (follows system preference)';

COMMENT ON COLUMN public.admin_settings.session_timeout IS
  'Admin session timeout in minutes: 15, 30, 60, or 120';

COMMENT ON COLUMN public.admin_settings.emergency_alerts IS
  'Emergency patient alerts - always enabled for safety';

commit;

-- migrate:down
begin;

DROP TRIGGER IF EXISTS admin_settings_updated_at ON public.admin_settings;
DROP FUNCTION IF EXISTS update_admin_settings_updated_at();
DROP TABLE IF EXISTS public.admin_settings CASCADE;

commit;
