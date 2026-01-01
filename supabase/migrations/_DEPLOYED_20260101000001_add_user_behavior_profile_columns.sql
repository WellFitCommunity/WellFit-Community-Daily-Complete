-- Migration: Add missing columns to user_behavior_profiles for dashboard tracking
-- Date: 2026-01-01
-- Issue: 400 Bad Request - code references columns that don't exist
-- Root cause: Table was designed for UEBA security tracking, but code needs dashboard usage columns

-- ============================================================================
-- ADD MISSING COLUMNS FOR DASHBOARD BEHAVIOR TRACKING
-- ============================================================================

-- Section usage statistics (JSONB for flexibility)
ALTER TABLE user_behavior_profiles
  ADD COLUMN IF NOT EXISTS section_stats jsonb DEFAULT '[]'::jsonb;

-- Most frequently used sections (array of section IDs)
ALTER TABLE user_behavior_profiles
  ADD COLUMN IF NOT EXISTS most_used_sections text[] DEFAULT '{}'::text[];

-- Preferred working hours (start/end hour object)
ALTER TABLE user_behavior_profiles
  ADD COLUMN IF NOT EXISTS preferred_working_hours jsonb DEFAULT '{"start": 9, "end": 17}'::jsonb;

-- Total session count
ALTER TABLE user_behavior_profiles
  ADD COLUMN IF NOT EXISTS total_sessions integer DEFAULT 0;

-- Average session duration (in minutes, separate from the security-focused avg_session_duration_minutes)
ALTER TABLE user_behavior_profiles
  ADD COLUMN IF NOT EXISTS avg_session_duration integer DEFAULT 0;

-- Add updated_at alias (code uses updated_at, table has last_updated_at)
-- We'll add a trigger to keep them in sync
ALTER TABLE user_behavior_profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- ============================================================================
-- CREATE TRIGGER TO SYNC updated_at WITH last_updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_behavior_profile_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- When updated_at changes, update last_updated_at too
  IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
    NEW.last_updated_at := NEW.updated_at;
  END IF;
  -- When last_updated_at changes, update updated_at too
  IF NEW.last_updated_at IS DISTINCT FROM OLD.last_updated_at THEN
    NEW.updated_at := NEW.last_updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_behavior_timestamps ON user_behavior_profiles;
CREATE TRIGGER trg_sync_behavior_timestamps
  BEFORE UPDATE ON user_behavior_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_behavior_profile_timestamps();

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN user_behavior_profiles.section_stats IS 'Dashboard section usage statistics (count, time, preferences)';
COMMENT ON COLUMN user_behavior_profiles.most_used_sections IS 'Array of most frequently accessed dashboard section IDs';
COMMENT ON COLUMN user_behavior_profiles.preferred_working_hours IS 'User preferred working hours JSON: {"start": 9, "end": 17}';
COMMENT ON COLUMN user_behavior_profiles.total_sessions IS 'Total number of dashboard sessions tracked';
COMMENT ON COLUMN user_behavior_profiles.avg_session_duration IS 'Average session duration in minutes (dashboard usage)';
COMMENT ON COLUMN user_behavior_profiles.updated_at IS 'Alias for last_updated_at for code compatibility';
