/**
 * Tenant Configuration Audit Service
 *
 * Purpose: Query and analyze tenant configuration change history
 * Features: History lookup, statistics, diff comparison
 * Compliance: SOC2 CC6.1 - Audit trail of configuration changes
 *
 * @module services/tenantConfigAuditService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export interface ConfigChange {
  id: string;
  tenantId: string;
  tenantName?: string;
  configTable: string;
  fieldName: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValue: unknown;
  newValue: unknown;
  changedByUserId: string | null;
  changedByName: string | null;
  changedByRole: string | null;
  changedAt: string;
  changeSource: string;
  reason: string | null;
  approvalTicket: string | null;
}

export interface ConfigChangeFilters {
  tenantId: string;
  configTable?: string;
  fieldName?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  changedByUserId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface ConfigChangeSummary {
  tenantId: string;
  tenantName: string | null;
  totalChanges: number;
  inserts: number;
  updates: number;
  deletes: number;
  uniqueChangers: number;
  lastChangeAt: string | null;
}

export interface ConfigChangeStats {
  totalChanges: number;
  changesByTable: Record<string, number>;
  changesByUser: Array<{ name: string; count: number }>;
  changesByAction: Record<string, number>;
  changesByDay: Array<{ date: string; count: number }>;
}

export interface ConfigDiff {
  configTable: string;
  fieldName: string;
  valueAtT1: unknown;
  valueAtT2: unknown;
  changed: boolean;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Get configuration change history for a tenant
 */
async function getChangeHistory(
  filters: ConfigChangeFilters
): Promise<ServiceResult<{ changes: ConfigChange[]; total: number }>> {
  try {
    let query = supabase
      .from('tenant_config_audit')
      .select('*, tenants!inner(name)', { count: 'exact' })
      .eq('tenant_id', filters.tenantId);

    if (filters.configTable) {
      query = query.eq('config_table', filters.configTable);
    }

    if (filters.fieldName) {
      query = query.eq('field_name', filters.fieldName);
    }

    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    if (filters.changedByUserId) {
      query = query.eq('changed_by_user_id', filters.changedByUserId);
    }

    if (filters.dateFrom) {
      query = query.gte('changed_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('changed_at', filters.dateTo);
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    query = query
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get change history', error);
    }

    const changes: ConfigChange[] = (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenants?.name,
      configTable: row.config_table,
      fieldName: row.field_name,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedByUserId: row.changed_by_user_id,
      changedByName: row.changed_by_name,
      changedByRole: row.changed_by_role,
      changedAt: row.changed_at,
      changeSource: row.change_source,
      reason: row.reason,
      approvalTicket: row.approval_ticket,
    }));

    return success({ changes, total: count || 0 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_AUDIT_HISTORY_FAILED', error, { tenantId: filters.tenantId });
    return failure('OPERATION_FAILED', 'Failed to get change history', err);
  }
}

/**
 * Get recent configuration changes for all tenants (super admin)
 */
async function getRecentChanges(
  limit: number = 50
): Promise<ServiceResult<ConfigChange[]>> {
  try {
    const { data, error } = await supabase
      .from('v_tenant_config_changes')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get recent changes', error);
    }

    const changes: ConfigChange[] = (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      configTable: row.config_table,
      fieldName: row.field_name,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedByUserId: row.changed_by_user_id,
      changedByName: row.changed_by_name,
      changedByRole: row.changed_by_role,
      changedAt: row.changed_at,
      changeSource: row.change_source,
      reason: row.reason,
      approvalTicket: row.approval_ticket,
    }));

    return success(changes);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_AUDIT_RECENT_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get recent changes', err);
  }
}

/**
 * Get change summary by tenant
 */
async function getChangeSummary(): Promise<ServiceResult<ConfigChangeSummary[]>> {
  try {
    const { data, error } = await supabase
      .from('v_tenant_config_change_summary')
      .select('*')
      .order('last_change_at', { ascending: false, nullsFirst: false });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get change summary', error);
    }

    const summaries: ConfigChangeSummary[] = (data || []).map((row) => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      totalChanges: row.total_changes,
      inserts: row.inserts,
      updates: row.updates,
      deletes: row.deletes,
      uniqueChangers: row.unique_changers,
      lastChangeAt: row.last_change_at,
    }));

    return success(summaries);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_AUDIT_SUMMARY_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get change summary', err);
  }
}

/**
 * Get configuration change statistics for a tenant
 */
async function getChangeStats(
  tenantId: string,
  days: number = 30
): Promise<ServiceResult<ConfigChangeStats>> {
  try {
    const { data, error } = await supabase.rpc('get_tenant_config_stats', {
      p_tenant_id: tenantId,
      p_days: days,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get change stats', error);
    }

    const row = Array.isArray(data) ? data[0] : data;

    return success({
      totalChanges: row?.total_changes || 0,
      changesByTable: (row?.changes_by_table || {}) as Record<string, number>,
      changesByUser: (row?.changes_by_user || []) as Array<{ name: string; count: number }>,
      changesByAction: (row?.changes_by_action || {}) as Record<string, number>,
      changesByDay: (row?.changes_by_day || []) as Array<{ date: string; count: number }>,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_AUDIT_STATS_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to get change stats', err);
  }
}

/**
 * Compare configuration at two points in time
 */
async function compareSnapshots(
  tenantId: string,
  timestamp1: string,
  timestamp2: string
): Promise<ServiceResult<ConfigDiff[]>> {
  try {
    const { data, error } = await supabase.rpc('compare_config_snapshots', {
      p_tenant_id: tenantId,
      p_timestamp_1: timestamp1,
      p_timestamp_2: timestamp2,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to compare snapshots', error);
    }

    const diffs: ConfigDiff[] = (data || []).map((row: {
      config_table: string;
      field_name: string;
      value_at_t1: unknown;
      value_at_t2: unknown;
      changed_between: boolean;
    }) => ({
      configTable: row.config_table,
      fieldName: row.field_name,
      valueAtT1: row.value_at_t1,
      valueAtT2: row.value_at_t2,
      changed: row.changed_between,
    }));

    await auditLogger.info('CONFIG_SNAPSHOT_COMPARED', {
      tenantId,
      timestamp1,
      timestamp2,
      diffCount: diffs.length,
    });

    return success(diffs);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_SNAPSHOT_COMPARE_FAILED', error, { tenantId });
    return failure('OPERATION_FAILED', 'Failed to compare snapshots', err);
  }
}

/**
 * Log a manual configuration change with reason
 */
async function logManualChange(
  tenantId: string,
  configTable: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
  reason: string,
  approvalTicket?: string
): Promise<ServiceResult<string>> {
  try {
    const { data, error } = await supabase.rpc('log_manual_config_change', {
      p_tenant_id: tenantId,
      p_config_table: configTable,
      p_field_name: fieldName,
      p_old_value: JSON.stringify(oldValue),
      p_new_value: JSON.stringify(newValue),
      p_reason: reason,
      p_approval_ticket: approvalTicket || null,
    });

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to log manual change', error);
    }

    await auditLogger.info('CONFIG_MANUAL_CHANGE_LOGGED', {
      tenantId,
      configTable,
      fieldName,
      reason,
      approvalTicket,
    });

    return success(data as string);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_MANUAL_LOG_FAILED', error, { tenantId, configTable });
    return failure('OPERATION_FAILED', 'Failed to log manual change', err);
  }
}

/**
 * Get changes for a specific field
 */
async function getFieldHistory(
  tenantId: string,
  configTable: string,
  fieldName: string,
  limit: number = 20
): Promise<ServiceResult<ConfigChange[]>> {
  return getChangeHistory({
    tenantId,
    configTable,
    fieldName,
    limit,
  }).then((result) => {
    if (result.success) {
      return success(result.data.changes);
    }
    return failure(result.error.code, result.error.message);
  });
}

/**
 * Search configuration changes
 */
async function searchChanges(
  searchTerm: string,
  tenantId?: string,
  limit: number = 50
): Promise<ServiceResult<ConfigChange[]>> {
  try {
    let query = supabase
      .from('tenant_config_audit')
      .select('*, tenants!inner(name)')
      .or(`field_name.ilike.%${searchTerm}%,config_table.ilike.%${searchTerm}%,reason.ilike.%${searchTerm}%`)
      .order('changed_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to search changes', error);
    }

    const changes: ConfigChange[] = (data || []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenants?.name,
      configTable: row.config_table,
      fieldName: row.field_name,
      action: row.action,
      oldValue: row.old_value,
      newValue: row.new_value,
      changedByUserId: row.changed_by_user_id,
      changedByName: row.changed_by_name,
      changedByRole: row.changed_by_role,
      changedAt: row.changed_at,
      changeSource: row.change_source,
      reason: row.reason,
      approvalTicket: row.approval_ticket,
    }));

    return success(changes);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_AUDIT_SEARCH_FAILED', error, { searchTerm });
    return failure('OPERATION_FAILED', 'Failed to search changes', err);
  }
}

/**
 * Export configuration change history for compliance
 */
async function exportChangeHistory(
  filters: ConfigChangeFilters,
  format: 'json' | 'csv' = 'json'
): Promise<ServiceResult<string>> {
  try {
    const result = await getChangeHistory({
      ...filters,
      limit: 10000,
      offset: 0,
    });

    if (!result.success) {
      return failure('OPERATION_FAILED', 'Failed to get changes for export');
    }

    const changes = result.data.changes;

    if (format === 'csv') {
      const headers = [
        'id',
        'changed_at',
        'config_table',
        'field_name',
        'action',
        'changed_by_name',
        'changed_by_role',
        'change_source',
        'reason',
        'approval_ticket',
        'old_value',
        'new_value',
      ];

      const rows = changes.map((change) => [
        change.id,
        change.changedAt,
        change.configTable,
        change.fieldName,
        change.action,
        change.changedByName || '',
        change.changedByRole || '',
        change.changeSource,
        change.reason || '',
        change.approvalTicket || '',
        JSON.stringify(change.oldValue || ''),
        JSON.stringify(change.newValue || ''),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      await auditLogger.info('CONFIG_AUDIT_EXPORT', {
        tenantId: filters.tenantId,
        format: 'csv',
        recordCount: changes.length,
      });

      return success(csvContent);
    }

    await auditLogger.info('CONFIG_AUDIT_EXPORT', {
      tenantId: filters.tenantId,
      format: 'json',
      recordCount: changes.length,
    });

    return success(JSON.stringify(changes, null, 2));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('CONFIG_AUDIT_EXPORT_FAILED', error, { tenantId: filters.tenantId });
    return failure('OPERATION_FAILED', 'Failed to export change history', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const tenantConfigAuditService = {
  // Query
  getChangeHistory,
  getRecentChanges,
  getFieldHistory,
  searchChanges,

  // Statistics
  getChangeSummary,
  getChangeStats,

  // Comparison
  compareSnapshots,

  // Logging
  logManualChange,

  // Export
  exportChangeHistory,
};

export default tenantConfigAuditService;
