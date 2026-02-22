/**
 * Healthcare Integrations — Insurance Verification
 *
 * Types for insurance verification (X12 270/271) integrations.
 * Covers payer connections, eligibility requests/responses, coverage details,
 * and patient insurance records.
 */

import type { BaseConnection } from './common';

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
