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

  // Billing & Revenue Modules - Active State
  billing_integration_enabled: boolean;
  rpm_ccm_enabled: boolean; // Remote Patient Monitoring / Chronic Care Management

  // Security & Compliance - Active State
  hipaa_audit_logging: boolean;
  mfa_enforcement: boolean;

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

  // Billing & Revenue Modules - Entitlements
  billing_integration_entitled: boolean;
  rpm_ccm_entitled: boolean;

  // Security & Compliance - Entitlements
  hipaa_audit_logging_entitled: boolean;
  mfa_enforcement_entitled: boolean;

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
  | 'community_enabled'
  | 'dashboard_enabled'
  | 'check_ins_enabled'
  | 'dental_enabled'
  | 'sdoh_enabled'
  | 'pharmacy_enabled'
  | 'medications_enabled'
  | 'telehealth_enabled'
  | 'messaging_enabled'
  | 'ehr_integration_enabled'
  | 'fhir_enabled'
  | 'ai_scribe_enabled'
  | 'claude_care_enabled'
  | 'guardian_monitoring_enabled'
  | 'nurseos_clarity_enabled'
  | 'nurseos_shield_enabled'
  | 'resilience_hub_enabled'
  | 'billing_integration_enabled'
  | 'rpm_ccm_enabled'
  | 'hipaa_audit_logging'
  | 'mfa_enforcement';

/**
 * Entitlement names (SuperAdmin controls)
 * These represent what the tenant has PAID FOR
 */
export type EntitlementName =
  | 'community_entitled'
  | 'dashboard_entitled'
  | 'check_ins_entitled'
  | 'dental_entitled'
  | 'sdoh_entitled'
  | 'pharmacy_entitled'
  | 'medications_entitled'
  | 'telehealth_entitled'
  | 'messaging_entitled'
  | 'ehr_integration_entitled'
  | 'fhir_entitled'
  | 'ai_scribe_entitled'
  | 'claude_care_entitled'
  | 'guardian_monitoring_entitled'
  | 'nurseos_clarity_entitled'
  | 'nurseos_shield_entitled'
  | 'resilience_hub_entitled'
  | 'billing_integration_entitled'
  | 'rpm_ccm_entitled'
  | 'hipaa_audit_logging_entitled'
  | 'mfa_enforcement_entitled';

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
export interface ModuleMetadata {
  key: ModuleName;
  name: string;
  description: string;
  category: 'core' | 'clinical' | 'communication' | 'integration' | 'advanced' | 'nurseos' | 'billing' | 'security';
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
    category: 'clinical',
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
};
