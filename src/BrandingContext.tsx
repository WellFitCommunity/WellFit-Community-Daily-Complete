// src/BrandingContext.tsx
import React, { createContext, useContext, useState } from 'react';
import type { BrandingConfig } from './branding.config';
import { getCurrentBranding } from './branding.config';

// Fallback/initial branding config
const fallbackBranding: BrandingConfig = getCurrentBranding();

// Shape exposed via context
export type BrandingContextValue = {
  branding: BrandingConfig;
  setBranding: React.Dispatch<React.SetStateAction<BrandingConfig>>;
};

// Create the context with a safe default so consumers don’t crash
export const BrandingContext = createContext<BrandingContextValue>({
  branding: fallbackBranding,
  setBranding: () => {}, // no-op; replaced by provider
});

// ✅ Hook for consumers
export function useBranding() {
  return useContext(BrandingContext);
}

// ✅ Provider (this is what index.tsx should import)
export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(fallbackBranding);

  const value: BrandingContextValue = {
    branding,
    setBranding,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}
