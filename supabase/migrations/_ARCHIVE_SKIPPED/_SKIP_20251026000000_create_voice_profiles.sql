-- Voice Learning System - Provider Voice Profiles
-- Date: 2025-10-26
-- Purpose: Store provider-specific voice corrections and learning data
-- Enables real-time transcription accuracy improvement through learned corrections

-- Create provider_voice_profiles table
CREATE TABLE IF NOT EXISTS provider_voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- Voice fingerprint (JSONB for flexibility)
  voice_fingerprint JSONB DEFAULT '{
    "corrections": [],
    "speechPatterns": {},
    "medicalVocabulary": []
  }'::jsonb NOT NULL,

  -- Learning stats
  total_sessions INTEGER DEFAULT 0 NOT NULL,
  total_training_minutes INTEGER DEFAULT 0 NOT NULL,
  accuracy_baseline DECIMAL(5,2) DEFAULT 0.00,
  accuracy_current DECIMAL(5,2) DEFAULT 0.00,
  accuracy_improvement DECIMAL(5,2) GENERATED ALWAYS AS (accuracy_current - accuracy_baseline) STORED,

  -- Privacy & retention (90 days for optimal learning persistence)
  is_training_mode BOOLEAN DEFAULT true NOT NULL,
  training_complete_at TIMESTAMP,
  data_retention_days INTEGER DEFAULT 90 NOT NULL,
  last_cleanup_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_training_session TIMESTAMP,

  -- Constraints
  CHECK (total_sessions >= 0),
  CHECK (total_training_minutes >= 0),
  CHECK (accuracy_baseline >= 0 AND accuracy_baseline <= 100),
  CHECK (accuracy_current >= 0 AND accuracy_current <= 100),
  CHECK (data_retention_days > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_voice_profiles_provider ON provider_voice_profiles(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_voice_profiles_last_session ON provider_voice_profiles(last_training_session);
CREATE INDEX IF NOT EXISTS idx_provider_voice_profiles_updated ON provider_voice_profiles(updated_at);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_voice_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_voice_profiles_timestamp
  BEFORE UPDATE ON provider_voice_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_profile_timestamp();

-- Row Level Security (RLS) Policies
ALTER TABLE provider_voice_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Providers can view their own voice profile
CREATE POLICY provider_voice_profiles_own_select ON provider_voice_profiles
  FOR SELECT
  USING (provider_id = auth.uid());

-- Policy: Providers can update their own voice profile
CREATE POLICY provider_voice_profiles_own_update ON provider_voice_profiles
  FOR UPDATE
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

-- Policy: Providers can insert their own voice profile
CREATE POLICY provider_voice_profiles_own_insert ON provider_voice_profiles
  FOR INSERT
  WITH CHECK (provider_id = auth.uid());

-- Policy: Providers can delete their own voice profile (GDPR compliance)
CREATE POLICY provider_voice_profiles_own_delete ON provider_voice_profiles
  FOR DELETE
  USING (provider_id = auth.uid());

-- Policy: Admins can view all voice profiles
CREATE POLICY provider_voice_profiles_admin_all ON provider_voice_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role_code IN (1, 2) -- Super Admin (1) or Admin (2)
    )
  );

-- Function: Clean up stale voice profiles (auto-delete after retention period)
CREATE OR REPLACE FUNCTION cleanup_stale_voice_profiles()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM provider_voice_profiles
  WHERE
    last_training_session IS NOT NULL
    AND last_training_session < NOW() - (data_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Update cleanup timestamp for remaining profiles
  UPDATE provider_voice_profiles
  SET last_cleanup_at = NOW()
  WHERE last_cleanup_at IS NULL OR last_cleanup_at < NOW() - INTERVAL '7 days';

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_stale_voice_profiles() TO authenticated;

-- Comment on table and important columns
COMMENT ON TABLE provider_voice_profiles IS 'Stores provider-specific voice learning profiles including learned corrections, speech patterns, and accuracy metrics. Auto-deleted after 90 days of inactivity for optimal balance between learning persistence and storage. NO AUDIO STORED - only text corrections (~75 bytes each).';
COMMENT ON COLUMN provider_voice_profiles.voice_fingerprint IS 'JSONB containing learned corrections, speech patterns, and medical vocabulary preferences (text only, no audio)';
COMMENT ON COLUMN provider_voice_profiles.accuracy_baseline IS 'Initial transcription accuracy percentage (0-100) from first sessions';
COMMENT ON COLUMN provider_voice_profiles.accuracy_current IS 'Current transcription accuracy percentage (0-100) after learning corrections';
COMMENT ON COLUMN provider_voice_profiles.accuracy_improvement IS 'Computed column: accuracy_current - accuracy_baseline';
COMMENT ON COLUMN provider_voice_profiles.data_retention_days IS 'Number of days to retain voice profile data before auto-deletion (default: 90 days - optimal for learning persistence while managing storage)';

-- Insert initial audit log entry
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO audit_logs (
      event_type,
      event_category,
      resource_type,
      operation,
      success,
      metadata,
      actor_ip_address,
      actor_user_agent
    ) VALUES (
      'VOICE_PROFILES_MIGRATION_COMPLETE',
      'SYSTEM',
      'database_migration',
      'CREATE',
      true,
      jsonb_build_object(
        'migration', '20251026000000_create_voice_profiles',
        'tables_created', ARRAY['provider_voice_profiles'],
        'rls_enabled', true,
        'retention_days_default', 90,
        'note', 'Only stores text corrections (~75 bytes each), NO audio files. 90-day retention allows corrections to persist through vacations and gaps in usage.',
        'indexes_created', 3,
        'policies_created', 5,
        'functions_created', 2
      ),
      '127.0.0.1'::inet,
      'PostgreSQL Migration Script'
    );
  END IF;
END $$;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON provider_voice_profiles TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
