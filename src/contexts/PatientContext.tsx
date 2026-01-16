/**
 * PatientContext
 *
 * ATLUS Enhancement: Unity - Maintains selected patient across dashboards
 *
 * This solves the critical problem where patient selection is lost when
 * navigating between different dashboards (e.g., from NeuroSuite to
 * Care Coordination).
 *
 * HIPAA COMPLIANCE (January 2026):
 * - localStorage stores ONLY patient IDs (no PHI)
 * - Patient data (names, DOB, MRN) kept in memory only
 * - On page refresh, IDs are restored but data must be re-fetched
 * - This prevents PHI exposure via browser developer tools
 *
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

// localStorage keys - ONLY store IDs, never PHI
const STORAGE_KEY = 'wf_selected_patient_id'; // Changed: only ID
const HISTORY_KEY = 'wf_patient_history_ids'; // Changed: only IDs

/**
 * Minimal patient info needed for cross-dashboard context
 * This is NOT the full patient record - just enough for identification and display
 */
export interface SelectedPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  mrn?: string; // Medical Record Number (for hospital patients)
  roomNumber?: string; // For inpatients
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  // Optional snapshot for quick display
  snapshot?: {
    primaryDiagnosis?: string;
    attendingPhysician?: string;
    unit?: string;
  };
}

interface PatientContextType {
  /** Currently selected patient */
  selectedPatient: SelectedPatient | null;
  /** Select a patient (persists ID only to localStorage) */
  selectPatient: (patient: SelectedPatient) => void;
  /** Clear patient selection */
  clearPatient: () => void;
  /** Recent patients for quick switching (last 10) - kept in memory */
  recentPatients: SelectedPatient[];
  /** Check if a patient is selected */
  hasPatient: boolean;
  /** Get patient display name */
  getPatientDisplayName: () => string;
  /** Select from recent history by ID */
  selectFromHistory: (patientId: string) => void;
  /** Clear all recent history */
  clearHistory: () => void;
  /** Patient ID that needs data fetched (for page refresh recovery) */
  pendingPatientId: string | null;
  /** Recent patient IDs that need data fetched */
  pendingHistoryIds: string[];
  /** Mark pending data as loaded */
  markPendingLoaded: () => void;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

/**
 * HIPAA-COMPLIANT: Load only patient ID from localStorage
 */
const loadPatientId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * HIPAA-COMPLIANT: Save only patient ID to localStorage
 */
const savePatientId = (patientId: string | null) => {
  try {
    if (patientId) {
      localStorage.setItem(STORAGE_KEY, patientId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

/**
 * HIPAA-COMPLIANT: Load only patient IDs from history
 */
const loadHistoryIds = (): string[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Ensure all items are strings (IDs only)
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

/**
 * HIPAA-COMPLIANT: Save only patient IDs to history
 */
const saveHistoryIds = (ids: string[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors
  }
};

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Patient data kept in MEMORY ONLY (not localStorage)
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [recentPatients, setRecentPatients] = useState<SelectedPatient[]>([]);

  // IDs that need data fetched (from localStorage on page refresh)
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(() => loadPatientId());
  const [pendingHistoryIds, setPendingHistoryIds] = useState<string[]>(() => loadHistoryIds());

  // Clear patient context on logout
  useEffect(() => {
    if (!user) {
      setSelectedPatient(null);
      setRecentPatients([]);
      setPendingPatientId(null);
      setPendingHistoryIds([]);
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(HISTORY_KEY);
      } catch {
        // Ignore
      }
    }
  }, [user]);

  // Select a patient
  const selectPatient = useCallback((patient: SelectedPatient) => {
    setSelectedPatient(patient);
    savePatientId(patient.id); // HIPAA: Only save ID

    // Update recent history (in memory)
    setRecentPatients(prev => {
      // Remove if already in history
      const filtered = prev.filter(p => p.id !== patient.id);
      // Add to front, limit to 10
      const updated = [patient, ...filtered].slice(0, 10);
      // Save only IDs to localStorage
      saveHistoryIds(updated.map(p => p.id));
      return updated;
    });

    // Clear pending since we have data
    setPendingPatientId(null);
  }, []);

  // Clear patient selection
  const clearPatient = useCallback(() => {
    setSelectedPatient(null);
    savePatientId(null);
    setPendingPatientId(null);
  }, []);

  // Get patient display name
  const getPatientDisplayName = useCallback((): string => {
    if (!selectedPatient) return '';
    const { firstName, lastName, roomNumber, mrn } = selectedPatient;
    let name = `${lastName}, ${firstName}`;
    if (roomNumber) {
      name += ` (Room ${roomNumber})`;
    } else if (mrn) {
      name += ` (MRN: ${mrn})`;
    }
    return name;
  }, [selectedPatient]);

  // Select from recent history
  const selectFromHistory = useCallback((patientId: string) => {
    const patient = recentPatients.find(p => p.id === patientId);
    if (patient) {
      selectPatient(patient);
    }
  }, [recentPatients, selectPatient]);

  // Clear all history
  const clearHistory = useCallback(() => {
    setRecentPatients([]);
    setPendingHistoryIds([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Mark pending data as loaded (called by consumer after fetching)
  const markPendingLoaded = useCallback(() => {
    setPendingPatientId(null);
    setPendingHistoryIds([]);
  }, []);

  const value: PatientContextType = {
    selectedPatient,
    selectPatient,
    clearPatient,
    recentPatients,
    hasPatient: selectedPatient !== null,
    getPatientDisplayName,
    selectFromHistory,
    clearHistory,
    pendingPatientId,
    pendingHistoryIds,
    markPendingLoaded,
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};

export const usePatientContext = (): PatientContextType => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatientContext must be used within a PatientProvider');
  }
  return context;
};

/**
 * Optional hook for components that may be outside provider
 * Returns null values instead of throwing
 */
export const usePatientContextSafe = (): PatientContextType | null => {
  return useContext(PatientContext) || null;
};

export default PatientContext;
