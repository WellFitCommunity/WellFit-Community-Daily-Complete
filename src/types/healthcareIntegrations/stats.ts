/**
 * Healthcare Integrations — Dashboard Statistics & Service Request Types
 *
 * Aggregate statistics for dashboards and typed request interfaces
 * for creating lab orders, prescriptions, eligibility checks, and imaging orders.
 */

import type { LabOrderPriority } from './lab';
import type { ControlledSubstanceSchedule } from './pharmacy';
import type { ImagingPriority, Laterality } from './imaging';

// ============================================================================
// DASHBOARD & STATISTICS TYPES
// ============================================================================

export interface HealthcareIntegrationStats {
  labOrdersTotal: number;
  labResultsReceived: number;
  labCriticalValues: number;
  prescriptionsSent: number;
  refillRequestsPending: number;
  imagingStudiesTotal: number;
  imagingReportsFinal: number;
  eligibilityChecks: number;
  eligibilityVerified: number;
}

export interface LabProviderStats {
  connectionId: string;
  providerName: string;
  ordersSent: number;
  resultsReceived: number;
  pendingOrders: number;
  averageTurnaroundHours: number;
}

export interface PharmacyStats {
  totalPrescriptionsSent: number;
  pendingRefillRequests: number;
  controlledSubstancesPrescribed: number;
  averageDispenseTime: number;
}

export interface ImagingStats {
  totalStudies: number;
  studiesPendingReport: number;
  criticalFindings: number;
  averageReportTurnaround: number;
}

export interface InsuranceStats {
  totalVerifications: number;
  activeVerifications: number;
  failedVerifications: number;
  averageResponseTime: number;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface CreateLabOrderRequest {
  patientId: string;
  connectionId?: string;
  orderingProviderId?: string;
  orderingProviderNpi?: string;
  tests: Array<{
    testCode: string;
    testName: string;
    loincCode?: string;
  }>;
  priority?: LabOrderPriority;
  diagnosisCodes?: string[];
  clinicalNotes?: string;
  fastingRequired?: boolean;
  fastingHours?: number;
}

export interface CreatePrescriptionRequest {
  patientId: string;
  pharmacyConnectionId?: string;
  prescriberNpi: string;
  prescriberDea?: string;
  medicationName: string;
  medicationNdc?: string;
  rxnormCode?: string;
  strength?: string;
  dosageForm?: string;
  quantity: number;
  quantityUnit?: string;
  daysSupply?: number;
  refillsAuthorized?: number;
  sig: string;
  dispenseAsWritten?: boolean;
  diagnosisCodes?: string[];
  isControlledSubstance?: boolean;
  schedule?: ControlledSubstanceSchedule;
}

export interface CheckEligibilityRequest {
  patientId: string;
  payerConnectionId?: string;
  subscriberId: string;
  subscriberName?: string;
  subscriberDob?: string;
  isDependent?: boolean;
  dependentName?: string;
  dependentDob?: string;
  relationshipCode?: string;
  serviceTypeCodes?: string[];
  dateOfService: string;
  providerNpi?: string;
}

export interface CreateImagingOrderRequest {
  patientId: string;
  pacsConnectionId?: string;
  orderingProviderId?: string;
  orderingProviderNpi?: string;
  modality: string;
  procedureCode: string;
  procedureName: string;
  bodyPart?: string;
  laterality?: Laterality;
  reasonForExam?: string;
  diagnosisCodes?: string[];
  clinicalHistory?: string;
  priority?: ImagingPriority;
  scheduledAt?: string;
}
