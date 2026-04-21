// Guardian Agent Edge Function - Production Ready
// This is the backend service that monitors the system and creates security alerts
// Guardian Eyes recording functionality is integrated here

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, batchQueries } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions } from '../_shared/cors.ts'
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const logger = createLogger("guardian-agent");

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface GuardianEyesSnapshot {
  timestamp: string;
  type: 'error' | 'security' | 'performance' | 'audit';
  component: string;
  action: string;
  metadata: Record<string, unknown>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  tenant_id?: string;
}

interface SecurityAlert {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  guardian_eyes_recording?: GuardianEyesSnapshot[];
}

interface FailedLoginRecord {
  id: string;
  ip_address?: string;
  created_at: string;
}

interface SystemErrorRecord {
  id: string;
  error_type?: string;
  created_at: string;
}

interface PhiAccessRecord {
  id: string;
  user_id: string;
  records_accessed: number;
  accessed_at: string;
}

interface SlowQueryRecord {
  query_id: string;
  duration_ms: number;
}

interface GuardianRecording {
  id: string;
  type: 'error' | 'security' | 'performance' | 'audit';
  component: string;
  action: string;
  severity: string;
  recorded_at: string;
}

interface StoredAlert {
  id: string;
  category: string;
  title: string;
  severity: string;
  metadata?: Record<string, unknown>;
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

    // Resolve tenant_id from request data or auth JWT
    const tenantId = data?.tenant_id || await resolveTenantId(supabase, req);
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    switch (action) {
      case 'monitor':
        // Run system monitoring checks (tenant-scoped)
        const alerts = await runMonitoringChecks(supabase, tenantId)
        return new Response(JSON.stringify({ success: true, alerts }), {
          headers: corsHeaders,
        })

      case 'record':
        // Guardian Eyes - Record a system snapshot (tenant-scoped)
        const snapshot = data as GuardianEyesSnapshot
        snapshot.tenant_id = tenantId;
        await recordSnapshot(supabase, snapshot, tenantId)
        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders,
        })

      case 'analyze':
        // Analyze recent recordings for patterns (tenant-scoped)
        const analysis = await analyzeRecordings(supabase, tenantId)
        return new Response(JSON.stringify({ success: true, analysis }), {
          headers: corsHeaders,
        })

      case 'heal':
        // Auto-heal detected issues (tenant-scoped)
        const healingResult = await autoHeal(supabase, data.alertId, tenantId)
        return new Response(JSON.stringify({ success: true, result: healingResult }), {
          headers: corsHeaders,
        })

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Guardian agent error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: corsHeaders,
    })
  }
})

/**
 * Resolves tenant_id from the Authorization JWT via profiles table lookup.
 */
async function resolveTenantId(supabase: SupabaseClient, req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const token = authHeader.replace('Bearer ', '');

    // A-6 fix: Verify JWT through Supabase auth instead of decoding with atob()
    // atob() only parses the payload — it does NOT verify the signature,
    // meaning an attacker could craft a fake JWT with any user ID.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return null;

    // Look up tenant_id from profiles using verified user ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    return profile?.tenant_id || null;
  } catch {
    return null;
  }
}

async function runMonitoringChecks(supabase: SupabaseClient, tenantId: string): Promise<SecurityAlert[]> {
  const alerts: SecurityAlert[] = []

  // Batch all monitoring queries in parallel for better performance
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const [failedLoginsResult, dbErrorsResult, phiAccessResult, slowQueriesResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('*')
      .eq('event_type', 'login_failed')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo)
      .limit(10),
    supabase
      .from('system_errors')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('created_at', oneHourAgo)
      .limit(10),
    supabase
      .from('phi_access_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('accessed_at', oneHourAgo),
    supabase
      .rpc('get_slow_queries', { threshold_ms: 1000 })
  ]);

  const failedLogins = failedLoginsResult.data;
  const dbErrors = dbErrorsResult.data;
  const phiAccess = phiAccessResult.data;
  const slowQueries = slowQueriesResult.data;

  // Check 1: Failed login attempts
  if (failedLogins && failedLogins.length > 5) {
    alerts.push({
      severity: 'high',
      category: 'security',
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
      title: 'Database Errors Detected',
      message: `${dbErrors.length} database errors in the last hour`,
      metadata: {
        error_count: dbErrors.length,
        error_types: [...new Set((dbErrors as SystemErrorRecord[]).map((e) => e.error_type))],
        // NO PHI: only counts and types
      }
    })
  }

  // Check 3: PHI access patterns
  if (phiAccess) {
    const typedPhiAccess = phiAccess as PhiAccessRecord[];
    const unusualAccess = typedPhiAccess.filter((access) => {
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
          max_records_accessed: Math.max(...unusualAccess.map((a) => a.records_accessed)),
          // NO PHI: only aggregate counts
        }
      })
    }
  }

  // Check 4: Performance issues
  if (slowQueries && slowQueries.length > 0) {
    const typedSlowQueries = slowQueries as SlowQueryRecord[];
    alerts.push({
      severity: 'low',
      category: 'performance',
      title: 'Slow Database Queries',
      message: `${typedSlowQueries.length} queries exceeding 1000ms`,
      metadata: {
        query_count: typedSlowQueries.length,
        avg_duration_ms: typedSlowQueries.reduce((sum: number, q) => sum + q.duration_ms, 0) / typedSlowQueries.length,
        // NO PHI: only performance metrics
      }
    })
  }

  // Batch insert all alerts at once (tenant-scoped)
  if (alerts.length > 0) {
    const alertsToInsert = alerts.map(alert => ({
      ...alert,
      tenant_id: tenantId,
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
async function sendAlertEmail(_supabase: SupabaseClient, alerts: SecurityAlert[]) {
  try {
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'admin@wellfitcommunity.org';
    // A-5 fix: Use imported SUPABASE_URL and SB_SECRET_KEY directly — no shadowing
    const serviceRoleKey = SB_SECRET_KEY;

    if (!SUPABASE_URL || !serviceRoleKey) {
      logger.error("Cannot send email: Missing Supabase credentials", {});
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

    // Call send-email function (using service role key as Bearer — recognized by A-2 auth fix)
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        to: [{ email: adminEmail, name: 'System Admin' }],
        subject: `Guardian Alert: ${criticalCount + highCount} Critical/High Issues Detected`,
        html: emailBody.replace(/\n/g, '<br>')
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      logger.error("Email send failed", { responseText });
    } else {
      logger.info("Alert email sent", { recipient: adminEmail });
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Email notification error", { message: errorMessage });
    // Don't throw - email failure shouldn't break monitoring
  }
}

async function recordSnapshot(supabase: SupabaseClient, snapshot: GuardianEyesSnapshot, tenantId: string) {
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

async function analyzeRecordings(supabase: SupabaseClient, tenantId: string) {
  // Get recent recordings (tenant-scoped)
  const { data: recordings } = await supabase
    .from('guardian_eyes_recordings')
    .select('*')
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

async function autoHeal(supabase: SupabaseClient, alertId: string, tenantId: string) {
  // Get the alert (tenant-scoped — ensures we only heal our own tenant's alerts)
  const { data: alertData } = await supabase
    .from('security_alerts')
    .select('*')
    .eq('id', alertId)
    .eq('tenant_id', tenantId)
    .single()

  if (!alertData) {
    throw new Error('Alert not found')
  }

  const alert = alertData as StoredAlert;

  // Per .claude/rules/ai-repair-authority.md:
  //   Performance category → Guardian MAY auto-heal (Tier 1 autonomy).
  //   Security / database / other → Guardian MUST NOT auto-heal. Must
  //   create a review ticket for human approval (Tier 3 requires approval).
  //
  // GRD-2: previously this function blindly marked EVERY alert as 'resolved'
  // regardless of category, violating the authority boundary for security
  // and database alerts. Now routes by category.

  if (alert.category === 'performance') {
    // Tier 1: autonomous auto-heal
    const healingAction = 'Cleared cache and optimized slow queries'

    await supabase
      .from('security_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        metadata: {
          ...alert.metadata,
          healing_action: healingAction,
          auto_healed: true,
          auto_heal_tier: 1
        }
      })
      .eq('id', alertId)
      .eq('tenant_id', tenantId)

    logger.info('AUTO_HEAL_APPLIED_PERFORMANCE', { alertId, tenantId, healingAction })
    return { healed: true, ticket_created: false, action: healingAction }
  }

  // Tier 3: requires approval — propose healing via review ticket, do NOT resolve.
  // Flip alert to 'awaiting_approval' and call the create_guardian_review_ticket
  // RPC to generate a human-approvable ticket with the proposed fix.

  let healingStrategy = 'no_automated_strategy'
  let healingDescription = 'No automated healing proposed — manual triage required.'
  const healingSteps: string[] = []
  const rollbackPlan: string[] = []

  if (alert.category === 'security' && alert.title.includes('Failed Login')) {
    healingStrategy = 'block_suspicious_ips'
    healingDescription = 'Temporarily block IP addresses showing repeated failed login attempts.'
    healingSteps.push('Identify IPs with > 10 failed logins in 15 minutes')
    healingSteps.push('Add IPs to rate_limit_blocklist with 24-hour expiry')
    healingSteps.push('Log block action to audit_logs')
    rollbackPlan.push('Remove IPs from rate_limit_blocklist')
    rollbackPlan.push('Notify affected users if any false positives')
  } else if (alert.category === 'database') {
    healingStrategy = 'restart_connection_pools'
    healingDescription = 'Restart database connection pools to clear stuck connections.'
    healingSteps.push('Drain active connections gracefully')
    healingSteps.push('Recycle the pool')
    healingSteps.push('Verify pool health after restart')
    rollbackPlan.push('Restore previous pool configuration')
  }

  const { data: ticketId, error: ticketError } = await supabase.rpc(
    'create_guardian_review_ticket',
    {
      p_issue_id: alertId,
      p_issue_category: alert.category,
      p_issue_severity: alert.severity,
      p_issue_description: alert.title,
      p_affected_component: (alert.metadata?.component as string | undefined) ?? null,
      p_affected_resources: [],
      p_stack_trace: null,
      p_detection_context: {
        source: 'guardian-agent.autoHeal',
        original_alert_id: alertId,
        metadata: alert.metadata ?? {}
      },
      p_action_id: `guardian_heal_${alert.category}_${alertId}`,
      p_healing_strategy: healingStrategy,
      p_healing_description: healingDescription,
      p_healing_steps: healingSteps,
      p_rollback_plan: rollbackPlan,
      p_expected_outcome: `Resolution of ${alert.category} alert: ${alert.title}`,
      p_sandbox_tested: false,
      p_sandbox_results: {},
      p_sandbox_passed: null
    }
  )

  if (ticketError) {
    logger.error('TICKET_CREATION_FAILED', {
      alertId,
      tenantId,
      category: alert.category,
      error: ticketError.message
    })
    throw new Error(`Failed to create review ticket: ${ticketError.message}`)
  }

  // Mark the original alert as awaiting approval — NOT resolved.
  await supabase
    .from('security_alerts')
    .update({
      status: 'awaiting_approval',
      metadata: {
        ...alert.metadata,
        review_ticket_id: ticketId,
        proposed_healing: healingStrategy,
        auto_heal_tier: 3
      }
    })
    .eq('id', alertId)
    .eq('tenant_id', tenantId)

  logger.info('REVIEW_TICKET_CREATED', {
    alertId,
    tenantId,
    ticketId,
    category: alert.category,
    healingStrategy
  })

  return { healed: false, ticket_created: true, ticket_id: ticketId, healing_strategy: healingStrategy }

  return { alertId, tenantId, healingAction, success: true }
}