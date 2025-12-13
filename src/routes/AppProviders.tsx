// src/routes/AppProviders.tsx
// Composed providers to reduce nesting in App.tsx
import React, { useEffect } from 'react';
import { SessionTimeoutProvider } from '../contexts/SessionTimeoutContext';
import { TimeClockProvider } from '../contexts/TimeClockContext';
import { NavigationHistoryProvider } from '../contexts/NavigationHistoryContext';
import { PatientProvider } from '../contexts/PatientContext';
import { VoiceActionProvider } from '../contexts/VoiceActionContext';
import { EAKeyboardShortcutsProvider } from '../components/envision-atlus/EAKeyboardShortcutsProvider';
import { BrandingConfig } from '../branding.config';
import { BrandingContext } from '../BrandingContext';
import { GuardianErrorBoundary } from '../components/GuardianErrorBoundary';
import { initializePHIEncryption } from '../lib/phi-encryption';

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
  // Initialize PHI encryption for database-level encryption (pgcrypto)
  useEffect(() => {
    initializePHIEncryption().catch(() => {
      // Encryption init failure is logged internally, app continues
    });
  }, []);

  return (
    <GuardianErrorBoundary>
      <BrandingContext.Provider value={{ branding, setBranding, loading: false, refreshBranding }}>
        <SessionTimeoutProvider>
          <TimeClockProvider>
            <PatientProvider>
              <NavigationHistoryProvider>
                <VoiceActionProvider>
                  <EAKeyboardShortcutsProvider>
                    {children}
                  </EAKeyboardShortcutsProvider>
                </VoiceActionProvider>
              </NavigationHistoryProvider>
            </PatientProvider>
          </TimeClockProvider>
        </SessionTimeoutProvider>
      </BrandingContext.Provider>
    </GuardianErrorBoundary>
  );
};
