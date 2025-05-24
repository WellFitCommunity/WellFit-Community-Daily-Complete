import React, { createContext, useContext } from 'react';
import { BrandingConfig, defaultBranding } from './branding.config';

export const BrandingContext = createContext<BrandingConfig>(defaultBranding);

export const useBranding = (): BrandingConfig => {
  return useContext(BrandingContext);
};
