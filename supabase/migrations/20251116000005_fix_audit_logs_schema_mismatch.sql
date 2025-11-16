-- ============================================================================
-- Fix audit_logs Schema Mismatch Between Database and Application Code
-- ============================================================================
-- Problem: Application code uses different column names than database:
--   - Code uses: operation, resource_type, resource_id
--   - Database has: action, target_resource_type, target_resource_id
-- This causes 400 Bad Request errors on INSERT
--
-- Solution: Rename columns to match application code
-- Date: 2025-11-16
-- ============================================================================

-- Step 1: Check current columns and show what needs to be fixed
DO $$
DECLARE
  has_action boolean;
  has_operation boolean;
  has_target_resource_type boolean;
  has_resource_type boolean;
BEGIN
  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'action'
  ) INTO has_action;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'operation'
  ) INTO has_operation;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'target_resource_type'
  ) INTO has_target_resource_type;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'resource_type'
  ) INTO has_resource_type;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Current audit_logs Schema:';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Has action column: %', has_action;
  RAISE NOTICE 'Has operation column: %', has_operation;
  RAISE NOTICE 'Has target_resource_type column: %', has_target_resource_type;
  RAISE NOTICE 'Has resource_type column: %', has_resource_type;
  RAISE NOTICE '=================================================================';
END $$;

-- Step 2: Rename columns to match application code
DO $$
BEGIN
  -- Rename action -> operation (if action exists and operation doesn't)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'action'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'operation'
  ) THEN
    ALTER TABLE audit_logs RENAME COLUMN action TO operation;
    RAISE NOTICE 'Renamed action -> operation';
  END IF;

  -- Rename target_resource_type -> resource_type (if target_resource_type exists and resource_type doesn't)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'target_resource_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'resource_type'
  ) THEN
    ALTER TABLE audit_logs RENAME COLUMN target_resource_type TO resource_type;
    RAISE NOTICE 'Renamed target_resource_type -> resource_type';
  END IF;

  -- Rename target_resource_id -> resource_id (if target_resource_id exists and resource_id doesn't)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'target_resource_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'resource_id'
  ) THEN
    ALTER TABLE audit_logs RENAME COLUMN target_resource_id TO resource_id;
    RAISE NOTICE 'Renamed target_resource_id -> resource_id';
  END IF;
END $$;

-- Step 3: Ensure operation is nullable (since not all audit entries need it)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND column_name = 'operation'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE audit_logs ALTER COLUMN operation DROP NOT NULL;
    RAISE NOTICE 'Made operation column nullable';
  END IF;
END $$;

-- Step 4: Drop and recreate indexes with new column names
DROP INDEX IF EXISTS idx_audit_logs_target_resource;
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource
  ON audit_logs(resource_type, resource_id)
  WHERE resource_type IS NOT NULL;

RAISE NOTICE 'Updated index for resource columns';

-- Step 5: Verify the final schema
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Final audit_logs Schema:';
  RAISE NOTICE '=================================================================';

  FOR rec IN
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'audit_logs'
      AND table_schema = 'public'
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  % (%) - NULL: %, DEFAULT: %',
      rec.column_name,
      rec.data_type,
      rec.is_nullable,
      COALESCE(rec.column_default, 'none');
  END LOOP;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Schema fix complete!';
  RAISE NOTICE '=================================================================';
END $$;

-- Add helpful comment
COMMENT ON COLUMN audit_logs.operation IS 'Operation performed (e.g., LOGIN, LOGOUT, READ, WRITE)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource accessed (e.g., patient, auth_event)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the resource accessed';
