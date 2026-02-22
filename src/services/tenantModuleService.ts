/**
 * Tenant Module Configuration Service
 *
 * Provides functions to check and manage tenant-level module configuration.
 * Used to enforce feature flags at the application level.
 *
 * @see supabase/migrations/20251111000000_tenant_module_configuration.sql
 * @see src/types/tenantModules.ts
 */

import { supabase } from '../lib/supabaseClient';
import type {
  TenantModuleConfig,
  ModuleName,
  EnabledModule,
  TenantModuleConfigUpdate,
} from '../types/tenantModules';
import { withServiceWrapper } from './_base';

/**
 * Check if a specific module is enabled for the current tenant
 *
 * @param moduleName - The module to check (e.g., 'dental_enabled')
 * @param tenantId - Optional tenant ID (defaults to current user's tenant)
 * @returns Promise<ServiceResult<boolean>> - Result with enabled status
 *
 * @example
 * const result = await isModuleEnabledResult('dental_enabled');
 * if (result.success && result.data) {
 *   // Show dental features
 * }
 */
export const isModuleEnabledResult = withServiceWrapper(
  async (moduleName: ModuleName, tenantId?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('is_module_enabled', {
      p_module_name: moduleName,
      p_tenant_id: tenantId || null,
    });

    if (error) throw error;
    return data ?? false;
  },
  { operationName: 'isModuleEnabled' }
);

/**
 * Check if a specific module is enabled for the current tenant (legacy)
 * @deprecated Use isModuleEnabledResult for better error handling
 */
export async function isModuleEnabled(
  moduleName: ModuleName,
  tenantId?: string
): Promise<boolean> {
  const result = await isModuleEnabledResult(moduleName, tenantId);
  return result.success ? result.data : false;
}

/**
 * Get all enabled modules for the current tenant
 *
 * @param tenantId - Optional tenant ID (defaults to current user's tenant)
 * @returns Promise<ServiceResult<EnabledModule[]>> - Result with modules array
 *
 * @example
 * const result = await getEnabledModulesResult();
 * if (result.success) {
 *   // result.data is an array of { module_name, is_enabled }
 * }
 */
export const getEnabledModulesResult = withServiceWrapper(
  async (tenantId?: string): Promise<EnabledModule[]> => {
    const { data, error } = await supabase.rpc('get_enabled_modules', {
      p_tenant_id: tenantId || null,
    });

    if (error) throw error;
    return data || [];
  },
  { operationName: 'getEnabledModules' }
);

/**
 * Get all enabled modules for the current tenant (legacy)
 * @deprecated Use getEnabledModulesResult for better error handling
 */
export async function getEnabledModules(
  tenantId?: string
): Promise<EnabledModule[]> {
  const result = await getEnabledModulesResult(tenantId);
  return result.success ? result.data : [];
}

/**
 * Get the full tenant module configuration for the current tenant
 *
 * @returns Promise<ServiceResult<TenantModuleConfig | null>> - Result with config or null
 *
 * @example
 * const result = await getTenantModuleConfigResult();
 * if (result.success && result.data?.dental_enabled) {
 *   // Show dental features
 * }
 */
export const getTenantModuleConfigResult = withServiceWrapper(
  async (): Promise<TenantModuleConfig | null> => {
    // First, get the current user's tenant_id from their profile
    // This is necessary because super_admins can see ALL tenant configs via RLS
    // but we want to return only THEIR tenant's config
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      // User has no profile or no tenant - return null
      return null;
    }

    // Now fetch the config for THIS user's tenant specifically
    const { data, error } = await supabase
      .from('tenant_module_config')
      .select('id, tenant_id, community_enabled, dashboard_enabled, check_ins_enabled, dental_enabled, sdoh_enabled, pharmacy_enabled, medications_enabled, memory_clinic_enabled, mental_health_enabled, stroke_assessment_enabled, wearable_integration_enabled, telehealth_enabled, messaging_enabled, ehr_integration_enabled, fhir_enabled, ai_scribe_enabled, claude_care_enabled, guardian_monitoring_enabled, nurseos_clarity_enabled, nurseos_shield_enabled, resilience_hub_enabled, frequent_flyers_enabled, discharge_tracking_enabled, shift_handoff_enabled, field_visits_enabled, caregiver_portal_enabled, time_clock_enabled, ems_metrics_enabled, coordinated_response_enabled, law_enforcement_enabled, billing_integration_enabled, rpm_ccm_enabled, hipaa_audit_logging, mfa_enforcement, physical_therapy_enabled, passkey_authentication_enabled, voice_command_enabled, atlas_revenue_enabled, vitals_capture_enabled, smart_questionnaires_enabled, medication_identifier_enabled, clinical_documentation_enabled, behavioral_analytics_enabled, allergies_immunizations_enabled, community_entitled, dashboard_entitled, check_ins_entitled, dental_entitled, sdoh_entitled, pharmacy_entitled, medications_entitled, memory_clinic_entitled, mental_health_entitled, stroke_assessment_entitled, wearable_integration_entitled, telehealth_entitled, messaging_entitled, ehr_integration_entitled, fhir_entitled, ai_scribe_entitled, claude_care_entitled, guardian_monitoring_entitled, nurseos_clarity_entitled, nurseos_shield_entitled, resilience_hub_entitled, frequent_flyers_entitled, discharge_tracking_entitled, shift_handoff_entitled, field_visits_entitled, caregiver_portal_entitled, time_clock_entitled, ems_metrics_entitled, coordinated_response_entitled, law_enforcement_entitled, billing_integration_entitled, rpm_ccm_entitled, hipaa_audit_logging_entitled, mfa_enforcement_entitled, physical_therapy_entitled, passkey_authentication_entitled, voice_command_entitled, atlas_revenue_entitled, vitals_capture_entitled, smart_questionnaires_entitled, medication_identifier_entitled, clinical_documentation_entitled, behavioral_analytics_entitled, allergies_immunizations_entitled, license_tier, custom_modules, created_at, updated_at, created_by, updated_by, entitlements_updated_at, entitlements_updated_by')
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (error) {
      // Not found is expected for tenants without config yet
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as TenantModuleConfig;
  },
  { operationName: 'getTenantModuleConfig' }
);

/**
 * Get the full tenant module configuration for the current tenant (legacy)
 * @deprecated Use getTenantModuleConfigResult for better error handling
 */
export async function getTenantModuleConfig(): Promise<TenantModuleConfig | null> {
  const result = await getTenantModuleConfigResult();
  return result.success ? result.data : null;
}

/**
 * Update tenant module configuration (admin only)
 *
 * @param updates - Partial config object with fields to update
 * @returns Promise<ServiceResult<TenantModuleConfig>> - Result with updated config
 *
 * @example
 * const result = await updateTenantModuleConfigResult({
 *   dental_enabled: true,
 *   sdoh_enabled: true,
 *   license_tier: 'premium'
 * });
 * if (result.success) {
 *   // Config updated successfully
 * }
 */
export const updateTenantModuleConfigResult = withServiceWrapper(
  async (updates: TenantModuleConfigUpdate): Promise<TenantModuleConfig> => {
    // Get current user to set updated_by
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('tenant_module_config')
      .update({
        ...updates,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data as TenantModuleConfig;
  },
  { operationName: 'updateTenantModuleConfig' }
);

/**
 * Update tenant module configuration (admin only) (legacy)
 * @deprecated Use updateTenantModuleConfigResult for better error handling
 */
export async function updateTenantModuleConfig(
  updates: TenantModuleConfigUpdate
): Promise<TenantModuleConfig | null> {
  const result = await updateTenantModuleConfigResult(updates);
  return result.success ? result.data : null;
}

/**
 * Check multiple modules at once
 *
 * @param moduleNames - Array of module names to check
 * @returns Promise<ServiceResult<Record<string, boolean>>> - Result with module status map
 *
 * @example
 * const result = await checkModulesResult(['dental_enabled', 'sdoh_enabled', 'telehealth_enabled']);
 * if (result.success && result.data.dental_enabled && result.data.sdoh_enabled) {
 *   // Both enabled
 * }
 */
export const checkModulesResult = withServiceWrapper(
  async (moduleNames: ModuleName[]): Promise<Record<string, boolean>> => {
    const config = await getTenantModuleConfig();

    if (!config) {
      // Return all false if no config found
      return moduleNames.reduce((acc, name) => {
        acc[name] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }

    return moduleNames.reduce((acc, name) => {
      acc[name] = config[name] ?? false;
      return acc;
    }, {} as Record<string, boolean>);
  },
  { operationName: 'checkModules' }
);

/**
 * Check multiple modules at once (legacy)
 * @deprecated Use checkModulesResult for better error handling
 */
export async function checkModules(
  moduleNames: ModuleName[]
): Promise<Record<string, boolean>> {
  const result = await checkModulesResult(moduleNames);
  if (result.success) return result.data;

  // On error, return all false
  return moduleNames.reduce((acc, name) => {
    acc[name] = false;
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Create tenant module configuration (system admin only)
 * Used during tenant provisioning
 *
 * @param tenantId - The tenant ID to create config for
 * @param config - Initial configuration (optional, uses defaults if not provided)
 * @returns Promise<ServiceResult<TenantModuleConfig>> - Result with created config
 */
export const createTenantModuleConfigResult = withServiceWrapper(
  async (tenantId: string, config?: Partial<TenantModuleConfig>): Promise<TenantModuleConfig> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('tenant_module_config')
      .insert({
        tenant_id: tenantId,
        created_by: user.id,
        updated_by: user.id,
        ...config,
      })
      .select()
      .single();

    if (error) throw error;
    return data as TenantModuleConfig;
  },
  { operationName: 'createTenantModuleConfig' }
);

/**
 * Create tenant module configuration (legacy)
 * @deprecated Use createTenantModuleConfigResult for better error handling
 */
export async function createTenantModuleConfig(
  tenantId: string,
  config?: Partial<TenantModuleConfig>
): Promise<TenantModuleConfig | null> {
  const result = await createTenantModuleConfigResult(tenantId, config);
  return result.success ? result.data : null;
}

/**
 * Get enabled modules as a simple object for easy checking
 *
 * @returns Promise<ServiceResult<Record<string, boolean>>> - Result with module map
 *
 * @example
 * const result = await getEnabledModulesMapResult();
 * if (result.success && result.data.dental_enabled) {
 *   // Dental is enabled
 * }
 */
export const getEnabledModulesMapResult = withServiceWrapper(
  async (): Promise<Record<string, boolean>> => {
    const modules = await getEnabledModules();

    return modules.reduce((acc, module) => {
      acc[module.module_name] = module.is_enabled;
      return acc;
    }, {} as Record<string, boolean>);
  },
  { operationName: 'getEnabledModulesMap' }
);

/**
 * Get enabled modules as a simple object for easy checking (legacy)
 * @deprecated Use getEnabledModulesMapResult for better error handling
 */
export async function getEnabledModulesMap(): Promise<Record<string, boolean>> {
  const result = await getEnabledModulesMapResult();
  return result.success ? result.data : {};
}
