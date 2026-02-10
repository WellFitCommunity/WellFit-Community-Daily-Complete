-- ============================================================================
-- FDA CDS Classification for AI Skills
-- 21 CFR 820, 21st Century Cures Act Section 3060
-- ============================================================================

-- Add FDA classification columns to ai_skills table
ALTER TABLE public.ai_skills
ADD COLUMN IF NOT EXISTS fda_classification TEXT DEFAULT 'non_device'
  CHECK (fda_classification IN ('non_device', 'exempt_cds', 'class_ii_device'));

ALTER TABLE public.ai_skills
ADD COLUMN IF NOT EXISTS fda_classification_rationale TEXT;

ALTER TABLE public.ai_skills
ADD COLUMN IF NOT EXISTS fda_classified_at TIMESTAMPTZ;

ALTER TABLE public.ai_skills
ADD COLUMN IF NOT EXISTS fda_classified_by TEXT;

-- Index for quick filtering by classification
CREATE INDEX IF NOT EXISTS idx_ai_skills_fda_classification ON public.ai_skills(fda_classification);
