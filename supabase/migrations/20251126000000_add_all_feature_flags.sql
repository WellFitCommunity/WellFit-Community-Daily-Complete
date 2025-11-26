/**
 * Add All Feature Flags to system_feature_flags
 *
 * Makes all features controllable from the SuperAdmin Feature Flag Control Panel
 * Previously features were only controllable via environment variables
 *
 * Categories:
 * - core: Essential system features
 * - clinical: Patient care features
 * - population_health: Analytics and tracking
 * - billing: Financial features
 * - workflow: Operational features
 * - emergency: EMS and response features
 * - admin: Administrative tools
 * - monitoring: Internal monitoring (super admin only)
 */

-- Clinical Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('clinical.memory_clinic', 'Memory Clinic', 'Dementia screening & cognitive care coordination with MoCA, MMSE, CDR scale assessments', false, 'clinical', false),
  ('clinical.mental_health', 'Mental Health Dashboard', 'Mental health tracking and assessment tools', false, 'clinical', false),
  ('clinical.dental_health', 'Dental Health Module', 'Dental health tracking and care coordination', true, 'clinical', true),
  ('clinical.stroke_assessment', 'Stroke Assessment', 'Stroke risk assessment and NIH Stroke Scale tools', false, 'clinical', false),
  ('clinical.neuro_suite', 'NeuroSuite Dashboard', 'Comprehensive neurological assessment suite', false, 'clinical', false),
  ('clinical.wearable_integration', 'Wearable Device Integration', 'Integration with health wearables and IoT devices', false, 'clinical', false)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Population Health Features
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants) VALUES
  ('population.frequent_flyers', 'Frequent Flyers Dashboard', 'Track high-utilization patients for care management intervention', false, 'population_health', false),
  ('population.discharge_tracking', 'Discharge Tracking', 'Post-discharge patient monitoring and follow-up', false, 'population_health', false)
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
  ('workflow.caregiver_portal', 'Caregiver Portal', 'Family caregiver access portal for patient monitoring', false, 'workflow', false)
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
  ('admin.enhanced_questions', 'Enhanced Questions', 'Advanced question management for Ask Nurse feature', false, 'admin', false)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Monitoring Features (Super Admin Only)
INSERT INTO system_feature_flags (feature_key, feature_name, description, is_enabled, category, enabled_for_new_tenants, requires_license) VALUES
  ('monitoring.soc2_dashboards', 'SOC2 Compliance Dashboards', 'SOC2 compliance monitoring and reporting', false, 'monitoring', false, true),
  ('monitoring.performance', 'Performance Monitoring', 'System performance and resource tracking', false, 'monitoring', false, true),
  ('monitoring.ai_cost_tracking', 'AI Cost Tracking', 'Claude and AI service usage cost monitoring', false, 'monitoring', false, true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  requires_license = EXCLUDED.requires_license;

-- Add comment for documentation
COMMENT ON TABLE system_feature_flags IS 'All system feature flags controllable from SuperAdmin Feature Flag Control Panel. Toggle on/off for all tenants, or use kill switch for emergency disable.';
