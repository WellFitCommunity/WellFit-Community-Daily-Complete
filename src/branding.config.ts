// src/components/branding.config.ts

export interface BrandingConfig {
  textColor: string;
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  contactInfo: string;
  gradient?: string;
  customFooter?: string; // <-- NEW for tenant footers
}

export interface TenantBranding extends BrandingConfig {
  subdomain: string;
}

export const defaultBranding: BrandingConfig = {
  appName: "WellFit Community",
  logoUrl: "/android-chrome-512x512.png",
  primaryColor: "#003865",
  secondaryColor: "#8cc63f",
  textColor: "#ffffff",
  gradient: "linear-gradient(to bottom right, #003865, #8cc63f)",
  contactInfo: `© ${new Date().getFullYear()} WellFit Community. All rights reserved.`,
  // No customFooter here—shows the Alliance default footer!
};

export const tenantBrandings: TenantBranding[] = [
  // Example tenant—uncomment and fill in to activate!
  // {
  //   subdomain: "houston",
  //   appName: "WellFit Houston",
  //   logoUrl: "/logos/houston-logo.png",
  //   primaryColor: "#A00000",
  //   secondaryColor: "#00A000",
  //   textColor: "#ffffff",
  //   gradient: "linear-gradient(to bottom right, #A00000, #00A000)",
  //   contactInfo: "Contact WellFit Houston at ...",
  //   customFooter: "© 2025 WellFit Houston. Powered by Houston Senior Services.",
  // }
];

export const getCurrentBranding = (): BrandingConfig => {
  if (typeof window === "undefined") {
    return defaultBranding;
  }

  const hostname = window.location.hostname;
  const parts = hostname.split(".");

  if (parts.length > 2 && parts[0] !== "www") {
    const subdomain = parts[0];
    const tenantBranding = tenantBrandings.find(
      (branding) => branding.subdomain === subdomain
    );
    if (tenantBranding) {
      return tenantBranding;
    }
  }

  return defaultBranding;
};
