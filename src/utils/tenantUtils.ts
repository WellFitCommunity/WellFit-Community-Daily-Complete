// Tenant Management Utilities
// Provides helper functions for multi-tenant functionality

import { tenantBrandings, defaultBranding, getCurrentBranding } from '../branding.config';

export interface TenantInfo {
  subdomain: string;
  isActive: boolean;
  branding: any;
  databasePrefix?: string;
}

/**
 * Get all configured tenants
 */
export function getAllTenants(): TenantInfo[] {
  return tenantBrandings.map(tenant => ({
    subdomain: tenant.subdomain,
    isActive: true,
    branding: tenant,
    databasePrefix: tenant.subdomain
  }));
}

/**
 * Get current tenant info based on hostname
 */
export function getCurrentTenant(): TenantInfo | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  if (parts.length > 2 && parts[0] !== 'www') {
    const subdomain = parts[0].toLowerCase();
    const tenant = tenantBrandings.find(t => t.subdomain.toLowerCase() === subdomain);

    if (tenant) {
      return {
        subdomain: tenant.subdomain,
        isActive: true,
        branding: tenant,
        databasePrefix: tenant.subdomain
      };
    }
  }

  return null;
}

/**
 * Check if current site is a tenant (not main site)
 */
export function isTenantSite(): boolean {
  return getCurrentTenant() !== null;
}

/**
 * Get tenant-specific database table prefix
 */
export function getTenantPrefix(): string {
  const tenant = getCurrentTenant();
  return tenant ? `${tenant.subdomain}_` : '';
}

/**
 * Format tenant-specific contact information
 */
export function getTenantContactInfo(): string {
  const branding = getCurrentBranding();
  return branding.contactInfo || branding.appName;
}

/**
 * Validate tenant configuration
 */
export function validateTenantConfig(subdomain: string): boolean {
  const tenant = tenantBrandings.find(t => t.subdomain === subdomain);

  if (!tenant) return false;

  // Check required fields
  const required = ['appName', 'primaryColor', 'secondaryColor'];
  return required.every(field => tenant[field as keyof typeof tenant]);
}

/**
 * Development utility to test different tenant configurations
 */
export function simulateTenant(subdomain: string): void {
  if (process.env.NODE_ENV !== 'development') {

    return;
  }

  // Store original hostname
  const originalHostname = window.location.hostname;

  // Override hostname for testing
  Object.defineProperty(window.location, 'hostname', {
    value: `${subdomain}.localhost`,
    writable: true
  });

  // Current branding applied for development testing

  // Restore original hostname after 10 seconds
  setTimeout(() => {
    Object.defineProperty(window.location, 'hostname', {
      value: originalHostname,
      writable: true
    });

  }, 10000);
}