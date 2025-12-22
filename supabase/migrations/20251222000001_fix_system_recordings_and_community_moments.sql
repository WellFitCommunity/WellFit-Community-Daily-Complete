-- =====================================================
-- Fix system_recordings and community_moments Tables
-- Date: 2025-12-22
-- Purpose: Create missing tables and fix RLS policies
-- =====================================================

-- ============================================
-- 1. CREATE session_recordings TABLE (parent of system_recordings)
-- ============================================
CREATE TABLE IF NOT EXISTS public.session_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  snapshot_count INTEGER DEFAULT 0,
  ai_summary JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_recordings_user ON session_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_tenant ON session_recordings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_start_time ON session_recordings(start_time DESC);

ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_recordings_tenant" ON public.session_recordings;
CREATE POLICY "session_recordings_tenant" ON public.session_recordings
  FOR ALL USING (auth.uid() = user_id OR tenant_id = get_current_tenant_id());

-- ============================================
-- 2. CREATE system_recordings TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.system_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  snapshots JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_recordings_session ON system_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_system_recordings_tenant ON system_recordings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_recordings_recorded_at ON system_recordings(recorded_at DESC);

ALTER TABLE public.system_recordings ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policy if exists and create new one
DROP POLICY IF EXISTS "system_recordings_tenant" ON public.system_recordings;
CREATE POLICY "system_recordings_tenant" ON public.system_recordings
  FOR ALL USING (tenant_id = get_current_tenant_id());

-- ============================================
-- 3. ENSURE community_moments HAS tenant_id COLUMN
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'community_moments'
    AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.community_moments
    ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT;

    CREATE INDEX IF NOT EXISTS idx_community_moments_tenant ON community_moments(tenant_id);
  END IF;
END $$;

-- ============================================
-- 4. FIX community_moments RLS POLICIES
-- ============================================
-- Drop conflicting policies
DROP POLICY IF EXISTS "community_moments_tenant" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
DROP POLICY IF EXISTS "community_moments_select_approved" ON public.community_moments;

-- Create comprehensive policies
CREATE POLICY "community_moments_select" ON public.community_moments
  FOR SELECT TO authenticated
  USING (
    -- Users can see approved moments OR their own moments
    approval_status = 'approved' OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "community_moments_insert_own" ON public.community_moments;
CREATE POLICY "community_moments_insert_own" ON public.community_moments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_update_own" ON public.community_moments;
CREATE POLICY "community_moments_update_own" ON public.community_moments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_delete_own" ON public.community_moments;
CREATE POLICY "community_moments_delete_own" ON public.community_moments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admin policy for managing all moments
DROP POLICY IF EXISTS "community_moments_admin_all" ON public.community_moments;
CREATE POLICY "community_moments_admin_all" ON public.community_moments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND (p.is_admin = true OR p.role IN ('admin', 'super_admin'))
    )
  );

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================
GRANT SELECT, INSERT, UPDATE ON public.session_recordings TO authenticated;
GRANT SELECT, INSERT ON public.system_recordings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_moments TO authenticated;
