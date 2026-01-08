/**
 * Medication API - Barrel Export
 * Central export point for all medication operations
 *
 * REFACTORED: 2025-11-04
 * - Extracted from monolithic medications.ts (1,113 lines → 6 modules ~150-200 lines each)
 * - Modular architecture for better maintainability
 * - Follows Strangler Fig Pattern for zero breaking changes
 */

// Export types
// Default export for backwards compatibility
import * as MedicationCrud from './MedicationCrud';
import * as MedicationExtraction from './MedicationExtraction';
import * as MedicationReminders from './MedicationReminders';
import * as MedicationAdherence from './MedicationAdherence';
import * as PillIdentification from './PillIdentification';
import * as PsychMedManagement from './PsychMedManagement';

export type { ApiResponse, Medication, MedicationReminder, MedicationDoseTaken, PsychMedAlertRecord } from './types';

// CRUD Operations
export {
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
  discontinueMedication
} from './MedicationCrud';

// Label Extraction (AI-powered)
export {
  extractMedicationFromImage,
  confirmMedication
} from './MedicationExtraction';

// Reminders
export {
  getMedicationReminders,
  createMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder
} from './MedicationReminders';

// Adherence Tracking
export {
  recordDoseTaken,
  getMedicationAdherence,
  getMedicationsNeedingRefill,
  getUpcomingReminders
} from './MedicationAdherence';

// Pill Identification
export {
  identifyPill,
  comparePillWithLabel,
  getPillIdentificationHistory,
  getPillComparisonHistory
} from './PillIdentification';

// Psychiatric Medication Management
export {
  getPsychiatricMedications,
  checkMultiplePsychMeds,
  getPsychMedAlerts,
  acknowledgePsychMedAlert
} from './PsychMedManagement';

const MedicationsAPI = {
  // CRUD
  ...MedicationCrud,

  // Label reading
  ...MedicationExtraction,

  // Pill identification
  ...PillIdentification,

  // Psychiatric medication management
  ...PsychMedManagement,

  // Reminders
  ...MedicationReminders,

  // Adherence
  ...MedicationAdherence
};

export default MedicationsAPI;
