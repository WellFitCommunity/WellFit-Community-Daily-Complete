-- ============================================================================
-- GUARDIAN EYES RECORDINGS TABLE
-- ============================================================================
-- Stores system snapshots recorded by Guardian Eyes
-- These recordings help diagnose issues and train the AI
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guardian_eyes_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recording details
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('error', 'security', 'performance', 'audit', 'user_action', 'state_change')),
  component TEXT NOT NULL,
  action TEXT NOT NULL,

  -- Severity for prioritization
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),

  -- Recording data
  metadata JSONB DEFAULT '{}',
  state_before JSONB,
  state_after JSONB,

  -- User context
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,

  -- AI analysis (filled in by Guardian Agent)
  ai_analysis JSONB,

  -- Indexing
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_guardian_eyes_type ON public.guardian_eyes_recordings(type);
CREATE INDEX idx_guardian_eyes_component ON public.guardian_eyes_recordings(component);
CREATE INDEX idx_guardian_eyes_severity ON public.guardian_eyes_recordings(severity);
CREATE INDEX idx_guardian_eyes_recorded_at ON public.guardian_eyes_recordings(recorded_at DESC);
CREATE INDEX idx_guardian_eyes_user_id ON public.guardian_eyes_recordings(user_id);

-- Row Level Security
ALTER TABLE public.guardian_eyes_recordings ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (from Edge Function)
CREATE POLICY "Service role can insert recordings"
  ON public.guardian_eyes_recordings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admins can view recordings
CREATE POLICY "Admins can view recordings"
  ON public.guardian_eyes_recordings
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

-- Grant permissions
GRANT SELECT ON public.guardian_eyes_recordings TO authenticated;
GRANT ALL ON public.guardian_eyes_recordings TO service_role;

-- ============================================================================
-- LINK GUARDIAN EYES TO SECURITY ALERTS
-- ============================================================================

-- Add recording reference to security alerts
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS guardian_eyes_recording_id UUID REFERENCES public.guardian_eyes_recordings(id),
  ADD COLUMN IF NOT EXISTS recording_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Function to get related recordings for an alert
CREATE OR REPLACE FUNCTION public.get_alert_recordings(p_alert_id UUID)
RETURNS TABLE (
  id UUID,
  timestamp TIMESTAMPTZ,
  type TEXT,
  component TEXT,
  action TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ger.id,
    ger.timestamp,
    ger.type,
    ger.component,
    ger.action,
    ger.metadata
  FROM public.guardian_eyes_recordings ger
  JOIN public.security_alerts sa ON sa.id = p_alert_id
  WHERE ger.recorded_at BETWEEN (sa.created_at - INTERVAL '5 minutes')
    AND (sa.created_at + INTERVAL '5 minutes')
    AND ger.component = sa.category
  ORDER BY ger.recorded_at DESC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alert_recordings TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ Guardian Eyes recordings table created
-- ✅ Linked to security alerts
-- ✅ RLS policies configured
-- ✅ Helper function for getting related recordings
-- ============================================================================