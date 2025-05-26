export interface BrandingConfig {
  textColor: string;
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  contactInfo: string;
  gradient?: string; // Optional but now fully supported
}


export interface TenantBranding extends BrandingConfig {
  subdomain: string;
}

export const defaultBranding: BrandingConfig = {
  appName: "WellFit Community",
  logoUrl: "/android-chrome-512x512.png",
  primaryColor: "#003865",
  secondaryColor: "#8cc63f",
  textColor: "#ffffff", // ✅ Required to match BrandingConfig
  gradient: "linear-gradient(to bottom right, #003865, #8cc63f)", // optional, but recommended
  contactInfo: `© ${new Date().getFullYear()} WellFit Community. All rights reserved.`,
};


export const tenantBrandings: TenantBranding[] = [
  // Example:
  // {
  //   subdomain: "houston",
  //   appName: "WellFit Houston",
  //   logoUrl: "/logos/houston-logo.png",
  //   primaryColor: "#A00000",
  //   secondaryColor: "#00A000",
  //   contactInfo: "Contact WellFit Houston at ..."
  // }
];

export const getCurrentBranding = (): BrandingConfig => {
  if (typeof window === "undefined") {
    // Return default branding if window is not defined (e.g., during SSR)
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
