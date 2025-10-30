-- ============================================================================
-- SECURITY ALERTS TABLE - PERMANENT SOLUTION
-- ============================================================================
-- This is the production table for security alerts.
-- Guardian Agent (running as backend service) writes alerts here.
-- SecurityPanel component reads from here.
-- NO TECH DEBT - THIS IS THE FINAL IMPLEMENTATION
-- ============================================================================

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

  -- Indexing for performance
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_category ON public.security_alerts(category);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_security_alert_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_security_alerts_timestamp
  BEFORE UPDATE ON public.security_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_security_alert_timestamp();

-- Row Level Security
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can view all alerts
CREATE POLICY "Admins can view all alerts"
  ON public.security_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (
        SELECT id FROM public.roles
        WHERE role_code IN (1, 2) -- Admin roles
      )
    )
  );

-- Admins can update alert status
CREATE POLICY "Admins can update alerts"
  ON public.security_alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role_id IN (
        SELECT id FROM public.roles
        WHERE role_code IN (1, 2)
      )
    )
  );

-- System can insert alerts (from Guardian Agent Edge Function)
CREATE POLICY "System can insert alerts"
  ON public.security_alerts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE - NO TECH DEBT
-- ============================================================================
-- ✅ Security alerts table created
-- ✅ Proper indexes for performance
-- ✅ Row level security enabled
-- ✅ Admin-only access policies
-- ✅ Timestamp triggers
-- ✅ This is the PERMANENT solution
-- ============================================================================