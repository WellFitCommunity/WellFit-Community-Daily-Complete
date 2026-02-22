/**
 * Encounter Audit Service — unified timeline of all encounter events
 *
 * Purpose: Aggregates 5 data sources into a single chronological timeline
 * for encounter-level compliance review and clinical audit.
 *
 * Sources:
 *   1. encounter_status_history — status transitions
 *   2. clinical_field_provenance — field-level edits
 *   3. clinical_note_amendments — formal amendments
 *   4. clinical_note_lock_audit — lock/unlock events
 *   5. audit_logs — general audit entries for this encounter
 *
 * Used by: EncounterAuditTimeline
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';
import { encounterStateMachine } from './encounterStateMachine';
import type { ServiceResult } from './_base';
import { success, failure } from './_base';

// =============================================================================
// TYPES
// =============================================================================

export type TimelineSource =
  | 'status_change'
  | 'field_edit'
  | 'amendment'
  | 'lock_action'
  | 'audit_log';

export type TimelineSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface EncounterTimelineEntry {
  id: string;
  timestamp: string;
  source: TimelineSource;
  actor_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  severity: TimelineSeverity;
  category: string;
}

export interface EncounterHeader {
  encounter_id: string;
  status: string;
  patient_id: string | null;
  provider_id: string | null;
  encounter_date: string | null;
}

export interface FieldChangeEntry {
  id: string;
  encounter_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  change_reason: string | null;
}

export interface AmendmentEntry {
  id: string;
  note_id: string;
  amendment_text: string;
  amendment_reason: string | null;
  amended_by: string | null;
  created_at: string;
  status: string;
}

// =============================================================================
// INTERNAL QUERY HELPERS
// =============================================================================

async function fetchStatusHistory(encounterId: string): Promise<EncounterTimelineEntry[]> {
  const result = await encounterStateMachine.getStatusHistory(encounterId);
  if (!result.success) return [];

  return result.data.map(entry => ({
    id: `status-${entry.id ?? entry.changed_at}`,
    timestamp: entry.changed_at,
    source: 'status_change' as TimelineSource,
    actor_id: entry.changed_by ?? null,
    summary: `Status changed: ${entry.from_status ?? '(new)'} → ${entry.to_status}`,
    details: {
      from_status: entry.from_status,
      to_status: entry.to_status,
      reason: entry.reason,
      metadata: entry.metadata,
    },
    severity: 'info' as TimelineSeverity,
    category: 'Status',
  }));
}

async function fetchFieldChanges(encounterId: string): Promise<EncounterTimelineEntry[]> {
  const { data, error } = await supabase
    .from('clinical_field_provenance')
    .select('id, encounter_id, field_name, old_value, new_value, changed_by, changed_at, change_reason')
    .eq('encounter_id', encounterId)
    .order('changed_at', { ascending: true });

  if (error || !data) return [];

  return (data as FieldChangeEntry[]).map(entry => ({
    id: `field-${entry.id}`,
    timestamp: entry.changed_at,
    source: 'field_edit' as TimelineSource,
    actor_id: entry.changed_by,
    summary: `Field "${entry.field_name}" edited`,
    details: {
      field_name: entry.field_name,
      old_value: entry.old_value,
      new_value: entry.new_value,
      reason: entry.change_reason,
    },
    severity: 'info' as TimelineSeverity,
    category: 'Field Edit',
  }));
}

async function fetchAmendments(encounterId: string): Promise<EncounterTimelineEntry[]> {
  // Amendments are linked via clinical_notes → encounter_id
  const { data: notes } = await supabase
    .from('clinical_notes')
    .select('id')
    .eq('encounter_id', encounterId);

  if (!notes || notes.length === 0) return [];

  const noteIds = notes.map(n => n.id);

  const { data, error } = await supabase
    .from('clinical_note_amendments')
    .select('id, note_id, amendment_text, amendment_reason, amended_by, created_at, status')
    .in('note_id', noteIds)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return (data as AmendmentEntry[]).map(entry => ({
    id: `amendment-${entry.id}`,
    timestamp: entry.created_at,
    source: 'amendment' as TimelineSource,
    actor_id: entry.amended_by,
    summary: `Amendment filed: ${(entry.amendment_reason || 'No reason provided').slice(0, 80)}`,
    details: {
      note_id: entry.note_id,
      amendment_text: entry.amendment_text,
      amendment_reason: entry.amendment_reason,
      status: entry.status,
    },
    severity: 'warning' as TimelineSeverity,
    category: 'Amendment',
  }));
}

async function fetchLockEvents(encounterId: string): Promise<EncounterTimelineEntry[]> {
  // Lock audit is linked via clinical_notes → encounter_id
  const { data: notes } = await supabase
    .from('clinical_notes')
    .select('id')
    .eq('encounter_id', encounterId);

  if (!notes || notes.length === 0) return [];

  const noteIds = notes.map(n => n.id);

  const { data, error } = await supabase
    .from('clinical_note_lock_audit')
    .select('id, note_id, action, performed_by, created_at, reason')
    .in('note_id', noteIds)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  interface LockAuditRow {
    id: string;
    note_id: string;
    action: string;
    performed_by: string | null;
    created_at: string;
    reason: string | null;
  }

  return (data as LockAuditRow[]).map(entry => ({
    id: `lock-${entry.id}`,
    timestamp: entry.created_at,
    source: 'lock_action' as TimelineSource,
    actor_id: entry.performed_by,
    summary: `Note ${entry.action}: ${entry.reason || 'No reason'}`,
    details: {
      note_id: entry.note_id,
      action: entry.action,
      reason: entry.reason,
    },
    severity: (entry.action === 'locked' ? 'info' : 'warning') as TimelineSeverity,
    category: 'Lock',
  }));
}

async function fetchAuditLogs(encounterId: string): Promise<EncounterTimelineEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, event_type, category, severity, actor_user_id, details, created_at')
    .eq('resource_id', encounterId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error || !data) return [];

  interface AuditRow {
    id: string;
    event_type: string;
    category: string;
    severity: string;
    actor_user_id: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }

  return (data as AuditRow[]).map(entry => ({
    id: `audit-${entry.id}`,
    timestamp: entry.created_at,
    source: 'audit_log' as TimelineSource,
    actor_id: entry.actor_user_id,
    summary: entry.event_type.replace(/_/g, ' '),
    details: entry.details ?? {},
    severity: (entry.severity === 'critical' ? 'critical' :
               entry.severity === 'error' ? 'error' :
               entry.severity === 'warning' ? 'warning' : 'info') as TimelineSeverity,
    category: entry.category || 'Audit',
  }));
}

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Get unified chronological timeline for an encounter
 * Aggregates 5 parallel queries, merges by timestamp, sorts descending
 */
async function getEncounterTimeline(
  encounterId: string
): Promise<ServiceResult<EncounterTimelineEntry[]>> {
  try {
    // Parallel queries for all 5 sources
    const [statusEntries, fieldEntries, amendmentEntries, lockEntries, auditEntries] =
      await Promise.all([
        fetchStatusHistory(encounterId),
        fetchFieldChanges(encounterId),
        fetchAmendments(encounterId),
        fetchLockEvents(encounterId),
        fetchAuditLogs(encounterId),
      ]);

    // Merge and sort by timestamp descending
    const timeline = [
      ...statusEntries,
      ...fieldEntries,
      ...amendmentEntries,
      ...lockEntries,
      ...auditEntries,
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    await auditLogger.info('ENCOUNTER_AUDIT_TIMELINE_VIEWED', {
      encounterId,
      entryCount: timeline.length,
    });

    return success(timeline);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ENCOUNTER_AUDIT_TIMELINE_FAILED', error, { encounterId });
    return failure('OPERATION_FAILED', 'Failed to build encounter timeline', err);
  }
}

/**
 * Get encounter header info (status, patient, provider, date)
 */
async function getEncounterHeader(
  encounterId: string
): Promise<ServiceResult<EncounterHeader>> {
  try {
    const { data, error } = await supabase
      .from('encounters')
      .select('id, status, patient_id, provider_id, encounter_date')
      .eq('id', encounterId)
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    if (!data) {
      return failure('NOT_FOUND', 'Encounter not found');
    }

    const row = data as { id: string; status: string; patient_id: string | null; provider_id: string | null; encounter_date: string | null };

    return success({
      encounter_id: row.id,
      status: row.status,
      patient_id: row.patient_id,
      provider_id: row.provider_id,
      encounter_date: row.encounter_date,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ENCOUNTER_HEADER_FETCH_FAILED', error, { encounterId });
    return failure('OPERATION_FAILED', 'Failed to fetch encounter header', err);
  }
}

/**
 * Export encounter audit as JSON or CSV
 */
async function exportEncounterAudit(
  encounterId: string,
  format: 'json' | 'csv' = 'json'
): Promise<ServiceResult<string>> {
  try {
    const result = await getEncounterTimeline(encounterId);
    if (!result.success) {
      return failure(result.error.code, result.error.message);
    }

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'source', 'actor_id', 'summary', 'severity', 'category'];
      const rows = result.data.map(entry => [
        entry.id,
        entry.timestamp,
        entry.source,
        entry.actor_id || '',
        `"${entry.summary.replace(/"/g, '""')}"`,
        entry.severity,
        entry.category,
      ]);
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

      await auditLogger.info('ENCOUNTER_AUDIT_EXPORTED', {
        encounterId,
        format: 'csv',
        entryCount: result.data.length,
      });

      return success(csvContent);
    }

    await auditLogger.info('ENCOUNTER_AUDIT_EXPORTED', {
      encounterId,
      format: 'json',
      entryCount: result.data.length,
    });

    return success(JSON.stringify(result.data, null, 2));
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    await auditLogger.error('ENCOUNTER_AUDIT_EXPORT_FAILED', error, { encounterId });
    return failure('OPERATION_FAILED', 'Failed to export encounter audit', err);
  }
}

// =============================================================================
// EXPORT
// =============================================================================

export const encounterAuditService = {
  getEncounterTimeline,
  getEncounterHeader,
  exportEncounterAudit,
};

export default encounterAuditService;
