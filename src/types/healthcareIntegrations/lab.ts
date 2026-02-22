/**
 * Healthcare Integrations — Lab Systems
 *
 * Types for lab system integrations: LabCorp, Quest Diagnostics, BioReference, etc.
 * Covers lab connections, orders, tests, and results.
 */

import type { BaseConnection } from './common';

// ============================================================================
// LAB SYSTEMS INTEGRATION
// ============================================================================

export type LabProviderCode = 'LABCORP' | 'QUEST' | 'BIOREFERENCE' | 'SONIC' | 'CUSTOM';

export type LabAuthType = 'oauth2' | 'api_key' | 'basic' | 'smart_on_fhir';

export interface LabProviderConnection extends BaseConnection {
  providerCode: LabProviderCode;
  providerName: string;
  description?: string;

  // FHIR settings
  fhirBaseUrl: string;
  fhirVersion: string;

  // Authentication
  authType: LabAuthType;
  clientId?: string;
  // Secrets are not exposed to client

  // SMART on FHIR
  smartAuthorizeUrl?: string;
  smartTokenUrl?: string;
  smartScopes?: string[];

  // Facility identifiers
  facilityId?: string;
  accountNumber?: string;

  // Settings
  autoFetchResults: boolean;
  fetchIntervalMinutes: number;
  resultNotificationEnabled: boolean;

  // Statistics
  ordersSent: number;
  resultsReceived: number;
  errorsCount: number;
}

export type LabOrderStatus =
  | 'pending'
  | 'submitted'
  | 'received'
  | 'in_progress'
  | 'resulted'
  | 'partial'
  | 'cancelled'
  | 'error';

export type LabOrderPriority = 'stat' | 'asap' | 'routine' | 'preop' | 'callback';

export interface LabOrder {
  id: string;
  tenantId: string;
  connectionId?: string;
  patientId: string;

  // Order identification
  internalOrderId: string;
  externalOrderId?: string;
  accessionNumber?: string;

  // Ordering provider
  orderingProviderId?: string;
  orderingProviderNpi?: string;

  // Order details
  orderStatus: LabOrderStatus;
  priority: LabOrderPriority;

  // Clinical info
  diagnosisCodes?: string[];
  clinicalNotes?: string;
  fastingRequired: boolean;
  fastingHours?: number;

  // Specimen info
  specimenCollectedAt?: string;
  specimenType?: string;
  specimenSource?: string;

  // Timing
  orderedAt: string;
  submittedAt?: string;
  receivedByLabAt?: string;
  expectedResultsAt?: string;
  resultedAt?: string;

  // FHIR references
  fhirServiceRequestId?: string;
  fhirDiagnosticReportId?: string;

  // Tests in this order
  tests?: LabOrderTest[];

  createdAt: string;
  updatedAt: string;
}

export type LabTestStatus = 'ordered' | 'received' | 'in_progress' | 'resulted' | 'cancelled' | 'error';

export interface LabOrderTest {
  id: string;
  orderId: string;

  // Test identification
  testCode: string;
  testName: string;
  loincCode?: string;

  // Status
  testStatus: LabTestStatus;

  // Results
  resultValue?: string;
  resultUnit?: string;
  referenceRange?: string;
  abnormalFlag?: string;
  interpretation?: string;

  // Result details
  resultedAt?: string;
  performingLab?: string;
  pathologistNotes?: string;

  fhirObservationId?: string;

  createdAt: string;
  updatedAt: string;
}

export type LabReportStatus = 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';

/**
 * Full lab result entity — FHIR-mapped with accession, specimen, and panel data.
 * NOTE: Distinct from handoff.HandoffLabResult which is a lightweight display type.
 */
export interface LabResult {
  id: string;
  tenantId: string;
  orderId?: string;
  patientId: string;
  connectionId?: string;

  // Result identification
  accessionNumber: string;
  reportId?: string;

  // Report info
  reportStatus: LabReportStatus;
  reportType?: string;

  // Dates
  specimenCollectedAt?: string;
  specimenReceivedAt?: string;
  reportedAt: string;

  // Provider info
  orderingProviderName?: string;
  performingLabName?: string;
  pathologistName?: string;

  // Content
  resultsSummary?: Record<string, unknown>;
  pdfReportUrl?: string;

  // FHIR references
  fhirDiagnosticReportId?: string;
  fhirBundleId?: string;

  // Notification tracking
  patientNotified: boolean;
  patientNotifiedAt?: string;
  providerNotified: boolean;
  providerNotifiedAt?: string;

  // Review tracking
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;

  // Critical values
  hasCriticalValues: boolean;
  criticalValuesAcknowledged: boolean;
  criticalValuesAcknowledgedAt?: string;
  criticalValuesAcknowledgedBy?: string;

  createdAt: string;
  updatedAt: string;
}
