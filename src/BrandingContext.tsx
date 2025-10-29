// src/BrandingContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { BrandingConfig } from './branding.config';
import { getCurrentBranding, defaultBranding } from './branding.config';
import { getCurrentTenantBranding } from './services/tenantBrandingService';

// Shape exposed via context
export type BrandingContextValue = {
  branding: BrandingConfig;
  setBranding: React.Dispatch<React.SetStateAction<BrandingConfig>>;
  loading: boolean;
  refreshBranding: () => Promise<void>;
};

// Create the context with a safe default so consumers don't crash
export const BrandingContext = createContext<BrandingContextValue>({
  branding: defaultBranding,
  setBranding: () => {}, // no-op; replaced by provider
  loading: true,
  refreshBranding: async () => {},
});

// ✅ Hook for consumers
export function useBranding() {
  return useContext(BrandingContext);
}

// ✅ Provider (this is what index.tsx should import)
// Now loads branding from database instead of hardcoded config
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);
  const [loading, setLoading] = useState(true);

  const loadBranding = async () => {
    setLoading(true);
    try {
      // Try database first
      const dbBranding = await getCurrentTenantBranding();
      setBranding(dbBranding);
    } catch (error) {

      // Fallback to hardcoded config if database fails
      setBranding(getCurrentBranding());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  const value: BrandingContextValue = {
    branding,
    setBranding,
    loading,
    refreshBranding: loadBranding,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}
