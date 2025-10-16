-- FHIR Interoperability System Migration
-- Creates tables for managing FHIR connections, patient mappings, and sync operations

-- migrate:up
BEGIN;

-- ============================================================================
-- FHIR CONNECTIONS TABLE
-- Stores EHR/FHIR server connection configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fhir_server_url TEXT NOT NULL,
  ehr_system TEXT NOT NULL CHECK (ehr_system IN ('EPIC', 'CERNER', 'ALLSCRIPTS', 'CUSTOM')),
  client_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  sync_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'manual')),
  sync_direction TEXT NOT NULL DEFAULT 'pull' CHECK (sync_direction IN ('pull', 'push', 'bidirectional')),
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PATIENT MAPPINGS TABLE
-- Maps community users to FHIR patient IDs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_patient_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fhir_patient_id TEXT NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_user_id, connection_id)
);

-- ============================================================================
-- SYNC LOGS TABLE
-- Tracks all sync operations and their results
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  direction TEXT NOT NULL CHECK (direction IN ('pull', 'push', 'bidirectional')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RESOURCE SYNC TRACKING TABLE
-- Tracks individual resource syncs (Patient, Observation, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_resource_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  community_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fhir_resource_type TEXT NOT NULL, -- Patient, Observation, Encounter, etc.
  fhir_resource_id TEXT NOT NULL,
  local_resource_id UUID, -- Reference to local resource (check_ins, profiles, etc.)
  local_table_name TEXT, -- Table name where local resource is stored
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('pull', 'push')),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  resource_version TEXT, -- FHIR resource versionId
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CONFLICT RESOLUTION TABLE
-- Tracks data conflicts that require manual resolution
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fhir_sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES public.fhir_connections(id) ON DELETE CASCADE,
  community_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fhir_resource_type TEXT NOT NULL,
  fhir_resource_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('data_mismatch', 'version_conflict', 'missing_resource', 'other')),
  fhir_data JSONB NOT NULL,
  community_data JSONB NOT NULL,
  resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (resolution_status IN ('pending', 'resolved', 'ignored')),
  resolution_action TEXT, -- 'use_fhir', 'use_community', 'merge', 'manual'
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Connection indexes
CREATE INDEX IF NOT EXISTS idx_fhir_connections_status ON public.fhir_connections(status);
CREATE INDEX IF NOT EXISTS idx_fhir_connections_last_sync ON public.fhir_connections(last_sync DESC);

-- Patient mapping indexes
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_user ON public.fhir_patient_mappings(community_user_id);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_connection ON public.fhir_patient_mappings(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_fhir_id ON public.fhir_patient_mappings(fhir_patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_patient_mappings_status ON public.fhir_patient_mappings(sync_status);

-- Sync logs indexes
CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_connection ON public.fhir_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_started_at ON public.fhir_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_logs_status ON public.fhir_sync_logs(status);

-- Resource sync indexes
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_connection ON public.fhir_resource_sync(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_user ON public.fhir_resource_sync(community_user_id);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_resource_type ON public.fhir_resource_sync(fhir_resource_type);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_status ON public.fhir_resource_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_fhir_resource_sync_fhir_id ON public.fhir_resource_sync(fhir_resource_id);

-- Conflict indexes
CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_connection ON public.fhir_sync_conflicts(connection_id);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_user ON public.fhir_sync_conflicts(community_user_id);
CREATE INDEX IF NOT EXISTS idx_fhir_sync_conflicts_status ON public.fhir_sync_conflicts(resolution_status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps on update
CREATE OR REPLACE FUNCTION public.update_fhir_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fhir_connections_updated_at ON public.fhir_connections;
CREATE TRIGGER update_fhir_connections_updated_at
  BEFORE UPDATE ON public.fhir_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_updated_at();

DROP TRIGGER IF EXISTS update_fhir_patient_mappings_updated_at ON public.fhir_patient_mappings;
CREATE TRIGGER update_fhir_patient_mappings_updated_at
  BEFORE UPDATE ON public.fhir_patient_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_updated_at();

DROP TRIGGER IF EXISTS update_fhir_resource_sync_updated_at ON public.fhir_resource_sync;
CREATE TRIGGER update_fhir_resource_sync_updated_at
  BEFORE UPDATE ON public.fhir_resource_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_updated_at();

DROP TRIGGER IF EXISTS update_fhir_sync_conflicts_updated_at ON public.fhir_sync_conflicts;
CREATE TRIGGER update_fhir_sync_conflicts_updated_at
  BEFORE UPDATE ON public.fhir_sync_conflicts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_fhir_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.fhir_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_patient_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_resource_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_sync_conflicts ENABLE ROW LEVEL SECURITY;

-- Admin access to all tables
DROP POLICY IF EXISTS "fhir_connections_admin_all" ON public.fhir_connections;
CREATE POLICY "fhir_connections_admin_all"
  ON public.fhir_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "fhir_patient_mappings_admin_all" ON public.fhir_patient_mappings;
CREATE POLICY "fhir_patient_mappings_admin_all"
  ON public.fhir_patient_mappings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own patient mappings
DROP POLICY IF EXISTS "fhir_patient_mappings_user_select" ON public.fhir_patient_mappings;
CREATE POLICY "fhir_patient_mappings_user_select"
  ON public.fhir_patient_mappings
  FOR SELECT
  USING (community_user_id = auth.uid());

DROP POLICY IF EXISTS "fhir_sync_logs_admin_all" ON public.fhir_sync_logs;
CREATE POLICY "fhir_sync_logs_admin_all"
  ON public.fhir_sync_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "fhir_resource_sync_admin_all" ON public.fhir_resource_sync;
CREATE POLICY "fhir_resource_sync_admin_all"
  ON public.fhir_resource_sync
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Users can view their own resource syncs
DROP POLICY IF EXISTS "fhir_resource_sync_user_select" ON public.fhir_resource_sync;
CREATE POLICY "fhir_resource_sync_user_select"
  ON public.fhir_resource_sync
  FOR SELECT
  USING (community_user_id = auth.uid());

DROP POLICY IF EXISTS "fhir_sync_conflicts_admin_all" ON public.fhir_sync_conflicts;
CREATE POLICY "fhir_sync_conflicts_admin_all"
  ON public.fhir_sync_conflicts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Users can view conflicts related to their data
DROP POLICY IF EXISTS "fhir_sync_conflicts_user_select" ON public.fhir_sync_conflicts;
CREATE POLICY "fhir_sync_conflicts_user_select"
  ON public.fhir_sync_conflicts
  FOR SELECT
  USING (community_user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active FHIR connections
CREATE OR REPLACE FUNCTION public.get_active_fhir_connections()
RETURNS SETOF public.fhir_connections
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.fhir_connections
  WHERE status = 'active'
  ORDER BY name;
END;
$$;

-- Function to get patient sync status
CREATE OR REPLACE FUNCTION public.get_patient_fhir_sync_status(user_id_param UUID)
RETURNS TABLE (
  connection_name TEXT,
  fhir_patient_id TEXT,
  sync_status TEXT,
  last_synced_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to get sync statistics for a connection
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
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_syncs,
    COUNT(*) FILTER (WHERE status = 'success')::BIGINT AS successful_syncs,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed_syncs,
    COUNT(*) FILTER (WHERE status = 'partial')::BIGINT AS partial_syncs,
    COALESCE(SUM(records_processed), 0)::BIGINT AS total_records_processed,
    COALESCE(SUM(records_succeeded), 0)::BIGINT AS total_records_succeeded,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END AS success_rate
  FROM public.fhir_sync_logs
  WHERE connection_id = connection_id_param
    AND started_at >= NOW() - (days_param || ' days')::INTERVAL;
END;
$$;

-- Function to clean up old sync logs (keep last 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_fhir_sync_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.fhir_sync_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

COMMIT;

-- migrate:down
BEGIN;

-- Drop functions
DROP FUNCTION IF EXISTS public.cleanup_old_fhir_sync_logs();
DROP FUNCTION IF EXISTS public.get_connection_sync_stats(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_patient_fhir_sync_status(UUID);
DROP FUNCTION IF EXISTS public.get_active_fhir_connections();
DROP FUNCTION IF EXISTS public.update_fhir_updated_at();

-- Drop tables
DROP TABLE IF EXISTS public.fhir_sync_conflicts CASCADE;
DROP TABLE IF EXISTS public.fhir_resource_sync CASCADE;
DROP TABLE IF EXISTS public.fhir_sync_logs CASCADE;
DROP TABLE IF EXISTS public.fhir_patient_mappings CASCADE;
DROP TABLE IF EXISTS public.fhir_connections CASCADE;

COMMIT;
