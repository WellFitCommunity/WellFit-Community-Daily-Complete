-- ============================================================================
-- GUARDIAN EYES VISUAL RECORDING STORAGE
-- ============================================================================
-- Creates storage bucket and tables for rrweb session recordings
-- Auto-triggered by Guardian Agent when issues are detected
-- 7-10 day retention with "Save Forever" option for major issues
-- ============================================================================

-- Create storage bucket for Guardian Eyes recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guardian-eyes-recordings',
  'guardian-eyes-recordings',
  false,  -- Private bucket (requires auth)
  52428800,  -- 50MB max per recording
  ARRAY['application/json', 'application/gzip']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/json', 'application/gzip']::text[];

-- ============================================================================
-- GUARDIAN EYES RECORDINGS TABLE
-- ============================================================================
-- Stores metadata about each visual recording session
-- Actual recording data is in Supabase Storage bucket
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guardian_eyes_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recording identification
  session_id TEXT NOT NULL UNIQUE,
  recording_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recording_ended_at TIMESTAMPTZ,

  -- Trigger context (what caused Guardian Eyes to start recording)
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'security_vulnerability',
    'phi_exposure',
    'memory_leak',
    'api_failure',
    'healing_operation',
    'manual',
    'system_health'
  )),
  trigger_alert_id TEXT,  -- Links to guardian_alerts.id
  trigger_description TEXT,

  -- Storage location
  storage_path TEXT NOT NULL,  -- Path in guardian-eyes-recordings bucket
  storage_size_bytes BIGINT,
  is_compressed BOOLEAN DEFAULT false,

  -- Recording metadata
  duration_seconds INTEGER,
  event_count INTEGER DEFAULT 0,

  -- User context (who was being recorded)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID,

  -- Retention policy
  retention_type TEXT NOT NULL DEFAULT 'standard' CHECK (retention_type IN (
    'standard',    -- 7-10 days, auto-delete
    'extended',    -- 30 days
    'permanent'    -- Keep forever (major issues)
  )),
  expires_at TIMESTAMPTZ,  -- NULL for permanent retention
  saved_by UUID REFERENCES auth.users(id),  -- Who clicked "Save Forever"
  saved_at TIMESTAMPTZ,
  save_reason TEXT,  -- Why it was saved permanently

  -- Review status
  reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- AI analysis
  ai_summary JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR FAST QUERIES
-- ============================================================================

CREATE INDEX idx_guardian_eyes_session_id ON public.guardian_eyes_sessions(session_id);
CREATE INDEX idx_guardian_eyes_trigger_type ON public.guardian_eyes_sessions(trigger_type);
CREATE INDEX idx_guardian_eyes_trigger_alert ON public.guardian_eyes_sessions(trigger_alert_id);
CREATE INDEX idx_guardian_eyes_user_id ON public.guardian_eyes_sessions(user_id);
CREATE INDEX idx_guardian_eyes_retention ON public.guardian_eyes_sessions(retention_type);
CREATE INDEX idx_guardian_eyes_expires_at ON public.guardian_eyes_sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_guardian_eyes_created_at ON public.guardian_eyes_sessions(created_at DESC);
CREATE INDEX idx_guardian_eyes_not_reviewed ON public.guardian_eyes_sessions(reviewed) WHERE reviewed = false;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.guardian_eyes_sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (for Guardian Agent)
CREATE POLICY "Service role full access"
  ON public.guardian_eyes_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Security admins can view all recordings
CREATE POLICY "Security admins can view recordings"
  ON public.guardian_eyes_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND (
        profiles.is_admin = true
        OR profiles.role IN ('super_admin', 'admin', 'security_admin', 'compliance_officer')
      )
    )
  );

-- Security admins can update recordings (mark reviewed, save permanently)
CREATE POLICY "Security admins can update recordings"
  ON public.guardian_eyes_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND (
        profiles.is_admin = true
        OR profiles.role IN ('super_admin', 'admin', 'security_admin', 'compliance_officer')
      )
    )
  );

-- ============================================================================
-- STORAGE BUCKET POLICIES
-- ============================================================================

-- Allow authenticated users to upload recordings (Guardian Agent runs as authenticated)
CREATE POLICY "Guardian can upload recordings"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'guardian-eyes-recordings');

-- Security admins can download recordings
CREATE POLICY "Security admins can download recordings"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'guardian-eyes-recordings'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND (
        profiles.is_admin = true
        OR profiles.role IN ('super_admin', 'admin', 'security_admin', 'compliance_officer')
      )
    )
  );

-- Service role can delete expired recordings
CREATE POLICY "Service role can delete recordings"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'guardian-eyes-recordings');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to extend recording retention to 30 days (called when "Save for 30 Days" clicked)
CREATE OR REPLACE FUNCTION public.extend_recording_retention(
  p_session_id TEXT,
  p_reason TEXT DEFAULT 'Extended retention for review'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.guardian_eyes_sessions
  SET
    retention_type = 'extended',
    expires_at = NOW() + INTERVAL '30 days',
    saved_by = auth.uid(),
    saved_at = NOW(),
    save_reason = p_reason,
    updated_at = NOW()
  WHERE session_id = p_session_id;

  RETURN FOUND;
END;
$$;

-- Function to mark recording as reviewed
CREATE OR REPLACE FUNCTION public.mark_recording_reviewed(
  p_session_id TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.guardian_eyes_sessions
  SET
    reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_notes = p_notes,
    updated_at = NOW()
  WHERE session_id = p_session_id;

  RETURN FOUND;
END;
$$;

-- Function to get recordings pending review
CREATE OR REPLACE FUNCTION public.get_pending_recordings(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  session_id TEXT,
  trigger_type TEXT,
  trigger_description TEXT,
  duration_seconds INTEGER,
  recording_started_at TIMESTAMPTZ,
  retention_type TEXT,
  expires_at TIMESTAMPTZ,
  storage_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ges.id,
    ges.session_id,
    ges.trigger_type,
    ges.trigger_description,
    ges.duration_seconds,
    ges.recording_started_at,
    ges.retention_type,
    ges.expires_at,
    ges.storage_path
  FROM public.guardian_eyes_sessions ges
  WHERE ges.reviewed = false
    AND (ges.expires_at IS NULL OR ges.expires_at > NOW())
  ORDER BY ges.recording_started_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to clean up expired recordings (run via cron job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_recordings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Find and delete expired recordings
  FOR v_record IN
    SELECT id, session_id, storage_path
    FROM public.guardian_eyes_sessions
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
      AND retention_type != 'permanent'
  LOOP
    -- Delete from storage (will be handled by storage trigger or edge function)
    -- For now, just mark for deletion and let cleanup job handle storage

    -- Delete metadata record
    DELETE FROM public.guardian_eyes_sessions WHERE id = v_record.id;
    v_deleted_count := v_deleted_count + 1;
  END LOOP;

  RETURN v_deleted_count;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.extend_recording_retention TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_recording_reviewed TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_recordings TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_recordings TO service_role;

-- ============================================================================
-- TRIGGER: Set expiration date on insert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_recording_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set expiration based on retention type
  IF NEW.retention_type = 'standard' THEN
    NEW.expires_at := NOW() + INTERVAL '10 days';
  ELSIF NEW.retention_type = 'extended' THEN
    NEW.expires_at := NOW() + INTERVAL '30 days';
  ELSIF NEW.retention_type = 'permanent' THEN
    NEW.expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_recording_expiration
  BEFORE INSERT ON public.guardian_eyes_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_recording_expiration();

-- ============================================================================
-- TRIGGER: Update timestamp on update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_guardian_eyes_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_guardian_eyes_timestamp
  BEFORE UPDATE ON public.guardian_eyes_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_guardian_eyes_timestamp();

-- ============================================================================
-- CRON JOB: Cleanup expired recordings daily
-- ============================================================================
-- Note: Requires pg_cron extension. Run this manually if pg_cron not available:
-- SELECT cleanup_expired_recordings();

DO $$
BEGIN
  -- Only create cron job if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Run cleanup at 3 AM UTC daily
    PERFORM cron.schedule(
      'guardian-eyes-cleanup',
      '0 3 * * *',
      'SELECT public.cleanup_expired_recordings();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- pg_cron not available, skip
    RAISE NOTICE 'pg_cron not available, skipping cron job creation';
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.guardian_eyes_sessions TO authenticated;
GRANT ALL ON public.guardian_eyes_sessions TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- ✅ Storage bucket created: guardian-eyes-recordings
-- ✅ Metadata table created: guardian_eyes_sessions
-- ✅ RLS policies configured
-- ✅ Helper functions created
-- ✅ Auto-expiration trigger configured
-- ✅ Cleanup cron job scheduled (if pg_cron available)
-- ============================================================================

COMMENT ON TABLE public.guardian_eyes_sessions IS
'Stores metadata for Guardian Eyes visual recordings. Recordings are triggered automatically when Guardian Agent detects issues. Standard retention is 10 days, with option to save permanently for major issues.';
