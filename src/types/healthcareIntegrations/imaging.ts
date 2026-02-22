/**
 * Healthcare Integrations — Imaging/PACS
 *
 * Types for imaging and PACS integrations: DICOM, DICOMweb, WADO.
 * Covers PACS connections, imaging orders, studies, and reports.
 */

import type { BaseConnection } from './common';

// ============================================================================
// IMAGING/PACS INTEGRATION
// ============================================================================

export interface PACSConnection extends BaseConnection {
  pacsVendor: string;
  pacsName: string;
  description?: string;

  // DICOM settings
  aeTitle: string;
  hostname: string;
  port: number;

  // Query/Retrieve settings
  queryAeTitle?: string;
  queryPort?: number;

  // WADO settings
  wadoUrl?: string;
  wadoAuthType?: 'none' | 'basic' | 'oauth2' | 'api_key';

  // DICOMweb API
  dicomwebUrl?: string;
  dicomwebQidoPath?: string;
  dicomwebWadoPath?: string;
  dicomwebStowPath?: string;

  // Settings
  autoFetchStudies: boolean;
  storeImagesLocally: boolean;
}

export type ImagingOrderStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'dictated'
  | 'finalized'
  | 'cancelled'
  | 'no_show';

export type ImagingPriority = 'stat' | 'urgent' | 'routine' | 'scheduled';

export type Laterality = 'LEFT' | 'RIGHT' | 'BILATERAL' | 'N/A';

/** DICOM standard imaging modality codes — UPPER case (distinct from oncology.ImagingModality which uses readable names) */
export type ImagingModality =
  | 'CR' // Computed Radiography
  | 'CT' // Computed Tomography
  | 'MR' // Magnetic Resonance
  | 'US' // Ultrasound
  | 'XA' // X-Ray Angiography
  | 'NM' // Nuclear Medicine
  | 'PT' // PET
  | 'DX' // Digital Radiography
  | 'MG' // Mammography
  | 'RF' // Radiofluoroscopy
  | 'OT'; // Other

export interface ImagingOrder {
  id: string;
  tenantId: string;
  pacsConnectionId?: string;
  patientId: string;

  // Order identification
  internalOrderId: string;
  accessionNumber?: string;

  // Ordering provider
  orderingProviderId?: string;
  orderingProviderNpi?: string;

  // Order details
  modality: string;
  procedureCode: string;
  procedureName: string;
  bodyPart?: string;
  laterality?: Laterality;

  // Clinical info
  reasonForExam?: string;
  diagnosisCodes?: string[];
  clinicalHistory?: string;

  // Priority
  priority: ImagingPriority;

  // Status
  orderStatus: ImagingOrderStatus;

  // Scheduling
  scheduledAt?: string;
  performedAt?: string;

  // Performing location
  performingFacility?: string;
  performingLocation?: string;

  // Reporting
  interpretingRadiologist?: string;
  dictatedAt?: string;
  finalizedAt?: string;

  // DICOM UIDs
  studyInstanceUid?: string;

  // FHIR references
  fhirImagingStudyId?: string;
  fhirDiagnosticReportId?: string;

  createdAt: string;
  updatedAt: string;
}

export type StudyAvailability = 'ONLINE' | 'NEARLINE' | 'OFFLINE' | 'UNAVAILABLE';

export interface ImagingStudy {
  id: string;
  tenantId: string;
  orderId?: string;
  patientId: string;
  pacsConnectionId?: string;

  // DICOM UIDs
  studyInstanceUid: string;
  seriesCount: number;
  instanceCount: number;

  // Study details
  studyDate: string;
  studyTime?: string;
  accessionNumber?: string;

  // Modality info
  modalities: string[];
  studyDescription?: string;
  bodyPartExamined?: string;

  // Patient info (from DICOM)
  dicomPatientName?: string;
  dicomPatientId?: string;

  // Institution info
  institutionName?: string;
  referringPhysician?: string;
  performingPhysician?: string;

  // Storage info
  storageLocation?: string;
  totalSizeBytes?: number;

  // Status
  availability: StudyAvailability;

  // Report
  hasReport: boolean;
  reportId?: string;

  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ImagingReportStatus = 'draft' | 'preliminary' | 'final' | 'amended' | 'cancelled';

export interface ImagingReport {
  id: string;
  tenantId: string;
  studyId?: string;
  orderId?: string;
  patientId: string;

  // Report identification
  reportId: string;
  accessionNumber?: string;

  // Report status
  reportStatus: ImagingReportStatus;

  // Sections
  clinicalInfo?: string;
  comparison?: string;
  technique?: string;
  findings: string;
  impression: string;

  // Structured findings
  codedFindings?: Record<string, unknown>;

  // Critical findings
  hasCriticalFinding: boolean;
  criticalFindingDescription?: string;
  criticalFindingCommunicated: boolean;
  criticalFindingCommunicatedTo?: string;
  criticalFindingCommunicatedAt?: string;

  // Radiologist
  dictatingRadiologist?: string;
  dictatingRadiologistNpi?: string;
  signingRadiologist?: string;
  signingRadiologistNpi?: string;

  // Timing
  dictatedAt?: string;
  transcribedAt?: string;
  signedAt?: string;
  amendedAt?: string;

  // Amendment tracking
  isAmended: boolean;
  amendmentReason?: string;
  originalReportId?: string;

  fhirDiagnosticReportId?: string;

  createdAt: string;
  updatedAt: string;
}
