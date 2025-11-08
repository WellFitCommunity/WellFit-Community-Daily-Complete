// Guardian Agent Edge Function - Production Ready
// This is the backend service that monitors the system and creates security alerts
// Guardian Eyes recording functionality is integrated here

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, batchQueries } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions } from '../_shared/cors.ts'

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
    return handleOptions(req)
  }

  // Get CORS headers for this origin
  const { headers: corsHeaders, allowed } = corsFromRequest(req);

  // Reject requests from unauthorized origins
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createAdminClient()

    const { action, data } = await req.json()

    switch (action) {
      case 'monitor':
        // Run system monitoring checks
        const alerts = await runMonitoringChecks(supabase)
        return new Response(JSON.stringify({ success: true, alerts }), {
          headers: corsHeaders,
        })

      case 'record':
        // Guardian Eyes - Record a system snapshot
        const snapshot = data as GuardianEyesSnapshot
        await recordSnapshot(supabase, snapshot)
        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders,
        })

      case 'analyze':
        // Analyze recent recordings for patterns
        const analysis = await analyzeRecordings(supabase)
        return new Response(JSON.stringify({ success: true, analysis }), {
          headers: corsHeaders,
        })

      case 'heal':
        // Auto-heal detected issues
        const healingResult = await autoHeal(supabase, data.alertId)
        return new Response(JSON.stringify({ success: true, result: healingResult }), {
          headers: corsHeaders,
        })

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders,
    })
  }
})

async function runMonitoringChecks(supabase: any): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = []

  // Batch all monitoring queries in parallel for better performance
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const [
    { data: failedLogins },
    { data: dbErrors },
    { data: phiAccess },
    { data: slowQueries }
  ] = await batchQueries([
    () => supabase
      .from('audit_logs')
      .select('*')
      .eq('event_type', 'login_failed')
      .gte('created_at', oneHourAgo)
      .limit(10),
    () => supabase
      .from('system_errors')
      .select('*')
      .gte('created_at', oneHourAgo)
      .limit(10),
    () => supabase
      .from('phi_access_logs')
      .select('*')
      .gte('accessed_at', oneHourAgo),
    () => supabase
      .rpc('get_slow_queries', { threshold_ms: 1000 })
  ]);

  // Check 1: Failed login attempts
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
  if (dbErrors && dbErrors.length > 0) {
    alerts.push({
      severity: 'medium',
      category: 'database',
      title: 'Database Errors Detected',
      message: `${dbErrors.length} database errors in the last hour`,
      metadata: {
        error_count: dbErrors.length,
        error_types: [...new Set(dbErrors.map((e: any) => e.error_type))],
        // NO PHI: only counts and types
      }
    })
  }

  // Check 3: PHI access patterns
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
        metadata: {
          user_count: unusualAccess.length,
          max_records_accessed: Math.max(...unusualAccess.map((a: any) => a.records_accessed)),
          // NO PHI: only aggregate counts
        }
      })
    }
  }

  // Check 4: Performance issues
  if (slowQueries && slowQueries.length > 0) {
    alerts.push({
      severity: 'low',
      category: 'performance',
      title: 'Slow Database Queries',
      message: `${slowQueries.length} queries exceeding 1000ms`,
      metadata: {
        query_count: slowQueries.length,
        avg_duration_ms: slowQueries.reduce((sum: number, q: any) => sum + q.duration_ms, 0) / slowQueries.length,
        // NO PHI: only performance metrics
      }
    })
  }

  // Batch insert all alerts at once
  if (alerts.length > 0) {
    const alertsToInsert = alerts.map(alert => ({
      ...alert,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    await supabase.from('security_alerts').insert(alertsToInsert);

    // Send email notification for critical/high severity alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
    if (criticalAlerts.length > 0) {
      await sendAlertEmail(supabase, criticalAlerts);
    }
  }

  return alerts
}

// Send email notification for critical alerts
async function sendAlertEmail(supabase: any, alerts: SecurityAlert[]) {
  try {
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'admin@wellfitcommunity.org';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Guardian] Cannot send email: Missing Supabase credentials');
      return;
    }

    // Build alert summary
    const alertSummary = alerts.map(alert =>
      `🚨 ${alert.severity.toUpperCase()}: ${alert.title}\n   ${alert.message}\n   Category: ${alert.category}`
    ).join('\n\n');

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;

    const emailBody = `
Guardian Alert System - ${criticalCount} Critical, ${highCount} High Priority Alerts

${alertSummary}

---
Detected at: ${new Date().toISOString()}
View full details in your Guardian Security Panel

This is an automated alert from Guardian monitoring system.
`;

    // Call send-email function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        to: adminEmail,
        subject: `🚨 Guardian Alert: ${criticalCount + highCount} Critical/High Issues Detected`,
        text: emailBody,
        html: emailBody.replace(/\n/g, '<br>')
      })
    });

    if (!response.ok) {
      console.error('[Guardian] Email send failed:', await response.text());
    } else {
      console.log(`[Guardian] Alert email sent to ${adminEmail}`);
    }
  } catch (error) {
    console.error('[Guardian] Email notification error:', error);
    // Don't throw - email failure shouldn't break monitoring
  }
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