/**
 * Custom React Hook for Tenant Branding
 * Fetches and caches tenant branding from database
 * Replaces hardcoded branding from branding.config.ts
 */

import { useState, useEffect } from 'react';
import type { BrandingConfig } from '../branding.config';
import { defaultBranding } from '../branding.config';
import {
  getCurrentTenantBranding,
  fetchTenantBrandingBySubdomain,
  type TenantBrandingData,
} from '../services/tenantBrandingService';

/**
 * Hook to load and cache tenant branding from database
 * Usage: const { branding, loading, error, refresh } = useTenantBranding();
 */
export function useTenantBranding() {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranding = async () => {
    try {
      setLoading(true);
      setError(null);

      const tenantBranding = await getCurrentTenantBranding();
      setBranding(tenantBranding);
    } catch (err) {
      console.error('[useTenantBranding] Error loading branding:', err);
      setError(err instanceof Error ? err.message : 'Failed to load branding');
      setBranding(defaultBranding); // Fallback to default
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  return {
    branding,
    loading,
    error,
    refresh: loadBranding,
  };
}

/**
 * Hook to load branding for a specific subdomain
 * Useful for admin panels that need to preview different tenant branding
 */
export function useTenantBrandingBySubdomain(subdomain: string | null) {
  const [branding, setBranding] = useState<TenantBrandingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subdomain) {
      setBranding(null);
      return;
    }

    const loadBranding = async () => {
      try {
        setLoading(true);
        setError(null);

        const tenantBranding = await fetchTenantBrandingBySubdomain(subdomain);
        setBranding(tenantBranding);
      } catch (err) {
        console.error('[useTenantBrandingBySubdomain] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load branding');
      } finally {
        setLoading(false);
      }
    };

    loadBranding();
  }, [subdomain]);

  return {
    branding,
    loading,
    error,
  };
}
