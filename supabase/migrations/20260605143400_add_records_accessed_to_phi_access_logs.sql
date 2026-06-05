-- GA / Accountability: add records_accessed to phi_access_logs.
--
-- phi_access_logs is one row per PHI access event. ATLUS Accountability requires
-- capturing HOW MANY patient records each access touched — the bulk-export /
-- scraping signature that guardian-agent Check 3 flags (records_accessed > 50).
-- The column was referenced by guardian-agent but never existed in the live DB
-- (verified 2026-06-05), so Check 3 was inert. This restores the accountability
-- signal rather than removing it.
--
-- Default 1: every logged access touched at least one record. Bulk/list/export
-- paths set the real count. CHECK keeps it non-negative.

ALTER TABLE public.phi_access_logs
  ADD COLUMN IF NOT EXISTS records_accessed INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.phi_access_logs
  DROP CONSTRAINT IF EXISTS phi_access_logs_records_accessed_nonneg;
ALTER TABLE public.phi_access_logs
  ADD CONSTRAINT phi_access_logs_records_accessed_nonneg
  CHECK (records_accessed >= 0);

COMMENT ON COLUMN public.phi_access_logs.records_accessed IS
  'Accountability: number of patient records touched by this access event. Default 1; bulk/export paths set the real count. guardian-agent Check 3 flags > 50.';
