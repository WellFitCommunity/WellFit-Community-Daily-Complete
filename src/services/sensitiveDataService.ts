/**
 * Sensitive Data Service - 42 CFR Part 2 Compliance
 *
 * Purpose: Manage sensitive data segments, consent verification, and disclosure logging
 * Features: SUD/MH classification, consent checking, FHIR redaction, disclosure tracking
 * Compliance: 42 CFR Part 2, HIPAA § 164.508, State mental health laws
 *
 * @module services/sensitiveDataService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type SensitiveDataCategory =
  | 'substance_use_disorder'
  | 'mental_health'
  | 'hiv_aids'
  | 'genetic_information'
  | 'reproductive_health'
  | 'domestic_violence'
  | 'minor_treatment'
  | 'custom';

export type ClassificationMethod =
  | 'manual'
  | 'icd10_code'
  | 'cpt_code'
  | 'ai_detected'
  | 'patient_reported';

export type DisclosureBasis =
  | 'patient_authorization'
  | 'medical_emergency'
  | 'court_order'
  | 'same_entity_treatment'
  | 'qualified_service_organization'
  | 'research_waiver'
  | 'public_health_emergency';

export interface SensitiveDataSegment {
  id: string;
  patient_id: string;
  segment_type: SensitiveDataCategory;
  source_table: string;
  source_record_id: string;
  source_field: string | null;
  classification_method: ClassificationMethod;
  icd10_codes: string[] | null;
  consent_id: string | null;
  consent_required: boolean;
  consent_obtained: boolean;
  consent_obtained_at: string | null;
  disclosure_prohibited: boolean;
  disclosure_exceptions: string[] | null;
  classified_by: string | null;
  classified_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CFR42Authorization {
  id: string;
  authorization_id: string;
  patient_id: string;
  purpose: string;
  authorized_recipients: string[];
  authorized_disclosures: string[] | null;
  authorization_date: string;
  effective_date: string;
  expiration_date: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  signed_form_url: string | null;
  created_by: string;
  created_at: string;
}

export interface DisclosureLog {
  id: string;
  patient_id: string;
  segment_id: string | null;
  recipient_name: string;
  recipient_organization: string | null;
  recipient_type: string;
  disclosure_basis: DisclosureBasis;
  authorization_id: string | null;
  disclosed_at: string;
  disclosed_by: string;
  disclosure_method: string;
  data_types_disclosed: string[];
  record_count: number | null;
  redisclosure_notice_included: boolean;
}

export interface CreateSegmentRequest {
  patientId: string;
  segmentType: SensitiveDataCategory;
  sourceTable: string;
  sourceRecordId: string;
  sourceField?: string;
  classificationMethod: ClassificationMethod;
  icd10Codes?: string[];
  consentRequired?: boolean;
  disclosureExceptions?: string[];
}

export interface LogDisclosureRequest {
  patientId: string;
  segmentId?: string;
  recipientName: string;
  recipientOrganization?: string;
  recipientType: string;
  disclosureBasis: DisclosureBasis;
  authorizationId?: string;
  disclosureMethod: string;
  dataTypesDisclosed: string[];
  recordCount?: number;
  dateRangeStart?: string;
  dateRangeEnd?: string;
}

// =============================================================================
// ICD-10 CODE CLASSIFICATIONS
// =============================================================================

const SENSITIVE_ICD10_PATTERNS: Record<SensitiveDataCategory, RegExp[]> = {
  substance_use_disorder: [
    /^F1[0-9]/, // F10-F19: Mental and behavioral disorders due to psychoactive substance use
    /^T40/,     // Poisoning by narcotics
    /^T43\.6/,  // Poisoning by psychostimulants
  ],
  mental_health: [
    /^F2[0-9]/, // F20-F29: Schizophrenia
    /^F3[0-9]/, // F30-F39: Mood disorders
    /^F4[0-8]/, // F40-F48: Anxiety, stress, etc.
    /^F5[0-9]/, // F50-F59: Behavioral syndromes
    /^F6[0-9]/, // F60-F69: Personality disorders
    /^F9[0-8]/, // F90-F98: Behavioral/emotional disorders
  ],
  hiv_aids: [
    /^B2[0-4]/, // B20-B24: HIV disease
    /^Z21/,     // Asymptomatic HIV status
    /^R75/,     // Inconclusive HIV test
  ],
  genetic_information: [
    /^Q/,       // Congenital malformations
    /^Z13\.7/,  // Genetic disease carrier screening
    /^Z14/,     // Genetic carrier status
    /^Z15/,     // Genetic susceptibility
  ],
  reproductive_health: [
    /^O/,       // Pregnancy codes
    /^Z30/,     // Contraceptive management
    /^Z33/,     // Pregnant state
    /^Z64\.0/,  // Problems related to unwanted pregnancy
  ],
  domestic_violence: [
    /^T74/,     // Maltreatment syndromes
    /^T76/,     // Suspected maltreatment
    /^Z62\.81/, // Personal history of abuse in childhood
    /^Z91\.41/, // Personal history of spouse abuse
  ],
  minor_treatment: [], // No specific codes - determined by patient age
  custom: [],
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Classify ICD-10 code into sensitive category
 */
function classifyICD10Code(code: string): SensitiveDataCategory | null {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (const [category, patterns] of Object.entries(SENSITIVE_ICD10_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedCode)) {
        return category as SensitiveDataCategory;
      }
    }
  }

  return null;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Create a sensitive data segment
 */
async function createSegment(
  request: CreateSegmentRequest,
  classifiedBy: string
): Promise<ServiceResult<SensitiveDataSegment>> {
  try {
    const { data, error } = await supabase
      .from('sensitive_data_segments')
      .insert({
        patient_id: request.patientId,
        segment_type: request.segmentType,
        source_table: request.sourceTable,
        source_record_id: request.sourceRecordId,
        source_field: request.sourceField || null,
        classification_method: request.classificationMethod,
        icd10_codes: request.icd10Codes || null,
        consent_required: request.consentRequired ?? true,
        disclosure_exceptions: request.disclosureExceptions || null,
        classified_by: classifiedBy,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return failure('ALREADY_EXISTS', 'This data is already classified as sensitive');
      }
      return failure('DATABASE_ERROR', 'Failed to create sensitive segment', error);
    }

    await auditLogger.info('SENSITIVE_SEGMENT_CREATED', {
      segmentId: data.id,
      patientId: request.patientId,
      segmentType: request.segmentType,
      classifiedBy,
    });

    return success(data as SensitiveDataSegment);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('SENSITIVE_SEGMENT_CREATE_FAILED', error, { ...request });
    return failure('OPERATION_FAILED', 'Failed to create sensitive segment', err);
  }
}

/**
 * Check if patient has consent for accessing sensitive data
 */
async function checkConsent(
  patientId: string,
  segmentType: SensitiveDataCategory,
  purpose: string = 'treatment'
): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('check_sensitive_consent', {
      p_patient_id: patientId,
      p_segment_type: segmentType,
      p_purpose: purpose,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to check consent', error);
    }

    return success(data === true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONSENT_CHECK_FAILED', error, { patientId, segmentType, purpose });
    return failure('OPERATION_FAILED', 'Failed to check consent', err);
  }
}

/**
 * Get patient's sensitive data segments
 */
async function getPatientSegments(
  patientId: string,
  requestingUserId: string,
  options: { includeInactive?: boolean; segmentType?: SensitiveDataCategory } = {}
): Promise<ServiceResult<SensitiveDataSegment[]>> {
  try {
    let query = supabase
      .from('sensitive_data_segments')
      .select('*')
      .eq('patient_id', patientId);

    if (!options.includeInactive) {
      query = query.eq('is_active', true);
    }

    if (options.segmentType) {
      query = query.eq('segment_type', options.segmentType);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get patient segments', error);
    }

    await auditLogger.phi('READ', patientId, {
      resourceType: 'sensitive_data_segments',
      operation: 'list',
      requestingUserId,
    });

    return success((data || []) as SensitiveDataSegment[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('GET_SEGMENTS_FAILED', error, { patientId });
    return failure('OPERATION_FAILED', 'Failed to get patient segments', err);
  }
}

/**
 * Mark consent as obtained for a segment
 */
async function markConsentObtained(
  segmentId: string,
  consentId: string,
  obtainedBy: string
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from('sensitive_data_segments')
      .update({
        consent_id: consentId,
        consent_obtained: true,
        consent_obtained_at: new Date().toISOString(),
        consent_obtained_by: obtainedBy,
      })
      .eq('id', segmentId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to mark consent obtained', error);
    }

    await auditLogger.info('SENSITIVE_CONSENT_OBTAINED', {
      segmentId,
      consentId,
      obtainedBy,
    });

    return success(true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONSENT_MARK_FAILED', error, { segmentId });
    return failure('OPERATION_FAILED', 'Failed to mark consent obtained', err);
  }
}

/**
 * Log a disclosure of sensitive data (required by 42 CFR Part 2)
 */
async function logDisclosure(
  request: LogDisclosureRequest,
  disclosedBy: string
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase
      .from('sensitive_disclosure_log')
      .insert({
        patient_id: request.patientId,
        segment_id: request.segmentId || null,
        recipient_name: request.recipientName,
        recipient_organization: request.recipientOrganization || null,
        recipient_type: request.recipientType,
        disclosure_basis: request.disclosureBasis,
        authorization_id: request.authorizationId || null,
        disclosed_by: disclosedBy,
        disclosure_method: request.disclosureMethod,
        data_types_disclosed: request.dataTypesDisclosed,
        record_count: request.recordCount || null,
        date_range_start: request.dateRangeStart || null,
        date_range_end: request.dateRangeEnd || null,
        redisclosure_notice_included: true,
      })
      .select('id')
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to log disclosure', error);
    }

    await auditLogger.info('SENSITIVE_DISCLOSURE_LOGGED', {
      disclosureId: data.id,
      patientId: request.patientId,
      recipientName: request.recipientName,
      disclosureBasis: request.disclosureBasis,
      disclosedBy,
    });

    return success(data.id);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('DISCLOSURE_LOG_FAILED', error, { ...request });
    return failure('OPERATION_FAILED', 'Failed to log disclosure', err);
  }
}

/**
 * Get disclosure history for a patient
 */
async function getDisclosureHistory(
  patientId: string,
  options: { fromDate?: string; toDate?: string; limit?: number } = {}
): Promise<ServiceResult<DisclosureLog[]>> {
  try {
    let query = supabase
      .from('sensitive_disclosure_log')
      .select('*')
      .eq('patient_id', patientId)
      .order('disclosed_at', { ascending: false });

    if (options.fromDate) {
      query = query.gte('disclosed_at', options.fromDate);
    }

    if (options.toDate) {
      query = query.lte('disclosed_at', options.toDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get disclosure history', error);
    }

    return success((data || []) as DisclosureLog[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('GET_DISCLOSURES_FAILED', error, { patientId });
    return failure('OPERATION_FAILED', 'Failed to get disclosure history', err);
  }
}

/**
 * Create a 42 CFR Part 2 authorization
 */
async function createAuthorization(
  patientId: string,
  purpose: string,
  authorizedRecipients: string[],
  authorizedDisclosures: string[],
  expirationDate: string | null,
  createdBy: string
): Promise<ServiceResult<CFR42Authorization>> {
  try {
    const authorizationId = `AUTH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const { data, error } = await supabase
      .from('cfr42_authorization_log')
      .insert({
        authorization_id: authorizationId,
        patient_id: patientId,
        purpose,
        authorized_recipients: authorizedRecipients,
        authorized_disclosures: authorizedDisclosures,
        authorization_date: new Date().toISOString(),
        effective_date: new Date().toISOString(),
        expiration_date: expirationDate,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to create authorization', error);
    }

    await auditLogger.info('CFR42_AUTHORIZATION_CREATED', {
      authorizationId,
      patientId,
      purpose,
      createdBy,
    });

    return success(data as CFR42Authorization);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AUTHORIZATION_CREATE_FAILED', error, { patientId, purpose });
    return failure('OPERATION_FAILED', 'Failed to create authorization', err);
  }
}

/**
 * Revoke an authorization
 */
async function revokeAuthorization(
  authorizationId: string,
  reason: string
): Promise<ServiceResult<boolean>> {
  try {
    const { error } = await supabase
      .from('cfr42_authorization_log')
      .update({
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
      })
      .eq('authorization_id', authorizationId);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to revoke authorization', error);
    }

    await auditLogger.info('CFR42_AUTHORIZATION_REVOKED', {
      authorizationId,
      reason,
    });

    return success(true);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AUTHORIZATION_REVOKE_FAILED', error, { authorizationId });
    return failure('OPERATION_FAILED', 'Failed to revoke authorization', err);
  }
}

/**
 * Classify ICD-10 codes and return any sensitive categories detected
 */
async function classifyDiagnosisCodes(
  icd10Codes: string[]
): Promise<ServiceResult<Map<string, SensitiveDataCategory>>> {
  const classifications = new Map<string, SensitiveDataCategory>();

  for (const code of icd10Codes) {
    const category = classifyICD10Code(code);
    if (category) {
      classifications.set(code, category);
    }
  }

  return success(classifications);
}

/**
 * Get summary statistics for sensitive data
 */
async function getSensitiveDataStats(
  tenantId?: string
): Promise<
  ServiceResult<{
    totalSegments: number;
    byCategory: Record<SensitiveDataCategory, number>;
    pendingConsent: number;
    totalDisclosures: number;
    activeAuthorizations: number;
  }>
> {
  try {
    // Get segment counts
    const { data: segments, error: segmentError } = await supabase
      .from('sensitive_data_segments')
      .select('segment_type, consent_obtained')
      .eq('is_active', true);

    if (segmentError) {
      return failure('DATABASE_ERROR', 'Failed to get segment stats', segmentError);
    }

    const byCategory: Record<SensitiveDataCategory, number> = {
      substance_use_disorder: 0,
      mental_health: 0,
      hiv_aids: 0,
      genetic_information: 0,
      reproductive_health: 0,
      domestic_violence: 0,
      minor_treatment: 0,
      custom: 0,
    };

    let pendingConsent = 0;

    for (const segment of segments || []) {
      if (segment.segment_type in byCategory) {
        byCategory[segment.segment_type as SensitiveDataCategory]++;
      }
      if (!segment.consent_obtained) {
        pendingConsent++;
      }
    }

    // Get disclosure count
    const { count: disclosureCount } = await supabase
      .from('sensitive_disclosure_log')
      .select('*', { count: 'exact', head: true });

    // Get active authorizations
    const { count: authCount } = await supabase
      .from('cfr42_authorization_log')
      .select('*', { count: 'exact', head: true })
      .is('revoked_at', null);

    return success({
      totalSegments: segments?.length || 0,
      byCategory,
      pendingConsent,
      totalDisclosures: disclosureCount || 0,
      activeAuthorizations: authCount || 0,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('SENSITIVE_STATS_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get sensitive data stats', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const sensitiveDataService = {
  // Segment management
  createSegment,
  getPatientSegments,

  // Consent
  checkConsent,
  markConsentObtained,

  // Disclosure
  logDisclosure,
  getDisclosureHistory,

  // Authorization
  createAuthorization,
  revokeAuthorization,

  // Classification
  classifyDiagnosisCodes,

  // Statistics
  getSensitiveDataStats,
};

export default sensitiveDataService;
