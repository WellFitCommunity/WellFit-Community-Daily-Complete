-- ============================================================================
-- Restore encryption_status_view — adapted to the LIVE encryption_keys shape
-- ============================================================================
-- The sixth SOC2 monitoring view, deferred from migration 20260711200000
-- pending a schema decision. Decision (2026-07-13, live-verified):
--
--   * The 2025-10-19 view definition selected ek.key_purpose / ek.key_algorithm.
--     Those columns NEVER existed live — they come from the SOC2 foundation
--     migration that was SKIPPED (_ARCHIVE_SKIPPED/_SKIP_20251018160000). The
--     live encryption_keys table (restored 20251130234000) is a key-rotation
--     registry: key_name / key_version / public_key / rotated_at / expires_at
--     / is_active / tenant_id.
--   * So the view is ADAPTED to the current columns (key_version replaces
--     purpose/algorithm) rather than fabricating fields — the same rule the
--     other five restored views followed.
--   * public_key is deliberately NOT exposed (minimum necessary — the
--     dashboard needs rotation posture, not key material).
--   * security_invoker = on (supabase.md §3): the caller's RLS on
--     encryption_keys applies (tenant OR super_admin policy, verified live).
--
-- Honest state notes (not defects of this migration):
--   * encryption_keys has 0 rows and no code writer yet — the view returns an
--     empty (truthful) list until key-rotation management writes rows.
--   * The two REAL PHI keys (supabase.md §17: WellFit Supabase-Secrets
--     PHI_ENCRYPTION_KEY; Envision Atlus Vault key — stored live as
--     vault.secrets name 'app_encryption_key') are NOT in this table and are
--     not representable through an invoker view; surfacing their posture would
--     need a SECURITY DEFINER accessor — a separate product/§17 decision.
--
-- Forward-only: NO `-- migrate:down` block. CREATE OR REPLACE, safe to re-run.
-- ============================================================================

CREATE OR REPLACE VIEW public.encryption_status_view
WITH (security_invoker = on) AS
SELECT
  ek.id,
  ek.key_name,
  ek.key_version,
  ek.is_active,
  ek.created_at,
  ek.rotated_at,
  ek.expires_at,
  EXTRACT(DAY FROM NOW() - COALESCE(ek.rotated_at, ek.created_at))::integer AS days_since_rotation,
  CASE
    WHEN ek.expires_at IS NULL THEN 'No Expiration'
    WHEN ek.expires_at < NOW() THEN 'EXPIRED'
    WHEN ek.expires_at < NOW() + INTERVAL '30 days' THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END AS expiration_status,
  CASE
    WHEN ek.expires_at IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM ek.expires_at - NOW())::integer
  END AS days_until_expiration
FROM public.encryption_keys ek
ORDER BY ek.is_active DESC, ek.created_at DESC;

COMMENT ON VIEW public.encryption_status_view IS
  'Key-rotation posture over encryption_keys for the SOC2 dashboards (security_invoker — caller RLS applies). Adapted 2026-07-13 to the live column set; the platform PHI keys (§17) live in Supabase Secrets / Vault, not here.';

-- §2a: views need their own GRANT — security_invoker controls whose RLS runs,
-- not whether the role may read the view.
GRANT SELECT ON public.encryption_status_view TO authenticated;
