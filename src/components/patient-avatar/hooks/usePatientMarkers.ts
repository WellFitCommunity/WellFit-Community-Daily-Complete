/**
 * usePatientMarkers Hook
 *
 * React hook for managing patient markers data.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { PatientAvatarService } from '../../../services/patientAvatarService';
import {
  PatientMarker,
  CreateMarkerRequest,
  UpdateMarkerRequest,
  PatientMarkersResponse,
} from '../../../types/patientAvatar';

interface UsePatientMarkersResult {
  markers: PatientMarker[];
  pendingCount: number;
  attentionCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createMarker: (request: Omit<CreateMarkerRequest, 'patient_id'>) => Promise<PatientMarker | null>;
  updateMarker: (markerId: string, updates: UpdateMarkerRequest) => Promise<PatientMarker | null>;
  confirmMarker: (markerId: string) => Promise<boolean>;
  rejectMarker: (markerId: string) => Promise<boolean>;
  deactivateMarker: (markerId: string) => Promise<boolean>;
  confirmAllPending: () => Promise<number>;
}

export function usePatientMarkers(patientId: string | undefined): UsePatientMarkersResult {
  const { user } = useAuth();
  const [markers, setMarkers] = useState<PatientMarker[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMarkers = useCallback(async () => {
    if (!patientId) {
      setMarkers([]);
      setPendingCount(0);
      setAttentionCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await PatientAvatarService.getPatientMarkers(patientId);

    if (result.success) {
      setMarkers(result.data.markers);
      setPendingCount(result.data.pending_count);
      setAttentionCount(result.data.attention_count);
    } else {
      setError(result.error.message);
    }

    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  const createMarker = useCallback(
    async (request: Omit<CreateMarkerRequest, 'patient_id'>): Promise<PatientMarker | null> => {
      if (!patientId) return null;

      const result = await PatientAvatarService.createMarker(
        { ...request, patient_id: patientId },
        user?.id
      );

      if (result.success) {
        // Refresh to get updated counts
        await loadMarkers();
        return result.data;
      }

      setError(result.error.message);
      return null;
    },
    [patientId, user?.id, loadMarkers]
  );

  const updateMarker = useCallback(
    async (markerId: string, updates: UpdateMarkerRequest): Promise<PatientMarker | null> => {
      const result = await PatientAvatarService.updateMarker(markerId, updates, user?.id);

      if (result.success) {
        // Update local state
        setMarkers((prev) =>
          prev.map((m) => (m.id === markerId ? result.data : m))
        );
        return result.data;
      }

      setError(result.error.message);
      return null;
    },
    [user?.id]
  );

  const confirmMarker = useCallback(
    async (markerId: string): Promise<boolean> => {
      const result = await PatientAvatarService.confirmMarker(markerId, user?.id);

      if (result.success && result.data) {
        // Update local state
        setMarkers((prev) =>
          prev.map((m) =>
            m.id === markerId
              ? { ...m, status: 'confirmed' as const, requires_attention: false }
              : m
          )
        );
        setPendingCount((prev) => Math.max(0, prev - 1));
        return true;
      }

      if (!result.success) {
        setError(result.error.message);
      }
      return false;
    },
    [user?.id]
  );

  const rejectMarker = useCallback(
    async (markerId: string): Promise<boolean> => {
      const result = await PatientAvatarService.rejectMarker(markerId, user?.id);

      if (result.success && result.data) {
        // Remove from local state (rejected markers are not shown)
        setMarkers((prev) => prev.filter((m) => m.id !== markerId));
        setPendingCount((prev) => Math.max(0, prev - 1));
        return true;
      }

      if (!result.success) {
        setError(result.error.message);
      }
      return false;
    },
    [user?.id]
  );

  const deactivateMarker = useCallback(
    async (markerId: string): Promise<boolean> => {
      const result = await PatientAvatarService.deactivateMarker(markerId, user?.id);

      if (result.success && result.data) {
        // Remove from local state
        setMarkers((prev) => prev.filter((m) => m.id !== markerId));
        return true;
      }

      if (!result.success) {
        setError(result.error.message);
      }
      return false;
    },
    [user?.id]
  );

  const confirmAllPending = useCallback(async (): Promise<number> => {
    if (!patientId) return 0;

    const result = await PatientAvatarService.confirmAllPendingMarkers(patientId, user?.id);

    if (result.success) {
      // Update local state
      setMarkers((prev) =>
        prev.map((m) =>
          m.status === 'pending_confirmation'
            ? { ...m, status: 'confirmed' as const, requires_attention: false }
            : m
        )
      );
      setPendingCount(0);
      return result.data;
    }

    setError(result.error.message);
    return 0;
  }, [patientId, user?.id]);

  return {
    markers,
    pendingCount,
    attentionCount,
    loading,
    error,
    refresh: loadMarkers,
    createMarker,
    updateMarker,
    confirmMarker,
    rejectMarker,
    deactivateMarker,
    confirmAllPending,
  };
}

export default usePatientMarkers;
