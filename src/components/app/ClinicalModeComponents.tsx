/**
 * ClinicalModeComponents.tsx
 *
 * Renders Envision Atlus components only for clinical users (physicians, nurses, admin, etc.)
 * WellFit community users (seniors, patients, caregivers) see a simplified interface.
 *
 * ATLUS Principles Applied:
 * - Intuitive: VoiceCommandBar, GlobalSearchBar, VoiceSearchOverlay
 * - Unity: EASessionResume (session persistence)
 * - Leading: EANotificationDock (consolidated notifications)
 */

import React from 'react';

// Global UI Components for Clinical Mode
// Note: VoiceCommandBar removed - GlobalSearchBar now has integrated voice search
import { VoiceCommandButton } from '../voice/VoiceCommandButton';
import { VoiceSearchOverlay } from '../voice/VoiceSearchOverlay';
import { GlobalSearchBar } from '../search/GlobalSearchBar';
import { EASessionResume } from '../envision-atlus/EASessionResume';
import { EANotificationDock } from '../envision-atlus/EANotificationDock';

// Clinical Mode Hook
import { useClinicalMode } from '../../hooks/useClinicalMode';

/**
 * Clinical Mode Wrapper Component
 * Only renders Envision Atlus components for clinical users.
 */
export function ClinicalModeComponents(): React.ReactElement | null {
  const { isClinical, loading } = useClinicalMode();

  // Don't render clinical components while loading or for non-clinical users
  if (loading || !isClinical) {
    return null;
  }

  return (
    <>
      {/* Voice Navigation Assistant - "Hey Vision" hands-free commands */}
      {/* Push-to-start (HIPAA compliant) - user clicks to activate, can pause for privacy */}
      <VoiceCommandButton />

      {/* Global Search Bar with Voice - keyboard (Ctrl+/) or mic button */}
      {/* Unified search + voice interface in header */}
      <div className="fixed top-4 right-4 z-50">
        <GlobalSearchBar />
      </div>

      {/* Voice Search Overlay - Shows search results from smart voice commands */}
      <VoiceSearchOverlay />

      {/* Session Resume Prompt - Shows when user returns and has previous session */}
      <EASessionResume />

      {/* Notification Dock - Consolidates all floating notifications */}
      <EANotificationDock />
    </>
  );
}

export default ClinicalModeComponents;
