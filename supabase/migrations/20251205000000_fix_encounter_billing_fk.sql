-- ============================================================================
-- Fix Encounter Billing Suggestions Foreign Key
-- ============================================================================
-- Problem: encounter_billing_suggestions.encounter_id has no FK constraint
-- which causes PostgREST schema cache error:
-- "could not find relationship between encounters and patients"
--
-- Solution: Add proper FK to encounters table
-- ============================================================================

BEGIN;

-- First check if the FK already exists to make this idempotent
DO $$
BEGIN
  -- Only add FK if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'encounter_billing_suggestions_encounter_id_fkey'
    AND table_name = 'encounter_billing_suggestions'
  ) THEN
    -- Add FK constraint - set NULL on delete since we don't want to lose billing suggestions
    -- if an encounter is deleted
    ALTER TABLE public.encounter_billing_suggestions
      ADD CONSTRAINT encounter_billing_suggestions_encounter_id_fkey
      FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added FK constraint: encounter_billing_suggestions_encounter_id_fkey';
  ELSE
    RAISE NOTICE 'FK constraint already exists: encounter_billing_suggestions_encounter_id_fkey';
  END IF;
END $$;

-- Update the column to allow NULL for orphaned suggestions
ALTER TABLE public.encounter_billing_suggestions
  ALTER COLUMN encounter_id DROP NOT NULL;

-- Create index for the FK if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_encounter_billing_suggestions_encounter
  ON public.encounter_billing_suggestions(encounter_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN public.encounter_billing_suggestions.encounter_id IS
  'References encounters(id) - FK constraint added to fix PostgREST schema cache relationship';

COMMIT;
