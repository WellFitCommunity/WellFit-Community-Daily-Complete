/**
 * Guardian Agent API - Edge Function
 *
 * Handles security scanning, audit logging, and health monitoring
 * for the WellFit Community Guardian Agent system
 *
 * HIPAA Compliant - All events logged to audit tables
 */

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

interface AuditLogPayload {
  event_type?: string;
  severity?: string;
  description?: string;
  requires_investigation?: boolean;
}

interface GuardianRequest {
  action: 'security_scan' | 'audit_log' | 'monitor_health';
  payload?: AuditLogPayload;
}

interface GuardianResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight with dynamic origin validation
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Get Supabase client with user context
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      SUPABASE_URL ?? '',
      SB_PUBLISHABLE_API_KEY ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestBody: GuardianRequest = await req.json();
    const { action, payload } = requestBody;

    let response: GuardianResponse;

    switch (action) {
      case 'security_scan':
        response = await handleSecurityScan(supabaseClient, user.id);
        break;

      case 'audit_log':
        response = await handleAuditLog(supabaseClient, user.id, payload);
        break;

      case 'monitor_health':
        response = await handleMonitorHealth(supabaseClient, user.id);
        break;

      default:
        response = {
          success: false,
          error: `Unknown action: ${action}`
        };
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    // Get CORS headers again for error response
    const { headers: errorCorsHeaders } = corsFromRequest(req);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage || 'Internal server error'
      }),
      { status: 500, headers: { ...errorCorsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle security scan request
 *
 * GRD-4: This handler previously returned an empty placeholder `findings: []`.
 * It now runs a real scan by querying recent security signals across four
 * categories: open security alerts, failed login bursts, PHI access bursts,
 * and unresolved tickets. All queries are user-scoped through RLS (the
 * supabase client is constructed with the caller's JWT in the wrapper).
 */
async function handleSecurityScan(
  supabase: SupabaseClient,
  userId: string
): Promise<GuardianResponse> {
  const scanId = crypto.randomUUID();
  const scanStartedAt = new Date();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  try {
    // Log scan initiation for audit trail
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        event_type: 'SECURITY_SCAN_INITIATED',
        event_category: 'SECURITY_EVENT',
        actor_user_id: userId,
        success: true,
        metadata: {
          scan_id: scanId,
          scan_type: 'manual',
          timestamp: scanStartedAt.toISOString()
        }
      });

    if (auditError) throw auditError;

    // Run the four scan checks in parallel
    const [
      openAlertsResult,
      failedLoginsResult,
      phiBurstsResult,
      pendingTicketsResult
    ] = await Promise.all([
      supabase
        .from('security_alerts')
        .select('id, severity, category, title, created_at', { count: 'exact' })
        .in('status', ['pending', 'awaiting_approval'])
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('login_attempts')
        .select('id, ip_address, created_at', { count: 'exact' })
        .eq('success', false)
        .gte('created_at', fifteenMinutesAgo),
      supabase
        .from('phi_access_logs')
        .select('id, accessing_user_id, records_accessed, accessed_at', { count: 'exact' })
        .gte('accessed_at', fiveMinutesAgo)
        .gt('records_accessed', 50),
      supabase
        .from('guardian_review_tickets')
        .select('id, status, issue_severity, created_at', { count: 'exact' })
        .eq('status', 'pending')
    ]);

    const findings: Array<{
      check: string;
      severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
      count: number;
      details: string;
    }> = [];

    const openAlertsCount = openAlertsResult.count ?? openAlertsResult.data?.length ?? 0;
    if (openAlertsCount > 0) {
      const critical = (openAlertsResult.data ?? []).filter(
        (a) => (a as { severity?: string }).severity === 'critical'
      ).length;
      findings.push({
        check: 'open_security_alerts',
        severity: critical > 0 ? 'critical' : openAlertsCount > 10 ? 'high' : 'medium',
        count: openAlertsCount,
        details: `${openAlertsCount} open alerts (${critical} critical)`
      });
    }

    const failedLoginsCount = failedLoginsResult.count ?? 0;
    if (failedLoginsCount > 10) {
      findings.push({
        check: 'failed_login_burst',
        severity: failedLoginsCount > 50 ? 'critical' : failedLoginsCount > 25 ? 'high' : 'medium',
        count: failedLoginsCount,
        details: `${failedLoginsCount} failed login attempts in the last 15 minutes`
      });
    }

    const phiBurstCount = phiBurstsResult.count ?? phiBurstsResult.data?.length ?? 0;
    if (phiBurstCount > 0) {
      findings.push({
        check: 'phi_access_burst',
        severity: 'high',
        count: phiBurstCount,
        details: `${phiBurstCount} PHI access events with >50 records in the last 5 minutes`
      });
    }

    const pendingTicketsCount = pendingTicketsResult.count ?? pendingTicketsResult.data?.length ?? 0;
    if (pendingTicketsCount > 0) {
      findings.push({
        check: 'pending_review_tickets',
        severity: pendingTicketsCount > 5 ? 'high' : 'medium',
        count: pendingTicketsCount,
        details: `${pendingTicketsCount} Guardian review tickets awaiting human approval`
      });
    }

    // Overall status from worst finding
    const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    const worstSeverity = findings.reduce<string>(
      (acc, f) => (severityRank[f.severity] > (severityRank[acc] ?? 0) ? f.severity : acc),
      'info'
    );

    const status = findings.length === 0
      ? 'clean'
      : worstSeverity === 'critical' ? 'critical' : worstSeverity === 'high' ? 'attention_required' : 'advisory';

    const scanDurationMs = Date.now() - scanStartedAt.getTime();

    // Log completion
    await supabase.from('audit_logs').insert({
      event_type: 'SECURITY_SCAN_COMPLETED',
      event_category: 'SECURITY_EVENT',
      actor_user_id: userId,
      success: true,
      metadata: {
        scan_id: scanId,
        scan_duration_ms: scanDurationMs,
        finding_count: findings.length,
        status,
        worst_severity: worstSeverity
      }
    });

    return {
      success: true,
      data: {
        scanId,
        timestamp: scanStartedAt.toISOString(),
        status,
        findings,
        summary: findings.length === 0
          ? 'No security issues detected.'
          : `${findings.length} finding(s) detected — worst severity: ${worstSeverity}`,
        duration_ms: scanDurationMs
      }
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMessage || 'Security scan failed'
    };
  }
}

/**
 * Handle audit log request
 */
async function handleAuditLog(
  supabase: SupabaseClient,
  userId: string,
  payload: AuditLogPayload | undefined
): Promise<GuardianResponse> {
  try {
    const {
      event_type,
      severity = 'MEDIUM',
      description,
      requires_investigation = false
    } = payload ?? {};

    // Insert audit log entry
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        event_type: event_type || 'GUARDIAN_EVENT',
        event_category: 'SYSTEM_EVENT',
        actor_user_id: userId,
        success: true,
        metadata: {
          severity,
          description,
          requires_investigation,
          source: 'guardian_agent',
          timestamp: new Date().toISOString()
        }
      });

    if (error) throw error;

    return {
      success: true,
      data: {
        logged: true,
        event_type,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMessage || 'Audit logging failed'
    };
  }
}

/**
 * Handle health monitoring request
 */
async function handleMonitorHealth(
  supabase: SupabaseClient,
  userId: string
): Promise<GuardianResponse> {
  try {
    // Check database connectivity
    const { error: dbError } = await supabase
      .from('audit_logs')
      .select('id')
      .limit(1);

    const dbHealthy = !dbError;

    // Log health check to audit_logs
    await supabase
      .from('audit_logs')
      .insert({
        event_type: 'HEALTH_CHECK',
        event_category: 'SYSTEM_EVENT',
        actor_user_id: userId,
        success: dbHealthy,
        metadata: {
          database: dbHealthy ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString()
        }
      });

    // IMPORTANT: Log to guardian_cron_log so dashboard shows Guardian as ONLINE
    await supabase
      .from('guardian_cron_log')
      .insert({
        job_name: 'guardian-health-check',
        executed_at: new Date().toISOString(),
        status: dbHealthy ? 'success' : 'failed',
        details: {
          triggered_by: userId,
          source: 'manual_health_check',
          database_healthy: dbHealthy,
          api_healthy: true
        }
      });

    return {
      success: true,
      data: {
        status: dbHealthy ? 'healthy' : 'degraded',
        checks: {
          database: dbHealthy,
          api: true,
          timestamp: new Date().toISOString()
        }
      }
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMessage || 'Health monitoring failed'
    };
  }
}
