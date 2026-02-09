/**
 * MedicineCabinet Types
 *
 * Shared type definitions for the Medicine Cabinet module.
 */

import { Medication } from '../../../api/medications';
import { LabelExtractionResult, MedicationInfo } from '../../../services/medicationLabelReader';

// Tab type for navigation
export type TabId = 'all' | 'scan' | 'identify' | 'verify' | 'adherence' | 'reminders';

// Adherence tracking data
export interface AdherenceDataItem {
  medication_id: string;
  medication_name: string;
  adherence_rate: number;
  total_taken: number;
  total_scheduled: number;
}

// Upcoming dose reminder
export interface UpcomingDose {
  medication_id: string;
  medication_name: string;
  dosage: string;
  instructions: string;
  next_reminder_at: string;
}

// MedicationCard props
export interface MedicationCardProps {
  medication: Medication;
  onDelete: () => void;
  onTakeDose: () => void;
  onAddReminder: () => void;
  onVerifyPill: () => void;
}

// StatsCards props
export interface StatsCardsProps {
  medicationCount: number;
  overallAdherence: number;
  needingRefillCount: number;
  upcomingDosesCount: number;
}

// TabNavigation props
export interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

// PsychMedAlert props
export interface PsychMedAlertProps {
  psychMedAlert: {
    hasMultiplePsychMeds: boolean;
    psychMedCount: number;
    requiresReview: boolean;
    medications: Array<{ name: string; category: string }>;
    warnings: string[];
  };
  psychAlerts: Array<{
    id?: string;
    severity?: string;
    acknowledged?: boolean;
  }>;
  onAcknowledge: (alertId: string) => Promise<boolean>;
}

// ScannerView props
export interface ScannerViewProps {
  processing: boolean;
  uploadProgress: number;
  scannedData: LabelExtractionResult | null;
  onScan: (file: File) => void;
  onConfirm: (medicationInfo: MedicationInfo) => void;
}

// ScannerModal props
export interface ScannerModalProps {
  onClose: () => void;
  onScan: (file: File) => void;
  processing: boolean;
  uploadProgress: number;
}

// AdherenceView props
export interface AdherenceViewProps {
  adherenceData: AdherenceDataItem[];
  medications: Medication[];
}

// RemindersView props
export interface RemindersViewProps {
  upcomingDoses: UpcomingDose[];
  onTakeDose: (medicationId: string) => void;
}
