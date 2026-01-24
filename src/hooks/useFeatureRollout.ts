/**
 * useFeatureRollout Hook
 *
 * Purpose: Check feature flag status for current user
 * Features: Percentage-based rollout, caching, beta programs
 * Usage: const { isEnabled, isLoading } = useFeatureRollout('feature_key');
 *
 * @module hooks/useFeatureRollout
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { rolloutService } from '../services/rolloutService';

// =============================================================================
// TYPES
// =============================================================================

export interface UseFeatureRolloutResult {
  isEnabled: boolean;
  isLoading: boolean;
  error: Error | null;
  reason: string | null;
  refresh: () => Promise<void>;
}

export interface UseFeatureRolloutsResult {
  features: Record<string, boolean>;
  isLoading: boolean;
  error: Error | null;
  isEnabled: (featureKey: string) => boolean;
  refresh: () => Promise<void>;
}

// Local cache for feature flags
const featureCache = new Map<string, { enabled: boolean; reason: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// SINGLE FEATURE HOOK
// =============================================================================

/**
 * Hook to check if a single feature is enabled for the current user
 *
 * @example
 * const { isEnabled, isLoading } = useFeatureRollout('new_dashboard');
 * if (isEnabled) {
 *   return <NewDashboard />;
 * }
 */
export function useFeatureRollout(featureKey: string): UseFeatureRolloutResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    // Check local cache first
    const cached = featureCache.get(featureKey);
    if (cached && cached.expiresAt > Date.now()) {
      setIsEnabled(cached.enabled);
      setReason(cached.reason);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsEnabled(false);
        setReason('no_user');
        setIsLoading(false);
        return;
      }

      // Get user's tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      const result = await rolloutService.evaluateFeature(
        user.id,
        featureKey,
        profile?.tenant_id
      );

      if (result.success) {
        const { enabled, reason: evalReason } = result.data;
        setIsEnabled(enabled);
        setReason(evalReason);

        // Update cache
        featureCache.set(featureKey, {
          enabled,
          reason: evalReason,
          expiresAt: Date.now() + CACHE_TTL,
        });
      } else {
        setError(new Error(result.error.message));
        setIsEnabled(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, [featureKey]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const refresh = useCallback(async () => {
    featureCache.delete(featureKey);
    await evaluate();
  }, [featureKey, evaluate]);

  return {
    isEnabled,
    isLoading,
    error,
    reason,
    refresh,
  };
}

// =============================================================================
// MULTIPLE FEATURES HOOK
// =============================================================================

/**
 * Hook to check multiple features at once
 *
 * @example
 * const { isEnabled, isLoading } = useFeatureRollouts(['feature_a', 'feature_b']);
 * if (isEnabled('feature_a')) {
 *   // show feature A
 * }
 */
export function useFeatureRollouts(featureKeys: string[]): UseFeatureRolloutsResult {
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const memoizedKeys = useMemo(() => featureKeys.sort().join(','), [featureKeys]);

  const evaluate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFeatures({});
        setIsLoading(false);
        return;
      }

      // Get user's tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      const result = await rolloutService.getUserFeatures(user.id, profile?.tenant_id);

      if (result.success) {
        setFeatures(result.data);

        // Update cache for individual features
        for (const [key, enabled] of Object.entries(result.data)) {
          featureCache.set(key, {
            enabled,
            reason: 'batch_loaded',
            expiresAt: Date.now() + CACHE_TTL,
          });
        }
      } else {
        setError(new Error(result.error.message));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- memoizedKeys triggers re-evaluation when feature keys change
  }, [memoizedKeys]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const isEnabled = useCallback(
    (featureKey: string): boolean => {
      return features[featureKey] ?? false;
    },
    [features]
  );

  const refresh = useCallback(async () => {
    for (const key of featureKeys) {
      featureCache.delete(key);
    }
    await evaluate();
  }, [featureKeys, evaluate]);

  return {
    features,
    isLoading,
    error,
    isEnabled,
    refresh,
  };
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Hook that returns true only if feature is enabled (convenience wrapper)
 */
export function useFeatureEnabled(featureKey: string): boolean {
  const { isEnabled, isLoading } = useFeatureRollout(featureKey);
  return !isLoading && isEnabled;
}

/**
 * Hook to check if user is in a specific beta program
 */
export function useIsBetaUser(programKey: string): {
  isBeta: boolean;
  isLoading: boolean;
} {
  const [isBeta, setIsBeta] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkBeta = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsBeta(false);
          setIsLoading(false);
          return;
        }

        // Check if user has an approved enrollment in this program
        const { data } = await supabase
          .from('beta_program_enrollments')
          .select('id, beta_programs!inner(program_key)')
          .eq('user_id', user.id)
          .eq('status', 'approved')
          .eq('beta_programs.program_key', programKey)
          .limit(1);

        setIsBeta((data?.length || 0) > 0);
      } catch {
        setIsBeta(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkBeta();
  }, [programKey]);

  return { isBeta, isLoading };
}

/**
 * Clear all cached feature flags
 */
export function clearFeatureCache(): void {
  featureCache.clear();
}

/**
 * Get cache status (for debugging)
 */
export function getFeatureCacheStatus(): {
  size: number;
  keys: string[];
} {
  return {
    size: featureCache.size,
    keys: Array.from(featureCache.keys()),
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default useFeatureRollout;
