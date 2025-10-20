-- =====================================================================
-- Comprehensive Grant of Authenticated Permissions
-- =====================================================================
-- Fix: 55 tables have RLS enabled but no authenticated role permissions
-- This causes 403 errors even when RLS policies exist
--
-- Strategy: Grant appropriate permissions based on table purpose
-- - Audit/log tables: SELECT, INSERT only
-- - Most tables: SELECT, INSERT, UPDATE (DELETE restricted)
-- - Critical tables: More restrictive, rely heavily on RLS
-- =====================================================================

-- ==================== AUDIT AND LOG TABLES ====================
-- These tables should only allow viewing and inserting
GRANT SELECT, INSERT ON TABLE public._trigger_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_audit_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.claude_api_audit TO authenticated;
GRANT SELECT, INSERT ON TABLE public.handoff_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.phi_access_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.scribe_audit_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.staff_audit_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.staff_auth_attempts TO authenticated;
GRANT SELECT, INSERT ON TABLE public.rate_limit_logins TO authenticated;

-- ==================== USER-FACING CONTENT TABLES ====================
-- Full CRUD for user content
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.affirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.community_moments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meal_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.memory_lane_trivia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.trivia_game_results TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_trivia_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_trivia_trophies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.word_game_results TO authenticated;

-- ==================== CCM AND TIME TRACKING ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.ccm_time_tracking TO authenticated;

-- ==================== BILLING AND CLAIMS ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_workflows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.claim_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.claim_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clearinghouse_batch_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.clearinghouse_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.remittances TO authenticated;

-- ==================== CODING TABLES ====================
GRANT SELECT ON TABLE public.code_cpt TO authenticated;
GRANT SELECT ON TABLE public.code_hcpcs TO authenticated;
GRANT SELECT ON TABLE public.code_icd10 TO authenticated;
GRANT SELECT ON TABLE public.code_modifiers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.coding_audits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.coding_recommendations TO authenticated;

-- ==================== CMS DOCUMENTATION ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.cms_documentation TO authenticated;

-- ==================== FEE SCHEDULES ====================
GRANT SELECT ON TABLE public.fee_schedules TO authenticated;
GRANT SELECT ON TABLE public.fee_schedule_items TO authenticated;
GRANT SELECT ON TABLE public.fee_schedule_rates TO authenticated;

-- ==================== FHIR RESOURCES ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.fhir_care_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fhir_medication_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fhir_observations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fhir_practitioner_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fhir_practitioners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.fhir_procedures TO authenticated;

-- ==================== SHIFT HANDOFF ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.handoff_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.handoff_packets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.handoff_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.shift_handoff_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.shift_handoff_overrides TO authenticated;

-- ==================== SCRIBE SESSIONS ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.scribe_sessions TO authenticated;

-- ==================== PHYSICIAN/PROVIDER ====================
GRANT SELECT ON TABLE public.physicians TO authenticated;
GRANT SELECT ON TABLE public.physician_tenants TO authenticated;

-- ==================== SDOH ASSESSMENTS ====================
GRANT SELECT, INSERT, UPDATE ON TABLE public.sdoh_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.self_report_submissions TO authenticated;

-- ==================== PROVIDER SUPPORT ====================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_support_reflections TO authenticated;

-- ==================== SECURITY/PRIVACY TABLES ====================
-- More restrictive - mostly read-only or insert-only
GRANT SELECT, INSERT ON TABLE public.privacy_consent TO authenticated;
GRANT SELECT ON TABLE public.data_retention_policies TO authenticated;
GRANT SELECT ON TABLE public.encryption_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.staff_pins TO authenticated;

-- =====================================================================
-- Migration Complete
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Granted comprehensive table permissions for 55 tables';
  RAISE NOTICE '   - Audit/log tables: SELECT, INSERT';
  RAISE NOTICE '   - User content: SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE '   - Clinical/billing: SELECT, INSERT, UPDATE';
  RAISE NOTICE '   - Code tables: SELECT only';
  RAISE NOTICE '   - Security tables: Restricted access';
  RAISE NOTICE '   - RLS policies will enforce fine-grained access control';
END $$;
