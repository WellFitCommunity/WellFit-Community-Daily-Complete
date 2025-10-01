-- Add missing columns to self_reports table
-- This fixes health data visibility in doctor's view
-- Date: 2025-10-01

-- Add missing health tracking columns
ALTER TABLE public.self_reports
ADD COLUMN IF NOT EXISTS blood_sugar integer,
ADD COLUMN IF NOT EXISTS weight numeric(6,2),
ADD COLUMN IF NOT EXISTS physical_activity text,
ADD COLUMN IF NOT EXISTS social_engagement text,
ADD COLUMN IF NOT EXISTS activity_description text,
ADD COLUMN IF NOT EXISTS blood_oxygen integer,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS reviewed_by_name text;

-- Add constraints for health metrics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'self_reports_blood_sugar_check'
  ) THEN
    ALTER TABLE public.self_reports
    ADD CONSTRAINT self_reports_blood_sugar_check
    CHECK (blood_sugar IS NULL OR (blood_sugar >= 30 AND blood_sugar <= 600));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'self_reports_weight_check'
  ) THEN
    ALTER TABLE public.self_reports
    ADD CONSTRAINT self_reports_weight_check
    CHECK (weight IS NULL OR (weight >= 50 AND weight <= 800));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'self_reports_blood_oxygen_check'
  ) THEN
    ALTER TABLE public.self_reports
    ADD CONSTRAINT self_reports_blood_oxygen_check
    CHECK (blood_oxygen IS NULL OR (blood_oxygen >= 50 AND blood_oxygen <= 100));
  END IF;
END $$;

-- Add index for care team review tracking
CREATE INDEX IF NOT EXISTS idx_self_reports_reviewed_at ON public.self_reports (reviewed_at) WHERE reviewed_at IS NOT NULL;

COMMENT ON COLUMN public.self_reports.blood_sugar IS 'Blood glucose level in mg/dL (30-600)';
COMMENT ON COLUMN public.self_reports.weight IS 'Body weight in pounds (50-800)';
COMMENT ON COLUMN public.self_reports.blood_oxygen IS 'Blood oxygen saturation percentage (50-100)';
COMMENT ON COLUMN public.self_reports.physical_activity IS 'Description of physical activity';
COMMENT ON COLUMN public.self_reports.social_engagement IS 'Description of social interactions';
COMMENT ON COLUMN public.self_reports.activity_description IS 'General activity description';
COMMENT ON COLUMN public.self_reports.reviewed_at IS 'Timestamp when care team reviewed this report';
COMMENT ON COLUMN public.self_reports.reviewed_by_name IS 'Name of care team member who reviewed';
