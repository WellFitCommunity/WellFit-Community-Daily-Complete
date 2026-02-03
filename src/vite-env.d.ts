/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase
  readonly VITE_SB_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_URL_PUBLIC?: string;
  readonly VITE_SB_PUBLISHABLE_API_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_REGISTER_URL?: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL?: string;

  // Claude AI
  readonly VITE_ANTHROPIC_API_KEY?: string;
  readonly VITE_CLAUDE_DEFAULT_MODEL?: string;
  readonly VITE_CLAUDE_ADMIN_MODEL?: string;
  readonly VITE_CLAUDE_MAX_TOKENS?: string;
  readonly VITE_CLAUDE_TIMEOUT?: string;
  readonly VITE_PILLBOX_API_KEY?: string;

  // Firebase
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;

  // External Services
  readonly VITE_HCAPTCHA_SITE_KEY?: string;
  readonly VITE_WEATHER_API_KEY?: string;
  readonly VITE_TWILIO_ENABLED?: string;

  // App Configuration
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEMO_ENABLED?: string;
  readonly VITE_ENABLE_SW?: string;
  readonly VITE_BASE_URL?: string;
  readonly VITE_VERSION?: string;
  readonly VITE_COMPASS_DEMO?: string;
  readonly VITE_MEALS_SOURCE?: string;
  readonly VITE_HIPAA_LOGGING_ENABLED?: string;
  readonly VITE_PHI_ENCRYPTION_KEY?: string;

  // Session/Timeout
  readonly VITE_INACTIVITY_TIMEOUT_MS?: string;
  readonly VITE_TIMEOUT_WARNING_MS?: string;

  // Security Alerts
  readonly VITE_SECURITY_ALERT_EMAILS?: string;
  readonly VITE_SECURITY_ALERT_PHONES?: string;

  // Feature Flags
  readonly VITE_FEATURE_MEMORY_CLINIC?: string;
  readonly VITE_FEATURE_MENTAL_HEALTH?: string;
  readonly VITE_FEATURE_DENTAL_HEALTH?: string;
  readonly VITE_FEATURE_STROKE_ASSESSMENT?: string;
  readonly VITE_FEATURE_NEURO_SUITE?: string;
  readonly VITE_FEATURE_WEARABLES?: string;
  readonly VITE_FEATURE_PHYSICAL_THERAPY?: string;
  readonly VITE_FEATURE_HEALTHCARE_INTEGRATIONS?: string;
  readonly VITE_FEATURE_FREQUENT_FLYERS?: string;
  readonly VITE_FEATURE_DISCHARGE_TRACKING?: string;
  readonly VITE_FEATURE_CARE_COORDINATION?: string;
  readonly VITE_FEATURE_REFERRAL_MANAGEMENT?: string;
  readonly VITE_FEATURE_QUESTIONNAIRE_ANALYTICS?: string;
  readonly VITE_FEATURE_REVENUE_DASHBOARD?: string;
  readonly VITE_FEATURE_BILLING_REVIEW?: string;
  readonly VITE_FEATURE_SHIFT_HANDOFF?: string;
  readonly VITE_FEATURE_FIELD_VISITS?: string;
  readonly VITE_FEATURE_CAREGIVER_PORTAL?: string;
  readonly VITE_FEATURE_TIME_CLOCK?: string;
  readonly VITE_FEATURE_EMS_METRICS?: string;
  readonly VITE_FEATURE_COORDINATED_RESPONSE?: string;
  readonly VITE_FEATURE_LAW_ENFORCEMENT?: string;
  readonly VITE_FEATURE_ADMIN_REPORTS?: string;
  readonly VITE_FEATURE_ENHANCED_QUESTIONS?: string;
  readonly VITE_FEATURE_SOC2_DASHBOARDS?: string;
  readonly VITE_FEATURE_PERFORMANCE_MONITORING?: string;
  readonly VITE_FEATURE_AI_COST_TRACKING?: string;

  // Demo Mode
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
