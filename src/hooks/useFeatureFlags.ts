/**
 * useFeatureFlags Hook
 *
 * React hook for accessing database-driven feature flags
 * Provides real-time feature flag state that can be controlled from SuperAdmin panel
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FeatureFlagService,
  SystemFeatureFlag,
  isFeatureFlagEnabledSync
} from '../services/featureFlagService';

export interface FeatureFlagsState {
  // Clinical
  memoryClinic: boolean;
  mentalHealth: boolean;
  dentalHealth: boolean;
  strokeAssessment: boolean;
  neuroSuite: boolean;
  wearableIntegration: boolean;

  // Population Health
  frequentFlyers: boolean;
  dischargeTracking: boolean;

  // Billing
  revenueDashboard: boolean;
  billingReview: boolean;

  // Workflow
  shiftHandoff: boolean;
  fieldVisits: boolean;
  caregiverPortal: boolean;

  // Emergency
  emsMetrics: boolean;
  coordinatedResponse: boolean;
  lawEnforcement: boolean;

  // Admin
  adminReports: boolean;
  enhancedQuestions: boolean;

  // Monitoring (Super Admin only)
  soc2Dashboards: boolean;
  performanceMonitoring: boolean;
  aiCostTracking: boolean;
}

const DEFAULT_FLAGS: FeatureFlagsState = {
  memoryClinic: false,
  mentalHealth: false,
  dentalHealth: true, // Default on
  strokeAssessment: false,
  neuroSuite: false,
  wearableIntegration: false,
  frequentFlyers: false,
  dischargeTracking: false,
  revenueDashboard: false,
  billingReview: false,
  shiftHandoff: false,
  fieldVisits: false,
  caregiverPortal: false,
  emsMetrics: false,
  coordinatedResponse: false,
  lawEnforcement: true, // Default on
  adminReports: true, // Default on
  enhancedQuestions: false,
  soc2Dashboards: false,
  performanceMonitoring: false,
  aiCostTracking: false,
};

/**
 * Hook to access feature flags from database
 * Updates when flags change (refreshes periodically)
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlagsState>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    try {
      await FeatureFlagService.initialize();

      // Build flags state from cache
      const newFlags: FeatureFlagsState = {
        memoryClinic: isFeatureFlagEnabledSync('memoryClinic'),
        mentalHealth: isFeatureFlagEnabledSync('mentalHealth'),
        dentalHealth: isFeatureFlagEnabledSync('dentalHealth'),
        strokeAssessment: isFeatureFlagEnabledSync('strokeAssessment'),
        neuroSuite: isFeatureFlagEnabledSync('neuroSuite'),
        wearableIntegration: isFeatureFlagEnabledSync('wearableIntegration'),
        frequentFlyers: isFeatureFlagEnabledSync('frequentFlyers'),
        dischargeTracking: isFeatureFlagEnabledSync('dischargeTracking'),
        revenueDashboard: isFeatureFlagEnabledSync('revenueDashboard'),
        billingReview: isFeatureFlagEnabledSync('billingReview'),
        shiftHandoff: isFeatureFlagEnabledSync('shiftHandoff'),
        fieldVisits: isFeatureFlagEnabledSync('fieldVisits'),
        caregiverPortal: isFeatureFlagEnabledSync('caregiverPortal'),
        emsMetrics: isFeatureFlagEnabledSync('emsMetrics'),
        coordinatedResponse: isFeatureFlagEnabledSync('coordinatedResponse'),
        lawEnforcement: isFeatureFlagEnabledSync('lawEnforcement'),
        adminReports: isFeatureFlagEnabledSync('adminReports'),
        enhancedQuestions: isFeatureFlagEnabledSync('enhancedQuestions'),
        soc2Dashboards: isFeatureFlagEnabledSync('soc2Dashboards'),
        performanceMonitoring: isFeatureFlagEnabledSync('performanceMonitoring'),
        aiCostTracking: isFeatureFlagEnabledSync('aiCostTracking'),
      };

      setFlags(newFlags);
      setError(null);
    } catch (err) {
      setError('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();

    // Refresh flags periodically (every 60 seconds)
    const interval = setInterval(loadFlags, 60000);

    return () => clearInterval(interval);
  }, [loadFlags]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFlags();
  }, [loadFlags]);

  return {
    flags,
    loading,
    error,
    refresh,
    isEnabled: (key: keyof FeatureFlagsState) => flags[key],
  };
}

/**
 * Simple hook to check a single feature flag
 */
export function useFeatureFlag(key: keyof FeatureFlagsState): boolean {
  const { flags } = useFeatureFlags();
  return flags[key];
}

export default useFeatureFlags;
