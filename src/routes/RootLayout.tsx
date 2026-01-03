// src/routes/RootLayout.tsx
// Root layout component for the data router
// This replaces the Shell component from App.tsx and integrates with the route tree

import React, { useEffect, useState, Suspense } from 'react';
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom';

import { BrandingConfig, getCurrentBranding } from '../branding.config';
import { performanceMonitor } from '../services/performanceMonitoring';
import { GuardianAgent } from '../services/guardian-agent/GuardianAgent';
import { smartRecordingStrategy } from '../services/guardian-agent/SmartRecordingStrategy';

// Route modules
import { AppProviders } from './AppProviders';

// Auth
import AuthGate from '../AuthGate';
import { useAuth } from '../contexts/AuthContext';

// Layout
import AppHeader from '../components/layout/AppHeader';
import Footer from '../components/layout/Footer';

// App-level components
import { ClinicalModeComponents, ClinicalPatientBanner } from '../components/app';

// Global UI Components
import OfflineIndicator from '../components/OfflineIndicator';
import { LearningMilestone } from '../components/ai-transparency';
import { IdleTimeoutProvider } from '../components/IdleTimeoutProvider';

// Theme
import { useThemeInit } from '../hooks/useTheme';

// Browser History Protection
import { useBrowserHistoryProtection } from '../hooks/useBrowserHistoryProtection';

// Error Boundary
import ErrorBoundary from '../ErrorBoundary';

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RootLayout replaces the Shell component from App.tsx.
 * It provides the app chrome (header, footer, providers) and renders
 * child routes via <Outlet />.
 *
 * This component is used as the root element in the data router configuration.
 */
export const RootLayout: React.FC = () => {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();
  const { supabase, user } = useAuth();

  // Initialize theme from database/localStorage
  useThemeInit();

  // Protect against browser back button navigating to auth routes when authenticated
  useBrowserHistoryProtection();

  // Initialize performance monitoring
  useEffect(() => {
    if (supabase) {
      performanceMonitor.initialize(supabase, user?.id);
    }
  }, [supabase, user?.id]);

  // Initialize Guardian Agent
  useEffect(() => {
    const guardian = GuardianAgent.getInstance({
      autoHealEnabled: true,
      requireApprovalForCritical: false,
      learningEnabled: true,
      hipaaComplianceMode: true
    });

    guardian.start();

    // Start Guardian Eyes smart recording
    smartRecordingStrategy.startSmartRecording(user?.id).catch(() => {
      // Silent fail - recording is optional
    });

    return () => {
      guardian.stop();
      smartRecordingStrategy.stopSmartRecording().catch(() => {});
    };
  }, [user?.id]);

  // Update branding on route change
  useEffect(() => {
    setBranding(getCurrentBranding());
  }, [location.pathname]);

  const refreshBranding = async () => {
    setBranding(getCurrentBranding());
  };

  return (
    <ErrorBoundary>
      {/* ScrollRestoration handles scroll position on navigation */}
      <ScrollRestoration />

      <AppProviders
        branding={branding}
        setBranding={setBranding}
        refreshBranding={refreshBranding}
      >
        {/* Global Learning Milestone Celebration Display */}
        <LearningMilestone />

        <AppHeader />

        {/* Patient Banner - Shows currently selected patient */}
        <ClinicalPatientBanner className="sticky top-0 z-40" />

        <AuthGate>
          {/* Idle Timeout Provider - Auto-logout after 15 min inactivity (HIPAA compliance) */}
          <IdleTimeoutProvider timeoutMinutes={15} warningMinutes={2}>
            <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
              {/* Child routes render here via Outlet */}
              <Outlet />
            </Suspense>

            <Footer />

            {/* Offline indicator for all users */}
            <OfflineIndicator />

            {/* Envision Atlus Clinical Components */}
            <ClinicalModeComponents />
          </IdleTimeoutProvider>
        </AuthGate>
      </AppProviders>
    </ErrorBoundary>
  );
};

export default RootLayout;
