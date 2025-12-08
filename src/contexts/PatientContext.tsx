/**
 * PatientContext
 *
 * ATLUS Enhancement: Unity - Maintains selected patient across dashboards
 *
 * This solves the critical problem where patient selection is lost when
 * navigating between different dashboards (e.g., from NeuroSuite to
 * Care Coordination).
 *
 * Features:
 * - Persists selected patient to localStorage
 * - Maintains recent patient history (last 10)
 * - Auto-restores patient on page refresh
 * - Provides patient banner data for consistent display
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';

// localStorage keys
const STORAGE_KEY = 'wf_selected_patient';
const HISTORY_KEY = 'wf_patient_history';

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
  /** Select a patient (persists to localStorage) */
  selectPatient: (patient: SelectedPatient) => void;
  /** Clear patient selection */
  clearPatient: () => void;
  /** Recent patients for quick switching (last 10) */
  recentPatients: SelectedPatient[];
  /** Check if a patient is selected */
  hasPatient: boolean;
  /** Get patient display name */
  getPatientDisplayName: () => string;
  /** Select from recent history by ID */
  selectFromHistory: (patientId: string) => void;
  /** Clear all recent history */
  clearHistory: () => void;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

// Helper functions for localStorage
const loadPatient = (): SelectedPatient | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

const savePatient = (patient: SelectedPatient | null) => {
  try {
    if (patient) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patient));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

const loadHistory = (): SelectedPatient[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

const saveHistory = (history: SelectedPatient[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
};

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Initialize from localStorage
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(() => loadPatient());
  const [recentPatients, setRecentPatients] = useState<SelectedPatient[]>(() => loadHistory());

  // Clear patient context on logout
  useEffect(() => {
    if (!user) {
      setSelectedPatient(null);
      setRecentPatients([]);
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
    savePatient(patient);

    // Update recent history
    setRecentPatients(prev => {
      // Remove if already in history
      const filtered = prev.filter(p => p.id !== patient.id);
      // Add to front, limit to 10
      const updated = [patient, ...filtered].slice(0, 10);
      saveHistory(updated);
      return updated;
    });
  }, []);

  // Clear patient selection
  const clearPatient = useCallback(() => {
    setSelectedPatient(null);
    savePatient(null);
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
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore
    }
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
