/**
 * Automatic Passive SDOH Detection Hook
 *
 * Automatically triggers SDOH detection when new content is created.
 * Can be called from:
 * - Clinical note save handlers
 * - Community post creation
 * - Check-in submission
 * - Message sending
 */

import { useEffect, useCallback } from 'react';
import { SDOHPassiveDetectionService } from '../services/sdohPassiveDetection';
import type { SDOHTextSource } from '../services/sdohPassiveDetection';

interface UsePassiveSDOHDetectionOptions {
  /**
   * Whether to automatically run detection
   * Set to false to only run on manual trigger
   */
  autoDetect?: boolean;

  /**
   * Callback when detections are found
   */
  onDetectionsFound?: (count: number) => void;

  /**
   * Callback when detection fails
   */
  onError?: (error: Error) => void;
}

/**
 * Hook for automatic passive SDOH detection
 *
 * @example
 * ```tsx
 * const { detectFromText } = usePassiveSDOHDetection({
 *   onDetectionsFound: (count) => {
 *     toast.success(`Found ${count} potential SDOH indicators`);
 *   }
 * });
 *
 * // In your save handler:
 * const handleSaveNote = async () => {
 *   const savedNote = await saveNote(noteText);
 *   await detectFromText(noteText, 'clinical_note', savedNote.id, patientId);
 * };
 * ```
 */
export function usePassiveSDOHDetection(options: UsePassiveSDOHDetectionOptions = {}) {
  const {
    autoDetect: _autoDetect = true,
    onDetectionsFound,
    onError
  } = options;

  /**
   * Manually trigger detection on text content
   */
  const detectFromText = useCallback(async (
    text: string,
    source: SDOHTextSource,
    sourceId: string,
    patientId: string
  ): Promise<number> => {
    try {
      const detections = await SDOHPassiveDetectionService.analyzeText(
        text,
        source,
        sourceId,
        patientId
      );

      if (detections.length > 0 && onDetectionsFound) {
        onDetectionsFound(detections.length);
      }

      return detections.length;
    } catch (error) {
      // Error logged server-side, fail silently on client
      if (onError && error instanceof Error) {
        onError(error);
      }
      return 0;
    }
  }, [onDetectionsFound, onError]);

  /**
   * Scan all recent communications for a patient
   */
  const scanPatientCommunications = useCallback(async (
    patientId: string
  ): Promise<number> => {
    try {
      const detections = await SDOHPassiveDetectionService.scanRecentCommunications(patientId);

      if (detections.length > 0 && onDetectionsFound) {
        onDetectionsFound(detections.length);
      }

      return detections.length;
    } catch (error) {
      // Error logged server-side, fail silently on client
      if (onError && error instanceof Error) {
        onError(error);
      }
      return 0;
    }
  }, [onDetectionsFound, onError]);

  return {
    detectFromText,
    scanPatientCommunications
  };
}

/**
 * Hook that automatically scans patient communications on mount
 * Useful for patient detail pages
 */
export function useAutoSDOHScan(patientId: string | null, enabled: boolean = true) {
  const { scanPatientCommunications } = usePassiveSDOHDetection();

  useEffect(() => {
    if (enabled && patientId) {
      // Run initial scan with a slight delay to avoid blocking UI
      const timer = setTimeout(() => {
        scanPatientCommunications(patientId);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [patientId, enabled, scanPatientCommunications]);
}

export default usePassiveSDOHDetection;
