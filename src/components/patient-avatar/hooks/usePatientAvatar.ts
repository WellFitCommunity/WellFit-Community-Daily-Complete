/**
 * usePatientAvatar Hook
 *
 * React hook for managing patient avatar preferences (skin tone, gender)
 * with real-time sync across clinician sessions.
 */

import { useState, useEffect, useCallback } from 'react';
import { PatientAvatarService } from '../../../services/patientAvatarService';
import { useRealtimeSubscription } from '../../../hooks/useRealtimeSubscription';
import {
  PatientAvatar,
  SkinTone,
  GenderPresentation,
} from '../../../types/patientAvatar';

interface UsePatientAvatarResult {
  avatar: PatientAvatar | null;
  loading: boolean;
  error: string | null;
  updateSkinTone: (skinTone: SkinTone) => Promise<boolean>;
  updateGenderPresentation: (gender: GenderPresentation) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function usePatientAvatar(patientId: string | undefined): UsePatientAvatarResult {
  const [avatar, setAvatar] = useState<PatientAvatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAvatar = useCallback(async () => {
    if (!patientId) {
      setAvatar(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await PatientAvatarService.getPatientAvatar(patientId);

    if (result.success) {
      setAvatar(result.data);
    } else {
      setError(result.error.message);
    }

    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  // Real-time subscription: auto-refresh avatar when settings change
  useRealtimeSubscription({
    table: 'patient_avatars',
    event: 'UPDATE',
    filter: patientId ? `patient_id=eq.${patientId}` : undefined,
    componentName: 'usePatientAvatar',
    initialFetch: patientId ? async () => {
      const result = await PatientAvatarService.getPatientAvatar(patientId);
      if (result.success) {
        setAvatar(result.data);
        return [result.data];
      }
      return [];
    } : undefined,
  });

  const updateSkinTone = useCallback(
    async (skinTone: SkinTone): Promise<boolean> => {
      if (!patientId) return false;

      const result = await PatientAvatarService.updatePatientAvatar(patientId, {
        skin_tone: skinTone,
      });

      if (result.success) {
        setAvatar(result.data);
        return true;
      }

      setError(result.error.message);
      return false;
    },
    [patientId]
  );

  const updateGenderPresentation = useCallback(
    async (gender: GenderPresentation): Promise<boolean> => {
      if (!patientId) return false;

      const result = await PatientAvatarService.updatePatientAvatar(patientId, {
        gender_presentation: gender,
      });

      if (result.success) {
        setAvatar(result.data);
        return true;
      }

      setError(result.error.message);
      return false;
    },
    [patientId]
  );

  return {
    avatar,
    loading,
    error,
    updateSkinTone,
    updateGenderPresentation,
    refresh: loadAvatar,
  };
}

export default usePatientAvatar;
