-- Fix audit log permissions for system-level logging
-- These tables need to accept logs from both authenticated users and system processes

-- Allow service role to bypass RLS (already enabled by default, but being explicit)
-- Service role key automatically bypasses RLS

-- Add permissive INSERT policies for audit logging from unauthenticated contexts
-- These are write-only policies - reads still require admin access

-- Drop existing restrictive INSERT policies if they exist
DROP POLICY IF EXISTS "System can create security alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "System can insert guardian alerts" ON public.guardian_alerts;

-- Security Events: Allow INSERT for all (service role will bypass RLS anyway)
-- This allows client-side error logging while maintaining read restrictions
CREATE POLICY "Allow system audit logging" ON public.security_events
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Audit Logs: Allow INSERT for service role and authenticated users for audit trails
CREATE POLICY "Allow audit log creation" ON public.audit_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Security Alerts: Allow INSERT for system processes
CREATE POLICY "Allow system security alerts" ON public.security_alerts
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Guardian Alerts: Allow INSERT for system processes
CREATE POLICY "Allow system guardian alerts" ON public.guardian_alerts
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON POLICY "Allow system audit logging" ON public.security_events IS
  'Allows system-level security event logging from Edge Functions and Guardian Agent. Read access still restricted to admins.';

COMMENT ON POLICY "Allow audit log creation" ON public.audit_logs IS
  'Allows comprehensive audit trail creation. Read access restricted to admins only.';

COMMENT ON POLICY "Allow system security alerts" ON public.security_alerts IS
  'Allows automated security alert creation. Read/update access restricted to admins.';

COMMENT ON POLICY "Allow system guardian alerts" ON public.guardian_alerts IS
  'Allows Guardian Agent to create alerts autonomously. Read/update access restricted to security admins.';
