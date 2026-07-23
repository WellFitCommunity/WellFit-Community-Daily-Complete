// guardian-agent: Guardian Eyes snapshot recording + recent-recording analysis.
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GuardianEyesSnapshot, GuardianRecording } from './types.ts'

const logger = createLogger("guardian-agent");

export async function recordSnapshot(supabase: SupabaseClient, snapshot: GuardianEyesSnapshot, tenantId: string) {
  // Store Guardian Eyes recording (tenant-scoped). Columns are mapped explicitly —
  // the old spread insert silently failed for months because it carried a tenant_id
  // field the table didn't have until migration 20260723170000.
  const { error: recordingError } = await supabase
    .from('guardian_eyes_recordings')
    .insert({
      timestamp: snapshot.timestamp,
      type: snapshot.type,
      component: snapshot.component,
      action: snapshot.action,
      severity: snapshot.severity,
      metadata: snapshot.metadata,
      session_id: snapshot.session_id ?? null,
      user_id: snapshot.user_id ?? null,
      tenant_id: tenantId,
      recorded_at: new Date().toISOString()
    })

  if (recordingError) {
    logger.error('Failed to store Guardian Eyes recording', {
      message: recordingError.message,
      component: snapshot.component,
      type: snapshot.type,
    });
    // Fail loud — index.ts converts this into a 400 so the caller knows.
    throw new Error(`Guardian Eyes recording failed: ${recordingError.message}`)
  }

  // If it's a critical event, create an immediate alert (tenant-scoped).
  // Column names match the live security_alerts schema: description (not message),
  // status 'new' (the CHECK enum has no 'pending'), and a valid alert_type.
  if (snapshot.severity === 'critical') {
    const { error: alertError } = await supabase
      .from('security_alerts')
      .insert({
        severity: snapshot.severity,
        category: snapshot.type,
        alert_type: 'anomalous_behavior',
        title: `Critical Event: ${snapshot.action}`,
        description: `Guardian Eyes detected a critical event in ${snapshot.component}`,
        tenant_id: tenantId,
        metadata: {
          component: snapshot.component,
          action: snapshot.action,
          timestamp: snapshot.timestamp,
          source: 'guardian_eyes',
          // NO PHI: sanitized metadata only
        },
        status: 'new',
      })

    if (alertError) {
      logger.error('Failed to create Guardian Eyes critical alert', {
        message: alertError.message,
        component: snapshot.component,
      });
    }
  }
}

export async function analyzeRecordings(supabase: SupabaseClient, tenantId: string) {
  // Get recent recordings (tenant-scoped)
  const { data: recordings, error: queryError } = await supabase
    .from('guardian_eyes_recordings')
    .select('id, type, component, action, severity, recorded_at')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', new Date(Date.now() - 3600000).toISOString())
    .order('recorded_at', { ascending: false })

  if (queryError) {
    // This query silently errored on every daily analyze cron for months (the
    // tenant_id column didn't exist) — never again swallow it.
    logger.error('Failed to query Guardian Eyes recordings for analysis', {
      message: queryError.message,
    });
    return { patterns: [], anomalies: [], error: queryError.message }
  }

  if (!recordings || recordings.length === 0) {
    return { patterns: [], anomalies: [] }
  }

  // Analyze for patterns
  const patterns: string[] = []
  const anomalies: string[] = []

  // Group by component
  const typedRecordings = recordings as GuardianRecording[];
  const componentGroups = typedRecordings.reduce((acc: Record<string, GuardianRecording[]>, rec: GuardianRecording) => {
    if (!acc[rec.component]) acc[rec.component] = []
    acc[rec.component].push(rec)
    return acc
  }, {} as Record<string, GuardianRecording[]>)

  // Check for repeated errors
  for (const [component, recs] of Object.entries(componentGroups)) {
    const errors = (recs as GuardianRecording[]).filter((r: GuardianRecording) => r.type === 'error')
    if (errors.length > 3) {
      patterns.push(`Repeated errors in ${component}: ${errors.length} occurrences`)
    }
  }

  // Check for security anomalies
  const securityEvents = typedRecordings.filter((r: GuardianRecording) => r.type === 'security')
  if (securityEvents.length > 0) {
    anomalies.push(`${securityEvents.length} security events detected`)
  }

  return { patterns, anomalies, totalRecordings: typedRecordings.length }
}
