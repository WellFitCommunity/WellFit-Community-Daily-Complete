-- ============================================================================
-- Restore the FHIR sync subsystem (4 tables lost to the migrate:down footgun)
-- ============================================================================
-- 20251017000002_fhir_interoperability_system.sql created fhir_connections,
-- fhir_patient_mappings, fhir_sync_logs, fhir_resource_sync and
-- fhir_sync_conflicts — then `db push` executed its `-- migrate:down` block
-- (the documented migrate:down + db push footgun), dropping all five plus
-- update_fhir_updated_at() and the four helper functions. Only
-- fhir_connections was later restored (it exists live with tenant_id and
-- encrypted-token columns). Verified 2026-07-13 via to_regclass /
-- information_schema / pg_proc: the other four tables and the functions are
-- absent live. Blast radius: FHIRConflictResolution.tsx (fully dead, false
-- "no conflicts" green), fhirSync.ts, fhir-integrator/helpers.ts,
-- fhirInteroperabilityIntegrator.ts, mcp-fhir-server trigger_ehr_sync.
--
-- Restored ADAPTED to current standards and the current callers:
--   * tenant_id on every table, auto-derived from the connection's tenant by
--     a BEFORE INSERT trigger (claims.patient_id derive-pattern precedent).
--   * RLS per-command policies mirroring the live fhir_* house pattern
--     (select: tenant OR is_super_admin(); insert: tenant; update/delete:
--     tenant AND is_tenant_admin()) + patient self-SELECT where applicable.
--   * Explicit GRANTs (supabase.md §2a — RLS does not grant privileges).
--   * Patient FKs point at profiles(user_id) — the PostgREST-embeddable join
--     key (encounters precedent, 99560310). fhir_sync_conflicts.patient_id FK
--     is NAMED fhir_sync_conflicts_patient_id_fkey because the UI embeds
--     profiles!fhir_sync_conflicts_patient_id_fkey.
--   * fhir_sync_conflicts is shaped for its caller (FHIRConflictResolution):
--     patient_id / resource_type / resource_id / detected_at /
--     resolution_notes (the 2025 shape used community_user_id /
--     fhir_resource_type / notes — the component never matched it).
--   * fhir_sync_logs also serves the mcp-fhir-server trigger_ehr_sync queue
--     write: adds patient_id + resource_types, widens status with
--     'pending'/'in_progress', completed_at nullable, sync_type defaults
--     'manual'. fhir-integrator/helpers.ts logSyncResult fits unchanged.
--   * Helper fns restored HARDENED: read helpers are SECURITY INVOKER (the
--     2025 versions were DEFINER — get_active_fhir_connections returned rows
--     including access tokens past RLS); cleanup stays DEFINER with
--     SET search_path = public and EXECUTE revoked from client roles.
--
-- Forward-only: NO `-- migrate:down` block. Idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS), safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) Shared trigger functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_fhir_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Derives tenant_id from the parent fhir_connections row when the caller does
-- not supply it. DEFINER so the lookup works for patient-context callers that
-- cannot read fhir_connections; RLS WITH CHECK still evaluates the final row
-- (BEFORE triggers run first), so tenant isolation is preserved.
CREATE OR REPLACE FUNCTION public.set_fhir_sync_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.fhir_connections
    WHERE id = NEW.connection_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1) fhir_patient_mappings — community user <-> FHIR patient id
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_patient_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  community_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  fhir_patient_id TEXT NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (community_user_id, connection_id)
);

COMMENT ON TABLE public.fhir_patient_mappings IS
  'Maps community users (profiles.user_id) to FHIR patient ids per EHR connection. Restored 2026-07-13 (migrate:down footgun).';

CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_user ON public.fhir_patient_mappings(community_user_id);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_connection ON public.fhir_patient_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_fhir_id ON public.fhir_patient_mappings(fhir_patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_status ON public.fhir_patient_mappings(sync_status);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_tenant ON public.fhir_patient_mappings(tenant_id);

DROP TRIGGER IF EXISTS update_fhir_patient_mappings_updated_at ON public.fhir_patient_mappings;
CREATE TRIGGER update_fhir_patient_mappings_updated_at
  BEFORE UPDATE ON public.fhir_patient_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_fhir_updated_at();

DROP TRIGGER IF EXISTS set_fhir_patient_mappings_tenant ON public.fhir_patient_mappings;
CREATE TRIGGER set_fhir_patient_mappings_tenant
  BEFORE INSERT ON public.fhir_patient_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_fhir_sync_tenant_id();

ALTER TABLE public.fhir_patient_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_patient_mappings_select" ON public.fhir_patient_mappings;
CREATE POLICY "fhir_patient_mappings_select" ON public.fhir_patient_mappings
  FOR SELECT USING ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR (community_user_id = auth.uid()));

DROP POLICY IF EXISTS "fhir_patient_mappings_insert" ON public.fhir_patient_mappings;
CREATE POLICY "fhir_patient_mappings_insert" ON public.fhir_patient_mappings
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "fhir_patient_mappings_update" ON public.fhir_patient_mappings;
CREATE POLICY "fhir_patient_mappings_update" ON public.fhir_patient_mappings
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

DROP POLICY IF EXISTS "fhir_patient_mappings_delete" ON public.fhir_patient_mappings;
CREATE POLICY "fhir_patient_mappings_delete" ON public.fhir_patient_mappings
  FOR DELETE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fhir_patient_mappings TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) fhir_sync_logs — sync run results + queued sync requests (append-heavy)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL DEFAULT 'manual' CHECK (sync_type IN ('full', 'incremental', 'manual')),
  direction TEXT NOT NULL CHECK (direction IN ('pull', 'push', 'bidirectional')),
  resource_types TEXT[],
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'partial', 'failed')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fhir_sync_logs IS
  'FHIR sync run results (fhir-integrator) and queued sync requests (mcp-fhir-server trigger_ehr_sync, status=pending). Restored 2026-07-13 (migrate:down footgun).';

CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_connection ON public.fhir_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_started_at ON public.fhir_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_status ON public.fhir_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_tenant ON public.fhir_sync_logs(tenant_id);

DROP TRIGGER IF EXISTS set_fhir_sync_logs_tenant ON public.fhir_sync_logs;
CREATE TRIGGER set_fhir_sync_logs_tenant
  BEFORE INSERT ON public.fhir_sync_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_fhir_sync_tenant_id();

ALTER TABLE public.fhir_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_sync_logs_select" ON public.fhir_sync_logs;
CREATE POLICY "fhir_sync_logs_select" ON public.fhir_sync_logs
  FOR SELECT USING ((tenant_id = get_current_tenant_id()) OR is_super_admin());

DROP POLICY IF EXISTS "fhir_sync_logs_insert" ON public.fhir_sync_logs;
CREATE POLICY "fhir_sync_logs_insert" ON public.fhir_sync_logs
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "fhir_sync_logs_update" ON public.fhir_sync_logs;
CREATE POLICY "fhir_sync_logs_update" ON public.fhir_sync_logs
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

DROP POLICY IF EXISTS "fhir_sync_logs_delete" ON public.fhir_sync_logs;
CREATE POLICY "fhir_sync_logs_delete" ON public.fhir_sync_logs
  FOR DELETE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

GRANT SELECT, INSERT, UPDATE ON public.fhir_sync_logs TO authenticated;

-- ----------------------------------------------------------------------------
-- 3) fhir_resource_sync — per-resource sync tracking
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_resource_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  community_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  fhir_resource_type TEXT NOT NULL,
  fhir_resource_id TEXT NOT NULL,
  local_resource_id UUID,
  local_table_name TEXT,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('pull', 'push')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  resource_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fhir_resource_sync IS
  'Per-resource FHIR sync state (Patient, Observation, ...). Restored 2026-07-13 (migrate:down footgun); no code writer yet — the sync engine populates it.';

CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_connection ON public.fhir_resource_sync(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_user ON public.fhir_resource_sync(community_user_id);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_resource_type ON public.fhir_resource_sync(fhir_resource_type);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_status ON public.fhir_resource_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_fhir_id ON public.fhir_resource_sync(fhir_resource_id);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_tenant ON public.fhir_resource_sync(tenant_id);

DROP TRIGGER IF EXISTS update_fhir_resource_sync_updated_at ON public.fhir_resource_sync;
CREATE TRIGGER update_fhir_resource_sync_updated_at
  BEFORE UPDATE ON public.fhir_resource_sync
  FOR EACH ROW EXECUTE FUNCTION public.update_fhir_updated_at();

DROP TRIGGER IF EXISTS set_fhir_resource_sync_tenant ON public.fhir_resource_sync;
CREATE TRIGGER set_fhir_resource_sync_tenant
  BEFORE INSERT ON public.fhir_resource_sync
  FOR EACH ROW EXECUTE FUNCTION public.set_fhir_sync_tenant_id();

ALTER TABLE public.fhir_resource_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_resource_sync_select" ON public.fhir_resource_sync;
CREATE POLICY "fhir_resource_sync_select" ON public.fhir_resource_sync
  FOR SELECT USING ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR (community_user_id = auth.uid()));

DROP POLICY IF EXISTS "fhir_resource_sync_insert" ON public.fhir_resource_sync;
CREATE POLICY "fhir_resource_sync_insert" ON public.fhir_resource_sync
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "fhir_resource_sync_update" ON public.fhir_resource_sync;
CREATE POLICY "fhir_resource_sync_update" ON public.fhir_resource_sync
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

DROP POLICY IF EXISTS "fhir_resource_sync_delete" ON public.fhir_resource_sync;
CREATE POLICY "fhir_resource_sync_delete" ON public.fhir_resource_sync
  FOR DELETE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

GRANT SELECT, INSERT, UPDATE ON public.fhir_resource_sync TO authenticated;

-- ----------------------------------------------------------------------------
-- 4) fhir_sync_conflicts — manual conflict-resolution queue
--    (shaped for FHIRConflictResolution.tsx; FK name is load-bearing for the
--    profiles!fhir_sync_conflicts_patient_id_fkey PostgREST embed)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id),
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL CONSTRAINT fhir_sync_conflicts_patient_id_fkey REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('data_mismatch', 'version_conflict', 'missing_resource', 'other')),
  fhir_data JSONB NOT NULL,
  community_data JSONB NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution_action TEXT CHECK (resolution_action IN ('use_fhir', 'use_community', 'merge', 'manual')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fhir_sync_conflicts IS
  'FHIR-vs-community data conflicts awaiting admin resolution (FHIRConflictResolution UI). resource_id is the FHIR resource id. Restored 2026-07-13 (migrate:down footgun); the sync engine is the writer.';

CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_connection ON public.fhir_sync_conflicts(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_patient ON public.fhir_sync_conflicts(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_unresolved ON public.fhir_sync_conflicts(detected_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_tenant ON public.fhir_sync_conflicts(tenant_id);

DROP TRIGGER IF EXISTS update_fhir_sync_conflicts_updated_at ON public.fhir_sync_conflicts;
CREATE TRIGGER update_fhir_sync_conflicts_updated_at
  BEFORE UPDATE ON public.fhir_sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.update_fhir_updated_at();

DROP TRIGGER IF EXISTS set_fhir_sync_conflicts_tenant ON public.fhir_sync_conflicts;
CREATE TRIGGER set_fhir_sync_conflicts_tenant
  BEFORE INSERT ON public.fhir_sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.set_fhir_sync_tenant_id();

ALTER TABLE public.fhir_sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fhir_sync_conflicts_select" ON public.fhir_sync_conflicts;
CREATE POLICY "fhir_sync_conflicts_select" ON public.fhir_sync_conflicts
  FOR SELECT USING ((tenant_id = get_current_tenant_id()) OR is_super_admin() OR (patient_id = auth.uid()));

DROP POLICY IF EXISTS "fhir_sync_conflicts_insert" ON public.fhir_sync_conflicts;
CREATE POLICY "fhir_sync_conflicts_insert" ON public.fhir_sync_conflicts
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "fhir_sync_conflicts_update" ON public.fhir_sync_conflicts;
CREATE POLICY "fhir_sync_conflicts_update" ON public.fhir_sync_conflicts
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

DROP POLICY IF EXISTS "fhir_sync_conflicts_delete" ON public.fhir_sync_conflicts;
CREATE POLICY "fhir_sync_conflicts_delete" ON public.fhir_sync_conflicts
  FOR DELETE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());

GRANT SELECT, INSERT, UPDATE ON public.fhir_sync_conflicts TO authenticated;

-- ----------------------------------------------------------------------------
-- 5) Helper functions (restored hardened; dropped by the same down-block)
-- ----------------------------------------------------------------------------

-- INVOKER (2025 version was DEFINER — leaked access tokens past RLS).
CREATE OR REPLACE FUNCTION public.get_active_fhir_connections()
RETURNS SETOF public.fhir_connections
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_connections
  WHERE status = 'active'
  ORDER BY name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_fhir_sync_status(user_id_param UUID)
RETURNS TABLE (
  connection_name TEXT,
  fhir_patient_id TEXT,
  sync_status TEXT,
  last_synced_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.name,
    fpm.fhir_patient_id,
    fpm.sync_status,
    fpm.last_synced_at
  FROM public.fhir_patient_mappings fpm
  JOIN public.fhir_connections fc ON fpm.connection_id = fc.id
  WHERE fpm.community_user_id = user_id_param
  ORDER BY fc.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_connection_sync_stats(
  connection_id_param UUID,
  days_param INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_syncs BIGINT,
  successful_syncs BIGINT,
  failed_syncs BIGINT,
  partial_syncs BIGINT,
  total_records_processed BIGINT,
  total_records_succeeded BIGINT,
  success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'partial')::BIGINT,
    COALESCE(SUM(records_processed), 0)::BIGINT,
    COALESCE(SUM(records_succeeded), 0)::BIGINT,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END
  FROM public.fhir_sync_logs
  WHERE connection_id = connection_id_param
    AND started_at >= NOW() - (days_param || ' days')::INTERVAL;
END;
$$;

-- Retention job — DEFINER (must delete past RLS), locked to service contexts.
CREATE OR REPLACE FUNCTION public.cleanup_old_fhir_sync_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.fhir_sync_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_fhir_sync_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_fhir_sync_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_fhir_sync_logs() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_fhir_sync_logs() TO service_role;
