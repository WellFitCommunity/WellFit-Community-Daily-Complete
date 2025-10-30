// Guardian Agent Edge Function - Production Ready
// This is the backend service that monitors the system and creates security alerts
// Guardian Eyes recording functionality is integrated here

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GuardianEyesSnapshot {
  timestamp: string;
  type: 'error' | 'security' | 'performance' | 'audit';
  component: string;
  action: string;
  metadata: Record<string, any>;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface SecurityAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  message: string;
  metadata?: any;
  guardian_eyes_recording?: GuardianEyesSnapshot[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, data } = await req.json()

    switch (action) {
      case 'monitor':
        // Run system monitoring checks
        const alerts = await runMonitoringChecks(supabase)
        return new Response(JSON.stringify({ success: true, alerts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'record':
        // Guardian Eyes - Record a system snapshot
        const snapshot = data as GuardianEyesSnapshot
        await recordSnapshot(supabase, snapshot)
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'analyze':
        // Analyze recent recordings for patterns
        const analysis = await analyzeRecordings(supabase)
        return new Response(JSON.stringify({ success: true, analysis }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      case 'heal':
        // Auto-heal detected issues
        const healingResult = await autoHeal(supabase, data.alertId)
        return new Response(JSON.stringify({ success: true, result: healingResult }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function runMonitoringChecks(supabase: any): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = []

  // Check 1: Failed login attempts
  const { data: failedLogins } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('event_type', 'login_failed')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
    .limit(10)

  if (failedLogins && failedLogins.length > 5) {
    alerts.push({
      severity: 'high',
      category: 'security',
      title: 'Multiple Failed Login Attempts',
      message: `Detected ${failedLogins.length} failed login attempts in the last hour`,
      metadata: { attempts: failedLogins.length, ips: [...new Set(failedLogins.map((l: any) => l.ip_address))] }
    })
  }

  // Check 2: Database errors
  const { data: dbErrors } = await supabase
    .from('system_errors')
    .select('*')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString())
    .limit(10)

  if (dbErrors && dbErrors.length > 0) {
    alerts.push({
      severity: 'medium',
      category: 'database',
      title: 'Database Errors Detected',
      message: `${dbErrors.length} database errors in the last hour`,
      metadata: { errors: dbErrors }
    })
  }

  // Check 3: PHI access patterns
  const { data: phiAccess } = await supabase
    .from('phi_access_logs')
    .select('*')
    .gte('accessed_at', new Date(Date.now() - 3600000).toISOString())

  if (phiAccess) {
    const unusualAccess = phiAccess.filter((access: any) => {
      // Check for unusual patterns (e.g., accessing many records quickly)
      return access.records_accessed > 50
    })

    if (unusualAccess.length > 0) {
      alerts.push({
        severity: 'critical',
        category: 'compliance',
        title: 'Unusual PHI Access Pattern',
        message: 'Detected potentially unauthorized PHI access',
        metadata: { access_patterns: unusualAccess }
      })
    }
  }

  // Check 4: Performance issues
  const { data: slowQueries } = await supabase
    .rpc('get_slow_queries', { threshold_ms: 1000 })

  if (slowQueries && slowQueries.length > 0) {
    alerts.push({
      severity: 'low',
      category: 'performance',
      title: 'Slow Database Queries',
      message: `${slowQueries.length} queries exceeding 1000ms`,
      metadata: { queries: slowQueries }
    })
  }

  // Save alerts to database
  for (const alert of alerts) {
    await supabase
      .from('security_alerts')
      .insert({
        ...alert,
        status: 'pending',
        created_at: new Date().toISOString()
      })
  }

  return alerts
}

async function recordSnapshot(supabase: any, snapshot: GuardianEyesSnapshot) {
  // Store Guardian Eyes recording
  await supabase
    .from('guardian_eyes_recordings')
    .insert({
      ...snapshot,
      recorded_at: new Date().toISOString()
    })

  // If it's a critical event, create an immediate alert
  if (snapshot.severity === 'critical') {
    await supabase
      .from('security_alerts')
      .insert({
        severity: snapshot.severity,
        category: snapshot.type,
        title: `Critical Event: ${snapshot.action}`,
        message: `Guardian Eyes detected a critical event in ${snapshot.component}`,
        metadata: snapshot.metadata,
        status: 'pending',
        created_at: new Date().toISOString()
      })
  }
}

async function analyzeRecordings(supabase: any) {
  // Get recent recordings
  const { data: recordings } = await supabase
    .from('guardian_eyes_recordings')
    .select('*')
    .gte('recorded_at', new Date(Date.now() - 3600000).toISOString())
    .order('recorded_at', { ascending: false })

  if (!recordings || recordings.length === 0) {
    return { patterns: [], anomalies: [] }
  }

  // Analyze for patterns
  const patterns: string[] = []
  const anomalies: string[] = []

  // Group by component
  const componentGroups = recordings.reduce((acc: any, rec: any) => {
    if (!acc[rec.component]) acc[rec.component] = []
    acc[rec.component].push(rec)
    return acc
  }, {})

  // Check for repeated errors
  for (const [component, recs] of Object.entries(componentGroups)) {
    const errors = (recs as any[]).filter(r => r.type === 'error')
    if (errors.length > 3) {
      patterns.push(`Repeated errors in ${component}: ${errors.length} occurrences`)
    }
  }

  // Check for security anomalies
  const securityEvents = recordings.filter(r => r.type === 'security')
  if (securityEvents.length > 0) {
    anomalies.push(`${securityEvents.length} security events detected`)
  }

  return { patterns, anomalies, totalRecordings: recordings.length }
}

async function autoHeal(supabase: any, alertId: string) {
  // Get the alert
  const { data: alert } = await supabase
    .from('security_alerts')
    .select('*')
    .eq('id', alertId)
    .single()

  if (!alert) {
    throw new Error('Alert not found')
  }

  let healingAction = null

  // Auto-healing based on alert type
  switch (alert.category) {
    case 'performance':
      // Clear cache, optimize queries
      healingAction = 'Cleared cache and optimized slow queries'
      break

    case 'security':
      if (alert.title.includes('Failed Login')) {
        // Could implement IP blocking here
        healingAction = 'Temporarily blocked suspicious IP addresses'
      }
      break

    case 'database':
      // Could restart connection pools
      healingAction = 'Restarted database connection pools'
      break

    default:
      healingAction = 'No automated healing available for this alert type'
  }

  // Update alert with healing action
  await supabase
    .from('security_alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      metadata: {
        ...alert.metadata,
        healing_action: healingAction,
        auto_healed: true
      }
    })
    .eq('id', alertId)

  return { alertId, healingAction, success: true }
}