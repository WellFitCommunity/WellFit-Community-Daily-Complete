-- Restore missing psychiatric classification columns on public.medications
--
-- Drift repair: migration 20251017000001_psych_med_flags.sql intended to add
-- four columns (is_psychiatric, psych_category, psych_subcategory,
-- psych_classification_confidence). The live database only has the first two;
-- psych_subcategory and psych_classification_confidence were never applied (or
-- were dropped out-of-band). This broke every read/write through
-- src/api/medications/* — PostgREST 400 ("column psych_subcategory does not
-- exist") surfaced in the Medicine Cabinet as "Failed to fetch medications".
--
-- This migration restores the two columns, the confidence check constraint, and
-- the psych_category index to match the original intent and the output of
-- src/services/psychMedClassifier.ts. All statements are guarded/idempotent.

-- migrate:up

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS psych_subcategory TEXT,
  ADD COLUMN IF NOT EXISTS psych_classification_confidence NUMERIC(3,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'valid_psych_confidence') THEN
    ALTER TABLE public.medications
    ADD CONSTRAINT valid_psych_confidence
      CHECK (psych_classification_confidence IS NULL OR
             (psych_classification_confidence >= 0 AND psych_classification_confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_medications_psych_category
  ON public.medications(psych_category)
  WHERE psych_category IS NOT NULL;

-- migrate:down

ALTER TABLE public.medications
  DROP CONSTRAINT IF EXISTS valid_psych_confidence;

DROP INDEX IF EXISTS public.idx_medications_psych_category;

ALTER TABLE public.medications
  DROP COLUMN IF EXISTS psych_subcategory,
  DROP COLUMN IF EXISTS psych_classification_confidence;
