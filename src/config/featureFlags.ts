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
  cardiology: boolean;
  laborDelivery: boolean;
  oncology: boolean;

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

  // Wired admin-dashboard visibility — modular toggles (default ON; set
  // VITE_FEATURE_<NAME>=false to make that dashboard inaccessible, no code change).
  // Tier annotation = audience the nav gating enforces:
  //   [envision] = platform / super-admin only;  [tenant] = each org, RLS-scoped.
  aiAccuracyDashboard: boolean;            // [tenant]
  aiFinancialDashboard: boolean;           // [tenant]
  auditAnalyticsDashboard: boolean;        // [tenant]
  disclosureAccountingDashboard: boolean;  // [tenant]
  mcpCostDashboard: boolean;               // [envision]
  disasterRecoveryDashboard: boolean;      // [envision]
  guardianAgentDashboard: boolean;         // [envision]
  interoperabilitySuite: boolean;          // [tenant]
  engagementMetrics: boolean;              // [tenant]
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
    cardiology: env.VITE_FEATURE_CARDIOLOGY === 'true',
    laborDelivery: env.VITE_FEATURE_LABOR_DELIVERY === 'true',
    oncology: env.VITE_FEATURE_ONCOLOGY === 'true',

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

    // Internal/Monitoring (super admin only). soc2Dashboards + aiCostTracking are the
    // gates for the wired SOC2 suite and AI-cost family below — default ON now that they
    // are enforced (previously defined-but-unused). performanceMonitoring left as-is.
    soc2Dashboards: env.VITE_FEATURE_SOC2_DASHBOARDS !== 'false',
    performanceMonitoring: env.VITE_FEATURE_PERFORMANCE_MONITORING === 'true',
    aiCostTracking: env.VITE_FEATURE_AI_COST_TRACKING !== 'false',

    // Wired admin-dashboard visibility (default ON; VITE_FEATURE_<NAME>=false to hide)
    aiAccuracyDashboard: env.VITE_FEATURE_AI_ACCURACY_DASHBOARD !== 'false',
    aiFinancialDashboard: env.VITE_FEATURE_AI_FINANCIAL_DASHBOARD !== 'false',
    auditAnalyticsDashboard: env.VITE_FEATURE_AUDIT_ANALYTICS_DASHBOARD !== 'false',
    disclosureAccountingDashboard: env.VITE_FEATURE_DISCLOSURE_ACCOUNTING_DASHBOARD !== 'false',
    mcpCostDashboard: env.VITE_FEATURE_MCP_COST_DASHBOARD !== 'false',
    disasterRecoveryDashboard: env.VITE_FEATURE_DISASTER_RECOVERY_DASHBOARD !== 'false',
    guardianAgentDashboard: env.VITE_FEATURE_GUARDIAN_AGENT_DASHBOARD !== 'false',
    interoperabilitySuite: env.VITE_FEATURE_INTEROPERABILITY_SUITE !== 'false',
    engagementMetrics: env.VITE_FEATURE_ENGAGEMENT_METRICS !== 'false',
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
