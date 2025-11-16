-- ============================================================================
-- Fix audit_logs table - Add timestamp column with default
-- ============================================================================
-- Purpose: Fix 400 Bad Request errors on INSERT
-- Context: audit_logs may be missing timestamp/created_at with default
-- Date: 2025-11-16
-- ============================================================================

-- Add timestamp column if it doesn't exist
DO $$
BEGIN
  -- Add timestamp column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'timestamp'
  ) THEN
    ALTER TABLE audit_logs
    ADD COLUMN timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
    RAISE NOTICE 'Added timestamp column to audit_logs';
  ELSE
    RAISE NOTICE 'timestamp column already exists in audit_logs';
  END IF;

  -- Ensure created_at has a default if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE audit_logs
    ALTER COLUMN created_at SET DEFAULT NOW();
    RAISE NOTICE 'Set default for created_at column';
  END IF;
END $$;

-- Verify the audit_logs table structure
DO $$
DECLARE
  col_count integer;
  has_timestamp boolean;
  has_created_at boolean;
BEGIN
  -- Count total columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'audit_logs' AND table_schema = 'public';

  -- Check for timestamp column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'timestamp'
  ) INTO has_timestamp;

  -- Check for created_at column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'created_at'
  ) INTO has_created_at;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'audit_logs Table Structure:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total columns: %', col_count;
  RAISE NOTICE 'Has timestamp column: %', has_timestamp;
  RAISE NOTICE 'Has created_at column: %', has_created_at;
  RAISE NOTICE '=================================================================';
END $$;
