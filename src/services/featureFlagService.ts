/**
 * Feature Flag Service
 *
 * Reads feature flags from system_feature_flags database table
 * Provides real-time flag checking controllable from SuperAdmin panel
 *
 * This replaces environment-variable-only feature flags with database-driven flags
 * that can be toggled from the Envision Atlus Master Panel without redeploying.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

export interface SystemFeatureFlag {
  featureKey: string;
  featureName: string;
  description: string | null;
  isEnabled: boolean;
  forceDisabled: boolean;
  enabledForNewTenants: boolean;
  requiresLicense: boolean;
  category: string | null;
}

// Cache for feature flags to avoid repeated database calls
let flagCache: Map<string, SystemFeatureFlag> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Map of frontend feature keys to database feature keys
 * This allows us to maintain backwards compatibility with existing code
 */
const FEATURE_KEY_MAP: Record<string, string> = {
  // Clinical
  memoryClinic: 'clinical.memory_clinic',
  mentalHealth: 'clinical.mental_health',
  dentalHealth: 'clinical.dental_health',
  strokeAssessment: 'clinical.stroke_assessment',
  neuroSuite: 'clinical.neuro_suite',
  wearableIntegration: 'clinical.wearable_integration',

  // Population Health
  frequentFlyers: 'population.frequent_flyers',
  dischargeTracking: 'population.discharge_tracking',

  // Billing
  revenueDashboard: 'billing.revenue_dashboard',
  billingReview: 'billing.billing_review',

  // Workflow
  shiftHandoff: 'workflow.shift_handoff',
  fieldVisits: 'workflow.field_visits',
  caregiverPortal: 'workflow.caregiver_portal',

  // Emergency
  emsMetrics: 'emergency.ems_metrics',
  coordinatedResponse: 'emergency.coordinated_response',
  lawEnforcement: 'emergency.law_enforcement',

  // Admin
  adminReports: 'admin.reports',
  enhancedQuestions: 'admin.enhanced_questions',

  // Monitoring
  soc2Dashboards: 'monitoring.soc2_dashboards',
  performanceMonitoring: 'monitoring.performance',
  aiCostTracking: 'monitoring.ai_cost_tracking',
};

/**
 * Fetch all feature flags from database
 */
export async function fetchAllFeatureFlags(): Promise<SystemFeatureFlag[]> {
  try {
    const { data, error } = await supabase
      .from('system_feature_flags')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      await auditLogger.error('FEATURE_FLAGS_FETCH_FAILED', error, {
        category: 'SYSTEM_ERROR'
      });
      return [];
    }

    // Update cache
    flagCache.clear();
    (data || []).forEach((row: any) => {
      const flag: SystemFeatureFlag = {
        featureKey: row.feature_key,
        featureName: row.feature_name,
        description: row.description,
        isEnabled: row.is_enabled,
        forceDisabled: row.force_disabled,
        enabledForNewTenants: row.enabled_for_new_tenants,
        requiresLicense: row.requires_license,
        category: row.category,
      };
      flagCache.set(row.feature_key, flag);
    });
    cacheTimestamp = Date.now();

    return Array.from(flagCache.values());
  } catch (err) {
    await auditLogger.error('FEATURE_FLAGS_FETCH_EXCEPTION', err as Error, {
      category: 'SYSTEM_ERROR'
    });
    return [];
  }
}

/**
 * Check if a feature is enabled
 * @param frontendKey - The key used in frontend code (e.g., 'memoryClinic')
 * @returns boolean - true if enabled, false if disabled or not found
 */
export async function isFeatureFlagEnabled(frontendKey: string): Promise<boolean> {
  // Map frontend key to database key
  const dbKey = FEATURE_KEY_MAP[frontendKey] || frontendKey;

  // Check cache freshness
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS || flagCache.size === 0) {
    await fetchAllFeatureFlags();
  }

  const flag = flagCache.get(dbKey);

  if (!flag) {
    // Flag not found in database - check environment variable fallback
    const envKey = `REACT_APP_FEATURE_${frontendKey.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    return process.env[envKey] === 'true';
  }

  // If force disabled (kill switch), always return false
  if (flag.forceDisabled) {
    return false;
  }

  return flag.isEnabled;
}

/**
 * Synchronous check using cached values only
 * Use this when you can't await (e.g., in render)
 * Will return env var fallback if cache is empty
 */
export function isFeatureFlagEnabledSync(frontendKey: string): boolean {
  const dbKey = FEATURE_KEY_MAP[frontendKey] || frontendKey;
  const flag = flagCache.get(dbKey);

  if (!flag) {
    // Fallback to environment variable
    const envKey = `REACT_APP_FEATURE_${frontendKey.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    return process.env[envKey] === 'true';
  }

  if (flag.forceDisabled) {
    return false;
  }

  return flag.isEnabled;
}

/**
 * Get all feature flags (cached)
 */
export function getAllFeatureFlagsSync(): Map<string, SystemFeatureFlag> {
  return flagCache;
}

/**
 * Force refresh the cache
 */
export async function refreshFeatureFlagCache(): Promise<void> {
  await fetchAllFeatureFlags();
}

/**
 * Initialize feature flag cache on app startup
 */
export async function initializeFeatureFlags(): Promise<void> {
  await fetchAllFeatureFlags();
}

export const FeatureFlagService = {
  fetchAll: fetchAllFeatureFlags,
  isEnabled: isFeatureFlagEnabled,
  isEnabledSync: isFeatureFlagEnabledSync,
  getAllSync: getAllFeatureFlagsSync,
  refresh: refreshFeatureFlagCache,
  initialize: initializeFeatureFlags,
};

export default FeatureFlagService;
