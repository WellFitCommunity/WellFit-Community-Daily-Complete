// White Label Brand Configuration
// This file controls all branding elements for the app

export const brandConfig = {
  // Company Information
  companyName: process.env.BRAND_COMPANY_NAME || "Your Healthcare Company",
  appName: process.env.BRAND_APP_NAME || "Care Monitor",
  tagline: process.env.BRAND_TAGLINE || "Professional Patient Safety Monitoring",

  // Visual Branding
  colors: {
    primary: process.env.BRAND_PRIMARY_COLOR || "#2196F3",
    secondary: process.env.BRAND_SECONDARY_COLOR || "#4CAF50",
    accent: process.env.BRAND_ACCENT_COLOR || "#FF9800",
    background: process.env.BRAND_BACKGROUND_COLOR || "#FFFFFF",
    text: process.env.BRAND_TEXT_COLOR || "#333333",
    emergency: process.env.BRAND_EMERGENCY_COLOR || "#F44336"
  },

  // Logo and Icons
  logo: {
    light: process.env.BRAND_LOGO_LIGHT || "./assets/logos/logo-light.png",
    dark: process.env.BRAND_LOGO_DARK || "./assets/logos/logo-dark.png",
    icon: process.env.BRAND_ICON || "./assets/icons/app-icon.png"
  },

  // Contact Information
  contact: {
    supportEmail: process.env.BRAND_SUPPORT_EMAIL || "support@yourcompany.com",
    emergencyEmail: process.env.BRAND_EMERGENCY_EMAIL || "emergency@yourcompany.com",
    privacyEmail: process.env.BRAND_PRIVACY_EMAIL || "privacy@yourcompany.com",
    phone: process.env.BRAND_PHONE || "1-800-YOURCARE",
    emergencyPhone: process.env.BRAND_EMERGENCY_PHONE || "1-800-YOURCARE ext. 911",
    address: {
      street: process.env.BRAND_ADDRESS_STREET || "123 Healthcare Drive",
      city: process.env.BRAND_ADDRESS_CITY || "Medical City",
      state: process.env.BRAND_ADDRESS_STATE || "MC",
      zip: process.env.BRAND_ADDRESS_ZIP || "12345"
    }
  },

  // Legal Information
  legal: {
    entityName: process.env.BRAND_LEGAL_ENTITY || "Your Healthcare Company LLC",
    website: process.env.BRAND_WEBSITE || "https://yourcompany.com",
    privacyPolicyUrl: process.env.BRAND_PRIVACY_URL || "https://yourcompany.com/privacy",
    termsOfServiceUrl: process.env.BRAND_TERMS_URL || "https://yourcompany.com/terms"
  },

  // App Store Information
  appStore: {
    packageName: process.env.BRAND_PACKAGE_NAME || "com.yourcompany.caremonitor",
    keywords: process.env.BRAND_KEYWORDS || "health monitoring, patient care, medical alert",
    shortDescription: process.env.BRAND_SHORT_DESC || "Professional patient monitoring and safety alerts",
    category: "Medical",
    contentRating: "Teen"
  },

  // Feature Configuration
  features: {
    enableGeofencing: process.env.ENABLE_GEOFENCING !== "false",
    enableHealthMonitoring: process.env.ENABLE_HEALTH_MONITORING !== "false",
    enableEmergencyAlerts: process.env.ENABLE_EMERGENCY_ALERTS !== "false",
    enableLocationHistory: process.env.ENABLE_LOCATION_HISTORY !== "false",
    enableDataExport: process.env.ENABLE_DATA_EXPORT !== "false"
  }
};

// Default WellFit Community Configuration (can be overridden)
export const wellfitConfig = {
  ...brandConfig,
  companyName: "WellFit Community",
  appName: "Dementia Care Monitor",
  tagline: "HIPAA-Compliant Dementia Patient Safety Monitoring",
  colors: {
    primary: "#2196F3",
    secondary: "#4CAF50",
    accent: "#FF9800",
    background: "#FFFFFF",
    text: "#333333",
    emergency: "#F44336"
  },
  contact: {
    supportEmail: "support@wellfitcommunity.org",
    emergencyEmail: "emergency@wellfitcommunity.org",
    privacyEmail: "privacy@wellfitcommunity.org",
    phone: "1-800-WELLFIT",
    emergencyPhone: "1-800-WELLFIT ext. 911",
    address: {
      street: "123 Healthcare Drive",
      city: "Medical City",
      state: "MC",
      zip: "12345"
    }
  },
  legal: {
    entityName: "WellFit Community",
    website: "https://wellfitcommunity.org",
    privacyPolicyUrl: "https://wellfitcommunity.org/privacy",
    termsOfServiceUrl: "https://wellfitcommunity.org/terms"
  },
  appStore: {
    packageName: "com.wellfitcommunity.dementiacare",
    keywords: "dementia care, patient monitoring, geofencing, health tracking",
    shortDescription: "HIPAA-compliant dementia patient safety monitoring with advanced geofencing"
  }
};

// Export the current brand (can be switched at build time)
export default process.env.BRAND_CONFIG === "wellfit" ? wellfitConfig : brandConfig;