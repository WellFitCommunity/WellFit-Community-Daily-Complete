/**
 * Tenant Module Configuration Types
 *
 * Defines types for the tenant-level feature flags system.
 * Allows B2B customers to enable/disable platform modules.
 *
 * @see supabase/migrations/20251111000000_tenant_module_configuration.sql
 */

export type LicenseTier = 'basic' | 'standard' | 'premium' | 'enterprise';

export interface TenantModuleConfig {
  id: string;
  tenant_id: string;

  // ============================================================================
  // ACTIVE STATE FLAGS (Tenant Admin controls what's currently ON)
  // ============================================================================

  // Core Platform Modules - Active State
  community_enabled: boolean;
  dashboard_enabled: boolean;
  check_ins_enabled: boolean;

  // Clinical Modules - Active State
  dental_enabled: boolean;
  sdoh_enabled: boolean;
  pharmacy_enabled: boolean;
  medications_enabled: boolean;
  memory_clinic_enabled: boolean;
  mental_health_enabled: boolean;
  stroke_assessment_enabled: boolean;
  wearable_integration_enabled: boolean;

  // Communication Modules - Active State
  telehealth_enabled: boolean;
  messaging_enabled: boolean;

  // Integration Modules - Active State
  ehr_integration_enabled: boolean;
  fhir_enabled: boolean;

  // Advanced Features - Active State
  ai_scribe_enabled: boolean;
  claude_care_enabled: boolean;
  guardian_monitoring_enabled: boolean;

  // NurseOS Modules - Active State
  nurseos_clarity_enabled: boolean;
  nurseos_shield_enabled: boolean;
  resilience_hub_enabled: boolean;

  // Population Health Modules - Active State
  frequent_flyers_enabled: boolean;
  discharge_tracking_enabled: boolean;

  // Workflow Modules - Active State
  shift_handoff_enabled: boolean;
  field_visits_enabled: boolean;
  caregiver_portal_enabled: boolean;
  time_clock_enabled: boolean;

  // Emergency Modules - Active State
  ems_metrics_enabled: boolean;
  coordinated_response_enabled: boolean;
  law_enforcement_enabled: boolean;

  // Billing & Revenue Modules - Active State
  billing_integration_enabled: boolean;
  rpm_ccm_enabled: boolean; // Remote Patient Monitoring / Chronic Care Management

  // Security & Compliance - Active State
  hipaa_audit_logging: boolean;
  mfa_enforcement: boolean;

  // Physical Therapy Module - Active State
  physical_therapy_enabled: boolean;

  // Advanced Authentication - Active State
  passkey_authentication_enabled: boolean;

  // Voice Features - Active State
  voice_command_enabled: boolean;

  // Atlas Revenue System - Active State
  atlas_revenue_enabled: boolean;

  // Vitals Capture - Active State
  vitals_capture_enabled: boolean;

  // SMART on FHIR Questionnaires - Active State
  smart_questionnaires_enabled: boolean;

  // Medication Identifier (Pill ID, Photo Capture) - Active State
  medication_identifier_enabled: boolean;

  // Clinical Documentation (SOAP Notes) - Active State
  clinical_documentation_enabled: boolean;

  // Behavioral Analytics - Active State
  behavioral_analytics_enabled: boolean;

  // Allergies & Immunizations - Active State
  allergies_immunizations_enabled: boolean;

  // ============================================================================
  // ENTITLEMENT FLAGS (SuperAdmin controls ceiling based on payment/license)
  // ============================================================================

  // Core Platform Modules - Entitlements
  community_entitled: boolean;
  dashboard_entitled: boolean;
  check_ins_entitled: boolean;

  // Clinical Modules - Entitlements
  dental_entitled: boolean;
  sdoh_entitled: boolean;
  pharmacy_entitled: boolean;
  medications_entitled: boolean;
  memory_clinic_entitled: boolean;
  mental_health_entitled: boolean;
  stroke_assessment_entitled: boolean;
  wearable_integration_entitled: boolean;

  // Communication Modules - Entitlements
  telehealth_entitled: boolean;
  messaging_entitled: boolean;

  // Integration Modules - Entitlements
  ehr_integration_entitled: boolean;
  fhir_entitled: boolean;

  // Advanced Features - Entitlements
  ai_scribe_entitled: boolean;
  claude_care_entitled: boolean;
  guardian_monitoring_entitled: boolean;

  // NurseOS Modules - Entitlements
  nurseos_clarity_entitled: boolean;
  nurseos_shield_entitled: boolean;
  resilience_hub_entitled: boolean;

  // Population Health Modules - Entitlements
  frequent_flyers_entitled: boolean;
  discharge_tracking_entitled: boolean;

  // Workflow Modules - Entitlements
  shift_handoff_entitled: boolean;
  field_visits_entitled: boolean;
  caregiver_portal_entitled: boolean;
  time_clock_entitled: boolean;

  // Emergency Modules - Entitlements
  ems_metrics_entitled: boolean;
  coordinated_response_entitled: boolean;
  law_enforcement_entitled: boolean;

  // Billing & Revenue Modules - Entitlements
  billing_integration_entitled: boolean;
  rpm_ccm_entitled: boolean;

  // Security & Compliance - Entitlements
  hipaa_audit_logging_entitled: boolean;
  mfa_enforcement_entitled: boolean;

  // Physical Therapy Module - Entitlements
  physical_therapy_entitled: boolean;

  // Advanced Authentication - Entitlements
  passkey_authentication_entitled: boolean;

  // Voice Features - Entitlements
  voice_command_entitled: boolean;

  // Atlas Revenue System - Entitlements
  atlas_revenue_entitled: boolean;

  // Vitals Capture - Entitlements
  vitals_capture_entitled: boolean;

  // SMART on FHIR Questionnaires - Entitlements
  smart_questionnaires_entitled: boolean;

  // Medication Identifier - Entitlements
  medication_identifier_entitled: boolean;

  // Clinical Documentation - Entitlements
  clinical_documentation_entitled: boolean;

  // Behavioral Analytics - Entitlements
  behavioral_analytics_entitled: boolean;

  // Allergies & Immunizations - Entitlements
  allergies_immunizations_entitled: boolean;

  // ============================================================================
  // METADATA
  // ============================================================================

  license_tier: LicenseTier;
  custom_modules: Record<string, unknown>;

  // Audit fields for active state changes (Tenant Admin)
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Audit fields for entitlement changes (SuperAdmin)
  entitlements_updated_at: string | null;
  entitlements_updated_by: string | null;
}

/**
 * Module names that can be checked with is_module_enabled()
 * These are the ACTIVE state columns (Tenant Admin controls)
 */
export type ModuleName =
  // Core
  | 'community_enabled'
  | 'dashboard_enabled'
  | 'check_ins_enabled'
  // Clinical
  | 'dental_enabled'
  | 'sdoh_enabled'
  | 'pharmacy_enabled'
  | 'medications_enabled'
  | 'memory_clinic_enabled'
  | 'mental_health_enabled'
  | 'stroke_assessment_enabled'
  | 'wearable_integration_enabled'
  // Communication
  | 'telehealth_enabled'
  | 'messaging_enabled'
  // Integration
  | 'ehr_integration_enabled'
  | 'fhir_enabled'
  // Advanced
  | 'ai_scribe_enabled'
  | 'claude_care_enabled'
  | 'guardian_monitoring_enabled'
  // NurseOS
  | 'nurseos_clarity_enabled'
  | 'nurseos_shield_enabled'
  | 'resilience_hub_enabled'
  // Population Health
  | 'frequent_flyers_enabled'
  | 'discharge_tracking_enabled'
  // Workflow
  | 'shift_handoff_enabled'
  | 'field_visits_enabled'
  | 'caregiver_portal_enabled'
  | 'time_clock_enabled'
  // Emergency
  | 'ems_metrics_enabled'
  | 'coordinated_response_enabled'
  | 'law_enforcement_enabled'
  // Billing
  | 'billing_integration_enabled'
  | 'rpm_ccm_enabled'
  // Security
  | 'hipaa_audit_logging'
  | 'mfa_enforcement'
  // Additional Modules
  | 'physical_therapy_enabled'
  | 'passkey_authentication_enabled'
  | 'voice_command_enabled'
  | 'atlas_revenue_enabled'
  | 'vitals_capture_enabled'
  | 'smart_questionnaires_enabled'
  | 'medication_identifier_enabled'
  | 'clinical_documentation_enabled'
  | 'behavioral_analytics_enabled'
  | 'allergies_immunizations_enabled';

/**
 * Entitlement names (SuperAdmin controls)
 * These represent what the tenant has PAID FOR
 */
export type EntitlementName =
  // Core
  | 'community_entitled'
  | 'dashboard_entitled'
  | 'check_ins_entitled'
  // Clinical
  | 'dental_entitled'
  | 'sdoh_entitled'
  | 'pharmacy_entitled'
  | 'medications_entitled'
  | 'memory_clinic_entitled'
  | 'mental_health_entitled'
  | 'stroke_assessment_entitled'
  | 'wearable_integration_entitled'
  // Communication
  | 'telehealth_entitled'
  | 'messaging_entitled'
  // Integration
  | 'ehr_integration_entitled'
  | 'fhir_entitled'
  // Advanced
  | 'ai_scribe_entitled'
  | 'claude_care_entitled'
  | 'guardian_monitoring_entitled'
  // NurseOS
  | 'nurseos_clarity_entitled'
  | 'nurseos_shield_entitled'
  | 'resilience_hub_entitled'
  // Population Health
  | 'frequent_flyers_entitled'
  | 'discharge_tracking_entitled'
  // Workflow
  | 'shift_handoff_entitled'
  | 'field_visits_entitled'
  | 'caregiver_portal_entitled'
  | 'time_clock_entitled'
  // Emergency
  | 'ems_metrics_entitled'
  | 'coordinated_response_entitled'
  | 'law_enforcement_entitled'
  // Billing
  | 'billing_integration_entitled'
  | 'rpm_ccm_entitled'
  // Security
  | 'hipaa_audit_logging_entitled'
  | 'mfa_enforcement_entitled'
  // Additional Modules
  | 'physical_therapy_entitled'
  | 'passkey_authentication_entitled'
  | 'voice_command_entitled'
  | 'atlas_revenue_entitled'
  | 'vitals_capture_entitled'
  | 'smart_questionnaires_entitled'
  | 'medication_identifier_entitled'
  | 'clinical_documentation_entitled'
  | 'behavioral_analytics_entitled'
  | 'allergies_immunizations_entitled';

/**
 * Result from get_enabled_modules() RPC function
 */
export interface EnabledModule {
  module_name: string;
  is_enabled: boolean;
}

/**
 * Result from get_module_states() RPC function
 * Includes both entitlement and enabled states
 */
export interface ModuleState {
  module_name: string;
  is_entitled: boolean;
  is_enabled: boolean;
  is_accessible: boolean; // true only if both entitled AND enabled
}

/**
 * Helper to convert ModuleName to EntitlementName
 */
export function getEntitlementName(moduleName: ModuleName): EntitlementName {
  // Replace '_enabled' suffix with '_entitled'
  // Handle special cases like 'hipaa_audit_logging' and 'mfa_enforcement'
  if (moduleName === 'hipaa_audit_logging') {
    return 'hipaa_audit_logging_entitled';
  }
  if (moduleName === 'mfa_enforcement') {
    return 'mfa_enforcement_entitled';
  }
  return moduleName.replace('_enabled', '_entitled') as EntitlementName;
}

/**
 * Partial update payload for tenant module config
 */
export type TenantModuleConfigUpdate = Partial<
  Omit<TenantModuleConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'created_by'>
>;

/**
 * Module metadata for display purposes
 */
export type ModuleCategory =
  | 'core'
  | 'clinical'
  | 'dental'           // Dental-specific suite (separate vertical)
  | 'public_safety'    // Law enforcement, welfare checks (separate vertical)
  | 'communication'
  | 'integration'
  | 'advanced'
  | 'nurseos'
  | 'population_health'
  | 'workflow'
  | 'emergency'
  | 'billing'
  | 'security';

export interface ModuleMetadata {
  key: ModuleName;
  name: string;
  description: string;
  category: ModuleCategory;
  requiredTier: LicenseTier;
  icon?: string;
}

/**
 * All module metadata for UI rendering
 */
export const MODULE_METADATA: Record<ModuleName, Omit<ModuleMetadata, 'key'>> = {
  // Core Platform Modules
  community_enabled: {
    name: 'Community Features',
    description: 'Social engagement, moments, trivia, peer support',
    category: 'core',
    requiredTier: 'basic',
    icon: 'Users',
  },
  dashboard_enabled: {
    name: 'Dashboard',
    description: 'Personalized health dashboard',
    category: 'core',
    requiredTier: 'basic',
    icon: 'LayoutDashboard',
  },
  check_ins_enabled: {
    name: 'Daily Check-Ins',
    description: 'Mood and health status tracking',
    category: 'core',
    requiredTier: 'basic',
    icon: 'CheckCircle',
  },

  // Clinical Modules
  dental_enabled: {
    name: 'Dental Health',
    description: 'Dental assessments, procedures, CDT codes, FHIR integration',
    category: 'dental',
    requiredTier: 'standard',
    icon: 'Smile',
  },
  sdoh_enabled: {
    name: 'SDOH Tracking',
    description: 'Social Determinants of Health: 26 categories, Z-codes',
    category: 'clinical',
    requiredTier: 'standard',
    icon: 'Home',
  },
  pharmacy_enabled: {
    name: 'Pharmacy Integration',
    description: 'Prescription management and pharmacy coordination',
    category: 'clinical',
    requiredTier: 'premium',
    icon: 'Pill',
  },
  medications_enabled: {
    name: 'Medication Management',
    description: 'Medication tracking, reminders, adherence',
    category: 'clinical',
    requiredTier: 'basic',
    icon: 'Pill',
  },
  memory_clinic_enabled: {
    name: 'Memory Clinic',
    description: 'Cognitive assessments, dementia screening, memory care',
    category: 'clinical',
    requiredTier: 'premium',
    icon: 'Brain',
  },
  mental_health_enabled: {
    name: 'Mental Health',
    description: 'Behavioral health assessments, PHQ-9, GAD-7 screening',
    category: 'clinical',
    requiredTier: 'standard',
    icon: 'HeartPulse',
  },
  stroke_assessment_enabled: {
    name: 'Stroke Assessment',
    description: 'FAST screening, stroke risk evaluation, rehab tracking',
    category: 'clinical',
    requiredTier: 'premium',
    icon: 'Activity',
  },
  wearable_integration_enabled: {
    name: 'Wearable Integration',
    description: 'Fitbit, Apple Watch, Garmin data synchronization',
    category: 'clinical',
    requiredTier: 'standard',
    icon: 'Watch',
  },

  // Communication Modules
  telehealth_enabled: {
    name: 'Telehealth',
    description: 'Video consultations and virtual care',
    category: 'communication',
    requiredTier: 'premium',
    icon: 'Video',
  },
  messaging_enabled: {
    name: 'Secure Messaging',
    description: 'HIPAA-compliant patient-provider messaging',
    category: 'communication',
    requiredTier: 'basic',
    icon: 'MessageSquare',
  },

  // Integration Modules
  ehr_integration_enabled: {
    name: 'EHR Integration',
    description: 'Epic, Cerner, Athena adapter connections',
    category: 'integration',
    requiredTier: 'enterprise',
    icon: 'Database',
  },
  fhir_enabled: {
    name: 'FHIR API',
    description: 'HL7 FHIR R4 interoperability',
    category: 'integration',
    requiredTier: 'premium',
    icon: 'Code',
  },

  // Advanced Features
  ai_scribe_enabled: {
    name: 'AI Medical Scribe',
    description: 'Automated clinical documentation',
    category: 'advanced',
    requiredTier: 'premium',
    icon: 'FileText',
  },
  claude_care_enabled: {
    name: 'Claude Care Assistant',
    description: 'AI-powered patient assistance',
    category: 'advanced',
    requiredTier: 'premium',
    icon: 'Bot',
  },
  guardian_monitoring_enabled: {
    name: 'Guardian Monitoring',
    description: 'Automated system health and security monitoring',
    category: 'advanced',
    requiredTier: 'enterprise',
    icon: 'Shield',
  },

  // NurseOS Modules
  nurseos_clarity_enabled: {
    name: 'NurseOS Clarity',
    description: 'Community health worker burnout prevention',
    category: 'nurseos',
    requiredTier: 'premium',
    icon: 'Heart',
  },
  nurseos_shield_enabled: {
    name: 'NurseOS Shield',
    description: 'Hospital nurse wellness and resilience',
    category: 'nurseos',
    requiredTier: 'premium',
    icon: 'Shield',
  },
  resilience_hub_enabled: {
    name: 'Resilience Hub',
    description: 'Provider wellness resources and support',
    category: 'nurseos',
    requiredTier: 'standard',
    icon: 'Heart',
  },

  // Population Health Modules
  frequent_flyers_enabled: {
    name: 'Frequent Flyers',
    description: 'High utilizer tracking, care management, intervention alerts',
    category: 'population_health',
    requiredTier: 'standard',
    icon: 'TrendingUp',
  },
  discharge_tracking_enabled: {
    name: 'Discharge Tracking',
    description: 'Hospital discharge follow-up, readmission prevention',
    category: 'population_health',
    requiredTier: 'standard',
    icon: 'ClipboardCheck',
  },

  // Workflow Modules
  shift_handoff_enabled: {
    name: 'Shift Handoff',
    description: 'Nurse shift change documentation, critical info transfer',
    category: 'workflow',
    requiredTier: 'standard',
    icon: 'ArrowRightLeft',
  },
  field_visits_enabled: {
    name: 'Field Visits',
    description: 'CHW home visit scheduling, documentation, GPS tracking',
    category: 'workflow',
    requiredTier: 'standard',
    icon: 'MapPin',
  },
  caregiver_portal_enabled: {
    name: 'Caregiver Portal',
    description: 'Family caregiver access, care coordination, updates',
    category: 'workflow',
    requiredTier: 'basic',
    icon: 'Users',
  },
  time_clock_enabled: {
    name: 'Time Clock',
    description: 'Employee time tracking, clock in/out, payroll hours, streak gamification',
    category: 'workflow',
    requiredTier: 'standard',
    icon: 'Clock',
  },

  // Emergency Modules
  ems_metrics_enabled: {
    name: 'EMS Metrics',
    description: 'Emergency medical services integration, response tracking',
    category: 'emergency',
    requiredTier: 'premium',
    icon: 'Siren',
  },
  coordinated_response_enabled: {
    name: 'Coordinated Response',
    description: 'Multi-agency emergency coordination, incident management',
    category: 'emergency',
    requiredTier: 'enterprise',
    icon: 'Radio',
  },
  law_enforcement_enabled: {
    name: 'Law Enforcement',
    description: 'Welfare check coordination, Precinct 3 integration',
    category: 'public_safety',
    requiredTier: 'premium',
    icon: 'Shield',
  },

  // Billing & Revenue Modules
  billing_integration_enabled: {
    name: 'Billing Integration',
    description: 'Revenue cycle and claims management',
    category: 'billing',
    requiredTier: 'premium',
    icon: 'DollarSign',
  },
  rpm_ccm_enabled: {
    name: 'RPM/CCM Billing',
    description: 'Remote Patient Monitoring & Chronic Care Management billing',
    category: 'billing',
    requiredTier: 'premium',
    icon: 'Activity',
  },

  // Security & Compliance
  hipaa_audit_logging: {
    name: 'HIPAA Audit Logging',
    description: 'Comprehensive PHI access audit trails',
    category: 'security',
    requiredTier: 'standard',
    icon: 'FileSearch',
  },
  mfa_enforcement: {
    name: 'MFA Enforcement',
    description: 'Require multi-factor authentication for all users',
    category: 'security',
    requiredTier: 'standard',
    icon: 'Lock',
  },

  // Additional Modules
  physical_therapy_enabled: {
    name: 'Physical Therapy',
    description: 'PT treatment plans, assessments, sessions, exercise library',
    category: 'clinical',
    requiredTier: 'premium',
    icon: 'Dumbbell',
  },
  passkey_authentication_enabled: {
    name: 'Passkey Authentication',
    description: 'WebAuthn passwordless authentication for enhanced security',
    category: 'security',
    requiredTier: 'standard',
    icon: 'Fingerprint',
  },
  voice_command_enabled: {
    name: 'Voice Commands',
    description: 'Voice-activated controls, voice profiles, speech recognition',
    category: 'advanced',
    requiredTier: 'premium',
    icon: 'Mic',
  },
  atlas_revenue_enabled: {
    name: 'Atlas Revenue',
    description: 'Claims submission, appeals, coding suggestions, revenue optimization',
    category: 'billing',
    requiredTier: 'enterprise',
    icon: 'TrendingUp',
  },
  vitals_capture_enabled: {
    name: 'Vitals Capture',
    description: 'Mobile vitals recording, CHW field data collection',
    category: 'clinical',
    requiredTier: 'standard',
    icon: 'HeartPulse',
  },
  smart_questionnaires_enabled: {
    name: 'SMART Questionnaires',
    description: 'SMART on FHIR questionnaire integration, clinical forms',
    category: 'integration',
    requiredTier: 'premium',
    icon: 'ClipboardList',
  },
  medication_identifier_enabled: {
    name: 'Medication Identifier',
    description: 'Pill identification, medication photo capture, label reading',
    category: 'clinical',
    requiredTier: 'premium',
    icon: 'Camera',
  },
  clinical_documentation_enabled: {
    name: 'Clinical Documentation',
    description: 'SOAP notes, clinical note templates, encounter documentation',
    category: 'clinical',
    requiredTier: 'standard',
    icon: 'FileText',
  },
  behavioral_analytics_enabled: {
    name: 'Behavioral Analytics',
    description: 'User behavior tracking, psychometric analysis, engagement metrics',
    category: 'advanced',
    requiredTier: 'premium',
    icon: 'BarChart',
  },
  allergies_immunizations_enabled: {
    name: 'Allergies & Immunizations',
    description: 'Allergy management, immunization records, health history',
    category: 'clinical',
    requiredTier: 'basic',
    icon: 'Syringe',
  },
};
