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

/**
 * Check if a specific module is enabled for the current tenant
 *
 * @param moduleName - The module to check (e.g., 'dental_enabled')
 * @param tenantId - Optional tenant ID (defaults to current user's tenant)
 * @returns Promise<boolean> - True if enabled, false otherwise
 *
 * @example
 * const isDentalEnabled = await isModuleEnabled('dental_enabled');
 * if (isDentalEnabled) {
 *   // Show dental features
 * }
 */
export async function isModuleEnabled(
  moduleName: ModuleName,
  tenantId?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_module_enabled', {
      p_module_name: moduleName,
      p_tenant_id: tenantId || null,
    });

    if (error) {
      // Error logged server-side, fail silently on client
      return false;
    }

    return data ?? false;
  } catch (error) {
    // Error logged server-side, fail silently on client
    return false;
  }
}

/**
 * Get all enabled modules for the current tenant
 *
 * @param tenantId - Optional tenant ID (defaults to current user's tenant)
 * @returns Promise<EnabledModule[]> - Array of modules with their enabled status
 *
 * @example
 * const modules = await getEnabledModules();
 * // modules is an array of { module_name, is_enabled }
 */
export async function getEnabledModules(
  tenantId?: string
): Promise<EnabledModule[]> {
  try {
    const { data, error } = await supabase.rpc('get_enabled_modules', {
      p_tenant_id: tenantId || null,
    });

    if (error) {
      // Error logged server-side, fail silently on client
      return [];
    }

    return data || [];
  } catch (error) {
    // Error logged server-side, fail silently on client
    return [];
  }
}

/**
 * Get the full tenant module configuration for the current tenant
 *
 * @returns Promise<TenantModuleConfig | null> - The configuration or null if not found
 *
 * @example
 * const config = await getTenantModuleConfig();
 * if (config?.dental_enabled) {
 *   // Show dental features
 * }
 */
export async function getTenantModuleConfig(): Promise<TenantModuleConfig | null> {
  try {
    const { data, error } = await supabase
      .from('tenant_module_config')
      .select('*')
      .single();

    if (error) {
      // Not found is expected for tenants without config yet
      if (error.code === 'PGRST116') {
        return null;
      }
      // Error logged server-side, fail silently on client
      return null;
    }

    return data as TenantModuleConfig;
  } catch (error) {
    // Error logged server-side, fail silently on client
    return null;
  }
}

/**
 * Update tenant module configuration (admin only)
 *
 * @param updates - Partial config object with fields to update
 * @returns Promise<TenantModuleConfig | null> - Updated config or null on error
 *
 * @example
 * const updated = await updateTenantModuleConfig({
 *   dental_enabled: true,
 *   sdoh_enabled: true,
 *   license_tier: 'premium'
 * });
 */
export async function updateTenantModuleConfig(
  updates: TenantModuleConfigUpdate
): Promise<TenantModuleConfig | null> {
  try {
    // Get current user to set updated_by
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // No user, return null
      return null;
    }

    const { data, error } = await supabase
      .from('tenant_module_config')
      .update({
        ...updates,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      // Error logged server-side, fail silently on client
      return null;
    }

    return data as TenantModuleConfig;
  } catch (error) {
    // Error logged server-side, fail silently on client
    return null;
  }
}

/**
 * Check multiple modules at once
 *
 * @param moduleNames - Array of module names to check
 * @returns Promise<Record<ModuleName, boolean>> - Object mapping module names to enabled status
 *
 * @example
 * const modules = await checkModules(['dental_enabled', 'sdoh_enabled', 'telehealth_enabled']);
 * if (modules.dental_enabled && modules.sdoh_enabled) {
 *   // Both enabled
 * }
 */
export async function checkModules(
  moduleNames: ModuleName[]
): Promise<Record<string, boolean>> {
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
}

/**
 * Create tenant module configuration (system admin only)
 * Used during tenant provisioning
 *
 * @param tenantId - The tenant ID to create config for
 * @param config - Initial configuration (optional, uses defaults if not provided)
 * @returns Promise<TenantModuleConfig | null>
 */
export async function createTenantModuleConfig(
  tenantId: string,
  config?: Partial<TenantModuleConfig>
): Promise<TenantModuleConfig | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // No user, return null
      return null;
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

    if (error) {
      // Error logged server-side, fail silently on client
      return null;
    }

    return data as TenantModuleConfig;
  } catch (error) {
    // Error logged server-side, fail silently on client
    return null;
  }
}

/**
 * Get enabled modules as a simple object for easy checking
 *
 * @returns Promise<Record<ModuleName, boolean>>
 *
 * @example
 * const enabled = await getEnabledModulesMap();
 * if (enabled.dental_enabled) {
 *   // Dental is enabled
 * }
 */
export async function getEnabledModulesMap(): Promise<Record<string, boolean>> {
  const modules = await getEnabledModules();

  return modules.reduce((acc, module) => {
    acc[module.module_name] = module.is_enabled;
    return acc;
  }, {} as Record<string, boolean>);
}
