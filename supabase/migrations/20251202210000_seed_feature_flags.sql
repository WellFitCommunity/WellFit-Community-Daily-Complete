-- ============================================================================
-- Seed System Feature Flags
-- Date: 2025-12-02
-- Purpose: Ensure system_feature_flags table has initial data for Envision panel
-- Note: Previous migration (20251126000000) may have run before table existed
-- ============================================================================

-- Clinical Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('clinical.memory_clinic', 'Memory Clinic', 'Dementia screening & cognitive care coordination with MoCA, MMSE, CDR scale assessments', false, 'clinical', false),
  ('clinical.mental_health', 'Mental Health Dashboard', 'Mental health tracking and assessment tools', false, 'clinical', false),
  ('clinical.dental_health', 'Dental Health Module', 'Dental health tracking and care coordination', true, 'clinical', true),
  ('clinical.stroke_assessment', 'Stroke Assessment', 'Stroke risk assessment and NIH Stroke Scale tools', false, 'clinical', false),
  ('clinical.neuro_suite', 'NeuroSuite Dashboard', 'Comprehensive neurological assessment suite', false, 'clinical', false),
  ('clinical.wearable_integration', 'Wearable Device Integration', 'Integration with health wearables and IoT devices', false, 'clinical', false),
  ('clinical.physical_therapy', 'Physical Therapy Dashboard', 'ICF-based PT assessments and treatment plans', true, 'clinical', true),
  ('clinical.care_coordination', 'Care Coordination Dashboard', 'Interdisciplinary care team management', true, 'clinical', true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Population Health Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('population.frequent_flyers', 'Frequent Flyers Dashboard', 'Track high-utilization patients for care management intervention', false, 'population_health', false),
  ('population.discharge_tracking', 'Discharge Tracking', 'Post-discharge patient monitoring and follow-up', false, 'population_health', false),
  ('population.questionnaire_analytics', 'Questionnaire Analytics', 'SMART questionnaire deployment and response analytics', true, 'population_health', true),
  ('population.referrals', 'Referral Management', 'External hospital referral tracking and reporting', true, 'population_health', true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Billing/Financial Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('billing.revenue_dashboard', 'Revenue Dashboard', 'Real-time revenue analytics and optimization', false, 'billing', false),
  ('billing.billing_review', 'Billing Review System', 'AI-assisted billing review and validation', false, 'billing', false)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Workflow Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('workflow.shift_handoff', 'Shift Handoff Dashboard', 'Nursing shift handoff communication and tracking', false, 'workflow', false),
  ('workflow.field_visits', 'Field Visit Workflow', 'Community health worker field visit management', false, 'workflow', false),
  ('workflow.caregiver_portal', 'Caregiver Portal', 'Family caregiver access portal for patient monitoring', true, 'workflow', true),
  ('workflow.bed_management', 'Bed Management', 'Hospital bed tracking and transfer logs', true, 'workflow', true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Emergency Response Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('emergency.ems_metrics', 'EMS Metrics Dashboard', 'EMS performance metrics and response analytics', false, 'emergency', false),
  ('emergency.coordinated_response', 'Coordinated Response System', 'Multi-department emergency response coordination', false, 'emergency', false),
  ('emergency.law_enforcement', 'Law Enforcement Integration', 'Constable dispatch and welfare check system', true, 'emergency', true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Admin Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('admin.reports', 'Admin Reports', 'Administrative reporting and analytics', true, 'admin', true),
  ('admin.enhanced_questions', 'Enhanced Questions', 'Advanced question management for Ask Nurse feature', false, 'admin', false),
  ('admin.time_clock', 'Time Clock', 'Staff time tracking and attendance', true, 'admin', true),
  ('admin.bulk_operations', 'Bulk Operations', 'Bulk enrollment and export tools', true, 'admin', true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Core Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('core.check_ins', 'Daily Check-ins', 'Senior daily health check-in system', true, 'core', true),
  ('core.questions', 'Ask Nurse Questions', 'Community health questions and answers', true, 'core', true),
  ('core.memory_lane', 'Memory Lane Trivia', 'Cognitive engagement trivia games', true, 'core', true),
  ('core.health_insights', 'Health Insights', 'Personalized health analytics and trends', true, 'core', true),
  ('core.medications', 'Medication Tracking', 'Medication schedule and adherence tracking', true, 'core', true),
  ('core.telehealth', 'Telehealth Appointments', 'Video visit scheduling and management', true, 'core', true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Monitoring Features (Super Admin Only)
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('monitoring.soc2_dashboards', 'SOC2 Compliance Dashboards', 'SOC2 compliance monitoring and reporting', true, 'monitoring', false),
  ('monitoring.performance', 'Performance Monitoring', 'System performance and resource tracking', true, 'monitoring', false),
  ('monitoring.ai_cost_tracking', 'AI Cost Tracking', 'Claude and AI service usage cost monitoring', true, 'monitoring', false),
  ('monitoring.guardian_agent', 'Guardian Agent', 'AI-powered system monitoring and alerts', true, 'monitoring', false)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Verify seed data
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM system_feature_flags;
  RAISE NOTICE 'System feature flags seeded: % total flags', v_count;
END $$;
