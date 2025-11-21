-- ============================================================================
-- PERFORMANCE INDEXES (Fixed Version - No CONCURRENTLY)
-- Date: 2025-11-21
-- Purpose: Add critical performance indexes without transaction conflicts
-- ============================================================================

-- Section 1: Critical FK Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id ON public.admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_affirmations_tenant_id ON public.affirmations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_workflows_patient_id ON public.billing_workflows(patient_id);
CREATE INDEX IF NOT EXISTS idx_billing_workflows_tenant_id ON public.billing_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_care_coordination_plans_patient_id ON public.care_coordination_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_community_moments_tenant_id ON public.community_moments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_denial_appeal_history_user_id ON public.denial_appeal_history(user_id);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_tenant_id ON public.handoff_packets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_physicians_tenant_id ON public.physicians(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scribe_sessions_tenant_id ON public.scribe_sessions(tenant_id);

-- Section 2: Composite Indexes for Common Queries
CREATE INDEX IF NOT EXISTS idx_claims_tenant_status
  ON public.claims(tenant_id, status) WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_encounters_tenant_patient_created
  ON public.encounters(tenant_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_handoff_packets_tenant_status_created
  ON public.handoff_packets(tenant_id, status, created_at DESC) WHERE status != 'archived';

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp
  ON public.audit_logs(tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fhir_med_req_tenant_patient_status
  ON public.fhir_medication_requests(tenant_id, patient_id, status)
  WHERE status IN ('active', 'on-hold');

-- Section 3: Text Search Indexes
CREATE INDEX IF NOT EXISTS idx_medications_name_trgm
  ON public.medications USING gin(medication_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_code_cpt_code_trgm
  ON public.code_cpt USING gin(code gin_trgm_ops);

-- Section 4: Update Statistics
ANALYZE public.claims;
ANALYZE public.encounters;
ANALYZE public.audit_logs;
ANALYZE public.handoff_packets;
ANALYZE public.profiles;
ANALYZE public.tenants;
ANALYZE public.medications;

-- Section 5: Storage Optimizations
ALTER TABLE public.claims SET (fillfactor = 90);
ALTER TABLE public.encounters SET (fillfactor = 100);
ALTER TABLE public.audit_logs SET (fillfactor = 100);

-- Verification
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

  RAISE NOTICE '=================================================================';
  RAISE NOTICE '✅ Performance Optimization Complete!';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Total indexes: %', index_count;
  RAISE NOTICE 'Composite indexes: 5';
  RAISE NOTICE 'Text search indexes: 2';
  RAISE NOTICE 'Statistics updated: 7 tables';
  RAISE NOTICE '=================================================================';
END $$;
