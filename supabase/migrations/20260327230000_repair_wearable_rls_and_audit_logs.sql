-- ============================================================================
-- Repair migration: fix wearable RLS policies + audit log identity enforcement
-- The original wearable migration (20260327200000) partially applied,
-- and the audit log RLS migration needs to be applied here.
-- ============================================================================

-- ── Wearable RLS policies (idempotent) ─────────────────────────────────────

-- User policies
DROP POLICY IF EXISTS "wearable_connections_user" ON public.wearable_connections;
CREATE POLICY "wearable_connections_user" ON public.wearable_connections
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_vitals_user" ON public.wearable_vital_signs;
CREATE POLICY "wearable_vitals_user" ON public.wearable_vital_signs
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_activity_user" ON public.wearable_activity_data;
CREATE POLICY "wearable_activity_user" ON public.wearable_activity_data
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_falls_user" ON public.wearable_fall_detections;
CREATE POLICY "wearable_falls_user" ON public.wearable_fall_detections
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "wearable_gait_user" ON public.wearable_gait_analysis;
CREATE POLICY "wearable_gait_user" ON public.wearable_gait_analysis
    FOR ALL USING (user_id = auth.uid() AND tenant_id = get_current_tenant_id())
    WITH CHECK (user_id = auth.uid() AND tenant_id = get_current_tenant_id());

-- Clinician read policies
DROP POLICY IF EXISTS "wearable_connections_clinician_read" ON public.wearable_connections;
CREATE POLICY "wearable_connections_clinician_read" ON public.wearable_connections
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_connections.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_vitals_clinician_read" ON public.wearable_vital_signs;
CREATE POLICY "wearable_vitals_clinician_read" ON public.wearable_vital_signs
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_vital_signs.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_activity_clinician_read" ON public.wearable_activity_data;
CREATE POLICY "wearable_activity_clinician_read" ON public.wearable_activity_data
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_activity_data.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_falls_clinician_read" ON public.wearable_fall_detections;
CREATE POLICY "wearable_falls_clinician_read" ON public.wearable_fall_detections
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_fall_detections.tenant_id
        )
    );

DROP POLICY IF EXISTS "wearable_gait_clinician_read" ON public.wearable_gait_analysis;
CREATE POLICY "wearable_gait_clinician_read" ON public.wearable_gait_analysis
    FOR SELECT USING (
        tenant_id = get_current_tenant_id()
        AND EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
              AND p.is_admin = true
              AND p.tenant_id = wearable_gait_analysis.tenant_id
        )
    );

-- Service role for wearable tables (edge functions need to write on behalf of webhooks)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN VALUES ('wearable_connections'), ('wearable_vital_signs'), ('wearable_activity_data'), ('wearable_fall_detections'), ('wearable_gait_analysis')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_service" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_service" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;

-- ── Audit log RLS identity enforcement (A-3) ──────────────────────────────

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_anon_insert" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_anon_insert_rate_limited" ON audit_logs;
DROP POLICY IF EXISTS "anon_insert_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_authenticated_insert" ON audit_logs;

CREATE POLICY "audit_logs_authenticated_insert"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

DROP POLICY IF EXISTS "audit_logs_service" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_service_full" ON audit_logs;
CREATE POLICY "audit_logs_service_full"
  ON audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── PHI access logs identity enforcement (A-13) ───────────────────────────

DROP POLICY IF EXISTS "phi_access_logs_tenant_insert" ON phi_access_logs;
DROP POLICY IF EXISTS "phi_access_logs_identity_insert" ON phi_access_logs;
DROP POLICY IF EXISTS "phi_access_logs_tenant_insert_v2" ON phi_access_logs;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'phi_access_logs'
      AND column_name = 'accessing_user_id'
  ) THEN
    EXECUTE 'CREATE POLICY "phi_access_logs_identity_insert"
      ON phi_access_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        tenant_id = get_current_tenant_id()
        AND accessing_user_id = auth.uid()
      )';
  ELSE
    EXECUTE 'CREATE POLICY "phi_access_logs_tenant_insert_v2"
      ON phi_access_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (tenant_id = get_current_tenant_id())';
  END IF;
END $$;

-- Service role for PHI logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'phi_access_logs'
      AND policyname = 'phi_access_logs_service_role'
  ) THEN
    EXECUTE 'CREATE POLICY "phi_access_logs_service_role"
      ON phi_access_logs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;
