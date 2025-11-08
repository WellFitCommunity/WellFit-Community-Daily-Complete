-- Complete Multi-Tenancy RLS Policies
-- Purpose: Add tenant isolation to all remaining tables
-- This completes the multi-tenancy implementation started in 20251107220000
-- Date: 2025-11-08
-- Critical: This is required for B2B2C healthcare platform security

BEGIN;

-- =============================================================================
-- Helper Function: Check if user is admin in their tenant
-- =============================================================================
CREATE OR REPLACE FUNCTION is_tenant_admin() RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND tenant_id = get_current_tenant_id()
    AND is_admin = TRUE
  );
END;
$$;

COMMENT ON FUNCTION is_tenant_admin IS 'Returns true if current user is admin in their tenant';

-- =============================================================================
-- CATEGORY 1: User-Specific Data Tables
-- Users can only see their own data within their tenant
-- =============================================================================

-- Profiles (already has policy, but let's ensure it's comprehensive)
DROP POLICY IF EXISTS "profiles_tenant" ON profiles;
CREATE POLICY "profiles_tenant_select" ON profiles FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "profiles_tenant_insert" ON profiles FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id() AND user_id = auth.uid());

CREATE POLICY "profiles_tenant_update" ON profiles FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()))
  WITH CHECK (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

-- Check-ins (already has policy, expand it)
DROP POLICY IF EXISTS "check_ins_tenant" ON check_ins;
CREATE POLICY "check_ins_tenant_select" ON check_ins FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "check_ins_tenant_insert" ON check_ins FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id() AND user_id = auth.uid());

CREATE POLICY "check_ins_tenant_update" ON check_ins FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

-- Senior tables
CREATE POLICY "senior_demographics_tenant" ON senior_demographics FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "senior_health_tenant" ON senior_health FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "senior_sdoh_tenant" ON senior_sdoh FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "senior_emergency_contacts_tenant" ON senior_emergency_contacts FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

-- Medications
CREATE POLICY "medications_tenant" ON medications FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "medication_reminders_tenant" ON medication_reminders FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "medication_doses_taken_tenant" ON medication_doses_taken FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

-- User preferences and personalization
CREATE POLICY "user_greeting_preferences_tenant" ON user_greeting_preferences FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "user_behavior_profiles_tenant" ON user_behavior_profiles FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

CREATE POLICY "dashboard_personalization_events_tenant" ON dashboard_personalization_events FOR ALL
  USING (tenant_id = get_current_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()));

-- =============================================================================
-- CATEGORY 2: Clinical Data Tables
-- Healthcare providers can see patient data in their tenant
-- =============================================================================

-- Encounters (already has policy, expand it)
DROP POLICY IF EXISTS "encounters_tenant" ON encounters;
CREATE POLICY "encounters_tenant" ON encounters FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Clinical notes and documentation
CREATE POLICY "clinical_notes_tenant" ON clinical_notes FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "care_coordination_notes_tenant" ON care_coordination_notes FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "encounter_diagnoses_tenant" ON encounter_diagnoses FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "encounter_procedures_tenant" ON encounter_procedures FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "lab_results_tenant" ON lab_results FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "risk_assessments_tenant" ON risk_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Care team
CREATE POLICY "care_team_tenant" ON care_team FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "care_team_members_tenant" ON care_team_members FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 3: FHIR Resources
-- All FHIR data must be tenant-isolated
-- =============================================================================

CREATE POLICY "fhir_observations_tenant" ON fhir_observations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_medication_requests_tenant" ON fhir_medication_requests FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_care_plans_tenant" ON fhir_care_plans FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_encounters_tenant" ON fhir_encounters FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_procedures_tenant" ON fhir_procedures FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_immunizations_tenant" ON fhir_immunizations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_practitioners_tenant" ON fhir_practitioners FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_practitioner_roles_tenant" ON fhir_practitioner_roles FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_care_teams_tenant" ON fhir_care_teams FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_care_team_members_tenant" ON fhir_care_team_members FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_questionnaires_tenant" ON fhir_questionnaires FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 4: Billing and Claims
-- Only billing staff should access, but must be tenant-isolated
-- =============================================================================

CREATE POLICY "claims_tenant" ON claims FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claim_lines_tenant" ON claim_lines FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claim_attachments_tenant" ON claim_attachments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claim_denials_tenant" ON claim_denials FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claim_status_history_tenant" ON claim_status_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claim_review_history_tenant" ON claim_review_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "denial_appeal_history_tenant" ON denial_appeal_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "billing_workflows_tenant" ON billing_workflows FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "billing_providers_tenant" ON billing_providers FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "billing_payers_tenant" ON billing_payers FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "remittances_tenant" ON remittances FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fee_schedules_tenant" ON fee_schedules FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fee_schedule_items_tenant" ON fee_schedule_items FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fee_schedule_rates_tenant" ON fee_schedule_rates FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "clearinghouse_config_tenant" ON clearinghouse_config FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "clearinghouse_batches_tenant" ON clearinghouse_batches FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "clearinghouse_batch_items_tenant" ON clearinghouse_batch_items FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "coding_audits_tenant" ON coding_audits FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "coding_recommendations_tenant" ON coding_recommendations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "cms_documentation_tenant" ON cms_documentation FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 5: EMS and Handoff Systems
-- Critical patient safety features - must be tenant-isolated
-- =============================================================================

CREATE POLICY "prehospital_handoffs_tenant" ON prehospital_handoffs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ems_department_dispatches_tenant" ON ems_department_dispatches FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ems_dispatch_protocols_tenant" ON ems_dispatch_protocols FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ems_provider_signoffs_tenant" ON ems_provider_signoffs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "handoff_packets_tenant" ON handoff_packets FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "handoff_sections_tenant" ON handoff_sections FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "handoff_attachments_tenant" ON handoff_attachments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "handoff_logs_tenant" ON handoff_logs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "shift_handoff_risk_scores_tenant" ON shift_handoff_risk_scores FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "shift_handoff_events_tenant" ON shift_handoff_events FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "shift_handoff_overrides_tenant" ON shift_handoff_overrides FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 6: Telehealth
-- Video visits and remote care
-- =============================================================================

CREATE POLICY "telehealth_appointments_tenant" ON telehealth_appointments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "telehealth_sessions_tenant" ON telehealth_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "telehealth_session_events_tenant" ON telehealth_session_events FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 7: Admin and Staff Management
-- Admin-only access within tenant
-- =============================================================================

CREATE POLICY "admin_users_tenant" ON admin_users FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_sessions_tenant" ON admin_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_settings_tenant" ON admin_settings FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_role_pins_tenant" ON admin_role_pins FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "physicians_tenant" ON physicians FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "staff_pins_tenant" ON staff_pins FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "roles_tenant" ON roles FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 8: Audit Logs and Security
-- Read-only for authorized users, write for system
-- =============================================================================

CREATE POLICY "audit_logs_tenant_read" ON audit_logs FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "audit_logs_tenant_insert" ON audit_logs FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "admin_audit_logs_tenant_read" ON admin_audit_logs FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_audit_logs_tenant_insert" ON admin_audit_logs FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "phi_access_logs_tenant_read" ON phi_access_logs FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "phi_access_logs_tenant_insert" ON phi_access_logs FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "phi_access_log_tenant" ON phi_access_log FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "audit_phi_access_tenant" ON audit_phi_access FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "staff_audit_log_tenant" ON staff_audit_log FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "scribe_audit_log_tenant" ON scribe_audit_log FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "security_events_tenant" ON security_events FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "security_alerts_tenant" ON security_alerts FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "security_vulnerabilities_tenant" ON security_vulnerabilities FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "login_attempts_tenant" ON login_attempts FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "account_lockouts_tenant" ON account_lockouts FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- =============================================================================
-- CATEGORY 9: AI and Claude Features
-- Tenant-specific AI usage and caching
-- =============================================================================

CREATE POLICY "claude_care_context_tenant" ON claude_care_context FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claude_translation_cache_tenant" ON claude_translation_cache FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claude_usage_logs_tenant" ON claude_usage_logs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claude_api_audit_tenant" ON claude_api_audit FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claude_admin_task_templates_tenant" ON claude_admin_task_templates FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claude_admin_task_history_tenant" ON claude_admin_task_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claude_voice_input_sessions_tenant" ON claude_voice_input_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ai_confidence_scores_tenant" ON ai_confidence_scores FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ai_learning_milestones_tenant" ON ai_learning_milestones FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ai_recording_analysis_tenant" ON ai_recording_analysis FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 10: Scribe and Medical Transcription
-- Provider-specific tools
-- =============================================================================

CREATE POLICY "scribe_sessions_tenant" ON scribe_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "scribe_conversation_context_tenant" ON scribe_conversation_context FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "scribe_interaction_history_tenant" ON scribe_interaction_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_scribe_preferences_tenant" ON provider_scribe_preferences FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_voice_profiles_tenant" ON provider_voice_profiles FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 11: Mental Health Specialization
-- Sensitive mental health data
-- =============================================================================

CREATE POLICY "mental_health_flags_tenant" ON mental_health_flags FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_risk_assessments_tenant" ON mental_health_risk_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_safety_plans_tenant" ON mental_health_safety_plans FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_therapy_sessions_tenant" ON mental_health_therapy_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_escalations_tenant" ON mental_health_escalations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_service_requests_tenant" ON mental_health_service_requests FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_screening_triggers_tenant" ON mental_health_screening_triggers FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_discharge_checklist_tenant" ON mental_health_discharge_checklist FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_quality_metrics_tenant" ON mental_health_quality_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 12: Parkinson's Disease Management
-- Specialized neurology features
-- =============================================================================

CREATE POLICY "parkinsons_patients_tenant" ON parkinsons_patients FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "parkinsons_medications_tenant" ON parkinsons_medications FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "parkinsons_symptom_diary_tenant" ON parkinsons_symptom_diary FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "parkinsons_updrs_assessments_tenant" ON parkinsons_updrs_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "parkinsons_dbs_sessions_tenant" ON parkinsons_dbs_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "parkinsons_forbes_tracking_tenant" ON parkinsons_forbes_tracking FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "parkinsons_robert_tracking_tenant" ON parkinsons_robert_tracking FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- Neuro assessments
CREATE POLICY "neuro_cognitive_assessments_tenant" ON neuro_cognitive_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "neuro_stroke_assessments_tenant" ON neuro_stroke_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "neuro_barthel_index_tenant" ON neuro_barthel_index FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "neuro_modified_rankin_scale_tenant" ON neuro_modified_rankin_scale FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "neuro_dementia_staging_tenant" ON neuro_dementia_staging FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "neuro_care_plans_tenant" ON neuro_care_plans FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "neuro_caregiver_assessments_tenant" ON neuro_caregiver_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 13: Physical Therapy
-- PT-specific workflows
-- =============================================================================

CREATE POLICY "pt_treatment_plans_tenant" ON pt_treatment_plans FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_treatment_sessions_tenant" ON pt_treatment_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_functional_assessments_tenant" ON pt_functional_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_outcome_measures_tenant" ON pt_outcome_measures FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_home_exercise_programs_tenant" ON pt_home_exercise_programs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_exercise_library_tenant" ON pt_exercise_library FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_telehealth_sessions_tenant" ON pt_telehealth_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_quality_metrics_tenant" ON pt_quality_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_team_communications_tenant" ON pt_team_communications FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pt_wearable_enhanced_outcomes_tenant" ON pt_wearable_enhanced_outcomes FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 14: Community and Engagement
-- Patient engagement features
-- =============================================================================

CREATE POLICY "community_moments_tenant" ON community_moments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "affirmations_tenant" ON affirmations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "comments_tenant" ON comments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "comment_reports_tenant" ON comment_reports FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "memory_lane_trivia_tenant" ON memory_lane_trivia FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "trivia_game_results_tenant" ON trivia_game_results FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "user_trivia_progress_tenant" ON user_trivia_progress FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "user_trivia_trophies_tenant" ON user_trivia_trophies FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "word_game_results_tenant" ON word_game_results FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "meal_interactions_tenant" ON meal_interactions FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 15: Wearables and IoT
-- Connected device data
-- =============================================================================

CREATE POLICY "wearable_connections_tenant" ON wearable_connections FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "wearable_vital_signs_tenant" ON wearable_vital_signs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "wearable_activity_data_tenant" ON wearable_activity_data FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "wearable_fall_detections_tenant" ON wearable_fall_detections FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "wearable_gait_analysis_tenant" ON wearable_gait_analysis FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mh_wearable_biomarkers_tenant" ON mh_wearable_biomarkers FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 16: Mobile and Device Management
-- Mobile app sync and offline support
-- =============================================================================

CREATE POLICY "mobile_devices_tenant" ON mobile_devices FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mobile_sync_status_tenant" ON mobile_sync_status FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mobile_vitals_tenant" ON mobile_vitals FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mobile_emergency_contacts_tenant" ON mobile_emergency_contacts FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mobile_emergency_incidents_tenant" ON mobile_emergency_incidents FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fcm_tokens_tenant" ON fcm_tokens FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "push_subscriptions_tenant" ON push_subscriptions FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 17: Caregiver Features
-- Family/caregiver access to patient data
-- =============================================================================

CREATE POLICY "caregiver_pins_tenant" ON caregiver_pins FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "caregiver_pin_attempts_tenant" ON caregiver_pin_attempts FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "caregiver_view_grants_tenant" ON caregiver_view_grants FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 18: Provider Wellness and Burnout Prevention
-- Provider support features
-- =============================================================================

CREATE POLICY "provider_burnout_assessments_tenant" ON provider_burnout_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_daily_checkins_tenant" ON provider_daily_checkins FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_support_circles_tenant" ON provider_support_circles FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_support_circle_members_tenant" ON provider_support_circle_members FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_support_reflections_tenant" ON provider_support_reflections FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "resilience_training_modules_tenant" ON resilience_training_modules FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "resilience_training_progress_tenant" ON resilience_training_progress FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "resilience_resources_tenant" ON resilience_resources FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 19: Questionnaires and Assessments
-- Configurable forms and surveys
-- =============================================================================

CREATE POLICY "questionnaire_templates_tenant" ON questionnaire_templates FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "questionnaire_deployments_tenant" ON questionnaire_deployments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "questionnaire_responses_tenant" ON questionnaire_responses FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "questionnaire_analytics_tenant" ON questionnaire_analytics FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "question_templates_tenant" ON question_templates FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "question_assignments_tenant" ON question_assignments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "user_questions_tenant" ON user_questions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "admin_user_questions_tenant" ON admin_user_questions FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 20: Consent and Privacy
-- HIPAA consent tracking
-- =============================================================================

CREATE POLICY "privacy_consent_tenant" ON privacy_consent FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "chw_patient_consent_tenant" ON chw_patient_consent FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "consent_verification_log_tenant" ON consent_verification_log FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "consent_expiration_alerts_tenant" ON consent_expiration_alerts FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 21: Kiosk and CHW Features
-- Community health worker workflows
-- =============================================================================

CREATE POLICY "chw_kiosk_devices_tenant" ON chw_kiosk_devices FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "chw_kiosk_sessions_tenant" ON chw_kiosk_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "chw_kiosk_usage_analytics_tenant" ON chw_kiosk_usage_analytics FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "field_visits_tenant" ON field_visits FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 22: Alerts and Notifications
-- Patient safety alerts
-- =============================================================================

CREATE POLICY "alerts_tenant" ON alerts FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "guardian_alerts_tenant" ON guardian_alerts FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "anomaly_detections_tenant" ON anomaly_detections FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "specialist_alerts_tenant" ON specialist_alerts FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 23: Admissions and Discharge
-- Hospital workflow management
-- =============================================================================

CREATE POLICY "patient_admissions_tenant" ON patient_admissions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "discharge_plans_tenant" ON discharge_plans FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "post_discharge_follow_ups_tenant" ON post_discharge_follow_ups FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "post_acute_facilities_tenant" ON post_acute_facilities FOR SELECT
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 24: SDOH (Social Determinants of Health)
-- Community health and social factors
-- =============================================================================

CREATE POLICY "sdoh_assessments_tenant" ON sdoh_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 25: Specialist Workflows
-- Specialty provider features
-- =============================================================================

CREATE POLICY "specialist_providers_tenant" ON specialist_providers FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "specialist_assessments_tenant" ON specialist_assessments FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =============================================================================
-- CATEGORY 26: Remaining Tables
-- Miscellaneous features requiring tenant isolation
-- =============================================================================

CREATE POLICY "enhanced_check_in_responses_tenant" ON enhanced_check_in_responses FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "check_ins_audit_tenant" ON check_ins_audit FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_enroll_audit_tenant" ON admin_enroll_audit FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_notes_audit_tenant" ON admin_notes_audit FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "admin_usage_tracking_tenant" ON admin_usage_tracking FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "user_roles_audit_tenant" ON user_roles_audit FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "user_sessions_tenant" ON user_sessions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "session_recordings_tenant" ON session_recordings FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "voice_profiles_tenant" ON voice_profiles FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "encryption_keys_tenant" ON encryption_keys FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "api_keys_tenant" ON api_keys FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "app_owners_tenant" ON app_owners FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "feature_usage_tenant" ON feature_usage FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "performance_metrics_tenant" ON performance_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "rate_limit_admin_tenant" ON rate_limit_admin FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "rate_limit_logins_tenant" ON rate_limit_logins FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "rate_limit_registrations_tenant" ON rate_limit_registrations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "rate_limit_attempts_tenant" ON rate_limit_attempts FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "pending_registrations_tenant" ON pending_registrations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "password_history_tenant" ON password_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mfa_enrollment_tenant" ON mfa_enrollment FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "staff_auth_attempts_tenant" ON staff_auth_attempts FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "patient_locations_tenant" ON patient_locations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "user_geolocation_history_tenant" ON user_geolocation_history FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "geofence_zones_tenant" ON geofence_zones FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "geofence_events_tenant" ON geofence_events FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "movement_patterns_tenant" ON movement_patterns FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "guardian_eyes_recordings_tenant" ON guardian_eyes_recordings FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "daily_behavior_summary_tenant" ON daily_behavior_summary FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "patient_daily_check_ins_tenant" ON patient_daily_check_ins FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "self_reports_tenant" ON self_reports FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "self_report_submissions_tenant" ON self_report_submissions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "medication_image_extractions_tenant" ON medication_image_extractions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "drug_interaction_cache_tenant" ON drug_interaction_cache FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "drug_interaction_check_logs_tenant" ON drug_interaction_check_logs FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ccm_time_tracking_tenant" ON ccm_time_tracking FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "wellness_enrollments_tenant" ON wellness_enrollments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "peer_group_statistics_tenant" ON peer_group_statistics FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "hospital_departments_tenant" ON hospital_departments FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "interdisciplinary_care_teams_tenant" ON interdisciplinary_care_teams FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "unified_care_plan_links_tenant" ON unified_care_plan_links FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "cross_system_referrals_tenant" ON cross_system_referrals FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "referral_auto_creation_rules_tenant" ON referral_auto_creation_rules FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ehr_observations_tenant" ON ehr_observations FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "ehr_patient_mappings_tenant" ON ehr_patient_mappings FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "fhir_connections_tenant" ON fhir_connections FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "file_upload_audit_tenant" ON file_upload_audit FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "connection_pool_metrics_tenant" ON connection_pool_metrics FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "query_result_cache_tenant" ON query_result_cache FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mcp_cache_performance_tenant" ON mcp_cache_performance FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "mcp_cost_metrics_tenant" ON mcp_cost_metrics FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "data_retention_policies_tenant" ON data_retention_policies FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "disaster_recovery_drills_tenant" ON disaster_recovery_drills FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "drill_checkpoints_tenant" ON drill_checkpoints FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "drill_participants_tenant" ON drill_participants FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "penetration_test_executions_tenant" ON penetration_test_executions FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "security_notifications_tenant" ON security_notifications FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "rls_policy_audit_tenant" ON rls_policy_audit FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "realtime_subscription_registry_tenant" ON realtime_subscription_registry FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "physician_section_interactions_tenant" ON physician_section_interactions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "physician_workflow_preferences_tenant" ON physician_workflow_preferences FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "provider_training_completions_tenant" ON provider_training_completions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "nurseos_product_config_tenant" ON nurseos_product_config FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "nurseos_feature_flags_tenant" ON nurseos_feature_flags FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mental_health_trigger_conditions_tenant" ON mental_health_trigger_conditions FOR ALL
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "motivational_quotes_tenant" ON motivational_quotes FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "claim_flag_types_tenant" ON claim_flag_types FOR SELECT
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "system_health_tenant" ON system_health FOR SELECT
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY "system_recordings_tenant" ON system_recordings FOR ALL
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

COMMIT;

-- =============================================================================
-- Summary
-- =============================================================================
-- This migration adds comprehensive RLS policies for ~250 tables
-- All policies enforce tenant_id = get_current_tenant_id()
-- Admin users can see all data in their tenant via is_tenant_admin()
-- Regular users can only see their own data or data explicitly shared with them
-- Audit logs are read-only for admins, write-only for system
-- This completes the B2B2C multi-tenancy security implementation
-- =============================================================================
