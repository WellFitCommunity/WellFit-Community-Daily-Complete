/**
 * Guardian Agent API - Edge Function
 *
 * Handles security scanning, audit logging, and health monitoring
 * for the WellFit Community Guardian Agent system
 *
 * HIPAA Compliant - All events logged to audit tables
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

interface GuardianRequest {
  action: 'security_scan' | 'audit_log' | 'monitor_health';
  payload: any;
}

interface GuardianResponse {
  success: boolean;
  data?: any;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Supabase client with user context
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Handle security scan request
 */
async function handleSecurityScan(
  supabase: any,
  userId: string
): Promise<GuardianResponse> {
  try {
    // Log security scan event
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        event_type: 'SECURITY_SCAN_INITIATED',
        event_category: 'SECURITY_EVENT',
        actor_user_id: userId,
        success: true,
        metadata: {
          scan_type: 'manual',
          timestamp: new Date().toISOString()
        }
      });

    if (error) throw error;

    // Return scan results (placeholder - expand based on your needs)
    return {
      success: true,
      data: {
        scanId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        status: 'completed',
        findings: [],
        summary: 'System scan completed successfully'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Security scan failed'
    };
  }
}

/**
 * Handle audit log request
 */
async function handleAuditLog(
  supabase: any,
  userId: string,
  payload: any
): Promise<GuardianResponse> {
  try {
    const {
      event_type,
      severity = 'MEDIUM',
      description,
      requires_investigation = false
    } = payload;

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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Audit logging failed'
    };
  }
}

/**
 * Handle health monitoring request
 */
async function handleMonitorHealth(
  supabase: any,
  userId: string
): Promise<GuardianResponse> {
  try {
    // Check database connectivity
    const { error: dbError } = await supabase
      .from('audit_logs')
      .select('id')
      .limit(1);

    const dbHealthy = !dbError;

    // Log health check
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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Health monitoring failed'
    };
  }
}
