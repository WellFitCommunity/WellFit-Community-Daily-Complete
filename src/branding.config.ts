// src/branding.config.ts

export interface BrandingConfig {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  contactInfo: string;
  gradient: string;   // Made required - always has a default value
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
  // Client 1: Houston Senior Services
  {
    subdomain: 'houston',
    appName: 'WellFit Houston',
    logoUrl: '/logos/houston-logo.png',
    primaryColor: '#C8102E',           // Houston Red
    secondaryColor: '#FFDC00',         // Houston Gold
    textColor: '#ffffff',
    gradient: 'linear-gradient(to bottom right, #C8102E, #FFDC00)',
    contactInfo: 'Houston Senior Services',
    customFooter: '© 2025 WellFit Houston. Powered by Houston Senior Services.',
  },

  // Client 2: Miami Healthcare Network
  {
    subdomain: 'miami',
    appName: 'WellFit Miami',
    logoUrl: '/logos/miami-logo.png',
    primaryColor: '#00B4A6',           // Miami Teal
    secondaryColor: '#FF6B35',         // Miami Coral
    textColor: '#ffffff',
    gradient: 'linear-gradient(to bottom right, #00B4A6, #FF6B35)',
    contactInfo: 'Miami Healthcare Network',
    customFooter: '© 2025 WellFit Miami. Powered by Miami Healthcare Network.',
  },

  // Client 3: Phoenix Wellness Center
  {
    subdomain: 'phoenix',
    appName: 'WellFit Phoenix',
    logoUrl: '/logos/phoenix-logo.png',
    primaryColor: '#D2691E',           // Desert Orange
    secondaryColor: '#8B4513',         // Saddle Brown
    textColor: '#ffffff',
    gradient: 'linear-gradient(to bottom right, #D2691E, #8B4513)',
    contactInfo: 'Phoenix Wellness Center',
    customFooter: '© 2025 WellFit Phoenix. Powered by Phoenix Wellness Center.',
  },

  // Client 4: Seattle Community Health
  {
    subdomain: 'seattle',
    appName: 'WellFit Seattle',
    logoUrl: '/logos/seattle-logo.png',
    primaryColor: '#004225',           // Evergreen
    secondaryColor: '#0066CC',         // Pacific Blue
    textColor: '#ffffff',
    gradient: 'linear-gradient(to bottom right, #004225, #0066CC)',
    contactInfo: 'Seattle Community Health',
    customFooter: '© 2025 WellFit Seattle. Powered by Seattle Community Health.',
  },
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
