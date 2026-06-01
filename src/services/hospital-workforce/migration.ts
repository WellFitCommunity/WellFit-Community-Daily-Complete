/**
 * Hospital Workforce — Expiring Credentials, Migration Batches/Logs,
 * Provider Groups, and NPI Validation
 *
 * Extracted from hospitalWorkforceService.ts (CLAUDE.md Commandment #12).
 * Behavior unchanged — functions moved verbatim.
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';
import { auditLogger } from '../auditLogger';
import { getErrorMessage } from './shared';
import {
  HCExpiringCredentialView,
  HCMigrationBatch,
  HCMigrationBatchInsert,
  HCMigrationBatchUpdate,
  HCMigrationLog,
  HCMigrationLogInsert,
  HCProviderGroup,
  HCProviderGroupInsert,
} from '../../types/hospitalWorkforce';

// ============================================================================
// EXPIRING CREDENTIALS
// ============================================================================

export async function getExpiringCredentials(
  organizationId?: string,
  daysAhead: number = 90
): Promise<ServiceResult<HCExpiringCredentialView[]>> {
  try {
    const { data, error } = await supabase
      .from('vw_hc_expiring_credentials')
      .select('staff_id, employee_id, staff_name, email, credential_type, credential_name, credential_number, state, expiration_date, days_until_expiration')
      .order('days_until_expiration');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    let filtered = data || [];
    if (daysAhead !== 90) {
      filtered = filtered.filter(
        (c) => c.days_until_expiration <= daysAhead && c.days_until_expiration >= 0
      );
    }

    return success(filtered);
  } catch (err: unknown) {
    auditLogger.error('Failed to get expiring credentials', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to get expiring credentials', err);
  }
}

// ============================================================================
// MIGRATION BATCHES
// ============================================================================

export async function createMigrationBatch(batch: HCMigrationBatchInsert): Promise<ServiceResult<HCMigrationBatch>> {
  try {
    const { data, error } = await supabase.from('hc_migration_batch').insert(batch).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Migration batch created', {
      batchId: data.batch_id,
      sourceSystem: batch.source_system,
      recordCount: batch.record_count,
    });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create migration batch', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create migration batch', err);
  }
}

export async function getMigrationBatch(batchId: string): Promise<ServiceResult<HCMigrationBatch>> {
  try {
    const { data, error } = await supabase
      .from('hc_migration_batch')
      .select('batch_id, organization_id, source_system, source_file_name, source_file_hash, record_count, success_count, error_count, warning_count, status, started_at, completed_at, started_by, notes, created_at')
      .eq('batch_id', batchId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return failure('NOT_FOUND', 'Migration batch not found');
      }
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to get migration batch', getErrorMessage(err), { batchId });
    return failure('UNKNOWN_ERROR', 'Failed to get migration batch', err);
  }
}

export async function updateMigrationBatch(
  batchId: string,
  updates: HCMigrationBatchUpdate
): Promise<ServiceResult<HCMigrationBatch>> {
  try {
    const { data, error } = await supabase
      .from('hc_migration_batch')
      .update(updates)
      .eq('batch_id', batchId)
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Migration batch updated', { batchId, updates: Object.keys(updates) });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to update migration batch', getErrorMessage(err), { batchId });
    return failure('UNKNOWN_ERROR', 'Failed to update migration batch', err);
  }
}

export async function addMigrationLog(log: HCMigrationLogInsert): Promise<ServiceResult<HCMigrationLog>> {
  try {
    const { data, error } = await supabase.from('hc_migration_log').insert(log).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to add migration log', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to add migration log', err);
  }
}

export async function getMigrationLogs(
  batchId: string,
  severity?: 'ERROR' | 'WARNING' | 'INFO'
): Promise<ServiceResult<HCMigrationLog[]>> {
  try {
    let query = supabase.from('hc_migration_log').select('log_id, batch_id, source_row_number, source_record_id, table_name, field_name, severity, error_code, message, source_value, suggested_fix, is_resolved, resolved_by, resolved_at, created_at').eq('batch_id', batchId);
    if (severity) {
      query = query.eq('severity', severity);
    }
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get migration logs', getErrorMessage(err), { batchId });
    return failure('UNKNOWN_ERROR', 'Failed to get migration logs', err);
  }
}

// ============================================================================
// PROVIDER GROUPS
// ============================================================================

export async function getProviderGroups(organizationId: string): Promise<ServiceResult<HCProviderGroup[]>> {
  try {
    const { data, error } = await supabase
      .from('hc_provider_group')
      .select('group_id, organization_id, group_name, group_npi, tax_id, is_active, source_system, source_id, created_at, updated_at')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('group_name');

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data || []);
  } catch (err: unknown) {
    auditLogger.error('Failed to get provider groups', getErrorMessage(err), { organizationId });
    return failure('UNKNOWN_ERROR', 'Failed to get provider groups', err);
  }
}

export async function createProviderGroup(group: HCProviderGroupInsert): Promise<ServiceResult<HCProviderGroup>> {
  try {
    const { data, error } = await supabase.from('hc_provider_group').insert(group).select().single();

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    auditLogger.info('Provider group created', { groupId: data.group_id, groupName: data.group_name });
    return success(data);
  } catch (err: unknown) {
    auditLogger.error('Failed to create provider group', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to create provider group', err);
  }
}

// ============================================================================
// VALIDATE NPI
// ============================================================================

export async function validateNPI(npi: string): Promise<ServiceResult<boolean>> {
  try {
    const { data, error } = await supabase.rpc('validate_hc_npi', { p_npi: npi });

    if (error) {
      return failure('DATABASE_ERROR', error.message, error);
    }

    return success(data ?? false);
  } catch (err: unknown) {
    auditLogger.error('Failed to validate NPI', getErrorMessage(err));
    return failure('UNKNOWN_ERROR', 'Failed to validate NPI', err);
  }
}
