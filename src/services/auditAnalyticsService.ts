/**
 * Audit Analytics Service - Audit Log Analysis and Search
 *
 * Purpose: Query, analyze, and export audit log data
 * Features: Full-text search, aggregation, compliance reporting
 * Compliance: SOC2 CC7.2, HIPAA § 164.312(b)
 *
 * @module services/auditAnalyticsService
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { ServiceResult, success, failure } from './_base';
import {
  AUDIT_LOG_READ_COLUMNS,
  LIVE_AUDIT_CATEGORIES,
  deriveAuditSeverity,
  type AuditSeverity,
  type LiveAuditCategory,
} from './auditLogRead';

// =============================================================================
// TYPES
// =============================================================================

// Live event_category vocabulary (see services/auditLogRead.ts)
export type AuditEventCategory = LiveAuditCategory;

export type { AuditSeverity } from './auditLogRead';

// Field names kept for the dashboard; values mapped from LIVE columns
// (timestamp, event_category, metadata, operation, actor_ip_address,
// target_user_id). severity is DERIVED — audit_logs stores none.
export interface AuditLogEntry {
  id: string;
  event_type: string;
  category: AuditEventCategory;
  severity: AuditSeverity;
  actor_user_id: string | null;
  actor_name?: string;
  patient_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  action: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface LiveAuditRow {
  id: string;
  event_type: string;
  event_category: string | null;
  actor_user_id: string | null;
  actor_role: string | null;
  target_user_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  operation: string | null;
  metadata: Record<string, unknown> | null;
  actor_ip_address: string | null;
  actor_user_agent: string | null;
  success: boolean | null;
  error_code: string | null;
  error_message: string | null;
  timestamp: string;
}

function mapLiveRow(row: LiveAuditRow): AuditLogEntry {
  return {
    id: row.id,
    event_type: row.event_type,
    category: (row.event_category ?? 'SYSTEM_EVENT') as AuditEventCategory,
    severity: deriveAuditSeverity(row.event_category, row.success),
    actor_user_id: row.actor_user_id,
    patient_id: row.target_user_id,
    resource_type: row.resource_type,
    resource_id: row.resource_id,
    action: row.operation,
    details: row.metadata,
    ip_address: row.actor_ip_address,
    user_agent: row.actor_user_agent,
    created_at: row.timestamp,
  };
}

export interface AuditSearchFilters {
  query?: string;
  category?: AuditEventCategory;
  severity?: AuditSeverity;
  eventType?: string;
  actorUserId?: string;
  patientId?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  eventsByCategory: Record<AuditEventCategory, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  topEventTypes: Array<{ event_type: string; count: number }>;
  topActors: Array<{ actor_id: string; actor_name: string; count: number }>;
  eventsOverTime: Array<{ date: string; count: number }>;
}

export interface PHIAccessReport {
  patientId: string;
  patientName?: string;
  accessCount: number;
  uniqueAccessors: number;
  lastAccessed: string;
  accessors: Array<{
    userId: string;
    userName: string;
    accessCount: number;
    lastAccess: string;
  }>;
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Search audit logs
 */
async function searchAuditLogs(
  filters: AuditSearchFilters
): Promise<ServiceResult<{ entries: AuditLogEntry[]; total: number }>> {
  try {
    let query = supabase
      .from('audit_logs')
      .select(AUDIT_LOG_READ_COLUMNS, { count: 'exact' });

    // Apply filters (live columns: event_category / target_user_id / timestamp)
    if (filters.category) {
      query = query.eq('event_category', filters.category);
    }

    if (filters.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters.actorUserId) {
      query = query.eq('actor_user_id', filters.actorUserId);
    }

    if (filters.patientId) {
      query = query.eq('target_user_id', filters.patientId);
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters.dateFrom) {
      query = query.gte('timestamp', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('timestamp', filters.dateTo);
    }

    // Search on event_type/operation (metadata is jsonb — not ilike-able server-side)
    if (filters.query) {
      query = query.or(`event_type.ilike.%${filters.query}%,operation.ilike.%${filters.query}%`);
    }

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.order('timestamp', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to search audit logs', error);
    }

    let entries = ((data || []) as unknown as LiveAuditRow[]).map(mapLiveRow);
    // Severity is derived — filter client-side
    if (filters.severity) {
      entries = entries.filter(entry => entry.severity === filters.severity);
    }

    await auditLogger.info('AUDIT_SEARCH_PERFORMED', {
      filters: { ...filters, query: filters.query ? '[REDACTED]' : undefined },
      resultCount: data?.length || 0,
    });

    return success({
      entries,
      total: count || 0,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AUDIT_SEARCH_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to search audit logs', err);
  }
}

/**
 * Get audit statistics
 */
async function getAuditStats(
  dateFrom?: string,
  dateTo?: string
): Promise<ServiceResult<AuditStats>> {
  try {
    const startDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = dateTo || new Date().toISOString();

    // Get total events (live time column is `timestamp`)
    const { count: totalEvents } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    // One pass drives category AND derived-severity counts
    const { data: categoryData } = await supabase
      .from('audit_logs')
      .select('event_category, success')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    const eventsByCategory = Object.fromEntries(
      LIVE_AUDIT_CATEGORIES.map(category => [category, 0])
    ) as Record<AuditEventCategory, number>;

    const eventsBySeverity: Record<AuditSeverity, number> = {
      info: 0, warning: 0, error: 0, critical: 0,
    };

    for (const row of categoryData || []) {
      if (row.event_category && row.event_category in eventsByCategory) {
        eventsByCategory[row.event_category as AuditEventCategory]++;
      }
      eventsBySeverity[deriveAuditSeverity(row.event_category, row.success)]++;
    }

    // Get top event types
    const { data: eventTypeData } = await supabase
      .from('audit_logs')
      .select('event_type')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate);

    const eventTypeCounts: Record<string, number> = {};
    for (const row of eventTypeData || []) {
      eventTypeCounts[row.event_type] = (eventTypeCounts[row.event_type] || 0) + 1;
    }

    const topEventTypes = Object.entries(eventTypeCounts)
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get top actors (simplified - would join with profiles in real impl)
    const { data: actorData } = await supabase
      .from('audit_logs')
      .select('actor_user_id')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .not('actor_user_id', 'is', null);

    const actorCounts: Record<string, number> = {};
    for (const row of actorData || []) {
      if (row.actor_user_id) {
        actorCounts[row.actor_user_id] = (actorCounts[row.actor_user_id] || 0) + 1;
      }
    }

    const topActors = Object.entries(actorCounts)
      .map(([actor_id, count]) => ({ actor_id, actor_name: actor_id.substring(0, 8) + '...', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get events over time (by day)
    const { data: timeData } = await supabase
      .from('audit_logs')
      .select('timestamp')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp');

    const dailyCounts: Record<string, number> = {};
    for (const row of timeData || []) {
      const date = row.timestamp.split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    }

    const eventsOverTime = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return success({
      totalEvents: totalEvents || 0,
      eventsByCategory,
      eventsBySeverity,
      topEventTypes,
      topActors,
      eventsOverTime,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AUDIT_STATS_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get audit statistics', err);
  }
}

/**
 * Get PHI access report for a patient
 */
async function getPHIAccessReport(
  patientId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<ServiceResult<PHIAccessReport>> {
  try {
    const startDate = dateFrom || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = dateTo || new Date().toISOString();

    // Get all PHI access events for this patient
    const { data: phiData, error } = await supabase
      .from('audit_logs')
      .select(AUDIT_LOG_READ_COLUMNS)
      .eq('target_user_id', patientId)
      .eq('event_category', 'PHI_ACCESS')
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false });
    const data = ((phiData || []) as unknown as LiveAuditRow[]).map(mapLiveRow);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get PHI access report', error);
    }

    // Aggregate by accessor
    const accessorMap = new Map<string, { count: number; lastAccess: string }>();
    for (const entry of data || []) {
      const actorId = entry.actor_user_id || 'system';
      const existing = accessorMap.get(actorId);
      if (existing) {
        existing.count++;
        if (entry.created_at > existing.lastAccess) {
          existing.lastAccess = entry.created_at;
        }
      } else {
        accessorMap.set(actorId, { count: 1, lastAccess: entry.created_at });
      }
    }

    const accessors = Array.from(accessorMap.entries()).map(([userId, info]) => ({
      userId,
      userName: userId === 'system' ? 'System' : userId.substring(0, 8) + '...',
      accessCount: info.count,
      lastAccess: info.lastAccess,
    }));

    await auditLogger.phi('READ', patientId, {
      resourceType: 'phi_access_report',
      operation: 'generate_report',
    });

    return success({
      patientId,
      accessCount: data?.length || 0,
      uniqueAccessors: accessorMap.size,
      lastAccessed: data?.[0]?.created_at || '',
      accessors,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('PHI_REPORT_FAILED', error, { patientId });
    return failure('OPERATION_FAILED', 'Failed to get PHI access report', err);
  }
}

/**
 * Get security event summary
 */
async function getSecurityEventSummary(
  dateFrom?: string,
  dateTo?: string
): Promise<ServiceResult<{
  total: number;
  bySeverity: Record<string, number>;
  byType: Array<{ type: string; count: number }>;
  recentCritical: AuditLogEntry[];
}>> {
  try {
    const startDate = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = dateTo || new Date().toISOString();

    // Get security events
    // security_events' live time column is `timestamp` (no created_at)
    const { data, error, count } = await supabase
      .from('security_events')
      .select('id, event_type, severity, timestamp', { count: 'exact' })
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (error) {
      return failure('DATABASE_ERROR', 'Failed to get security events', error);
    }

    // Aggregate by severity
    const bySeverity: Record<string, number> = {};
    const byTypeMap: Record<string, number> = {};

    for (const event of data || []) {
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
      byTypeMap[event.event_type] = (byTypeMap[event.event_type] || 0) + 1;
    }

    const byType = Object.entries(byTypeMap)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get recent critical events
    const recentCritical = (data || [])
      .filter(e => (e.severity || '').toUpperCase() === 'CRITICAL')
      .slice(0, 5)
      .map(e => ({ ...e, created_at: e.timestamp })) as unknown as AuditLogEntry[];

    return success({
      total: count || 0,
      bySeverity,
      byType,
      recentCritical,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('SECURITY_SUMMARY_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to get security summary', err);
  }
}

/**
 * Export audit logs for compliance review
 */
async function exportAuditLogs(
  filters: AuditSearchFilters,
  format: 'json' | 'csv' = 'json'
): Promise<ServiceResult<string>> {
  try {
    // Get all matching logs (with higher limit for export)
    const result = await searchAuditLogs({
      ...filters,
      limit: 10000,
      offset: 0,
    });

    if (!result.success) {
      return failure('OPERATION_FAILED', 'Failed to fetch logs for export');
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = ['id', 'created_at', 'event_type', 'category', 'severity', 'actor_user_id', 'patient_id', 'resource_type', 'resource_id', 'action'];
      const rows = result.data.entries.map(entry => [
        entry.id,
        entry.created_at,
        entry.event_type,
        entry.category,
        entry.severity,
        entry.actor_user_id || '',
        entry.patient_id || '',
        entry.resource_type || '',
        entry.resource_id || '',
        entry.action || '',
      ]);

      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      await auditLogger.info('AUDIT_EXPORT_COMPLETED', {
        format: 'csv',
        recordCount: result.data.entries.length,
      });

      return success(csvContent);
    }

    // Return JSON
    await auditLogger.info('AUDIT_EXPORT_COMPLETED', {
      format: 'json',
      recordCount: result.data.entries.length,
    });

    return success(JSON.stringify(result.data.entries, null, 2));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('AUDIT_EXPORT_FAILED', error, {});
    return failure('OPERATION_FAILED', 'Failed to export audit logs', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const auditAnalyticsService = {
  // Search
  searchAuditLogs,

  // Analytics
  getAuditStats,
  getSecurityEventSummary,

  // Reports
  getPHIAccessReport,
  exportAuditLogs,
};

export default auditAnalyticsService;
