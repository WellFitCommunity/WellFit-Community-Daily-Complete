-- ============================================================================
-- Fix RLS Policies for security-related tables
-- ============================================================================
-- Purpose: Fix 403/400 errors for guardian_alerts, security_alerts, security_events
--
-- Issues Fixed:
-- 1. guardian_alerts: RLS policies use profiles.id instead of profiles.user_id
-- 2. security_alerts: Table doesn't exist (was skipped in migration)
-- 3. security_events: Missing INSERT policy for authenticated users
-- ============================================================================

-- ============================================================================
-- 1. FIX GUARDIAN_ALERTS RLS POLICIES
-- ============================================================================
-- Current policies incorrectly use profiles.id = auth.uid()
-- Should use profiles.user_id = auth.uid()

-- Drop old incorrect policies
DROP POLICY IF EXISTS "Security admins can view all guardian alerts" ON guardian_alerts;
DROP POLICY IF EXISTS "Security admins can update guardian alerts" ON guardian_alerts;

-- Recreate with correct column reference (profiles.user_id)
CREATE POLICY "Security admins can view all guardian alerts"
ON guardian_alerts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role_code IN (1, 2)  -- admin, super_admin
  )
);

CREATE POLICY "Security admins can update guardian alerts"
ON guardian_alerts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role_code IN (1, 2)  -- admin, super_admin
  )
);

-- ============================================================================
-- 2. FIX SECURITY_NOTIFICATIONS RLS POLICIES
-- ============================================================================
-- Same issue: profiles.id should be profiles.user_id

-- Drop old incorrect policies
DROP POLICY IF EXISTS "Security team can view notifications" ON security_notifications;
DROP POLICY IF EXISTS "Security team can update notifications" ON security_notifications;

-- Recreate with correct column reference
CREATE POLICY "Security team can view notifications"
ON security_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role_code IN (1, 2)  -- admin, super_admin
  )
);

CREATE POLICY "Security team can update notifications"
ON security_notifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role_code IN (1, 2)  -- admin, super_admin
  )
);

-- ============================================================================
-- 3. CREATE SECURITY_ALERTS TABLE (if not exists)
-- ============================================================================
-- This table was in _ARCHIVE_SKIPPED and never applied

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alert classification
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category TEXT NOT NULL,

  -- Alert details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved', 'ignored')),

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Resolution tracking
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Updated timestamp
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_category ON public.security_alerts(category);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_security_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_security_alerts_timestamp ON public.security_alerts;
CREATE TRIGGER update_security_alerts_timestamp
  BEFORE UPDATE ON public.security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_security_alert_timestamp();

-- Enable RLS
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (including variations of the policy names)
DROP POLICY IF EXISTS "Admins can view all alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Admins can view all security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Admins can update alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Admins can update security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "System can insert alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Authenticated users can insert security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Service role can manage security alerts" ON public.security_alerts;

-- Admins can view all alerts
CREATE POLICY "Admins can view all security alerts"
  ON public.security_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_code IN (1, 2) -- admin, super_admin
    )
  );

-- Admins can update alert status
CREATE POLICY "Admins can update security alerts"
  ON public.security_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_code IN (1, 2)
    )
  );

-- Allow authenticated users to INSERT security alerts (for app-level logging)
CREATE POLICY "Authenticated users can insert security alerts"
  ON public.security_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role can manage security alerts"
  ON public.security_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;

-- ============================================================================
-- 4. FIX SECURITY_EVENTS INSERT POLICY
-- ============================================================================
-- Allow authenticated users to INSERT security events (for app-level logging)

DROP POLICY IF EXISTS "Authenticated users can insert security events" ON security_events;

CREATE POLICY "Authenticated users can insert security events"
  ON security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role full access for security_events
DROP POLICY IF EXISTS "Service role can manage security events" ON security_events;

CREATE POLICY "Service role can manage security events"
  ON security_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION COMMENTS
-- ============================================================================
COMMENT ON POLICY "Security admins can view all guardian alerts" ON guardian_alerts IS
  'Fixed: Now uses profiles.user_id instead of profiles.id';

COMMENT ON POLICY "Authenticated users can insert security alerts" ON public.security_alerts IS
  'Allows authenticated users to log security alerts from the app';

COMMENT ON POLICY "Authenticated users can insert security events" ON security_events IS
  'Allows authenticated users to log security events from the app';
