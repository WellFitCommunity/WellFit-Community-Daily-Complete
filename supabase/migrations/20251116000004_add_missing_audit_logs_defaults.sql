-- ============================================================================
-- Add defaults to NOT NULL columns in audit_logs
-- ============================================================================
-- Purpose: Fix 400 Bad Request by adding defaults to required columns
-- Date: 2025-11-16
-- ============================================================================

-- First, let's see which columns are NOT NULL without defaults
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'NOT NULL columns without defaults in audit_logs:';
  RAISE NOTICE '=================================================================';

  FOR rec IN
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND table_schema = 'public'
      AND is_nullable = 'NO'
      AND column_default IS NULL
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  % (%) - NOT NULL, no default', rec.column_name, rec.data_type;
  END LOOP;

  RAISE NOTICE '=================================================================';
END $$;

-- Add sensible defaults to required columns
DO $$
BEGIN
  -- If event_type is NOT NULL without default, add one
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'event_type'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE audit_logs
    ALTER COLUMN event_type SET DEFAULT 'UNKNOWN_EVENT';
    RAISE NOTICE 'Added default for event_type';
  END IF;

  -- If event_category is NOT NULL without default, add one
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'event_category'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE audit_logs
    ALTER COLUMN event_category SET DEFAULT 'SYSTEM_EVENT';
    RAISE NOTICE 'Added default for event_category';
  END IF;

  -- If success is NOT NULL without default, add one
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'success'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE audit_logs
    ALTER COLUMN success SET DEFAULT true;
    RAISE NOTICE 'Added default for success';
  END IF;

  -- If timestamp is NOT NULL without default, add one
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'timestamp'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  ) THEN
    ALTER TABLE audit_logs
    ALTER COLUMN timestamp SET DEFAULT NOW();
    RAISE NOTICE 'Added default for timestamp';
  END IF;
END $$;

-- Verify all columns now have defaults or are nullable
DO $$
DECLARE
  problem_cols integer;
BEGIN
  SELECT COUNT(*) INTO problem_cols
  FROM information_schema.columns
  WHERE table_name = 'audit_logs'
    AND table_schema = 'public'
    AND is_nullable = 'NO'
    AND column_default IS NULL
    AND column_name != 'id'; -- id is auto-generated, exempt

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Verification Complete:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Columns still requiring values: %', problem_cols;

  IF problem_cols = 0 THEN
    RAISE NOTICE 'SUCCESS: All required columns now have defaults!';
  ELSE
    RAISE WARNING 'WARNING: % columns still need defaults', problem_cols;
  END IF;
  RAISE NOTICE '=================================================================';
END $$;
