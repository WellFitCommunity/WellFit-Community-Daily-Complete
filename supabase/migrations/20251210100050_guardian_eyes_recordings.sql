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

  -- User context (NO PHI - only IDs)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,

  -- AI analysis (filled in by Guardian Agent)
  ai_analysis JSONB,

  -- Indexing
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_guardian_eyes_type ON public.guardian_eyes_recordings(type);
CREATE INDEX IF NOT EXISTS idx_guardian_eyes_component ON public.guardian_eyes_recordings(component);
CREATE INDEX IF NOT EXISTS idx_guardian_eyes_severity ON public.guardian_eyes_recordings(severity);
CREATE INDEX IF NOT EXISTS idx_guardian_eyes_recorded_at ON public.guardian_eyes_recordings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardian_eyes_user_id ON public.guardian_eyes_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_eyes_session ON public.guardian_eyes_recordings(session_id);

-- Row Level Security
ALTER TABLE public.guardian_eyes_recordings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can insert recordings" ON public.guardian_eyes_recordings;
DROP POLICY IF EXISTS "Admins can view recordings" ON public.guardian_eyes_recordings;
DROP POLICY IF EXISTS "Authenticated can insert recordings" ON public.guardian_eyes_recordings;

-- Service role can insert (from Edge Function)
CREATE POLICY "Service role can insert recordings"
  ON public.guardian_eyes_recordings
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Authenticated users can insert (for client-side Guardian Agent)
CREATE POLICY "Authenticated can insert recordings"
  ON public.guardian_eyes_recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can view recordings (role_code: 1=admin, 2=super_admin)
CREATE POLICY "Admins can view recordings"
  ON public.guardian_eyes_recordings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role_code IN (1, 2)
    )
  );

-- Grant permissions
GRANT SELECT, INSERT ON public.guardian_eyes_recordings TO authenticated;
GRANT ALL ON public.guardian_eyes_recordings TO service_role;

-- ============================================================================
-- LINK GUARDIAN EYES TO SECURITY ALERTS
-- ============================================================================

-- Add recording reference to security alerts (if columns don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'security_alerts'
    AND column_name = 'guardian_eyes_recording_id'
  ) THEN
    ALTER TABLE public.security_alerts
      ADD COLUMN guardian_eyes_recording_id UUID REFERENCES public.guardian_eyes_recordings(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'security_alerts'
    AND column_name = 'recording_timestamp'
  ) THEN
    ALTER TABLE public.security_alerts
      ADD COLUMN recording_timestamp TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'security_alerts'
    AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE public.security_alerts
      ADD COLUMN recording_url TEXT;
  END IF;
END $$;

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
  ORDER BY ger.recorded_at DESC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alert_recordings TO authenticated;

-- ============================================================================
-- AUTO-CLEANUP OLD RECORDINGS (30 days retention)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_guardian_recordings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.guardian_eyes_recordings
  WHERE recorded_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_guardian_recordings TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.guardian_eyes_recordings IS 'System snapshots recorded by Guardian Eyes for debugging and AI learning';
COMMENT ON COLUMN public.guardian_eyes_recordings.type IS 'Type of recording: error, security, performance, audit, user_action, state_change';
COMMENT ON COLUMN public.guardian_eyes_recordings.component IS 'React component or service that generated the recording';
COMMENT ON COLUMN public.guardian_eyes_recordings.action IS 'What action was being performed';
COMMENT ON COLUMN public.guardian_eyes_recordings.metadata IS 'Sanitized context data (NO PHI)';
COMMENT ON COLUMN public.guardian_eyes_recordings.ai_analysis IS 'AI-generated analysis of the recording';
