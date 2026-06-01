/**
 * MPI Matching — tenant matching configuration + enterprise MPI linking
 *
 * Extracted from mpiMatchingService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { ServiceResult, success, failure } from '../_base';
import type { MPIMatchingConfig, MPIIdentityRecord } from './types';

/**
 * Get matching configuration for a tenant
 */
export async function getMatchingConfig(tenantId: string): Promise<ServiceResult<MPIMatchingConfig | null>> {
  try {
    const { data, error } = await supabase
      .from('mpi_matching_config')
      .select('id, tenant_id, auto_merge_threshold, review_threshold, definite_no_match_threshold, field_weights, blocking_keys, use_jaro_winkler, use_soundex, use_metaphone, jaro_winkler_threshold, require_dob_match, allow_partial_ssn_match, phone_match_weight_boost, auto_merge_enabled, auto_merge_requires_mrn_match, auto_merge_max_per_day, default_review_priority, escalate_high_volume, high_volume_threshold, audit_all_matches, retain_match_history_days, is_active, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', 'Failed to get matching config', error);
    }

    return success(data as MPIMatchingConfig | null);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_CONFIG_GET_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get matching config', err);
  }
}

/**
 * Update matching configuration for a tenant
 */
export async function updateMatchingConfig(
  tenantId: string,
  config: Partial<Omit<MPIMatchingConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>>
): Promise<ServiceResult<MPIMatchingConfig>> {
  try {
    const { data, error } = await supabase
      .from('mpi_matching_config')
      .upsert(
        {
          tenant_id: tenantId,
          ...config,
        },
        {
          onConflict: 'tenant_id',
        }
      )
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to update matching config', error);
    }

    await auditLogger.info('MPI_CONFIG_UPDATED', {
      tenantId,
      updatedFields: Object.keys(config),
    });

    return success(data as MPIMatchingConfig);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_CONFIG_UPDATE_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to update matching config', err);
  }
}

/**
 * Link patient to enterprise MPI ID (cross-tenant linking)
 */
export async function linkToEnterpriseMPI(
  patientId: string,
  tenantId: string,
  enterpriseMpiId: string
): Promise<ServiceResult<MPIIdentityRecord>> {
  try {
    const { data, error } = await supabase
      .from('mpi_identity_records')
      .update({
        enterprise_mpi_id: enterpriseMpiId,
      })
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to link to enterprise MPI', error);
    }

    await auditLogger.info('MPI_ENTERPRISE_LINK_CREATED', {
      patientId,
      tenantId,
      enterpriseMpiId,
    });

    return success(data as MPIIdentityRecord);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_ENTERPRISE_LINK_FAILED', error, { patientId, tenantId, enterpriseMpiId });
    return failure('OPERATION_FAILED', 'Failed to link to enterprise MPI', err);
  }
}

/**
 * Get all patients linked to an enterprise MPI ID
 */
export async function getEnterpriseMPILinks(
  enterpriseMpiId: string
): Promise<ServiceResult<MPIIdentityRecord[]>> {
  try {
    const { data, error } = await supabase
      .from('mpi_identity_records')
      .select('id, patient_id, tenant_id, enterprise_mpi_id, first_name_normalized, last_name_normalized, middle_name_normalized, first_name_soundex, last_name_soundex, first_name_metaphone, last_name_metaphone, date_of_birth, gender, ssn_last_four, phone_normalized, email_normalized, address_normalized, city_normalized, state, zip_code, mrn, mrn_assigning_authority, identity_confidence_score, identity_verified_at, identity_verified_by, verification_method, match_hash, last_matched_at, match_count, is_golden_record, is_active, created_at, updated_at')
      .eq('enterprise_mpi_id', enterpriseMpiId)
      .eq('is_active', true);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get enterprise MPI links', error);
    }

    return success((data || []) as MPIIdentityRecord[]);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('MPI_ENTERPRISE_LINKS_FAILED', error, { enterpriseMpiId });
    return failure('OPERATION_FAILED', 'Failed to get enterprise MPI links', err);
  }
}
