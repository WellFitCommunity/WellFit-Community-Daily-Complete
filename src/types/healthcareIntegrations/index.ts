/**
 * Healthcare Integrations Type Definitions — Barrel Re-export
 *
 * Types for external healthcare system integrations:
 * - Lab Systems (LabCorp, Quest Diagnostics)
 * - Pharmacy (Surescripts, PillPack)
 * - Imaging/PACS (DICOM)
 * - Insurance Verification (X12 270/271)
 *
 * Decomposed from a single 972-line file into focused modules:
 * - common.ts: Base connection types
 * - lab.ts: Lab system integrations
 * - pharmacy.ts: Pharmacy integrations
 * - imaging.ts: Imaging/PACS integrations
 * - insurance.ts: Insurance verification (X12 270/271)
 * - stats.ts: Dashboard statistics and service request types
 */

// Common types
export type {
  ConnectionStatus,
  BaseConnection,
} from './common';

// Lab systems
export type {
  LabProviderCode,
  LabAuthType,
  LabProviderConnection,
  LabOrderStatus,
  LabOrderPriority,
  LabOrder,
  LabTestStatus,
  LabOrderTest,
  LabReportStatus,
  LabResult,
} from './lab';

// Pharmacy
export type {
  PharmacyType,
  PharmacyProtocol,
  PharmacyConnection,
  PrescriptionStatus,
  ControlledSubstanceSchedule,
  EPrescription,
  MedicationHistorySource,
  MedicationHistory,
  RefillRequestSource,
  RefillRequestStatus,
  RefillRequest,
} from './pharmacy';

// Imaging/PACS
export type {
  PACSConnection,
  ImagingOrderStatus,
  ImagingPriority,
  Laterality,
  ImagingModality,
  ImagingOrder,
  StudyAvailability,
  ImagingStudy,
  ImagingReportStatus,
  ImagingReport,
} from './imaging';

// Insurance verification
export type {
  PayerType,
  InsuranceConnectionType,
  InsurancePayerConnection,
  EligibilityRequestStatus,
  EligibilityRequest,
  EligibilityResponseStatus,
  EligibilityResponse,
  CoverageDetail,
  BenefitAmount,
  SubscriberRelationship,
  InsuranceVerificationStatus,
  PatientInsurance,
} from './insurance';

// Dashboard stats & service request types
export type {
  HealthcareIntegrationStats,
  LabProviderStats,
  PharmacyStats,
  ImagingStats,
  InsuranceStats,
  CreateLabOrderRequest,
  CreatePrescriptionRequest,
  CheckEligibilityRequest,
  CreateImagingOrderRequest,
} from './stats';
