// src/branding.config.ts

export interface BrandingConfig {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  contactInfo: string;
  gradient?: string;
  customFooter?: string; // tenant-specific footer override (optional)
}

export interface TenantBranding extends BrandingConfig {
  subdomain: string; // e.g., "houston" for houston.example.com
}

// ---- Defaults (WellFit) -----------------------------------------------------

export const defaultBranding: BrandingConfig = {
  appName: 'WellFit Community',
  logoUrl: '/android-chrome-512x512.png',
  primaryColor: '#003865',           // WellFit Blue
  secondaryColor: '#8cc63f',         // WellFit Green
  textColor: '#ffffff',              // white by default (pairs with dark blue)
  gradient: 'linear-gradient(to bottom right, #003865, #8cc63f)',
  contactInfo: `© ${new Date().getFullYear()} WellFit Community. All rights reserved.`,
  // customFooter intentionally omitted so global/Alliance default footer shows
};

// ---- Tenants (optional) -----------------------------------------------------

export const tenantBrandings: TenantBranding[] = [
  // Example (leave commented until you have assets & subdomain live):
  // {
  //   subdomain: 'houston',
  //   appName: 'WellFit Houston',
  //   logoUrl: '/logos/houston-logo.png',
  //   primaryColor: '#A00000',
  //   secondaryColor: '#00A000',
  //   textColor: '#ffffff',
  //   gradient: 'linear-gradient(to bottom right, #A00000, #00A000)',
  //   contactInfo: 'Contact WellFit Houston at …',
  //   customFooter: '© 2025 WellFit Houston. Powered by Houston Senior Services.',
  // },
];

// ---- Utilities --------------------------------------------------------------

/**
 * Returns the active branding for the current hostname.
 * Safe on SSR/build: falls back to default when window is unavailable.
 */
export function getCurrentBranding(): BrandingConfig {
  // Server-side / build-time safety
  if (typeof window === 'undefined') return defaultBranding;

  const hostname = window.location.hostname; // e.g., houston.thewellfitcommunity.org
  const parts = hostname.split('.');

  // Match first label if we have a clear subdomain (and not "www")
  if (parts.length > 2 && parts[0] !== 'www') {
    const subdomain = parts[0].toLowerCase();
    const tenant = tenantBrandings.find((b) => b.subdomain.toLowerCase() === subdomain);
    if (tenant) return tenant;
  }

  return defaultBranding;
}

/**
 * Optional helper: compute a readable text color if you ever need dynamic contrast.
 * Not used by default, but here if you want to override textColor automatically.
 */
export function readableTextOn(bgHex: string): '#000000' | '#ffffff' {
  // naive YIQ contrast
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
}
