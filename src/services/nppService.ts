/**
 * Notice of Privacy Practices (NPP) Service
 *
 * Purpose: Manage NPP versions and patient acknowledgments
 * Regulation: 45 CFR 164.520
 * Features: Version management, acknowledgment tracking, compliance checking
 *
 * @module services/nppService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type AcknowledgmentType = 'electronic' | 'signed' | 'verbal' | 'refused';

export interface NppVersion {
  id: string;
  tenant_id: string;
  version_number: string;
  effective_date: string;
  content_hash: string;
  summary: string | null;
  is_current: boolean;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NppAcknowledgment {
  id: string;
  tenant_id: string;
  patient_id: string;
  npp_version_id: string;
  acknowledgment_type: AcknowledgmentType;
  acknowledged_at: string;
  refusal_reason: string | null;
  created_at: string;
}

export interface AcknowledgmentStatus {
  has_acknowledged_current: boolean;
  current_version: NppVersion | null;
  last_acknowledgment: NppAcknowledgment | null;
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
 * Get the current NPP version for the tenant
 */
export async function getCurrentNPP(): Promise<ServiceResult<NppVersion | null>> {
  try {
    const { data, error } = await supabase
      .from('npp_versions')
      .select('*')
      .eq('is_current', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success((data as NppVersion) ?? null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NPP_FETCH_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to get current NPP');
  }
}

/**
 * Record a patient's acknowledgment of the NPP
 */
export async function recordAcknowledgment(
  nppVersionId: string,
  acknowledgmentType: AcknowledgmentType,
  refusalReason?: string
): Promise<ServiceResult<NppAcknowledgment>> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return failure('UNAUTHORIZED', 'No tenant context');

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return failure('UNAUTHORIZED', 'Not authenticated');

    const { data, error } = await supabase
      .from('npp_acknowledgments')
      .upsert(
        {
          tenant_id: tenantId,
          patient_id: user.id,
          npp_version_id: nppVersionId,
          acknowledgment_type: acknowledgmentType,
          acknowledged_at: new Date().toISOString(),
          refusal_reason: refusalReason ?? null,
        },
        { onConflict: 'patient_id,npp_version_id' }
      )
      .select()
      .single();

    if (error) return failure('DATABASE_ERROR', error.message, error);

    await auditLogger.info('NPP_ACKNOWLEDGMENT_RECORDED', {
      patientId: user.id,
      versionId: nppVersionId,
      type: acknowledgmentType,
    });

    return success(data as NppAcknowledgment);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NPP_ACKNOWLEDGMENT_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to record NPP acknowledgment');
  }
}

/**
 * Check if a patient has acknowledged the current NPP version
 */
export async function checkAcknowledgmentStatus(
  patientId?: string
): Promise<ServiceResult<AcknowledgmentStatus>> {
  try {
    const userId = patientId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return failure('UNAUTHORIZED', 'Not authenticated');

    // Get current NPP
    const currentResult = await getCurrentNPP();
    if (!currentResult.success) return currentResult;

    const currentVersion = currentResult.data;
    if (!currentVersion) {
      return success({
        has_acknowledged_current: false,
        current_version: null,
        last_acknowledgment: null,
      });
    }

    // Check for acknowledgment
    const { data: ack, error } = await supabase
      .from('npp_acknowledgments')
      .select('*')
      .eq('patient_id', userId)
      .eq('npp_version_id', currentVersion.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success({
      has_acknowledged_current: !!ack && ack.acknowledgment_type !== 'refused',
      current_version: currentVersion,
      last_acknowledgment: (ack as NppAcknowledgment) ?? null,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NPP_STATUS_CHECK_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to check NPP acknowledgment status');
  }
}

/**
 * Get all NPP versions for the tenant
 */
export async function listNppVersions(): Promise<ServiceResult<NppVersion[]>> {
  try {
    const { data, error } = await supabase
      .from('npp_versions')
      .select('*')
      .order('effective_date', { ascending: false });

    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success((data ?? []) as NppVersion[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('NPP_LIST_FAILED', error);
    return failure('OPERATION_FAILED', 'Failed to list NPP versions');
  }
}

export const nppService = {
  getCurrentNPP,
  recordAcknowledgment,
  checkAcknowledgmentStatus,
  listNppVersions,
};
