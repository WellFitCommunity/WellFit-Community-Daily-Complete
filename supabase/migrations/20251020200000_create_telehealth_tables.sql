-- Migration: Telehealth infrastructure with Daily.co integration
-- Supports: Regular visits, ER telehealth, stethoscope streaming
-- HIPAA-compliant session tracking and audit logging

-- Telehealth sessions table
CREATE TABLE IF NOT EXISTS telehealth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Daily.co room details
  room_name TEXT NOT NULL UNIQUE,
  room_url TEXT NOT NULL,
  daily_room_id TEXT NOT NULL,
  session_token TEXT NOT NULL, -- Provider's meeting token

  -- Session metadata
  encounter_type TEXT NOT NULL CHECK (encounter_type IN ('outpatient', 'emergency', 'urgent-care', 'er')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'error')),

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,

  -- Recording info (for compliance and training)
  recording_enabled BOOLEAN DEFAULT true,
  recording_url TEXT,
  recording_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_encounter ON telehealth_sessions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_patient ON telehealth_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_provider ON telehealth_sessions(provider_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_status ON telehealth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_telehealth_sessions_started ON telehealth_sessions(started_at DESC);

-- Telehealth session events (for analytics and compliance)
CREATE TABLE IF NOT EXISTS telehealth_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES telehealth_sessions(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'participant_joined',
    'participant_left',
    'recording_started',
    'recording_stopped',
    'stethoscope_connected',
    'stethoscope_disconnected',
    'screen_share_started',
    'screen_share_stopped',
    'error',
    'session_ended'
  )),

  participant_id UUID REFERENCES profiles(id),
  participant_role TEXT CHECK (participant_role IN ('provider', 'patient', 'observer')),

  -- Event data
  event_data JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telehealth_events_session ON telehealth_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_telehealth_events_type ON telehealth_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telehealth_events_created ON telehealth_session_events(created_at DESC);

-- Add telehealth fields to encounters table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'encounters' AND column_name = 'visit_mode') THEN
    ALTER TABLE encounters ADD COLUMN visit_mode TEXT CHECK (visit_mode IN ('in-person', 'telehealth', 'phone', 'async'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'encounters' AND column_name = 'telehealth_session_id') THEN
    ALTER TABLE encounters ADD COLUMN telehealth_session_id UUID REFERENCES telehealth_sessions(id);
  END IF;
END $$;

-- Row Level Security
ALTER TABLE telehealth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE telehealth_session_events ENABLE ROW LEVEL SECURITY;

-- Providers can see their own sessions
CREATE POLICY telehealth_sessions_provider_access ON telehealth_sessions
  FOR ALL
  USING (
    provider_id = auth.uid()
  );

-- Patients can see their own sessions
CREATE POLICY telehealth_sessions_patient_access ON telehealth_sessions
  FOR SELECT
  USING (
    patient_id = auth.uid()
  );

-- Admins can see all sessions (using helper function)
CREATE POLICY telehealth_sessions_admin_access ON telehealth_sessions
  FOR ALL
  USING (is_admin());

-- Session events follow same access as sessions
CREATE POLICY telehealth_events_access ON telehealth_session_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM telehealth_sessions
      WHERE telehealth_sessions.id = telehealth_session_events.session_id
      AND (
        telehealth_sessions.provider_id = auth.uid()
        OR telehealth_sessions.patient_id = auth.uid()
        OR is_admin()
      )
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_telehealth_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_telehealth_session_updated_at
  BEFORE UPDATE ON telehealth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_telehealth_session_updated_at();

-- Function to log session events
CREATE OR REPLACE FUNCTION log_telehealth_event(
  p_session_id UUID,
  p_event_type TEXT,
  p_participant_id UUID DEFAULT NULL,
  p_participant_role TEXT DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO telehealth_session_events (
    session_id,
    event_type,
    participant_id,
    participant_role,
    event_data
  ) VALUES (
    p_session_id,
    p_event_type,
    p_participant_id,
    p_participant_role,
    p_event_data
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON telehealth_sessions TO authenticated;
GRANT SELECT, INSERT ON telehealth_session_events TO authenticated;
GRANT EXECUTE ON FUNCTION log_telehealth_event TO authenticated;

-- Create audit triggers for HIPAA compliance
CREATE TRIGGER audit_telehealth_sessions
  AFTER INSERT OR UPDATE OR DELETE ON telehealth_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_telehealth_session_events
  AFTER INSERT OR UPDATE OR DELETE ON telehealth_session_events
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- Add comment for documentation
COMMENT ON TABLE telehealth_sessions IS 'HIPAA-compliant telehealth session tracking with Daily.co integration';
COMMENT ON TABLE telehealth_session_events IS 'Audit log for telehealth session events';
COMMENT ON COLUMN telehealth_sessions.room_name IS 'Daily.co room identifier';
COMMENT ON COLUMN telehealth_sessions.recording_url IS 'URL to session recording for compliance/training (HIPAA-encrypted)';
COMMENT ON COLUMN telehealth_sessions.encounter_type IS 'Type of encounter: outpatient, emergency, urgent-care, er';
