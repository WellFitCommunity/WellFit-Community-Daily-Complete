/**
 * Voice Search Hook
 *
 * Easy integration of voice search into dashboards.
 * Automatically registers search handlers and handles result selection.
 *
 * ATLUS: Intuitive Technology - Voice-first healthcare UX
 *
 * Supports all entity types:
 * - Patients (by name, diagnosis, medication, unit, risk level)
 * - Beds/Rooms
 * - Alerts
 * - Tasks
 * - Referrals
 * - Shifts/Handoffs
 * - Admissions/Discharges
 * - Providers
 * - Caregivers
 *
 * Example usage:
 * ```tsx
 * useVoiceSearch({
 *   entityTypes: ['patient', 'alert', 'task'],
 *   onPatientSelected: (patient) => setSelectedPatient(patient),
 *   onAlertSelected: (alert) => navigateToAlert(alert),
 * });
 * ```
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../contexts/AuthContext';
import {
  useVoiceActionSafe,
  useVoiceSearchHandler,
  EntityType,
  ParsedEntity,
  SearchResult,
} from '../contexts/VoiceActionContext';
import { usePatientContext, SelectedPatient } from '../contexts/PatientContext';
import { voiceSearch, searchPatients, searchBeds, searchProviders } from '../services/voiceSearchService';
import { auditLogger } from '../services/auditLogger';

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceSearchOptions {
  /** Which entity types this dashboard handles */
  entityTypes?: EntityType[];

  // Entity-specific callbacks
  onPatientSelected?: (result: SearchResult) => void;
  onBedSelected?: (result: SearchResult) => void;
  onRoomSelected?: (result: SearchResult) => void;
  onProviderSelected?: (result: SearchResult) => void;
  onCaregiverSelected?: (result: SearchResult) => void;
  onAlertSelected?: (result: SearchResult) => void;
  onTaskSelected?: (result: SearchResult) => void;
  onReferralSelected?: (result: SearchResult) => void;
  onShiftSelected?: (result: SearchResult) => void;
  onHandoffSelected?: (result: SearchResult) => void;
  onAdmissionSelected?: (result: SearchResult) => void;
  onDischargeSelected?: (result: SearchResult) => void;

  /** Called when any entity is selected (generic handler) */
  onResultSelected?: (result: SearchResult) => void;

  /** Auto-update PatientContext when patient is selected (default: true) */
  updatePatientContext?: boolean;

  /** Auto-scroll to element with matching ID (default: false) */
  autoScrollToResult?: boolean;
}

export interface VoiceSearchReturn {
  /** Whether voice search is currently active */
  isSearching: boolean;

  /** Current search results */
  searchResults: SearchResult[];

  /** Handle result selection (called by overlay or manually) */
  handleResultSelected: (result: SearchResult) => void;

  /** Clear current voice action */
  clearVoiceAction: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useVoiceSearch(options: VoiceSearchOptions = {}): VoiceSearchReturn {
  const {
    entityTypes = ['patient'],
    onPatientSelected,
    onBedSelected,
    onRoomSelected,
    onProviderSelected,
    onCaregiverSelected,
    onAlertSelected,
    onTaskSelected,
    onReferralSelected,
    onShiftSelected,
    onHandoffSelected,
    onAdmissionSelected,
    onDischargeSelected,
    onResultSelected,
    updatePatientContext = true,
    autoScrollToResult = false,
  } = options;

  const supabase = useSupabaseClient();
  const voiceAction = useVoiceActionSafe();
  const { selectPatient } = usePatientContext();

  // Create search handler for each entity type
  const createSearchHandler = useCallback(
    (entityType: EntityType) => async (entity: ParsedEntity): Promise<SearchResult[]> => {
      if (!supabase) return [];

      auditLogger.debug('VOICE_SEARCH_HANDLER_CALLED', { entityType, query: entity.query });

      switch (entityType) {
        case 'patient':
        case 'medication':
        case 'diagnosis':
        case 'admission':
        case 'discharge':
          // All patient-related searches use the patient search
          return searchPatients(supabase, entity);

        case 'bed':
        case 'room':
          return searchBeds(supabase, entity);

        case 'provider':
          return searchProviders(supabase, entity);

        case 'alert':
        case 'task':
        case 'referral':
        case 'shift':
        case 'handoff':
        case 'caregiver':
          // These dispatch events for specific dashboards to handle
          // They may not have database search handlers
          return voiceSearch(supabase, entity);

        default:
          return voiceSearch(supabase, entity);
      }
    },
    [supabase]
  );

  // Register search handlers for each entity type
  for (const entityType of entityTypes) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useVoiceSearchHandler(entityType, createSearchHandler(entityType), [supabase, entityType]);
  }

  // Handle result selection
  const handleResultSelected = useCallback(
    (result: SearchResult) => {
      auditLogger.info('VOICE_SEARCH_RESULT_SELECTED', {
        type: result.type,
        id: result.id,
        primaryText: result.primaryText,
      });

      // Call type-specific handler
      switch (result.type) {
        case 'patient':
        case 'medication':
        case 'diagnosis':
        case 'admission':
        case 'discharge':
          // Update PatientContext if enabled
          if (updatePatientContext && result.metadata) {
            const patient: SelectedPatient = {
              id: result.id,
              firstName: result.metadata.firstName as string,
              lastName: result.metadata.lastName as string,
              mrn: result.metadata.mrn as string | undefined,
              roomNumber: result.metadata.roomNumber as string | undefined,
              riskLevel: getRiskLevelFromScore(result.metadata.riskScore as number | undefined),
              snapshot: {
                unit: result.metadata.unit as string | undefined,
                primaryDiagnosis: result.metadata.diagnosis as string | undefined,
              },
            };
            selectPatient(patient);
          }
          onPatientSelected?.(result);
          if (result.type === 'admission') onAdmissionSelected?.(result);
          if (result.type === 'discharge') onDischargeSelected?.(result);
          break;

        case 'bed':
          onBedSelected?.(result);
          break;

        case 'room':
          onRoomSelected?.(result);
          break;

        case 'provider':
          onProviderSelected?.(result);
          break;

        case 'caregiver':
          onCaregiverSelected?.(result);
          break;

        case 'alert':
          onAlertSelected?.(result);
          break;

        case 'task':
          onTaskSelected?.(result);
          break;

        case 'referral':
          onReferralSelected?.(result);
          break;

        case 'shift':
          onShiftSelected?.(result);
          break;

        case 'handoff':
          onHandoffSelected?.(result);
          break;
      }

      // Call generic handler
      onResultSelected?.(result);

      // Auto-scroll if enabled
      if (autoScrollToResult) {
        const element = document.getElementById(`entity-${result.type}-${result.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-voice-result');
          setTimeout(() => element.classList.remove('highlight-voice-result'), 2000);
        }
      }
    },
    [
      updatePatientContext,
      selectPatient,
      onPatientSelected,
      onBedSelected,
      onRoomSelected,
      onProviderSelected,
      onCaregiverSelected,
      onAlertSelected,
      onTaskSelected,
      onReferralSelected,
      onShiftSelected,
      onHandoffSelected,
      onAdmissionSelected,
      onDischargeSelected,
      onResultSelected,
      autoScrollToResult,
    ]
  );

  // Listen for voice result selection events
  useEffect(() => {
    const handleVoiceResultEvent = (event: CustomEvent<{ result: SearchResult }>) => {
      handleResultSelected(event.detail.result);
    };

    window.addEventListener('voiceResultSelected', handleVoiceResultEvent as EventListener);
    return () => {
      window.removeEventListener('voiceResultSelected', handleVoiceResultEvent as EventListener);
    };
  }, [handleResultSelected]);

  // Clear voice action
  const clearVoiceAction = useCallback(() => {
    voiceAction?.clearAction();
  }, [voiceAction]);

  return {
    isSearching: voiceAction?.isSearching ?? false,
    searchResults: voiceAction?.searchResults ?? [],
    handleResultSelected,
    clearVoiceAction,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getRiskLevelFromScore(score?: number): 'critical' | 'high' | 'medium' | 'low' {
  if (!score) return 'low';
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export default useVoiceSearch;
