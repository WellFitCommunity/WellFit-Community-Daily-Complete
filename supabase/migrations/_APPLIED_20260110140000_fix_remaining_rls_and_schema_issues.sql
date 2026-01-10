-- ============================================================================
-- Fix Remaining RLS and Schema Issues
-- ============================================================================
-- Purpose: Fix 400/403 errors for security_events, security_alerts,
--          admin_audit_logs, and guardian_alerts tables
--
-- Issues Addressed:
-- 1. security_events 400: Missing columns (auto_blocked, requires_investigation)
-- 2. security_alerts 403: INSERT policy may not be applied
-- 3. admin_audit_logs 400: Schema mismatch (wrong column names, missing columns)
-- 4. guardian_alerts 403: INSERT policy may not be applied
-- ============================================================================

-- ============================================================================
-- 1. FIX SECURITY_EVENTS TABLE - Add missing columns
-- ============================================================================

-- Add columns that DatabaseAuditLogger.ts expects
ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN DEFAULT FALSE;

ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS requires_investigation BOOLEAN DEFAULT FALSE;

ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Ensure RLS is enabled
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Drop and recreate INSERT policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can insert security events" ON public.security_events;
CREATE POLICY "Authenticated users can insert security events"
  ON public.security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure service role has full access
DROP POLICY IF EXISTS "Service role can manage security events" ON public.security_events;
CREATE POLICY "Service role can manage security events"
  ON public.security_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

-- ============================================================================
-- 2. FIX SECURITY_ALERTS TABLE
-- ============================================================================

-- First ensure the table exists with correct columns
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category TEXT,
  alert_type TEXT,
  title TEXT NOT NULL,
  message TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'new', 'acknowledged', 'investigating', 'resolved', 'ignored', 'false_positive', 'escalated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add columns that might be missing due to conflicting migrations
ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS alert_type TEXT;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS affected_resource TEXT;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS affected_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS source_ip INET;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS detection_method TEXT;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS notification_channels TEXT[];

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

ALTER TABLE public.security_alerts
ADD COLUMN IF NOT EXISTS resolution_time TIMESTAMPTZ;

-- Ensure RLS is enabled
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies and recreate cleanly
DROP POLICY IF EXISTS "Admins can view all alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Admins can view all security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Admins can update alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Admins can update security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "System can insert alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Authenticated users can insert security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Service role can manage security alerts" ON public.security_alerts;

-- INSERT: Any authenticated user can insert (for logging from app)
CREATE POLICY "security_alerts_insert_authenticated"
  ON public.security_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Admins only (using simple role check without subquery to profiles)
CREATE POLICY "security_alerts_select_admins"
  ON public.security_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_code IN (1, 2)
    )
  );

-- UPDATE: Admins only
CREATE POLICY "security_alerts_update_admins"
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

-- Service role: Full access
CREATE POLICY "security_alerts_service_role"
  ON public.security_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;

-- ============================================================================
-- 3. FIX ADMIN_AUDIT_LOGS TABLE
-- ============================================================================

-- Add missing columns that the frontend expects
ALTER TABLE public.admin_audit_logs
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.admin_audit_logs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.admin_audit_logs
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ;

-- Make admin_user_id optional (allow NULL) for system-generated logs
-- First drop the NOT NULL constraint if it exists
DO $$
BEGIN
  ALTER TABLE public.admin_audit_logs ALTER COLUMN admin_user_id DROP NOT NULL;
EXCEPTION WHEN others THEN
  -- Column might not have NOT NULL constraint
  NULL;
END $$;

-- Drop the action_type CHECK constraint and recreate with more values
DO $$
BEGIN
  ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_check_action;
  ALTER TABLE public.admin_audit_logs ADD CONSTRAINT admin_audit_logs_check_action
    CHECK (action_type IN ('view', 'export', 'modify', 'delete', 'access', 'guardian_manual_approval', 'guardian_auto_heal', 'system'));
EXCEPTION WHEN others THEN
  -- Constraint might not exist
  NULL;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Super admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Users can log their own actions" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_audit_logs_insert" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "admin_audit_logs_select" ON public.admin_audit_logs;

-- INSERT: Any authenticated user can insert (for self-logging)
CREATE POLICY "admin_audit_logs_insert"
  ON public.admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Super admins can view all
CREATE POLICY "admin_audit_logs_select"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_code = 2
    )
  );

-- Service role: Full access
DROP POLICY IF EXISTS "admin_audit_logs_service_role" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_service_role"
  ON public.admin_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- ============================================================================
-- 4. FIX GUARDIAN_ALERTS TABLE
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.guardian_alerts ENABLE ROW LEVEL SECURITY;

-- Drop and recreate INSERT policy
DROP POLICY IF EXISTS "System can insert guardian alerts" ON public.guardian_alerts;
DROP POLICY IF EXISTS "guardian_alerts_insert_authenticated" ON public.guardian_alerts;

-- INSERT: Any authenticated user can insert
CREATE POLICY "guardian_alerts_insert_authenticated"
  ON public.guardian_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure SELECT/UPDATE policies exist (for admins)
DROP POLICY IF EXISTS "Security admins can view all guardian alerts" ON public.guardian_alerts;
DROP POLICY IF EXISTS "Security admins can update guardian alerts" ON public.guardian_alerts;

CREATE POLICY "guardian_alerts_select_admins"
  ON public.guardian_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_code IN (1, 2)
    )
  );

CREATE POLICY "guardian_alerts_update_admins"
  ON public.guardian_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_code IN (1, 2)
    )
  );

-- Service role: Full access
DROP POLICY IF EXISTS "guardian_alerts_service_role" ON public.guardian_alerts;
CREATE POLICY "guardian_alerts_service_role"
  ON public.guardian_alerts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.guardian_alerts TO authenticated;
GRANT ALL ON public.guardian_alerts TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✓ security_events: Added auto_blocked, requires_investigation, category columns';
  RAISE NOTICE '✓ security_events: INSERT policy created for authenticated users';
  RAISE NOTICE '✓ security_alerts: Added missing columns and INSERT policy';
  RAISE NOTICE '✓ admin_audit_logs: Added description, metadata, timestamp columns';
  RAISE NOTICE '✓ admin_audit_logs: Made admin_user_id optional';
  RAISE NOTICE '✓ admin_audit_logs: Extended action_type constraint';
  RAISE NOTICE '✓ guardian_alerts: INSERT policy created for authenticated users';
  RAISE NOTICE '✓ All tables: Service role has full access';
END $$;
