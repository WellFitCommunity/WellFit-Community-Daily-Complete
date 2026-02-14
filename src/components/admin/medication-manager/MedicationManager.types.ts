/**
 * Type definitions for MedicationManager decomposed modules
 */

export interface MedicationOverview {
  totalPatients: number;
  totalMedications: number;
  activePrescriptions: number;
  pendingRefills: number;
  highRiskCount: number;
  polypharmacyCount: number;
  interactionsDetected: number;
  reconciliationPending: number;
}

export interface PatientMedication {
  patientId: string;
  patientName: string;
  medicationCount: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  lastReviewDate: string | null;
  needsReconciliation: boolean;
  medications: MedicationRecord[];
}

export interface MedicationRecord {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  status: 'active' | 'on-hold' | 'discontinued' | 'completed';
  prescribedDate: string;
  lastDispensedDate: string | null;
  refillsRemaining: number;
  isHighRisk: boolean;
  drugClass: string;
  interactions: DrugInteraction[];
}

export interface DrugInteraction {
  id: string;
  drug1: string;
  drug2: string;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
  description: string;
  recommendation: string;
  patientId: string;
  patientName: string;
}

export interface ReconciliationTask {
  id: string;
  patientId: string;
  patientName: string;
  reason: 'admission' | 'discharge' | 'transfer' | 'routine' | 'new_prescription';
  status: 'pending' | 'in_progress' | 'completed' | 'escalated';
  assignedTo: string | null;
  dueDate: string;
  createdAt: string;
  medicationChanges: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface MedicationManagerProps {
  tenantId?: string;
}
