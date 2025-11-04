/**
 * Medication API
 *
 * RESTful API endpoints for Medicine Cabinet operations
 * Handles medication CRUD, label reading, reminders, and adherence tracking
 *
 * @module api/medications
 * @version 2.0.0
 *
 * REFACTORED: 2025-11-04
 * - Extracted from monolithic file (1,113 lines) to modular architecture
 * - 6 focused modules: CRUD, Extraction, Reminders, Adherence, PillID, PsychMed
 * - Maintained 100% backwards compatibility
 * - All imports from 'api/medications' continue to work
 *
 * NEW USAGE (Recommended):
 * import { getMedications } from '@/api/medications';
 * import { getMedications } from '@/api/medications/MedicationCrud';
 *
 * OLD USAGE (Still works):
 * import MedicationsAPI from '@/api/medications';
 * MedicationsAPI.getMedications();
 */

// Re-export everything from modular structure for backwards compatibility
export type { ApiResponse, Medication, MedicationReminder, MedicationDoseTaken } from './medications/types';

export {
  // CRUD Operations
  getMedications,
  getMedication,
  createMedication,
  updateMedication,
  deleteMedication,
  discontinueMedication
} from './medications/MedicationCrud';

export {
  // Label Extraction (AI-powered)
  extractMedicationFromImage,
  confirmMedication
} from './medications/MedicationExtraction';

export {
  // Reminders
  getMedicationReminders,
  createMedicationReminder,
  updateMedicationReminder,
  deleteMedicationReminder
} from './medications/MedicationReminders';

export {
  // Adherence Tracking
  recordDoseTaken,
  getMedicationAdherence,
  getMedicationsNeedingRefill,
  getUpcomingReminders
} from './medications/MedicationAdherence';

export {
  // Pill Identification
  identifyPill,
  comparePillWithLabel,
  getPillIdentificationHistory,
  getPillComparisonHistory
} from './medications/PillIdentification';

export {
  // Psychiatric Medication Management
  getPsychiatricMedications,
  checkMultiplePsychMeds,
  getPsychMedAlerts,
  acknowledgePsychMedAlert
} from './medications/PsychMedManagement';

// Default export for backwards compatibility with existing code
// Re-create the default export object without circular import
import * as MedicationCrud from './medications/MedicationCrud';
import * as MedicationExtraction from './medications/MedicationExtraction';
import * as MedicationReminders from './medications/MedicationReminders';
import * as MedicationAdherence from './medications/MedicationAdherence';
import * as PillIdentification from './medications/PillIdentification';
import * as PsychMedManagement from './medications/PsychMedManagement';

const MedicationsAPI = {
  ...MedicationCrud,
  ...MedicationExtraction,
  ...MedicationReminders,
  ...MedicationAdherence,
  ...PillIdentification,
  ...PsychMedManagement
};

export default MedicationsAPI;
