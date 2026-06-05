// guardian-agent: Guardian Eyes snapshot recording + recent-recording analysis.
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GuardianEyesSnapshot, GuardianRecording } from './types.ts'

const logger = createLogger("guardian-agent");
void logger; // reserved for future recording diagnostics

export async function recordSnapshot(supabase: SupabaseClient, snapshot: GuardianEyesSnapshot, tenantId: string) {
  // Store Guardian Eyes recording (tenant-scoped)
  await supabase
    .from('guardian_eyes_recordings')
    .insert({
      ...snapshot,
      tenant_id: tenantId,
      recorded_at: new Date().toISOString()
    })

  // If it's a critical event, create an immediate alert (tenant-scoped)
  if (snapshot.severity === 'critical') {
    await supabase
      .from('security_alerts')
      .insert({
        severity: snapshot.severity,
        category: snapshot.type,
        title: `Critical Event: ${snapshot.action}`,
        message: `Guardian Eyes detected a critical event in ${snapshot.component}`,
        tenant_id: tenantId,
        metadata: {
          component: snapshot.component,
          action: snapshot.action,
          timestamp: snapshot.timestamp,
          // NO PHI: sanitized metadata only
        },
        status: 'pending',
        created_at: new Date().toISOString()
      })
  }
}

export async function analyzeRecordings(supabase: SupabaseClient, tenantId: string) {
  // Get recent recordings (tenant-scoped)
  const { data: recordings } = await supabase
    .from('guardian_eyes_recordings')
    .select('id, type, component, action, severity, recorded_at')
    .eq('tenant_id', tenantId)
    .gte('recorded_at', new Date(Date.now() - 3600000).toISOString())
    .order('recorded_at', { ascending: false })

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
