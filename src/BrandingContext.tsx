// src/BrandingContext.tsx
import React, { createContext, useContext } from 'react';
import type { BrandingConfig } from './branding.config';

// If you have a known fallback, import it:
import { getCurrentBranding } from './branding.config';
const fallbackBranding: BrandingConfig = getCurrentBranding();

export type BrandingContextValue = {
  branding: BrandingConfig;
  setBranding: React.Dispatch<React.SetStateAction<BrandingConfig>>;
};

// ✅ Provide a safe default so consumers don't crash if provider isn't present yet
export const BrandingContext = createContext<BrandingContextValue>({
  branding: fallbackBranding,
  // no-op setter; will be replaced by Provider
  setBranding: () => {},
});

export function useBranding() {
  return useContext(BrandingContext);
}
