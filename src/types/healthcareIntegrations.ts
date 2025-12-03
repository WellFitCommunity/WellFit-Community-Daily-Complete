/**
 * Healthcare Integrations Type Definitions
 *
 * Types for external healthcare system integrations:
 * - Lab Systems (LabCorp, Quest Diagnostics)
 * - Pharmacy (Surescripts, PillPack)
 * - Imaging/PACS (DICOM)
 * - Insurance Verification (X12 270/271)
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';

export interface BaseConnection {
  id: string;
  tenantId: string;
  enabled: boolean;
  lastConnectedAt?: string;
  lastError?: string;
  connectionStatus: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

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

// ============================================================================
// PHARMACY INTEGRATION
// ============================================================================

export type PharmacyType =
  | 'SURESCRIPTS'
  | 'PILLPACK'
  | 'CVS'
  | 'WALGREENS'
  | 'LOCAL'
  | 'MAIL_ORDER'
  | 'SPECIALTY'
  | 'CUSTOM';

export type PharmacyProtocol = 'NCPDP_SCRIPT' | 'FHIR' | 'API' | 'FAX' | 'MANUAL';

export interface PharmacyConnection extends BaseConnection {
  pharmacyType: PharmacyType;
  pharmacyName: string;
  ncpdpId?: string;
  npi?: string;
  deaNumber?: string;

  // Contact info
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  fax?: string;

  // Integration settings
  protocol: PharmacyProtocol;
  apiEndpoint?: string;

  // Capabilities
  supportsErx: boolean;
  supportsRefillRequests: boolean;
  supportsMedicationHistory: boolean;
  supportsEligibility: boolean;
  supportsControlledSubstances: boolean;

  // Settings
  isPreferred: boolean;
}

export type PrescriptionStatus =
  | 'draft'
  | 'pending_review'
  | 'signed'
  | 'transmitted'
  | 'dispensed'
  | 'partially_filled'
  | 'cancelled'
  | 'expired'
  | 'transfer_out'
  | 'error';

export type ControlledSubstanceSchedule = 'II' | 'III' | 'IV' | 'V';

export interface EPrescription {
  id: string;
  tenantId: string;
  pharmacyConnectionId?: string;

  // Patient
  patientId: string;

  // Prescriber
  prescriberId?: string;
  prescriberNpi: string;
  prescriberDea?: string;

  // Prescription identification
  internalRxId: string;
  externalRxId?: string;
  surescriptsMessageId?: string;

  // Medication details
  medicationName: string;
  medicationNdc?: string;
  rxnormCode?: string;
  strength?: string;
  dosageForm?: string;

  // Prescription details
  quantity: number;
  quantityUnit: string;
  daysSupply?: number;
  refillsAuthorized: number;
  refillsRemaining?: number;

  // Instructions
  sig: string;
  sigCode?: string;

  // Dispensing
  dispenseAsWritten: boolean;
  substitutionAllowed: boolean;

  // Clinical info
  diagnosisCodes?: string[];
  indication?: string;
  priorAuthNumber?: string;

  // Controlled substance info
  isControlledSubstance: boolean;
  schedule?: ControlledSubstanceSchedule;

  // Status
  rxStatus: PrescriptionStatus;

  // Timing
  writtenAt: string;
  signedAt?: string;
  transmittedAt?: string;
  dispensedAt?: string;
  expiresAt?: string;

  // Errors
  transmissionError?: string;
  pharmacyResponse?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}

export type MedicationHistorySource = 'SURESCRIPTS' | 'PBM' | 'PATIENT_REPORTED' | 'FHIR' | 'MANUAL';

export interface MedicationHistory {
  id: string;
  tenantId: string;
  patientId: string;

  // Source
  source: MedicationHistorySource;
  sourcePharmacyName?: string;
  sourcePharmacyNcpdp?: string;

  // Medication
  medicationName: string;
  ndc?: string;
  rxnormCode?: string;
  strength?: string;
  dosageForm?: string;

  // Fill details
  fillDate?: string;
  quantityDispensed?: number;
  daysSupply?: number;
  refillsRemaining?: number;

  // Prescriber
  prescriberName?: string;
  prescriberNpi?: string;

  // Status
  isActive: boolean;
  discontinuedDate?: string;
  discontinuedReason?: string;

  fetchedAt: string;
  createdAt: string;
}

export type RefillRequestSource = 'PHARMACY' | 'PATIENT' | 'AUTOMATED';

export type RefillRequestStatus = 'pending' | 'approved' | 'denied' | 'new_rx_needed' | 'expired';

export interface RefillRequest {
  id: string;
  tenantId: string;
  patientId: string;
  originalPrescriptionId?: string;
  pharmacyConnectionId?: string;

  // Request details
  medicationName: string;
  requestSource: RefillRequestSource;

  // Status
  requestStatus: RefillRequestStatus;

  // Response
  responsePrescriptionId?: string;
  responseNotes?: string;
  respondedBy?: string;
  respondedAt?: string;

  // Timing
  requestedAt: string;
  dueBy?: string;

  createdAt: string;
  updatedAt: string;
}

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

// ============================================================================
// INSURANCE VERIFICATION (X12 270/271)
// ============================================================================

export type PayerType = 'COMMERCIAL' | 'MEDICARE' | 'MEDICAID' | 'TRICARE' | 'WORKERS_COMP' | 'AUTO' | 'OTHER';

export type InsuranceConnectionType = 'CLEARINGHOUSE' | 'DIRECT' | 'PORTAL' | 'API';

export interface InsurancePayerConnection extends BaseConnection {
  payerId: string;
  payerName: string;
  payerType?: PayerType;

  // EDI settings
  ediReceiverId?: string;
  ediInterchangeQualifier?: string;

  // Connection method
  connectionType: InsuranceConnectionType;

  // Clearinghouse
  clearinghouseName?: string;
  clearinghouseId?: string;

  // API/Portal settings
  apiEndpoint?: string;
  portalUrl?: string;

  // Capabilities
  supports270_271: boolean;
  supports276_277: boolean;
  supports278: boolean;
  supports835: boolean;
  supports837: boolean;

  // Real-time vs batch
  supportsRealTime: boolean;
  batchSchedule?: string;
}

export type EligibilityRequestStatus = 'pending' | 'submitted' | 'received' | 'error' | 'timeout';

export interface EligibilityRequest {
  id: string;
  tenantId: string;
  payerConnectionId?: string;

  // Patient/subscriber
  patientId: string;
  subscriberId: string;
  subscriberName?: string;
  subscriberDob?: string;

  // Dependent info
  isDependent: boolean;
  dependentName?: string;
  dependentDob?: string;
  relationshipCode?: string;

  // Service info
  serviceTypeCodes?: string[];
  dateOfService: string;
  providerNpi?: string;
  providerTaxonomy?: string;

  // Request tracking
  requestStatus: EligibilityRequestStatus;

  // EDI tracking
  traceNumber?: string;
  submitterTrace?: string;

  // Timing
  requestedAt: string;
  submittedAt?: string;
  responseReceivedAt?: string;

  // Response reference
  responseId?: string;

  // Error tracking
  errorCode?: string;
  errorMessage?: string;

  createdAt: string;
  createdBy?: string;
}

export type EligibilityResponseStatus = 'ACTIVE' | 'INACTIVE' | 'NOT_FOUND' | 'REQUIRES_REVIEW' | 'ERROR';

export interface EligibilityResponse {
  id: string;
  requestId: string;
  tenantId: string;

  // Response status
  responseStatus: EligibilityResponseStatus;

  // Subscriber info
  subscriberNameResponse?: string;
  subscriberIdResponse?: string;
  subscriberGroupNumber?: string;
  subscriberGroupName?: string;

  // Plan info
  planName?: string;
  planNumber?: string;
  planEffectiveDate?: string;
  planTermDate?: string;

  // Coverage details
  coverageDetails?: CoverageDetail[];

  // Key coverage info
  hasActiveCoverage: boolean;
  pcpRequired: boolean;
  pcpName?: string;
  pcpNpi?: string;

  // Deductibles and out-of-pocket
  individualDeductible?: number;
  individualDeductibleMet?: number;
  familyDeductible?: number;
  familyDeductibleMet?: number;
  individualOopMax?: number;
  individualOopMet?: number;
  familyOopMax?: number;
  familyOopMet?: number;

  // Copays/coinsurance
  officeVisitCopay?: number;
  specialistCopay?: number;
  erCopay?: number;
  inpatientCoinsurance?: number;

  // Prior auth requirements
  priorAuthRequiredServices?: string[];

  // Notes
  benefitNotes?: string[];
  rejectionReasons?: string[];

  receivedAt: string;
  createdAt: string;
}

export interface CoverageDetail {
  serviceType: string;
  serviceTypeName: string;
  coverageLevel: 'INDIVIDUAL' | 'FAMILY';
  inNetworkBenefit?: BenefitAmount;
  outOfNetworkBenefit?: BenefitAmount;
  limitations?: string[];
  priorAuthRequired: boolean;
}

export interface BenefitAmount {
  type: 'COPAY' | 'COINSURANCE' | 'DEDUCTIBLE' | 'OUT_OF_POCKET';
  amount?: number;
  percentage?: number;
  timePeriod?: 'VISIT' | 'DAY' | 'MONTH' | 'YEAR' | 'LIFETIME';
}

export type SubscriberRelationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'OTHER';

export type InsuranceVerificationStatus = 'unverified' | 'verified' | 'needs_review' | 'inactive';

export interface PatientInsurance {
  id: string;
  tenantId: string;
  patientId: string;

  // Payer info
  payerConnectionId?: string;
  payerId: string;
  payerName: string;

  // Subscriber info
  subscriberId: string;
  groupNumber?: string;
  groupName?: string;

  // Subscriber relationship
  subscriberRelationship: SubscriberRelationship;
  subscriberName?: string;
  subscriberDob?: string;

  // Plan info
  planName?: string;
  planType?: string;

  // Coverage dates
  effectiveDate: string;
  terminationDate?: string;

  // Priority
  coveragePriority: number;

  // Verification
  lastVerifiedAt?: string;
  lastVerificationRequestId?: string;
  verificationStatus: InsuranceVerificationStatus;

  // Active status
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

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
