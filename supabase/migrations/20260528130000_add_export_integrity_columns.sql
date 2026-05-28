-- =============================================================================
-- ONC 170.315(d)(7)/(d)(8) — Data Integrity Verification (bulk exports)
-- =============================================================================
-- Adds the SHA-256 integrity hash columns to `export_jobs` so the
-- asynchronous bulk-export workflow can persist + later verify the hash
-- of each generated export bundle.
--
-- Synchronous exports (enhanced-fhir-export, ccda-export) return the hash
-- inline in the response body + the RFC 3230 `Digest` HTTP header — no
-- DB column needed for those since the recipient is the response stream.
--
-- Live DB verification (per CLAUDE.md Rule #18):
--   • SELECT column_name FROM information_schema.columns
--     WHERE table_name='export_jobs' AND column_name IN
--     ('sha256_hex','integrity_algorithm')
--     → [] (confirmed missing 2026-05-28)
-- =============================================================================

ALTER TABLE public.export_jobs
  ADD COLUMN IF NOT EXISTS sha256_hex          TEXT,
  ADD COLUMN IF NOT EXISTS integrity_algorithm TEXT DEFAULT 'SHA-256';

COMMENT ON COLUMN public.export_jobs.sha256_hex IS
  'SHA-256 of the final exported payload (hex). NULL until the background processor finishes. ONC 170.315(d)(7)/(d)(8).';

COMMENT ON COLUMN public.export_jobs.integrity_algorithm IS
  'Hash algorithm used to compute sha256_hex. Defaults to SHA-256; column exists for future upgrades (e.g., SHA-384) without a breaking change.';
