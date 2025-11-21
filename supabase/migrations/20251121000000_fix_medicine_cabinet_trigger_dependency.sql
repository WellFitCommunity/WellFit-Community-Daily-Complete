-- ============================================================================
-- FIX: Medicine Cabinet Migration - Trigger/Function Dependency Issue
-- Date: 2025-11-21
-- Issue: DROP FUNCTION fails because trigger depends on it
-- Solution: Drop triggers BEFORE dropping functions
-- ============================================================================
--
-- ERROR from original migration:
-- cannot drop function calculate_next_medication_reminder() because other
-- objects depend on it (SQLSTATE 2BP01)
-- trigger set_next_medication_reminder on table medication_reminders depends
-- on function calculate_next_medication_reminder()
--
-- This migration fixes the dependency order issue in 20251016000001_medicine_cabinet.sql
-- ============================================================================

-- ============================================================================
-- 1. DROP TRIGGERS FIRST (before functions)
-- ============================================================================

-- Drop the trigger that depends on calculate_next_medication_reminder()
DROP TRIGGER IF EXISTS set_next_medication_reminder ON public.medication_reminders;

-- Drop update triggers
DROP TRIGGER IF EXISTS update_medications_updated_at ON public.medications;
DROP TRIGGER IF EXISTS update_medication_reminders_updated_at ON public.medication_reminders;

-- ============================================================================
-- 2. NOW DROP FUNCTIONS (safe now that triggers are gone)
-- ============================================================================

DROP FUNCTION IF EXISTS public.calculate_next_medication_reminder() CASCADE;
DROP FUNCTION IF EXISTS public.update_medications_updated_at() CASCADE;

-- ============================================================================
-- 3. RECREATE FUNCTIONS (clean versions)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_medications_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function to calculate next medication reminder
CREATE OR REPLACE FUNCTION public.calculate_next_medication_reminder()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_time TIMESTAMPTZ;
  current_day INTEGER;
  days_ahead INTEGER;
  target_day INTEGER;
BEGIN
  -- Only calculate if reminder is enabled
  IF NEW.enabled = false THEN
    NEW.next_reminder_at = NULL;
    RETURN NEW;
  END IF;

  -- Get current day of week (0=Sunday, 6=Saturday)
  current_day = EXTRACT(DOW FROM NOW());

  -- Find next occurrence of the time_of_day on a valid day
  days_ahead = 0;
  LOOP
    target_day = (current_day + days_ahead) % 7;

    -- Check if this day is in the days_of_week array
    IF target_day = ANY(NEW.days_of_week) THEN
      -- Calculate the timestamp for this day
      next_time = (CURRENT_DATE + days_ahead) + NEW.time_of_day;

      -- If this time has already passed today, move to next valid day
      IF next_time > NOW() THEN
        NEW.next_reminder_at = next_time;
        EXIT;
      END IF;
    END IF;

    days_ahead = days_ahead + 1;

    -- Safety: don't loop more than 7 days
    IF days_ahead > 7 THEN
      NEW.next_reminder_at = NULL;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. RECREATE TRIGGERS (properly ordered)
-- ============================================================================

-- Trigger to update medications.updated_at
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medications_updated_at();

-- Trigger to update medication_reminders.updated_at
CREATE TRIGGER update_medication_reminders_updated_at
  BEFORE UPDATE ON public.medication_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_medications_updated_at();

-- Trigger to calculate next reminder time
CREATE TRIGGER set_next_medication_reminder
  BEFORE INSERT OR UPDATE ON public.medication_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_next_medication_reminder();

-- ============================================================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.calculate_next_medication_reminder() IS
  'Automatically calculates the next_reminder_at timestamp based on time_of_day and days_of_week.
   Triggered on INSERT/UPDATE of medication_reminders table.';

COMMENT ON FUNCTION public.update_medications_updated_at() IS
  'Updates the updated_at timestamp to NOW() whenever a row is modified.
   Used by medications and medication_reminders tables.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  trigger_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname IN ('medications', 'medication_reminders')
    AND NOT t.tgisinternal;

  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname IN ('calculate_next_medication_reminder', 'update_medications_updated_at');

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Medicine Cabinet Migration Fix Complete!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Functions recreated: % (expected: 2)', function_count;
  RAISE NOTICE 'Triggers recreated: % (expected: 3)', trigger_count;
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Issue Fixed: Triggers are now dropped BEFORE functions';
  RAISE NOTICE 'Migration 20251016000001 can now be rolled back safely';
  RAISE NOTICE '=================================================================';
END $$;
