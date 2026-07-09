// guardian-agent: tenant-scoped monitoring checks (Checks 1-5) + GA-2 anomaly persistence.
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SecurityAlert, FailedLoginRecord, SystemErrorRecord, PhiAccessRecord, SlowQueryRecord, AnomalyRecord } from './types.ts'
import { sendAlertEmail } from './notifications.ts'

const logger = createLogger("guardian-agent");

export async function runMonitoringChecks(supabase: SupabaseClient, tenantId: string): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = []

  // Batch all monitoring queries in parallel for better performance
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const [failedLoginsResult, dbErrorsResult, phiAccessResult, slowQueriesResult, anomaliesResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, ip_address, created_at')
      .eq('event_type', 'login_failed')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo)
      .limit(10),
    supabase
      .from('system_errors')
      .select('id, error_type, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo)
      .limit(10),
    supabase
      .from('phi_access_logs')
      .select('id, user_id, records_accessed, timestamp')
      .eq('tenant_id', tenantId)
      .gte('timestamp', oneHourAgo),
    supabase
      .rpc('get_slow_queries', { threshold_ms: 1000 }),
    // GA-1: read the durable behavioral-anomaly record (impossible travel, peer
    // deviation, excessive PHI access). Reads PRE-existing state (before this run's
    // GA-2 writes in Check 3), so freshly-recorded anomalies surface next cron tick.
    supabase
      .from('anomaly_detections')
      .select('id, risk_level, event_type, aggregate_anomaly_score')
      .eq('tenant_id', tenantId)
      .eq('investigated', false)
      .gte('aggregate_anomaly_score', 0.5)
      .gte('detected_at', oneHourAgo)
      .limit(100)
  ]);

  const failedLogins = failedLoginsResult.data;
  const dbErrors = dbErrorsResult.data;
  const phiAccess = phiAccessResult.data;
  const slowQueries = slowQueriesResult.data;
  const anomalies = anomaliesResult.data;

  // Check 1: Failed login attempts
  if (failedLogins && failedLogins.length > 5) {
    alerts.push({
      severity: 'high',
      category: 'security',
      alertType: 'failed_login_spike',
      title: 'Multiple Failed Login Attempts',
      message: `Detected ${failedLogins.length} failed login attempts in the last hour`,
      metadata: { attempts: failedLogins.length, ips: [...new Set((failedLogins as FailedLoginRecord[]).map((l) => l.ip_address))] }
    })
  }

  // Check 2: Database errors
  if (dbErrors && dbErrors.length > 0) {
    alerts.push({
      severity: 'medium',
      category: 'database',
      alertType: 'database_error',
      title: 'Database Errors Detected',
      message: `${dbErrors.length} database errors in the last hour`,
      metadata: {
        error_count: dbErrors.length,
        error_types: [...new Set((dbErrors as SystemErrorRecord[]).map((e) => e.error_type))],
        // NO PHI: only counts and types
      }
    })
  }

  // Check 3: PHI access patterns — ACCOUNTABILITY: flag access events that touched
  // an unusually large number of patient records (records_accessed), which is the
  // bulk-export / scraping signature.
  if (phiAccess) {
    const typedPhiAccess = phiAccess as PhiAccessRecord[];
    const unusualAccess = typedPhiAccess.filter((access) => {
      // Check for unusual patterns (e.g., accessing many records quickly)
      return (access.records_accessed ?? 0) > 50
    })

    if (unusualAccess.length > 0) {
      alerts.push({
        severity: 'critical',
        category: 'compliance',
        alertType: 'unusual_phi_access',
        title: 'Unusual PHI Access Pattern',
        message: 'Detected potentially unauthorized PHI access',
        metadata: {
          user_count: unusualAccess.length,
          max_records_accessed: unusualAccess.reduce((max, a) => Math.max(max, a.records_accessed), 0),
          // NO PHI: only aggregate counts
        }
      })

      // GA-2: persist this server-side detection as durable, investigable
      // behavioral anomalies so AgentBrain + the investigation queue (and Check 5
      // on the next tick) see them. Idempotent per phi_access_log_id.
      await recordPhiAccessAnomalies(supabase, unusualAccess, tenantId)
    }
  }

  // Check 4: Performance issues
  if (slowQueries && slowQueries.length > 0) {
    const typedSlowQueries = slowQueries as SlowQueryRecord[];
    alerts.push({
      severity: 'low',
      category: 'performance',
      alertType: 'slow_query',
      title: 'Slow Database Queries',
      message: `${typedSlowQueries.length} queries exceeding 1000ms`,
      metadata: {
        query_count: typedSlowQueries.length,
        avg_duration_ms: typedSlowQueries.reduce((sum: number, q) => sum + q.duration_ms, 0) / typedSlowQueries.length,
        // NO PHI: only performance metrics
      }
    })
  }

  // Check 5: Uninvestigated behavioral anomalies (GA-1 — Guardian Eyes now
  // includes the behavioral-anomaly subsystem: impossible travel, peer deviation,
  // excessive PHI access). Surfaces the investigation backlog as one security alert.
  if (anomalies && anomalies.length > 0) {
    const typedAnomalies = anomalies as AnomalyRecord[]
    const riskOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    const maxRisk = typedAnomalies.reduce(
      (m, a) => ((riskOrder[a.risk_level] ?? 0) > (riskOrder[m] ?? 0) ? a.risk_level : m),
      'LOW'
    )
    const severity: SecurityAlert['severity'] =
      maxRisk === 'CRITICAL' ? 'critical' : maxRisk === 'HIGH' ? 'high' : maxRisk === 'MEDIUM' ? 'medium' : 'low'
    alerts.push({
      severity,
      category: 'security',
      alertType: 'anomalous_behavior',
      title: 'Behavioral Anomalies Detected',
      message: `${typedAnomalies.length} uninvestigated behavioral ${typedAnomalies.length === 1 ? 'anomaly' : 'anomalies'} in the last hour`,
      metadata: {
        anomaly_count: typedAnomalies.length,
        max_score: typedAnomalies.reduce((mx, a) => Math.max(mx, Number(a.aggregate_anomaly_score) || 0), 0),
        risk_levels: [...new Set(typedAnomalies.map((a) => a.risk_level))],
        event_types: [...new Set(typedAnomalies.map((a) => a.event_type).filter(Boolean))],
        // NO PHI: counts, scores, risk/event types only
      }
    })
  }

  // Persist alerts with DEDUPLICATION (Maria-directed 2026-07-09). security_alerts
  // carries occurrence_count / first_detected_at / last_occurrence_at columns for
  // exactly this purpose. The old code did a plain batch .insert() every 5-minute
  // cron tick, producing a byte-identical row each time — 40k+ duplicate slow_query
  // rows that then all got escalated, destroying the severity signal. Now we bump an
  // existing OPEN alert of the same (tenant_id, alert_type) instead. A fresh row is
  // created only when no open alert of that type exists (condition newly appeared, or
  // the prior one was resolved). Email fires only on a genuinely NEW critical/high
  // alert — never on a recurrence — so an ongoing incident doesn't re-notify each tick.
  if (alerts.length > 0) {
    const newlyCreatedCritical: SecurityAlert[] = [];
    const nowIso = new Date().toISOString();

    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from('security_alerts')
        .select('id, occurrence_count')
        .eq('tenant_id', tenantId)
        .eq('alert_type', alert.alertType)
        .not('status', 'in', '(resolved,false_positive,dismissed)')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Recurrence — bump the existing open alert instead of duplicating it.
        const prevCount = (existing as { occurrence_count: number | null }).occurrence_count ?? 1;
        const { error: updateError } = await supabase
          .from('security_alerts')
          .update({
            occurrence_count: prevCount + 1,
            last_occurrence_at: nowIso,
            description: alert.message,
            metadata: alert.metadata ?? {},
            updated_at: nowIso,
          })
          .eq('id', (existing as { id: string }).id);
        if (updateError) {
          logger.error('Failed to bump security alert', { message: updateError.message, alertType: alert.alertType });
        }
      } else {
        // First occurrence — create the alert (defaults: occurrence_count 1, status 'new').
        const { error: insertError } = await supabase.from('security_alerts').insert({
          severity: alert.severity,
          category: alert.category,
          alert_type: alert.alertType,
          title: alert.title,
          description: alert.message,
          metadata: alert.metadata ?? {},
          tenant_id: tenantId,
          status: 'new',
        });
        if (insertError) {
          logger.error('Failed to persist security alert', { message: insertError.message, alertType: alert.alertType });
        } else if (alert.severity === 'critical' || alert.severity === 'high') {
          newlyCreatedCritical.push(alert);
        }
      }
    }

    // Email only for NEWLY created critical/high alerts (not recurrences).
    if (newlyCreatedCritical.length > 0) {
      await sendAlertEmail(supabase, newlyCreatedCritical);
    }
  }

  return alerts
}

/**
 * GA-2: Persist Guardian's excessive-PHI-access detections as durable behavioral
 * anomalies in anomaly_detections (the investigable record AgentBrain learns from).
 * Idempotent per phi_access_log_id so the once-a-minute cron never duplicates a row.
 * Writes ONLY the accessing user_id + access counts — never any patient identifier.
 */
async function recordPhiAccessAnomalies(
  supabase: SupabaseClient,
  unusualAccess: PhiAccessRecord[],
  tenantId: string
): Promise<void> {
  const logIds = unusualAccess.map((a) => a.id)
  if (logIds.length === 0) return

  // Skip events already recorded (idempotency across cron runs)
  const { data: existing } = await supabase
    .from('anomaly_detections')
    .select('phi_access_log_id')
    .in('phi_access_log_id', logIds)
  const seen = new Set(
    ((existing ?? []) as { phi_access_log_id: string | null }[])
      .map((r) => r.phi_access_log_id)
      .filter((id): id is string => !!id)
  )

  const rows = unusualAccess
    .filter((a) => !seen.has(a.id) && !!a.user_id) // user_id is NOT NULL in anomaly_detections
    .map((a) => {
      // Score scales with volume, clamped to the CHECK range [0,1]
      const score = Math.min(1, a.records_accessed / 200)
      const risk_level = score >= 0.75 ? 'CRITICAL' : score >= 0.5 ? 'HIGH' : 'MEDIUM'
      return {
        user_id: a.user_id,
        tenant_id: tenantId,
        event_type: 'phi_access',
        event_timestamp: a.timestamp,
        aggregate_anomaly_score: score,
        risk_level,
        anomaly_breakdown: { excessive_access_score: score, records_accessed: a.records_accessed },
        phi_access_log_id: a.id, // satisfies valid_audit_reference CHECK
      }
    })

  if (rows.length > 0) {
    const { error } = await supabase.from('anomaly_detections').insert(rows)
    if (error) {
      logger.error('Failed to persist PHI-access anomalies', { message: error.message })
    }
  }
}
