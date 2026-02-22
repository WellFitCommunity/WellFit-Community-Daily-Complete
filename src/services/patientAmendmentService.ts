/**
 * Patient Amendment Service
 *
 * Purpose: Patient-initiated amendment requests for health records
 * Regulation: 45 CFR 164.526 (Right to Amend)
 * Features: Request submission, clinical review, disagreement statements
 *
 * Distinct from noteAmendmentService.ts (clinical note amendments by staff).
 * This service handles patient-initiated record corrections.
 *
 * @module services/patientAmendmentService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type AmendmentRecordType =
  | 'demographics'
  | 'conditions'
  | 'medications'
  | 'allergies'
  | 'vitals'
  | 'lab_results'
  | 'care_plans'
  | 'clinical_notes'
  | 'other';

export type AmendmentRequestStatus = 'submitted' | 'under_review' | 'accepted' | 'denied' | 'withdrawn';

export interface PatientAmendmentRequest {
  id: string;
  tenant_id: string;
  patient_id: string;
  request_number: string;
  record_type: AmendmentRecordType;
  record_description: string;
  current_value: string | null;
  requested_value: string;
  reason: string;
  status: AmendmentRequestStatus;
  response_deadline: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_decision: 'accepted' | 'denied' | null;
  denial_reason: string | null;
  disagreement_statement: string | null;
  disagreement_filed_at: string | null;
  rebuttal_statement: string | null;
  rebuttal_filed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAmendmentRequestInput {
  record_type: AmendmentRecordType;
  record_description: string;
  current_value?: string;
  requested_value: string;
  reason: string;
}

export interface ReviewDecisionInput {
  request_id: string;
  decision: 'accepted' | 'denied';
  denial_reason?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

async function getTenantId(): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data?.tenant_id ?? null;
}

/**
 * Submit a patient-initiated amendment request
 */
export async function submitAmendmentRequest(
  input: CreateAmendmentRequestInput
): Promise<ServiceResult<PatientAmendmentRequest>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return failure('UNAUTHORIZED', 'Not authenticated');

    const { data, error } = await supabase
      .from('patient_amendment_requests')
      .insert({
        tenant_id: tenantId,
        patient_id: user.id,
        request_number: '',
        record_type: input.record_type,
        record_description: input.record_description,
        current_value: input.current_value ?? null,
        requested_value: input.requested_value,
        reason: input.reason,
        status: 'submitted',
        response_deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.phi('PATIENT_AMENDMENT_REQUESTED', user.id, {
      requestId: data.id,
      recordType: input.record_type,
    });

    return success(data as PatientAmendmentRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_REQUEST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to submit amendment request');
  }
}

/**
 * Get amendment requests for the current patient
 */
export async function getMyAmendmentRequests(): Promise<ServiceResult<PatientAmendmentRequest[]>> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return failure('UNAUTHORIZED', 'Not authenticated');

    const { data, error } = await supabase
      .from('patient_amendment_requests')
      .select('id, tenant_id, patient_id, request_number, record_type, record_description, current_value, requested_value, reason, status, response_deadline, reviewed_by, reviewed_at, review_decision, denial_reason, disagreement_statement, disagreement_filed_at, rebuttal_statement, rebuttal_filed_at, created_at, updated_at')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as PatientAmendmentRequest[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_REQUESTS_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get amendment requests');
  }
}

/**
 * Get all pending amendment requests for clinical review (tenant-scoped)
 */
export async function getPendingAmendments(): Promise<ServiceResult<PatientAmendmentRequest[]>> {
  try {
    const { data, error } = await supabase
      .from('patient_amendment_requests')
      .select('id, tenant_id, patient_id, request_number, record_type, record_description, current_value, requested_value, reason, status, response_deadline, reviewed_by, reviewed_at, review_decision, denial_reason, disagreement_statement, disagreement_filed_at, rebuttal_statement, rebuttal_filed_at, created_at, updated_at')
      .in('status', ['submitted', 'under_review'])
      .order('response_deadline', { ascending: true });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as PatientAmendmentRequest[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('PENDING_AMENDMENTS_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get pending amendments');
  }
}

/**
 * Review a patient amendment request (clinical staff action)
 */
export async function reviewAmendmentRequest(
  input: ReviewDecisionInput
): Promise<ServiceResult<PatientAmendmentRequest>> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return failure('UNAUTHORIZED', 'Not authenticated');

    const updates: Record<string, unknown> = {
      status: input.decision,
      review_decision: input.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (input.decision === 'denied' && input.denial_reason) {
      updates.denial_reason = input.denial_reason;
    }

    const { data, error } = await supabase
      .from('patient_amendment_requests')
      .update(updates)
      .eq('id', input.request_id)
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.clinical(`AMENDMENT_${input.decision.toUpperCase()}`, true, {
      requestId: input.request_id,
      patientId: data.patient_id,
      reviewedBy: user.id,
    });

    return success(data as PatientAmendmentRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AMENDMENT_REVIEW_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to review amendment request');
  }
}

/**
 * File a disagreement statement (patient response to denial)
 * Per 45 CFR 164.526(d)(1)
 */
export async function fileDisagreementStatement(
  requestId: string,
  statement: string
): Promise<ServiceResult<PatientAmendmentRequest>> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return failure('UNAUTHORIZED', 'Not authenticated');

    const { data, error } = await supabase
      .from('patient_amendment_requests')
      .update({
        disagreement_statement: statement,
        disagreement_filed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('patient_id', user.id)
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.phi('AMENDMENT_DISAGREEMENT_FILED', user.id, {
      requestId,
    });

    return success(data as PatientAmendmentRequest);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('DISAGREEMENT_FILING_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to file disagreement statement');
  }
}

export const patientAmendmentService = {
  submitAmendmentRequest,
  getMyAmendmentRequests,
  getPendingAmendments,
  reviewAmendmentRequest,
  fileDisagreementStatement,
};
