-- ============================================================================
-- AI Skills Foreign Key Constraints
-- Adds FK constraints for care_coordination_plans and sdoh_observations
-- that were deferred with TODO comments in the original AI skills migrations
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Add FK constraint for readmission_risk_predictions.care_plan_id
-- References: care_coordination_plans (created in 20251004000000)
-- ============================================================================

-- Check if both tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'care_coordination_plans'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'readmission_risk_predictions'
  ) THEN
    -- Add FK constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_readmission_care_plan'
      AND table_name = 'readmission_risk_predictions'
    ) THEN
      ALTER TABLE public.readmission_risk_predictions
        ADD CONSTRAINT fk_readmission_care_plan
        FOREIGN KEY (care_plan_id)
        REFERENCES public.care_coordination_plans(id)
        ON DELETE SET NULL;

      RAISE NOTICE 'Added FK constraint: readmission_risk_predictions.care_plan_id -> care_coordination_plans.id';
    END IF;
  ELSE
    RAISE WARNING 'Table care_coordination_plans or readmission_risk_predictions does not exist. Skipping FK constraint.';
  END IF;
END $$;

-- ============================================================================
-- 2. Fix passive_sdoh_detections.sdoh_indicator_id
-- The table was named incorrectly - should reference sdoh_observations
-- ============================================================================

-- Check if both tables exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'sdoh_observations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'passive_sdoh_detections'
  ) THEN
    -- Add FK constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_passive_sdoh_observation'
      AND table_name = 'passive_sdoh_detections'
    ) THEN
      ALTER TABLE public.passive_sdoh_detections
        ADD CONSTRAINT fk_passive_sdoh_observation
        FOREIGN KEY (sdoh_indicator_id)
        REFERENCES public.sdoh_observations(id)
        ON DELETE SET NULL;

      RAISE NOTICE 'Added FK constraint: passive_sdoh_detections.sdoh_indicator_id -> sdoh_observations.id';
    END IF;
  ELSE
    RAISE WARNING 'Table sdoh_observations or passive_sdoh_detections does not exist. Skipping FK constraint.';
  END IF;
END $$;

-- ============================================================================
-- 3. Add helpful comments to clarify the naming (if tables exist)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'passive_sdoh_detections'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.passive_sdoh_detections.sdoh_indicator_id IS ''References sdoh_observations.id (note: column name says "indicator" but references "observations" table)''';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'readmission_risk_predictions'
  ) THEN
    EXECUTE 'COMMENT ON COLUMN public.readmission_risk_predictions.care_plan_id IS ''References care_coordination_plans.id - links high-risk prediction to follow-up care plan''';
  END IF;
END $$;

COMMIT;
