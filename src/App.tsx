// src/App.tsx
// Main application component - refactored for maintainability
import React, { useEffect, useState, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { BrandingConfig, getCurrentBranding } from './branding.config';
import { performanceMonitor } from './services/performanceMonitoring';
import { GuardianAgent } from './services/guardian-agent/GuardianAgent';
import { smartRecordingStrategy } from './services/guardian-agent/SmartRecordingStrategy';
import { queryClient } from './lib/queryClient';

// Route modules
import { AppProviders, RouteRenderer } from './routes';

// Auth
import AuthGate from './AuthGate';
import { useSupabaseClient } from './contexts/AuthContext';

// Layout
import AppHeader from './components/layout/AppHeader';
import Footer from './components/layout/Footer';

// Global UI Components
import OfflineIndicator from './components/OfflineIndicator';
import { VoiceCommandBar } from './components/admin/VoiceCommandBar';
import { VoiceCommandButton } from './components/voice/VoiceCommandButton';
import { VoiceSearchOverlay } from './components/voice/VoiceSearchOverlay';
import { GlobalSearchBar } from './components/search/GlobalSearchBar';
import { EAPatientBanner } from './components/envision-atlus/EAPatientBanner';
import { EASessionResume } from './components/envision-atlus/EASessionResume';
import { EARealtimeAlertNotifications } from './components/envision-atlus/EARealtimeAlertNotifications';
import { LearningMilestone } from './components/ai-transparency';
import { IdleTimeoutProvider } from './components/IdleTimeoutProvider';

// Theme
import { useThemeInit } from './hooks/useTheme';

// Clinical Mode - separates Envision Atlus (clinical) from WellFit (community)
import { useClinicalMode } from './hooks/useClinicalMode';

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICAL MODE WRAPPER
// Only renders Envision Atlus components for clinical users (physicians, nurses, admin, etc.)
// WellFit community users (seniors, patients, caregivers) see simplified interface
// ═══════════════════════════════════════════════════════════════════════════════

function ClinicalModeComponents() {
  const { isClinical, loading } = useClinicalMode();

  // Don't render clinical components while loading or for non-clinical users
  if (loading || !isClinical) {
    return null;
  }

  return (
    <>
      {/* Global Voice Command Bar - compact mic icon that expands when clicked */}
      <VoiceCommandBar />

      {/* "Hey Vision" Wake Word Assistant - always listening, hands-free navigation */}
      {/* "Always listening, always learning" - Envision Atlus */}
      <VoiceCommandButton />

      {/* Global Search Bar - keyboard-accessible search (Ctrl+/) (ATLUS: Intuitive) */}
      <div className="fixed top-4 right-4 z-50">
        <GlobalSearchBar />
      </div>

      {/* Voice Search Overlay - Shows search results from smart voice commands (ATLUS: Intuitive) */}
      <VoiceSearchOverlay />

      {/* Session Resume Prompt - Shows when user returns and has previous session (ATLUS: Unity) */}
      <EASessionResume />

      {/* Real-Time Alert Notifications - Push-based critical alerts (ATLUS: Leading) */}
      <EARealtimeAlertNotifications />
    </>
  );
}

/**
 * Clinical Patient Banner Wrapper
 * Only shows patient banner for clinical users (outside AuthGate for layout purposes)
 */
function ClinicalPatientBanner({ className }: { className?: string }) {
  const { isClinical, loading } = useClinicalMode();

  if (loading || !isClinical) {
    return null;
  }

  return <EAPatientBanner className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function Shell() {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();
  const { supabase, user } = useSupabaseClient() as any;

  // Initialize theme from database/localStorage
  useThemeInit();

  // Initialize performance monitoring
  useEffect(() => {
    if (supabase) {
      performanceMonitor.initialize(supabase, user?.id);
    }
  }, [supabase, user?.id]);

  // Initialize Guardian Agent - Self-healing system with Guardian Eyes recording
  useEffect(() => {
    const guardian = GuardianAgent.getInstance({
      autoHealEnabled: true,
      requireApprovalForCritical: false,
      learningEnabled: true,
      hipaaComplianceMode: true
    });

    guardian.start();

    // Start Guardian Eyes smart recording (1% sampling + all errors/security events)
    smartRecordingStrategy.startSmartRecording(user?.id).catch(() => {
      // Silent fail - recording is optional enhancement
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
    <AppProviders
      branding={branding}
      setBranding={setBranding}
      refreshBranding={refreshBranding}
    >
      {/* Global Learning Milestone Celebration Display */}
      <LearningMilestone />

      <AppHeader />

      {/* Patient Banner - Shows currently selected patient (ATLUS: Unity) */}
      {/* Only visible to clinical users (physicians, nurses, admin, etc.) */}
      <ClinicalPatientBanner className="sticky top-0 z-40" />

      <AuthGate>
        {/* Idle Timeout Provider - Auto-logout after 15 min inactivity (HIPAA compliance) */}
        <IdleTimeoutProvider timeoutMinutes={15} warningMinutes={2}>
          <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
            <RouteRenderer />
          </Suspense>

          <Footer />

          {/* Offline indicator for all users */}
          <OfflineIndicator />

          {/* Envision Atlus Clinical Components - Hidden from WellFit community users */}
          {/* Clinical users see: VoiceCommandBar, GlobalSearchBar, VoiceSearchOverlay, EASessionResume, EARealtimeAlertNotifications */}
          {/* Community users (seniors, patients, caregivers) see simplified WellFit interface */}
          <ClinicalModeComponents />
        </IdleTimeoutProvider>
      </AuthGate>
    </AppProviders>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
      {/* React Query DevTools - Only visible in development */}
      {import.meta.env.MODE === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
};

export default App;
