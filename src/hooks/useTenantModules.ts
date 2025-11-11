/**
 * useTenantModules Hook
 *
 * React hook for accessing tenant module configuration.
 * Provides easy access to feature flags in React components.
 *
 * @example
 * function DentalFeature() {
 *   const { isEnabled, loading } = useTenantModules();
 *
 *   if (loading) return <Spinner />;
 *   if (!isEnabled('dental_enabled')) return null;
 *
 *   return <DentalHealthDashboard />;
 * }
 */

import { useState, useEffect, useCallback } from 'react';
import type { TenantModuleConfig, ModuleName } from '../types/tenantModules';
import {
  getTenantModuleConfig,
  isModuleEnabled as checkModuleEnabled,
  getEnabledModulesMap,
} from '../services/tenantModuleService';

interface UseTenantModulesReturn {
  /**
   * Full tenant module configuration
   */
  config: TenantModuleConfig | null;

  /**
   * Map of module names to enabled status for quick lookups
   */
  enabledModules: Record<string, boolean>;

  /**
   * Check if a specific module is enabled
   */
  isEnabled: (moduleName: ModuleName) => boolean;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Error state
   */
  error: Error | null;

  /**
   * Refresh the configuration from the database
   */
  refresh: () => Promise<void>;
}

/**
 * Hook to access tenant module configuration
 *
 * @returns {UseTenantModulesReturn} Tenant module configuration state and helpers
 *
 * @example
 * // Simple check
 * const { isEnabled } = useTenantModules();
 * if (isEnabled('dental_enabled')) {
 *   // Show dental features
 * }
 *
 * @example
 * // Full config access
 * const { config, loading } = useTenantModules();
 * if (config?.license_tier === 'enterprise') {
 *   // Show enterprise features
 * }
 *
 * @example
 * // Check multiple modules
 * const { enabledModules } = useTenantModules();
 * const hasAdvancedFeatures = enabledModules.ai_scribe_enabled &&
 *                              enabledModules.claude_care_enabled;
 */
export function useTenantModules(): UseTenantModulesReturn {
  const [config, setConfig] = useState<TenantModuleConfig | null>(null);
  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both config and enabled modules map in parallel
      const [configData, modulesMap] = await Promise.all([
        getTenantModuleConfig(),
        getEnabledModulesMap(),
      ]);

      setConfig(configData);
      setEnabledModules(modulesMap);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load tenant modules');
      setError(error);
      // Error logged server-side, set state only
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const isEnabled = useCallback(
    (moduleName: ModuleName): boolean => {
      // First try from enabledModules map (fastest)
      if (enabledModules[moduleName] !== undefined) {
        return enabledModules[moduleName];
      }

      // Fallback to config object
      if (config && moduleName in config) {
        return config[moduleName] ?? false;
      }

      // Default to false if not found
      return false;
    },
    [config, enabledModules]
  );

  return {
    config,
    enabledModules,
    isEnabled,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook to check a single module (optimized for single checks)
 *
 * @param moduleName - The module to check
 * @returns Object with isEnabled boolean and loading state
 *
 * @example
 * const { isEnabled, loading } = useTenantModule('dental_enabled');
 * if (loading) return <Spinner />;
 * if (!isEnabled) return <UpgradePrompt />;
 * return <DentalDashboard />;
 */
export function useTenantModule(moduleName: ModuleName) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkModule = async () => {
      try {
        setLoading(true);
        setError(null);

        const enabled = await checkModuleEnabled(moduleName);

        if (isMounted) {
          setIsEnabled(enabled);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to check module');
        if (isMounted) {
          setError(error);
          // Error logged server-side, set state only
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkModule();

    return () => {
      isMounted = false;
    };
  }, [moduleName]);

  return { isEnabled, loading, error };
}

/**
 * Hook to check multiple modules at once
 *
 * @param moduleNames - Array of module names to check
 * @returns Object with modules map, loading state, and error
 *
 * @example
 * const { modules, loading } = useTenantModuleCheck([
 *   'dental_enabled',
 *   'sdoh_enabled',
 *   'telehealth_enabled'
 * ]);
 *
 * if (modules.dental_enabled && modules.sdoh_enabled) {
 *   // Both enabled
 * }
 */
export function useTenantModuleCheck(moduleNames: ModuleName[]) {
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkModules = async () => {
      try {
        setLoading(true);
        setError(null);

        const results: Record<string, boolean> = {};

        // Check all modules in parallel
        await Promise.all(
          moduleNames.map(async (moduleName) => {
            const enabled = await checkModuleEnabled(moduleName);
            results[moduleName] = enabled;
          })
        );

        if (isMounted) {
          setModules(results);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to check modules');
        if (isMounted) {
          setError(error);
          // Error logged server-side, set state only
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkModules();

    return () => {
      isMounted = false;
    };
  }, [moduleNames]);

  return { modules, loading, error };
}
