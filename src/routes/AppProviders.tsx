// src/routes/AppProviders.tsx
// Composed providers to reduce nesting in App.tsx
import React from 'react';
import { SessionTimeoutProvider } from '../contexts/SessionTimeoutContext';
import { TimeClockProvider } from '../contexts/TimeClockContext';
import { NavigationHistoryProvider } from '../contexts/NavigationHistoryContext';
import { PatientProvider } from '../contexts/PatientContext';
import { EAKeyboardShortcutsProvider } from '../components/envision-atlus/EAKeyboardShortcutsProvider';
import { BrandingConfig } from '../branding.config';
import { BrandingContext } from '../BrandingContext';
import { GuardianErrorBoundary } from '../components/GuardianErrorBoundary';

interface AppProvidersProps {
  children: React.ReactNode;
  branding: BrandingConfig;
  setBranding: React.Dispatch<React.SetStateAction<BrandingConfig>>;
  refreshBranding: () => Promise<void>;
}

/**
 * Composes all providers in the correct order.
 * This reduces the deeply nested JSX in App.tsx.
 */
export const AppProviders: React.FC<AppProvidersProps> = ({
  children,
  branding,
  setBranding,
  refreshBranding,
}) => {
  return (
    <GuardianErrorBoundary>
      <BrandingContext.Provider value={{ branding, setBranding, loading: false, refreshBranding }}>
        <SessionTimeoutProvider>
          <TimeClockProvider>
            <PatientProvider>
              <NavigationHistoryProvider>
                <EAKeyboardShortcutsProvider>
                  {children}
                </EAKeyboardShortcutsProvider>
              </NavigationHistoryProvider>
            </PatientProvider>
          </TimeClockProvider>
        </SessionTimeoutProvider>
      </BrandingContext.Provider>
    </GuardianErrorBoundary>
  );
};
