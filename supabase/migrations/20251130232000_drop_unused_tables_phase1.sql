-- ============================================================================
-- TECH DEBT CLEANUP: Phase 1 - Drop obviously unused tables
-- ============================================================================
-- These tables are:
-- 1. Debug/backup tables from failed migrations
-- 2. Test tables
-- 3. Feature modules that were never implemented
--
-- Total: ~80 tables being removed
-- ============================================================================

-- Disable triggers during bulk operations
SET session_replication_role = 'replica';

-- ============================================================================
-- CATEGORY 1: Debug/backup tables from migrations (safe to delete)
-- ============================================================================
DROP TABLE IF EXISTS _func_backup_search_path CASCADE;
DROP TABLE IF EXISTS _func_patch_failures CASCADE;
DROP TABLE IF EXISTS _policy_backup CASCADE;
DROP TABLE IF EXISTS _policy_merge_backup CASCADE;
DROP TABLE IF EXISTS _policy_merge_backup_all CASCADE;
DROP TABLE IF EXISTS _policy_merge_backup_final CASCADE;
DROP TABLE IF EXISTS _policy_merge_backup_select CASCADE;
DROP TABLE IF EXISTS _policy_merge_backup_select_all CASCADE;
DROP TABLE IF EXISTS _policy_role_tweak_backup CASCADE;
DROP TABLE IF EXISTS _trigger_log CASCADE;
DROP TABLE IF EXISTS test_pt_table CASCADE;

-- ============================================================================
-- CATEGORY 2: Parkinson's module (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS parkinsons_updrs_assessments CASCADE;
DROP TABLE IF EXISTS parkinsons_symptom_diary CASCADE;
DROP TABLE IF EXISTS parkinsons_robert_tracking CASCADE;
DROP TABLE IF EXISTS parkinsons_medication_log CASCADE;
DROP TABLE IF EXISTS parkinsons_medications CASCADE;
DROP TABLE IF EXISTS parkinsons_forbes_tracking CASCADE;
DROP TABLE IF EXISTS parkinsons_dbs_sessions CASCADE;
DROP TABLE IF EXISTS parkinsons_patients CASCADE;

-- ============================================================================
-- CATEGORY 3: Dental module (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS dental_imaging CASCADE;

-- ============================================================================
-- CATEGORY 4: Neurology module (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS neuro_barthel_index CASCADE;

-- ============================================================================
-- CATEGORY 5: CHW Kiosk feature (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS chw_kiosk_usage_analytics CASCADE;
DROP TABLE IF EXISTS chw_kiosk_sessions CASCADE;
DROP TABLE IF EXISTS chw_kiosk_devices CASCADE;
DROP TABLE IF EXISTS chw_patient_consent CASCADE;

-- ============================================================================
-- CATEGORY 6: Disaster Recovery Drills (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS drill_metrics_log CASCADE;
DROP TABLE IF EXISTS drill_participants CASCADE;
DROP TABLE IF EXISTS drill_checkpoints CASCADE;
DROP TABLE IF EXISTS disaster_recovery_drills CASCADE;

-- ============================================================================
-- CATEGORY 7: Geofencing (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS geofence_events CASCADE;
DROP TABLE IF EXISTS geofence_zones CASCADE;

-- ============================================================================
-- CATEGORY 8: Guardian Eyes Recording (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS guardian_eyes_recordings CASCADE;

-- ============================================================================
-- CATEGORY 9: Mobile app tables (app not built)
-- ============================================================================
DROP TABLE IF EXISTS mobile_vitals CASCADE;
DROP TABLE IF EXISTS mobile_sync_status CASCADE;
DROP TABLE IF EXISTS mobile_emergency_incidents CASCADE;
DROP TABLE IF EXISTS mobile_emergency_contacts CASCADE;
DROP TABLE IF EXISTS mobile_devices CASCADE;

-- ============================================================================
-- CATEGORY 10: EMS Dispatch (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS ems_dispatch_protocols CASCADE;

-- ============================================================================
-- CATEGORY 11: Clearinghouse/Advanced Billing (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS remittances CASCADE;
DROP TABLE IF EXISTS claim_review_history CASCADE;
DROP TABLE IF EXISTS claim_denials CASCADE;
DROP TABLE IF EXISTS claim_attachments CASCADE;
DROP TABLE IF EXISTS claim_flag_types CASCADE;
DROP TABLE IF EXISTS clearinghouse_config CASCADE;
DROP TABLE IF EXISTS denial_appeal_history CASCADE;

-- ============================================================================
-- CATEGORY 12: Medical Coding Reference (unused)
-- ============================================================================
DROP TABLE IF EXISTS code_modifiers CASCADE;
DROP TABLE IF EXISTS code_icd10 CASCADE;
DROP TABLE IF EXISTS code_hcpcs CASCADE;
DROP TABLE IF EXISTS code_cpt CASCADE;
DROP TABLE IF EXISTS cpt_code_reference CASCADE;

-- ============================================================================
-- CATEGORY 13: Unused questionnaire system
-- ============================================================================
DROP TABLE IF EXISTS questionnaire_responses CASCADE;
DROP TABLE IF EXISTS questionnaire_deployments CASCADE;
DROP TABLE IF EXISTS questionnaire_analytics CASCADE;
DROP TABLE IF EXISTS question_templates CASCADE;
DROP TABLE IF EXISTS question_assignments CASCADE;

-- ============================================================================
-- CATEGORY 14: Referral system (never implemented)
-- ============================================================================
DROP TABLE IF EXISTS referral_reports CASCADE;
DROP TABLE IF EXISTS referral_alerts CASCADE;
DROP TABLE IF EXISTS referral_auto_creation_rules CASCADE;
DROP TABLE IF EXISTS patient_referrals CASCADE;
DROP TABLE IF EXISTS external_referral_sources CASCADE;
DROP TABLE IF EXISTS cross_system_referrals CASCADE;

-- ============================================================================
-- CATEGORY 15: PT (Physical Therapy) advanced features (unused)
-- ============================================================================
DROP TABLE IF EXISTS pt_wearable_enhanced_outcomes CASCADE;
DROP TABLE IF EXISTS pt_telehealth_sessions CASCADE;
DROP TABLE IF EXISTS pt_team_communications CASCADE;
DROP TABLE IF EXISTS pt_quality_metrics CASCADE;
DROP TABLE IF EXISTS pt_exercise_library CASCADE;

-- ============================================================================
-- CATEGORY 16: Mental Health advanced tables (unused)
-- ============================================================================
DROP TABLE IF EXISTS mental_health_trigger_conditions CASCADE;
DROP TABLE IF EXISTS mental_health_quality_metrics CASCADE;
DROP TABLE IF EXISTS mh_wearable_biomarkers CASCADE;

-- ============================================================================
-- CATEGORY 17: Misc unused tables
-- ============================================================================
DROP TABLE IF EXISTS movement_patterns CASCADE;
DROP TABLE IF EXISTS memory_lane_trivia CASCADE;
DROP TABLE IF EXISTS mfa_enrollment CASCADE;
DROP TABLE IF EXISTS encryption_keys CASCADE;
DROP TABLE IF EXISTS export_jobs CASCADE;
DROP TABLE IF EXISTS data_retention_policies CASCADE;
DROP TABLE IF EXISTS connection_pool_metrics CASCADE;
DROP TABLE IF EXISTS cache_statistics CASCADE;
DROP TABLE IF EXISTS backup_verification_logs CASCADE;
DROP TABLE IF EXISTS app_owners CASCADE;
DROP TABLE IF EXISTS admin_user_questions CASCADE;
DROP TABLE IF EXISTS hospital_departments CASCADE;
DROP TABLE IF EXISTS interdisciplinary_care_teams CASCADE;
DROP TABLE IF EXISTS handoff_sections CASCADE;
DROP TABLE IF EXISTS patient_locations CASCADE;
DROP TABLE IF EXISTS penetration_test_executions CASCADE;
DROP TABLE IF EXISTS security_vulnerabilities CASCADE;
DROP TABLE IF EXISTS vulnerability_remediation_log CASCADE;
DROP TABLE IF EXISTS physician_section_interactions CASCADE;
DROP TABLE IF EXISTS nurseos_feature_flags CASCADE;
DROP TABLE IF EXISTS nurseos_product_config CASCADE;
DROP TABLE IF EXISTS ehr_patient_mappings CASCADE;
DROP TABLE IF EXISTS unified_care_plan_links CASCADE;
DROP TABLE IF EXISTS shift_handoff_overrides CASCADE;
DROP TABLE IF EXISTS shift_handoff_override_log CASCADE;
DROP TABLE IF EXISTS system_health CASCADE;
DROP TABLE IF EXISTS system_health_check CASCADE;
DROP TABLE IF EXISTS password_history CASCADE;
DROP TABLE IF EXISTS passkey_challenges CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS comment_reports CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS care_coordination_notes CASCADE;
DROP TABLE IF EXISTS care_team_members CASCADE;
DROP TABLE IF EXISTS senior_demographics CASCADE;
DROP TABLE IF EXISTS senior_emergency_contacts CASCADE;
DROP TABLE IF EXISTS senior_health CASCADE;
DROP TABLE IF EXISTS senior_sdoh CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Summary
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'PHASE 1 CLEANUP COMPLETE';
  RAISE NOTICE 'Remaining tables: %', table_count;
  RAISE NOTICE '========================================';
END $$;
