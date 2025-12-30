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
import { VoiceCommandBar } from '../admin/VoiceCommandBar';
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

      {/* Notification Dock - Consolidates all floating notifications (ATLUS: Leading) */}
      <EANotificationDock />
    </>
  );
}

export default ClinicalModeComponents;
