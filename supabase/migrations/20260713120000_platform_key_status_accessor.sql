-- ============================================================================
-- get_platform_key_status() — admin-only PHI-key POSTURE accessor (§17)
-- ============================================================================
-- The SOC2 dashboards can now show encryption_status_view (the key-rotation
-- registry), but the two REAL platform PHI keys (supabase.md §17) do not live
-- in that table:
--   * Envision Atlus (clinical): Supabase Vault secret 'app_encryption_key'
--     (verified live 2026-07-13 — note the underscores; §17 previously
--     documented 'app.encryption_key', which never existed).
--   * WellFit (community): Supabase Secrets env PHI_ENCRYPTION_KEY — an edge
--     function secret that is NOT visible from SQL at all.
--
-- vault.secrets is unreadable to client roles, so surfacing the clinical
-- key's presence/rotation-age needs SECURITY DEFINER. This function returns
-- METADATA ONLY (name, presence, created/updated timestamps) — never key
-- material (vault.decrypted_secrets is never touched). Access is gated
-- inside the function to tenant admins / super admins and EXECUTE is revoked
-- from anon/PUBLIC.
--
-- Approved by Maria 2026-07-13 (fix #2 of the encryption_status_view work).
-- Forward-only: NO `-- migrate:down` block. CREATE OR REPLACE, safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_key_status()
RETURNS TABLE (
  key_scope TEXT,
  key_store TEXT,
  key_name TEXT,
  present BOOLEAN,
  created_at TIMESTAMPTZ,
  last_rotated_at TIMESTAMPTZ,
  days_since_rotation INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Key posture is admin-only metadata
  IF NOT (is_tenant_admin() OR is_super_admin()) THEN
    RAISE EXCEPTION 'forbidden: admin role required to view key posture';
  END IF;

  -- Envision Atlus clinical key (Supabase Vault) — metadata only, never material
  RETURN QUERY
  SELECT
    'clinical'::TEXT,
    'supabase_vault'::TEXT,
    s.name::TEXT,
    TRUE,
    s.created_at,
    s.updated_at,
    EXTRACT(DAY FROM NOW() - s.updated_at)::INTEGER
  FROM vault.secrets s
  WHERE s.name = 'app_encryption_key';

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'clinical'::TEXT, 'supabase_vault'::TEXT, 'app_encryption_key'::TEXT,
      FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::INTEGER;
  END IF;

  -- WellFit community key lives in edge-function Secrets — not SQL-visible.
  -- present = NULL means "unknown from the database"; the dashboard renders
  -- it as 'verify in Supabase Dashboard → Edge Functions → Secrets'.
  RETURN QUERY SELECT
    'community'::TEXT, 'edge_function_secrets'::TEXT, 'PHI_ENCRYPTION_KEY'::TEXT,
    NULL::BOOLEAN, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::INTEGER;
END;
$$;

COMMENT ON FUNCTION public.get_platform_key_status() IS
  'Admin-only PHI-key posture metadata for the SOC2 dashboards (§17): clinical Vault key presence/rotation-age + community edge-secret placeholder. Returns metadata only — never key material.';

REVOKE EXECUTE ON FUNCTION public.get_platform_key_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_key_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_platform_key_status() TO authenticated;
