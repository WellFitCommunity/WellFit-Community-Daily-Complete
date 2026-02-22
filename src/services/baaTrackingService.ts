/**
 * Business Associate Agreement (BAA) Tracking Service
 *
 * Purpose: Track and manage BAAs with business associates
 * Regulation: 45 CFR 164.502(e)
 * Features: Lifecycle management, renewal tracking, review history
 *
 * @module services/baaTrackingService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type BAAStatus = 'draft' | 'pending_review' | 'active' | 'expired' | 'terminated' | 'not_required';

export type AssociateType = 'vendor' | 'subcontractor' | 'clearinghouse' | 'cloud_provider' | 'ehr_vendor' | 'other';

export type ReviewType = 'initial_review' | 'annual_review' | 'renewal' | 'amendment' | 'termination' | 'status_change';

export interface BAA {
  id: string;
  tenant_id: string;
  associate_name: string;
  associate_type: AssociateType;
  service_description: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: BAAStatus;
  effective_date: string | null;
  expiration_date: string | null;
  renewal_date: string | null;
  auto_renew: boolean;
  phi_types_shared: string[];
  permitted_uses: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BAAReview {
  id: string;
  baa_id: string;
  tenant_id: string;
  reviewed_by: string;
  review_type: ReviewType;
  previous_status: string | null;
  new_status: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface CreateBAARequest {
  associate_name: string;
  associate_type: AssociateType;
  service_description: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  effective_date?: string;
  expiration_date?: string;
  phi_types_shared?: string[];
  permitted_uses?: string;
  notes?: string;
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
 * List all BAAs for the current tenant
 */
export async function listBAAs(): Promise<ServiceResult<BAA[]>> {
  try {
    const { data, error } = await supabase
      .from('business_associate_agreements')
      .select('id, tenant_id, associate_name, associate_type, service_description, contact_name, contact_email, contact_phone, status, effective_date, expiration_date, renewal_date, auto_renew, phi_types_shared, permitted_uses, notes, created_by, created_at, updated_at')
      .order('associate_name', { ascending: true });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as BAA[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BAA_LIST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to list BAAs');
  }
}

/**
 * Create a new BAA record
 */
export async function createBAA(
  request: CreateBAARequest
): Promise<ServiceResult<BAA>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase
      .from('business_associate_agreements')
      .insert({
        tenant_id: tenantId,
        associate_name: request.associate_name,
        associate_type: request.associate_type,
        service_description: request.service_description,
        contact_name: request.contact_name ?? null,
        contact_email: request.contact_email ?? null,
        contact_phone: request.contact_phone ?? null,
        effective_date: request.effective_date ?? null,
        expiration_date: request.expiration_date ?? null,
        phi_types_shared: request.phi_types_shared ?? [],
        permitted_uses: request.permitted_uses ?? null,
        notes: request.notes ?? null,
        status: 'draft',
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('BAA_CREATED', {
      baaId: data.id,
      associateName: request.associate_name,
    });

    return success(data as BAA);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BAA_CREATE_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to create BAA');
  }
}

/**
 * Update BAA status with review history
 */
export async function updateBAAStatus(
  baaId: string,
  newStatus: BAAStatus,
  reviewType: ReviewType,
  reviewNotes?: string
): Promise<ServiceResult<BAA>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;

    // Get current status
    const { data: current, error: fetchError } = await supabase
      .from('business_associate_agreements')
      .select('status')
      .eq('id', baaId)
      .single();

    if (fetchError) return failure('NOT_FOUND', 'BAA not found', fetchError);

    // Update status
    const { data, error } = await supabase
      .from('business_associate_agreements')
      .update({ status: newStatus })
      .eq('id', baaId)
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    // Record review history
    const { error: reviewError } = await supabase
      .from('baa_review_history')
      .insert({
        baa_id: baaId,
        tenant_id: tenantId,
        reviewed_by: user?.id,
        review_type: reviewType,
        previous_status: current.status,
        new_status: newStatus,
        review_notes: reviewNotes ?? null,
      });

    if (reviewError) {
      await auditLogger.warn('BAA_REVIEW_HISTORY_INSERT_FAILED', {
        baaId,
        error: reviewError.message,
      });
    }

    await auditLogger.info('BAA_STATUS_UPDATED', {
      baaId,
      previousStatus: current.status,
      newStatus,
      reviewType,
    });

    return success(data as BAA);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BAA_STATUS_UPDATE_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to update BAA status');
  }
}

/**
 * Get BAAs expiring within N days
 */
export async function getExpiringBAAs(
  withinDays: number = 90
): Promise<ServiceResult<BAA[]>> {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + withinDays);

    const { data, error } = await supabase
      .from('business_associate_agreements')
      .select('id, tenant_id, associate_name, associate_type, service_description, contact_name, contact_email, contact_phone, status, effective_date, expiration_date, renewal_date, auto_renew, phi_types_shared, permitted_uses, notes, created_by, created_at, updated_at')
      .eq('status', 'active')
      .not('expiration_date', 'is', null)
      .lte('expiration_date', futureDate.toISOString().split('T')[0])
      .order('expiration_date', { ascending: true });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as BAA[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BAA_EXPIRING_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get expiring BAAs');
  }
}

/**
 * Get review history for a BAA
 */
export async function getBAAReviewHistory(
  baaId: string
): Promise<ServiceResult<BAAReview[]>> {
  try {
    const { data, error } = await supabase
      .from('baa_review_history')
      .select('id, baa_id, tenant_id, reviewed_by, review_type, previous_status, new_status, review_notes, created_at')
      .eq('baa_id', baaId)
      .order('created_at', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as BAAReview[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('BAA_REVIEW_HISTORY_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get BAA review history');
  }
}

export const baaTrackingService = {
  listBAAs,
  createBAA,
  updateBAAStatus,
  getExpiringBAAs,
  getBAAReviewHistory,
};
