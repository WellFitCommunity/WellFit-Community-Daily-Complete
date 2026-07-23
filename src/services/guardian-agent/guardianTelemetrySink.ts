/**
 * guardianTelemetrySink - Persists Guardian audit entries to guardian_telemetry.
 *
 * Extracted from AuditLogger (600-line limit) and repaired 2026-07-23:
 * guardian_telemetry had been dead since 2026-07-10 because the writer hardcoded
 * tenant 'wellfit-primary', which the table's RLS check
 * (tenant_id = get_current_tenant_id()::text OR is_super_admin()) rejects for
 * every non-super-admin session. The real tenant is now resolved at insert time
 * and insert errors are logged instead of swallowed.
 *
 * Used by: AuditLogger.sendToTelemetry (guardian-agent healing audit trail).
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger as systemAuditLogger } from '../auditLogger';
import { resolveTenantId } from './tenantResolver';
import type { AuditLogEntry } from './AuditLogger';

// Only these metadata keys may reach guardian_telemetry. Everything on the row
// must stay system/ops data (counts, durations, canned strings) — a caller that
// stuffs a raw error message or PHI into entry.metadata gets filtered here at
// the boundary instead of trusted. Extend this list only for keys whose values
// are guaranteed PHI-free at every call site.
const TELEMETRY_METADATA_ALLOWLIST = new Set<string>([
  // AuditLogger.logHealingAction
  'stepsCompleted',
  'totalSteps',
  'timeToDetect',
  'timeToHeal',
  'resourcesAffected',
  'usersImpacted',
  'lessons',
  'preventiveMeasures',
  // AuditLogger.logBlockedAction
  'blockReason',
  'requiresApproval',
]);

function filterTelemetryMetadata(
  metadata: Record<string, unknown>,
  auditId: string
): Record<string, unknown> {
  const allowed: Record<string, unknown> = {};
  const droppedKeys: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (TELEMETRY_METADATA_ALLOWLIST.has(key)) {
      allowed[key] = value;
    } else {
      droppedKeys.push(key);
    }
  }

  if (droppedKeys.length > 0) {
    // Key names only — the values are exactly what we refused to persist.
    systemAuditLogger.warn('GUARDIAN_TELEMETRY_METADATA_DROPPED', {
      audit_id: auditId,
      dropped_keys: droppedKeys,
    });
  }

  return allowed;
}

export async function persistTelemetryEntry(entry: AuditLogEntry): Promise<void> {
  // Format for internal telemetry system
  const telemetryEvent = {
    timestamp: entry.timestamp.toISOString(),
    tenant: entry.tenant,
    module: entry.module,
    error_code: entry.errorCode,
    action: entry.action,
    version_before: entry.versionBefore,
    version_after: entry.versionAfter,
    validation_result: entry.validationResult,
    severity: entry.severity,
    environment: entry.environment,
    affected_resources: entry.affectedResources.join(','),
    user_id: entry.userId,
    session_id: entry.sessionId,
    ...filterTelemetryMetadata(entry.metadata, entry.id),
  };

  // Send to internal telemetry (HIPAA-compliant, no external services)
  try {
    // Resolve the real tenant at insert time — guardian_telemetry RLS rejects
    // rows whose tenant_id doesn't match the caller's tenant.
    const tenantId = (await resolveTenantId()) ?? entry.tenant;

    // 1. Store in guardian_telemetry table for internal monitoring
    const { error: telemetryError } = await supabase.from('guardian_telemetry').insert({
      event_type: 'audit_log',
      event_data: telemetryEvent,
      severity: entry.severity,
      module: entry.module,
      tenant_id: tenantId,
      user_id: entry.userId,
      created_at: entry.timestamp.toISOString(),
    });
    if (telemetryError) {
      systemAuditLogger.warn('GUARDIAN_TELEMETRY_FAILED', {
        audit_id: entry.id,
        error: telemetryError.message,
      });
    }

    // 2. Log to system audit logger for HIPAA compliance
    systemAuditLogger.info('GUARDIAN_TELEMETRY_EVENT', {
      audit_id: entry.id,
      action: entry.action,
      module: entry.module,
      severity: entry.severity,
      validation_result: entry.validationResult,
    });
  } catch (error: unknown) {
    // Telemetry failures should not block the main flow
    systemAuditLogger.warn('GUARDIAN_TELEMETRY_FAILED', {
      audit_id: entry.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
