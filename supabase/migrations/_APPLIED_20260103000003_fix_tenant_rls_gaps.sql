-- =============================================================================
-- Fix Tenant RLS Policy Gaps
-- =============================================================================
-- Purpose: Add tenant_id isolation policies to all tables that have tenant_id
--          column but are missing tenant-scoped RLS policies.
--
-- Security: Prevents cross-tenant data access (HIPAA critical)
-- Pattern: tenant_id = get_current_tenant_id() OR is_super_admin()
--
-- Tables Fixed: 96 tables identified in audit
-- =============================================================================

BEGIN;

-- =============================================================================
-- Helper: Ensure is_super_admin function exists
-- =============================================================================
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$;

-- =============================================================================
-- AI Service Tables
-- =============================================================================
DROP POLICY IF EXISTS "ai_accuracy_metrics_tenant" ON ai_accuracy_metrics;
CREATE POLICY "ai_accuracy_metrics_tenant" ON ai_accuracy_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "ai_appointment_prep_instructions_tenant" ON ai_appointment_prep_instructions;
CREATE POLICY "ai_appointment_prep_instructions_tenant" ON ai_appointment_prep_instructions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "ai_contraindication_checks_tenant" ON ai_contraindication_checks;
CREATE POLICY "ai_contraindication_checks_tenant" ON ai_contraindication_checks FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "ai_medication_reconciliations_tenant" ON ai_medication_reconciliations;
CREATE POLICY "ai_medication_reconciliations_tenant" ON ai_medication_reconciliations FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "ai_referral_letters_tenant" ON ai_referral_letters;
CREATE POLICY "ai_referral_letters_tenant" ON ai_referral_letters FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "ai_skill_config_tenant" ON ai_skill_config;
CREATE POLICY "ai_skill_config_tenant" ON ai_skill_config FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Alerts & Notifications
-- =============================================================================
DROP POLICY IF EXISTS "alerts_tenant" ON alerts;
CREATE POLICY "alerts_tenant" ON alerts FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- App & Admin Tables
-- =============================================================================
DROP POLICY IF EXISTS "app_owners_tenant" ON app_owners;
CREATE POLICY "app_owners_tenant" ON app_owners FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Care Coordination
-- =============================================================================
DROP POLICY IF EXISTS "care_coordination_notes_tenant" ON care_coordination_notes;
CREATE POLICY "care_coordination_notes_tenant" ON care_coordination_notes FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "care_team_members_tenant" ON care_team_members;
CREATE POLICY "care_team_members_tenant" ON care_team_members FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- CHW Kiosk Tables
-- =============================================================================
DROP POLICY IF EXISTS "chw_kiosk_devices_tenant" ON chw_kiosk_devices;
CREATE POLICY "chw_kiosk_devices_tenant" ON chw_kiosk_devices FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "chw_kiosk_sessions_tenant" ON chw_kiosk_sessions;
CREATE POLICY "chw_kiosk_sessions_tenant" ON chw_kiosk_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "chw_kiosk_usage_analytics_tenant" ON chw_kiosk_usage_analytics;
CREATE POLICY "chw_kiosk_usage_analytics_tenant" ON chw_kiosk_usage_analytics FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "chw_patient_consent_tenant" ON chw_patient_consent;
CREATE POLICY "chw_patient_consent_tenant" ON chw_patient_consent FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Claims & Billing
-- =============================================================================
DROP POLICY IF EXISTS "claim_attachments_tenant" ON claim_attachments;
CREATE POLICY "claim_attachments_tenant" ON claim_attachments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "claim_denials_tenant" ON claim_denials;
CREATE POLICY "claim_denials_tenant" ON claim_denials FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "claim_review_history_tenant" ON claim_review_history;
CREATE POLICY "claim_review_history_tenant" ON claim_review_history FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "clearinghouse_config_tenant" ON clearinghouse_config;
CREATE POLICY "clearinghouse_config_tenant" ON clearinghouse_config FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "denial_appeal_history_tenant" ON denial_appeal_history;
CREATE POLICY "denial_appeal_history_tenant" ON denial_appeal_history FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "remittances_tenant" ON remittances;
CREATE POLICY "remittances_tenant" ON remittances FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Comments & Community
-- =============================================================================
DROP POLICY IF EXISTS "comment_reports_tenant" ON comment_reports;
CREATE POLICY "comment_reports_tenant" ON comment_reports FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "comments_tenant" ON comments;
CREATE POLICY "comments_tenant" ON comments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "community_moments_tenant" ON community_moments;
CREATE POLICY "community_moments_tenant" ON community_moments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Referrals
-- =============================================================================
DROP POLICY IF EXISTS "cross_system_referrals_tenant" ON cross_system_referrals;
CREATE POLICY "cross_system_referrals_tenant" ON cross_system_referrals FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "external_referral_sources_tenant" ON external_referral_sources;
CREATE POLICY "external_referral_sources_tenant" ON external_referral_sources FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "patient_referrals_tenant" ON patient_referrals;
CREATE POLICY "patient_referrals_tenant" ON patient_referrals FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "referral_alerts_tenant" ON referral_alerts;
CREATE POLICY "referral_alerts_tenant" ON referral_alerts FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "referral_auto_creation_rules_tenant" ON referral_auto_creation_rules;
CREATE POLICY "referral_auto_creation_rules_tenant" ON referral_auto_creation_rules FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "referral_reports_tenant" ON referral_reports;
CREATE POLICY "referral_reports_tenant" ON referral_reports FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Data & Config
-- =============================================================================
DROP POLICY IF EXISTS "data_retention_policies_tenant" ON data_retention_policies;
CREATE POLICY "data_retention_policies_tenant" ON data_retention_policies FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "documentation_templates_tenant" ON documentation_templates;
CREATE POLICY "documentation_templates_tenant" ON documentation_templates FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "encryption_keys_tenant" ON encryption_keys;
CREATE POLICY "encryption_keys_tenant" ON encryption_keys FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "export_jobs_tenant" ON export_jobs;
CREATE POLICY "export_jobs_tenant" ON export_jobs FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- EHR & FHIR
-- =============================================================================
DROP POLICY IF EXISTS "ehr_patient_mappings_tenant" ON ehr_patient_mappings;
CREATE POLICY "ehr_patient_mappings_tenant" ON ehr_patient_mappings FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "fhir_conditions_tenant" ON fhir_conditions;
CREATE POLICY "fhir_conditions_tenant" ON fhir_conditions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "fhir_diagnostic_reports_tenant" ON fhir_diagnostic_reports;
CREATE POLICY "fhir_diagnostic_reports_tenant" ON fhir_diagnostic_reports FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Guardian & Telemetry
-- =============================================================================
DROP POLICY IF EXISTS "guardian_eyes_sessions_tenant" ON guardian_eyes_sessions;
CREATE POLICY "guardian_eyes_sessions_tenant" ON guardian_eyes_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "guardian_telemetry_tenant" ON guardian_telemetry;
CREATE POLICY "guardian_telemetry_tenant" ON guardian_telemetry FOR ALL
  USING (tenant_id = get_current_tenant_id()::text OR is_super_admin());

-- =============================================================================
-- Handoffs & Hospital
-- =============================================================================
DROP POLICY IF EXISTS "handoff_sections_tenant" ON handoff_sections;
CREATE POLICY "handoff_sections_tenant" ON handoff_sections FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "hospital_departments_tenant" ON hospital_departments;
CREATE POLICY "hospital_departments_tenant" ON hospital_departments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "interdisciplinary_care_teams_tenant" ON interdisciplinary_care_teams;
CREATE POLICY "interdisciplinary_care_teams_tenant" ON interdisciplinary_care_teams FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "shift_handoff_override_log_tenant" ON shift_handoff_override_log;
CREATE POLICY "shift_handoff_override_log_tenant" ON shift_handoff_override_log FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "shift_handoff_overrides_tenant" ON shift_handoff_overrides;
CREATE POLICY "shift_handoff_overrides_tenant" ON shift_handoff_overrides FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- MCP Logs
-- =============================================================================
DROP POLICY IF EXISTS "mcp_fhir_logs_tenant" ON mcp_fhir_logs;
CREATE POLICY "mcp_fhir_logs_tenant" ON mcp_fhir_logs FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mcp_function_logs_tenant" ON mcp_function_logs;
CREATE POLICY "mcp_function_logs_tenant" ON mcp_function_logs FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mcp_query_logs_tenant" ON mcp_query_logs;
CREATE POLICY "mcp_query_logs_tenant" ON mcp_query_logs FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Mental Health
-- =============================================================================
DROP POLICY IF EXISTS "mental_health_quality_metrics_tenant" ON mental_health_quality_metrics;
CREATE POLICY "mental_health_quality_metrics_tenant" ON mental_health_quality_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mental_health_trigger_conditions_tenant" ON mental_health_trigger_conditions;
CREATE POLICY "mental_health_trigger_conditions_tenant" ON mental_health_trigger_conditions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mh_wearable_biomarkers_tenant" ON mh_wearable_biomarkers;
CREATE POLICY "mh_wearable_biomarkers_tenant" ON mh_wearable_biomarkers FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "psych_med_alerts_tenant" ON psych_med_alerts;
CREATE POLICY "psych_med_alerts_tenant" ON psych_med_alerts FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- MFA & Security
-- =============================================================================
DROP POLICY IF EXISTS "mfa_enrollment_tenant" ON mfa_enrollment;
CREATE POLICY "mfa_enrollment_tenant" ON mfa_enrollment FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "security_vulnerabilities_tenant" ON security_vulnerabilities;
CREATE POLICY "security_vulnerabilities_tenant" ON security_vulnerabilities FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "vulnerability_remediation_log_tenant" ON vulnerability_remediation_log;
CREATE POLICY "vulnerability_remediation_log_tenant" ON vulnerability_remediation_log FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "penetration_test_executions_tenant" ON penetration_test_executions;
CREATE POLICY "penetration_test_executions_tenant" ON penetration_test_executions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Mobile
-- =============================================================================
DROP POLICY IF EXISTS "mobile_devices_tenant" ON mobile_devices;
CREATE POLICY "mobile_devices_tenant" ON mobile_devices FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mobile_emergency_contacts_tenant" ON mobile_emergency_contacts;
CREATE POLICY "mobile_emergency_contacts_tenant" ON mobile_emergency_contacts FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mobile_emergency_incidents_tenant" ON mobile_emergency_incidents;
CREATE POLICY "mobile_emergency_incidents_tenant" ON mobile_emergency_incidents FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mobile_sync_status_tenant" ON mobile_sync_status;
CREATE POLICY "mobile_sync_status_tenant" ON mobile_sync_status FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "mobile_vitals_tenant" ON mobile_vitals;
CREATE POLICY "mobile_vitals_tenant" ON mobile_vitals FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Parkinson's Module
-- =============================================================================
DROP POLICY IF EXISTS "parkinsons_dbs_sessions_tenant" ON parkinsons_dbs_sessions;
CREATE POLICY "parkinsons_dbs_sessions_tenant" ON parkinsons_dbs_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_forbes_tracking_tenant" ON parkinsons_forbes_tracking;
CREATE POLICY "parkinsons_forbes_tracking_tenant" ON parkinsons_forbes_tracking FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_medication_log_tenant" ON parkinsons_medication_log;
CREATE POLICY "parkinsons_medication_log_tenant" ON parkinsons_medication_log FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_medications_tenant" ON parkinsons_medications;
CREATE POLICY "parkinsons_medications_tenant" ON parkinsons_medications FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_patients_tenant" ON parkinsons_patients;
CREATE POLICY "parkinsons_patients_tenant" ON parkinsons_patients FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_robert_tracking_tenant" ON parkinsons_robert_tracking;
CREATE POLICY "parkinsons_robert_tracking_tenant" ON parkinsons_robert_tracking FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_symptom_diary_tenant" ON parkinsons_symptom_diary;
CREATE POLICY "parkinsons_symptom_diary_tenant" ON parkinsons_symptom_diary FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "parkinsons_updrs_assessments_tenant" ON parkinsons_updrs_assessments;
CREATE POLICY "parkinsons_updrs_assessments_tenant" ON parkinsons_updrs_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Patient Data
-- =============================================================================
DROP POLICY IF EXISTS "patient_locations_tenant" ON patient_locations;
CREATE POLICY "patient_locations_tenant" ON patient_locations FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Provider & Staff
-- =============================================================================
DROP POLICY IF EXISTS "provider_burnout_risk_tenant" ON provider_burnout_risk;
CREATE POLICY "provider_burnout_risk_tenant" ON provider_burnout_risk FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Physical Therapy
-- =============================================================================
DROP POLICY IF EXISTS "pt_exercise_library_tenant" ON pt_exercise_library;
CREATE POLICY "pt_exercise_library_tenant" ON pt_exercise_library FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "pt_quality_metrics_tenant" ON pt_quality_metrics;
CREATE POLICY "pt_quality_metrics_tenant" ON pt_quality_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "pt_team_communications_tenant" ON pt_team_communications;
CREATE POLICY "pt_team_communications_tenant" ON pt_team_communications FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "pt_telehealth_sessions_tenant" ON pt_telehealth_sessions;
CREATE POLICY "pt_telehealth_sessions_tenant" ON pt_telehealth_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "pt_wearable_enhanced_outcomes_tenant" ON pt_wearable_enhanced_outcomes;
CREATE POLICY "pt_wearable_enhanced_outcomes_tenant" ON pt_wearable_enhanced_outcomes FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Push & Notifications
-- =============================================================================
DROP POLICY IF EXISTS "push_subscriptions_tenant" ON push_subscriptions;
CREATE POLICY "push_subscriptions_tenant" ON push_subscriptions FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Questionnaires
-- =============================================================================
DROP POLICY IF EXISTS "question_assignments_tenant" ON question_assignments;
CREATE POLICY "question_assignments_tenant" ON question_assignments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "question_templates_tenant" ON question_templates;
CREATE POLICY "question_templates_tenant" ON question_templates FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "questionnaire_analytics_tenant" ON questionnaire_analytics;
CREATE POLICY "questionnaire_analytics_tenant" ON questionnaire_analytics FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "questionnaire_deployments_tenant" ON questionnaire_deployments;
CREATE POLICY "questionnaire_deployments_tenant" ON questionnaire_deployments FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "questionnaire_responses_tenant" ON questionnaire_responses;
CREATE POLICY "questionnaire_responses_tenant" ON questionnaire_responses FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Realtime & System
-- =============================================================================
DROP POLICY IF EXISTS "realtime_subscription_registry_tenant" ON realtime_subscription_registry;
CREATE POLICY "realtime_subscription_registry_tenant" ON realtime_subscription_registry FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "system_audit_logs_tenant" ON system_audit_logs;
CREATE POLICY "system_audit_logs_tenant" ON system_audit_logs FOR ALL
  USING (tenant_id = get_current_tenant_id()::text OR is_super_admin());

DROP POLICY IF EXISTS "system_health_tenant" ON system_health;
CREATE POLICY "system_health_tenant" ON system_health FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "system_health_check_tenant" ON system_health_check;
CREATE POLICY "system_health_check_tenant" ON system_health_check FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- SDOH
-- =============================================================================
DROP POLICY IF EXISTS "sdoh_observations_tenant" ON sdoh_observations;
CREATE POLICY "sdoh_observations_tenant" ON sdoh_observations FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "sdoh_referrals_tenant" ON sdoh_referrals;
CREATE POLICY "sdoh_referrals_tenant" ON sdoh_referrals FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "sdoh_resources_tenant" ON sdoh_resources;
CREATE POLICY "sdoh_resources_tenant" ON sdoh_resources FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "sdoh_screenings_tenant" ON sdoh_screenings;
CREATE POLICY "sdoh_screenings_tenant" ON sdoh_screenings FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- SMART on FHIR
-- =============================================================================
DROP POLICY IF EXISTS "smart_registered_apps_tenant" ON smart_registered_apps;
CREATE POLICY "smart_registered_apps_tenant" ON smart_registered_apps FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Super Admin (special case - only super admins can access)
-- =============================================================================
DROP POLICY IF EXISTS "super_admin_tenant_assignments_tenant" ON super_admin_tenant_assignments;
CREATE POLICY "super_admin_tenant_assignments_tenant" ON super_admin_tenant_assignments FOR ALL
  USING (is_super_admin());

-- =============================================================================
-- Temp & Misc
-- =============================================================================
DROP POLICY IF EXISTS "temp_image_jobs_tenant" ON temp_image_jobs;
CREATE POLICY "temp_image_jobs_tenant" ON temp_image_jobs FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "tenant_branding_audit_tenant" ON tenant_branding_audit;
CREATE POLICY "tenant_branding_audit_tenant" ON tenant_branding_audit FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "tenant_system_status_tenant" ON tenant_system_status;
CREATE POLICY "tenant_system_status_tenant" ON tenant_system_status FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- User & Roles
-- =============================================================================
DROP POLICY IF EXISTS "unified_care_plan_links_tenant" ON unified_care_plan_links;
CREATE POLICY "unified_care_plan_links_tenant" ON unified_care_plan_links FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "user_roles_tenant" ON user_roles;
CREATE POLICY "user_roles_tenant" ON user_roles FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Memory Lane (Community Feature)
-- =============================================================================
DROP POLICY IF EXISTS "memory_lane_trivia_tenant" ON memory_lane_trivia;
CREATE POLICY "memory_lane_trivia_tenant" ON memory_lane_trivia FOR ALL
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

-- =============================================================================
-- Verification
-- =============================================================================
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  -- Count tables still missing tenant policies
  WITH tenant_tables AS (
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.column_name = 'tenant_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
  ),
  tenant_policies AS (
    SELECT DISTINCT tablename as table_name
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual LIKE '%tenant_id%' OR qual LIKE '%get_current_tenant_id%')
  )
  SELECT COUNT(*) INTO missing_count
  FROM tenant_tables tt
  LEFT JOIN tenant_policies tp ON tt.table_name = tp.table_name
  WHERE tp.table_name IS NULL;

  IF missing_count > 0 THEN
    RAISE WARNING 'Tenant RLS gap fix complete, but % tables still missing policies', missing_count;
  ELSE
    RAISE NOTICE 'Tenant RLS gap fix complete. All tenant_id tables now have tenant-scoped policies.';
  END IF;
END $$;

COMMIT;
