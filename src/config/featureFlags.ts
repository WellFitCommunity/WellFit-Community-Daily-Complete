// Feature Flags Configuration
// Control which advanced features are enabled in the app

export interface FeatureFlags {
  // Clinical Features
  memoryClinic: boolean;
  mentalHealth: boolean;
  dentalHealth: boolean;
  strokeAssessment: boolean;
  neuroSuite: boolean;
  wearableIntegration: boolean;
  physicalTherapy: boolean;

  // Healthcare Integrations
  healthcareIntegrations: boolean;

  // Population Health
  frequentFlyers: boolean;
  dischargeTracking: boolean;
  careCoordination: boolean;

  // External Referrals & Reporting
  referralManagement: boolean;

  // Questionnaires & Surveys
  questionnaireAnalytics: boolean;

  // Financial/Billing
  revenueDashboard: boolean;
  billingReview: boolean;

  // Workflow Features
  shiftHandoff: boolean;
  fieldVisits: boolean;
  caregiverPortal: boolean;
  timeClock: boolean;

  // Emergency Response
  emsMetrics: boolean;
  coordinatedResponse: boolean;
  lawEnforcement: boolean;

  // Admin Features
  adminReports: boolean;
  enhancedQuestions: boolean;

  // Internal/Monitoring (Super Admin only)
  soc2Dashboards: boolean;
  performanceMonitoring: boolean;
  aiCostTracking: boolean;

  // Demo
  demoMode: boolean;
}

// Environment-based feature flag configuration
// Override these in .env with VITE_FEATURE_<NAME>=true
const getFeatureFlags = (): FeatureFlags => {
  const env = import.meta.env;

  return {
    // Clinical Features (default: disabled, enable per tenant)
    memoryClinic: env.VITE_FEATURE_MEMORY_CLINIC === 'true',
    mentalHealth: env.VITE_FEATURE_MENTAL_HEALTH === 'true',
    dentalHealth: env.VITE_FEATURE_DENTAL_HEALTH === 'true' || true, // Already routed, always on
    strokeAssessment: env.VITE_FEATURE_STROKE_ASSESSMENT === 'true',
    neuroSuite: env.VITE_FEATURE_NEURO_SUITE === 'true',
    wearableIntegration: env.VITE_FEATURE_WEARABLES === 'true',
    physicalTherapy: env.VITE_FEATURE_PHYSICAL_THERAPY === 'true',

    // Healthcare Integrations (default: disabled)
    healthcareIntegrations: env.VITE_FEATURE_HEALTHCARE_INTEGRATIONS === 'true',

    // Population Health (default: disabled)
    frequentFlyers: env.VITE_FEATURE_FREQUENT_FLYERS === 'true',
    dischargeTracking: env.VITE_FEATURE_DISCHARGE_TRACKING === 'true',
    careCoordination: env.VITE_FEATURE_CARE_COORDINATION === 'true',

    // External Referrals & Reporting (default: disabled)
    referralManagement: env.VITE_FEATURE_REFERRAL_MANAGEMENT === 'true',

    // Questionnaires & Surveys (default: disabled)
    questionnaireAnalytics: env.VITE_FEATURE_QUESTIONNAIRE_ANALYTICS === 'true',

    // Financial/Billing (default: disabled)
    revenueDashboard: env.VITE_FEATURE_REVENUE_DASHBOARD === 'true',
    billingReview: env.VITE_FEATURE_BILLING_REVIEW === 'true',

    // Workflow Features (default: disabled)
    shiftHandoff: env.VITE_FEATURE_SHIFT_HANDOFF === 'true',
    fieldVisits: env.VITE_FEATURE_FIELD_VISITS === 'true',
    caregiverPortal: env.VITE_FEATURE_CAREGIVER_PORTAL === 'true',
    timeClock: env.VITE_FEATURE_TIME_CLOCK === 'true',

    // Emergency Response (default: disabled)
    emsMetrics: env.VITE_FEATURE_EMS_METRICS === 'true',
    coordinatedResponse: env.VITE_FEATURE_COORDINATED_RESPONSE === 'true',
    lawEnforcement: env.VITE_FEATURE_LAW_ENFORCEMENT === 'true' || true, // Enable by default (you have constable dispatch)

    // Admin Features (default: enabled for admins)
    adminReports: env.VITE_FEATURE_ADMIN_REPORTS !== 'false', // Default ON
    enhancedQuestions: env.VITE_FEATURE_ENHANCED_QUESTIONS === 'true',

    // Internal/Monitoring (default: disabled, super admin only)
    soc2Dashboards: env.VITE_FEATURE_SOC2_DASHBOARDS === 'true',
    performanceMonitoring: env.VITE_FEATURE_PERFORMANCE_MONITORING === 'true',
    aiCostTracking: env.VITE_FEATURE_AI_COST_TRACKING === 'true',

    // Demo mode (shows persona switcher on login page)
    demoMode: env.VITE_DEMO_MODE === 'true',
  };
};

// Export singleton instance
export const featureFlags = getFeatureFlags();

// Helper function to check if a feature is enabled
export const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
  return featureFlags[feature];
};

// Helper for logging feature flag status (useful for debugging)
// Note: Use auditLogger for production logging to comply with HIPAA
export const logFeatureFlags = () => {
  if (import.meta.env.DEV) {
    // Feature flags can be inspected in browser DevTools: window.featureFlags
  }
};
