/**
 * useModuleAccess Hook
 *
 * UNIFIED module access hook - the ONE way to check if a feature is available.
 *
 * This hook combines:
 * - Entitlement check (has tenant paid for this module?)
 * - Active state check (has tenant admin enabled this module?)
 *
 * A module is accessible ONLY if: entitled=true AND enabled=true
 *
 * @example
 * // Check single module
 * const { canAccess, loading } = useModuleAccess('dental_enabled');
 * if (loading) return <Spinner />;
 * if (!canAccess) return <UpgradePrompt module="dental_enabled" />;
 * return <DentalDashboard />;
 *
 * @example
 * // Check multiple modules
 * const { canAccessAll, canAccessAny } = useModuleAccessMultiple([
 *   'dental_enabled',
 *   'sdoh_enabled'
 * ]);
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ModuleName, TenantModuleConfig } from '../types/tenantModules';
import { getEntitlementName, MODULE_METADATA } from '../types/tenantModules';
import { getTenantModuleConfig } from '../services/tenantModuleService';

export interface ModuleAccessResult {
  /** Whether the module can be accessed (entitled AND enabled) */
  canAccess: boolean;
  /** Whether the tenant is entitled to this module (paid for it) */
  isEntitled: boolean;
  /** Whether the module is enabled (tenant admin turned it on) */
  isEnabled: boolean;
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Reason why access is denied (for UI messaging) */
  denialReason: 'loading' | 'not_entitled' | 'not_enabled' | 'no_config' | null;
  /** Refresh the access state */
  refresh: () => Promise<void>;
}

export interface MultipleModuleAccessResult {
  /** Map of module name to access state */
  modules: Record<string, boolean>;
  /** Whether ALL specified modules are accessible */
  canAccessAll: boolean;
  /** Whether ANY of the specified modules are accessible */
  canAccessAny: boolean;
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh all module states */
  refresh: () => Promise<void>;
}

/**
 * Check access to a single module
 *
 * @param moduleName - The module to check (e.g., 'dental_enabled')
 * @returns ModuleAccessResult with access state and helpers
 */
export function useModuleAccess(moduleName: ModuleName): ModuleAccessResult {
  const [config, setConfig] = useState<TenantModuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const configData = await getTenantModuleConfig();
      // null config is OK - means tenant doesn't have config yet, use defaults
      setConfig(configData);
    } catch (err) {
      // Don't treat as fatal error - log but allow graceful degradation
      const error = err instanceof Error ? err : new Error('Failed to load module config');
      setError(error);
      // Set empty config to allow access checks to proceed with defaults
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accessState = useMemo(() => {
    if (loading) {
      return {
        canAccess: false,
        isEntitled: false,
        isEnabled: false,
        denialReason: 'loading' as const,
      };
    }

    if (!config) {
      return {
        canAccess: false,
        isEntitled: false,
        isEnabled: false,
        denialReason: 'no_config' as const,
      };
    }

    // Check entitlement (what they paid for)
    const entitlementName = getEntitlementName(moduleName);
    const isEntitled = (config as unknown as Record<string, boolean>)[entitlementName] ?? false;

    // Check enabled state (what they turned on)
    const isEnabled = config[moduleName] ?? false;

    // Access requires BOTH
    const canAccess = isEntitled && isEnabled;

    let denialReason: ModuleAccessResult['denialReason'] = null;
    if (!canAccess) {
      if (!isEntitled) {
        denialReason = 'not_entitled';
      } else if (!isEnabled) {
        denialReason = 'not_enabled';
      }
    }

    return {
      canAccess,
      isEntitled,
      isEnabled,
      denialReason,
    };
  }, [config, loading, moduleName]);

  return {
    ...accessState,
    loading,
    error,
    refresh,
  };
}

/**
 * Check access to multiple modules at once
 *
 * @param moduleNames - Array of module names to check
 * @returns MultipleModuleAccessResult with access states for all modules
 */
export function useModuleAccessMultiple(moduleNames: ModuleName[]): MultipleModuleAccessResult {
  const [config, setConfig] = useState<TenantModuleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const configData = await getTenantModuleConfig();
      setConfig(configData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load module config');
      setError(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accessState = useMemo(() => {
    if (!config) {
      const modules: Record<string, boolean> = {};
      moduleNames.forEach(name => {
        modules[name] = false;
      });
      return {
        modules,
        canAccessAll: false,
        canAccessAny: false,
      };
    }

    const modules: Record<string, boolean> = {};

    moduleNames.forEach(moduleName => {
      const entitlementName = getEntitlementName(moduleName);
      const isEntitled = (config as unknown as Record<string, boolean>)[entitlementName] ?? false;
      const isEnabled = config[moduleName] ?? false;
      modules[moduleName] = isEntitled && isEnabled;
    });

    const accessValues = Object.values(modules);
    const canAccessAll = accessValues.length > 0 && accessValues.every(Boolean);
    const canAccessAny = accessValues.some(Boolean);

    return {
      modules,
      canAccessAll,
      canAccessAny,
    };
  }, [config, moduleNames]);

  return {
    ...accessState,
    loading,
    error,
    refresh,
  };
}

/**
 * Get module metadata (name, description, icon, etc.)
 *
 * @param moduleName - The module to get metadata for
 * @returns Module metadata or undefined if not found
 */
export function useModuleMetadata(moduleName: ModuleName) {
  return MODULE_METADATA[moduleName];
}

export default useModuleAccess;
