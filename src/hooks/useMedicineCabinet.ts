/**
 * useMedicineCabinet Hook
 *
 * Enterprise-grade React hook for medication management
 * Handles all Medicine Cabinet operations with state management
 */

import { useState, useEffect, useCallback } from 'react';
import medicationAPI, { Medication, MedicationReminder } from '../api/medications';
import { LabelExtractionResult, MedicationInfo } from '../services/medicationLabelReader';
import { PsychMedAlert } from '../services/psychMedClassifier';

// Type definitions for adherence and dose tracking
interface DoseRecord {
  taken_at?: string;
  status?: 'taken' | 'missed' | 'skipped';
  notes?: string;
}

// Extended PsychMedAlert with optional properties used by components
interface ExtendedPsychMedAlert extends PsychMedAlert {
  id?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  acknowledged?: boolean;
}

interface UseMedicineCabinetReturn {
  // State
  medications: Medication[];
  loading: boolean;
  error: string | null;
  processing: boolean;
  uploadProgress: number;
  psychMedAlert: PsychMedAlert | null;
  psychAlerts: ExtendedPsychMedAlert[];

  // CRUD operations
  loadMedications: () => Promise<void>;
  addMedication: (data: Partial<Medication>) => Promise<boolean>;
  updateMedication: (id: string, updates: Partial<Medication>) => Promise<boolean>;
  deleteMedication: (id: string) => Promise<boolean>;
  discontinueMedication: (id: string, reason?: string) => Promise<boolean>;

  // Label reading
  scanMedicationLabel: (imageFile: File) => Promise<LabelExtractionResult | null>;
  confirmScannedMedication: (medicationInfo: MedicationInfo) => Promise<boolean>;

  // Reminders
  getReminders: (medicationId: string) => Promise<MedicationReminder[]>;
  addReminder: (reminderData: Partial<MedicationReminder>) => Promise<boolean>;
  updateReminder: (id: string, updates: Partial<MedicationReminder>) => Promise<boolean>;
  deleteReminder: (id: string) => Promise<boolean>;

  // Adherence - use generic types to avoid conflicts with component-local types
  recordDose: (medicationId: string, data: DoseRecord) => Promise<boolean>;
  getAdherence: (medicationId?: string, days?: number) => Promise<unknown[] | null>;
  getNeedingRefill: (daysThreshold?: number) => Promise<Medication[]>;
  getUpcomingDoses: (hoursAhead?: number) => Promise<unknown[]>;

  // Psychiatric medication alerts
  checkPsychMeds: () => Promise<void>;
  acknowledgePsychAlert: (alertId: string) => Promise<boolean>;
}

export function useMedicineCabinet(userId: string): UseMedicineCabinetReturn {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [psychMedAlert, setPsychMedAlert] = useState<PsychMedAlert | null>(null);
  const [psychAlerts, setPsychAlerts] = useState<ExtendedPsychMedAlert[]>([]);

  // Load medications
  const loadMedications = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await medicationAPI.getMedications(userId, 'active');
      if (response.success && response.data) {
        setMedications(response.data);
      } else {
        setError(response.error || 'Failed to load medications');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Add medication
  const addMedication = useCallback(async (data: Partial<Medication>): Promise<boolean> => {
    setError(null);
    try {
      const response = await medicationAPI.createMedication({
        ...data,
        user_id: userId
      });

      if (response.success) {
        await loadMedications();
        return true;
      } else {
        setError(response.error || 'Failed to add medication');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [userId, loadMedications]);

  // Update medication
  const updateMedication = useCallback(async (
    id: string,
    updates: Partial<Medication>
  ): Promise<boolean> => {
    setError(null);
    try {
      const response = await medicationAPI.updateMedication(id, updates);
      if (response.success) {
        await loadMedications();
        return true;
      } else {
        setError(response.error || 'Failed to update medication');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [loadMedications]);

  // Delete medication
  const deleteMedication = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await medicationAPI.deleteMedication(id);
      if (response.success) {
        await loadMedications();
        return true;
      } else {
        setError(response.error || 'Failed to delete medication');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [loadMedications]);

  // Discontinue medication
  const discontinueMedication = useCallback(async (
    id: string,
    reason?: string
  ): Promise<boolean> => {
    setError(null);
    try {
      const response = await medicationAPI.discontinueMedication(id, reason);
      if (response.success) {
        await loadMedications();
        return true;
      } else {
        setError(response.error || 'Failed to discontinue medication');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [loadMedications]);

  // Scan medication label
  const scanMedicationLabel = useCallback(async (
    imageFile: File
  ): Promise<LabelExtractionResult | null> => {
    setProcessing(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await medicationAPI.extractMedicationFromImage(userId, imageFile);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.success && response.data) {
        // If medication was auto-created, reload list
        if (response.data.medication) {
          await loadMedications();
        }
        return response.data.extraction;
      } else {
        setError(response.error || 'Failed to scan medication label');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [userId, loadMedications]);

  // Confirm scanned medication
  const confirmScannedMedication = useCallback(async (
    medicationInfo: MedicationInfo
  ): Promise<boolean> => {
    setError(null);
    try {
      const response = await medicationAPI.confirmMedication(userId, medicationInfo);
      if (response.success) {
        await loadMedications();
        return true;
      } else {
        setError(response.error || 'Failed to confirm medication');
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [userId, loadMedications]);

  // Reminders
  const getReminders = useCallback(async (medicationId: string): Promise<MedicationReminder[]> => {
    const response = await medicationAPI.getMedicationReminders(medicationId);
    return response.data || [];
  }, []);

  const addReminder = useCallback(async (reminderData: Partial<MedicationReminder>): Promise<boolean> => {
    const response = await medicationAPI.createMedicationReminder({
      ...reminderData,
      user_id: userId
    });
    return response.success;
  }, [userId]);

  const updateReminder = useCallback(async (
    id: string,
    updates: Partial<MedicationReminder>
  ): Promise<boolean> => {
    const response = await medicationAPI.updateMedicationReminder(id, updates);
    return response.success;
  }, []);

  const deleteReminder = useCallback(async (id: string): Promise<boolean> => {
    const response = await medicationAPI.deleteMedicationReminder(id);
    return response.success;
  }, []);

  // Adherence tracking
  const recordDose = useCallback(async (medicationId: string, data: DoseRecord): Promise<boolean> => {
    const response = await medicationAPI.recordDoseTaken({
      medication_id: medicationId,
      user_id: userId,
      ...data
    });
    return response.success;
  }, [userId]);

  const getAdherence = useCallback(async (medicationId?: string, days: number = 30): Promise<unknown[] | null> => {
    const response = await medicationAPI.getMedicationAdherence(userId, medicationId, days);
    return response.data as unknown[] | null;
  }, [userId]);

  const getNeedingRefill = useCallback(async (daysThreshold: number = 7): Promise<Medication[]> => {
    const response = await medicationAPI.getMedicationsNeedingRefill(userId, daysThreshold);
    return response.data || [];
  }, [userId]);

  const getUpcomingDoses = useCallback(async (hoursAhead: number = 24): Promise<unknown[]> => {
    const response = await medicationAPI.getUpcomingReminders(userId, hoursAhead);
    return (response.data || []) as unknown[];
  }, [userId]);

  // Check for multiple psych meds
  const checkPsychMeds = useCallback(async () => {
    if (!userId) return;

    try {
      const [alertResponse, alertsResponse] = await Promise.all([
        medicationAPI.checkMultiplePsychMeds(userId),
        medicationAPI.getPsychMedAlerts(userId)
      ]);

      if (alertResponse.success && alertResponse.data) {
        setPsychMedAlert(alertResponse.data);
      }

      if (alertsResponse.success && alertsResponse.data) {
        setPsychAlerts(alertsResponse.data);
      }
    } catch (err) {

    }
  }, [userId]);

  // Acknowledge psych med alert
  const acknowledgePsychAlert = useCallback(async (alertId: string): Promise<boolean> => {
    const response = await medicationAPI.acknowledgePsychMedAlert(alertId, userId);
    if (response.success) {
      await checkPsychMeds(); // Reload alerts
    }
    return response.success;
  }, [userId, checkPsychMeds]);

  // Load medications and check psych meds on mount
  useEffect(() => {
    if (userId) {
      loadMedications();
      checkPsychMeds();
    }
  }, [userId, loadMedications, checkPsychMeds]);

  return {
    // State
    medications,
    loading,
    error,
    processing,
    uploadProgress,
    psychMedAlert,
    psychAlerts,

    // CRUD
    loadMedications,
    addMedication,
    updateMedication,
    deleteMedication,
    discontinueMedication,

    // Label reading
    scanMedicationLabel,
    confirmScannedMedication,

    // Reminders
    getReminders,
    addReminder,
    updateReminder,
    deleteReminder,

    // Adherence
    recordDose,
    getAdherence,
    getNeedingRefill,
    getUpcomingDoses,

    // Psychiatric medication alerts
    checkPsychMeds,
    acknowledgePsychAlert
  };
}

export default useMedicineCabinet;
