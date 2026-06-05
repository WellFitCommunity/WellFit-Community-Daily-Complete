// Guardian Agent Edge Function - Production Ready
// Backend service that monitors the system and creates security alerts.
// Decomposed into focused modules (CLAUDE.md #12): types/monitoring/notifications/
// recordings/healing. This file is the HTTP entry + action dispatch only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions, rejectDisallowedOrigin } from '../_shared/cors.ts'
import { createLogger } from "../_shared/auditLogger.ts";
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GuardianEyesSnapshot } from './types.ts'
import { runMonitoringChecks } from './monitoring.ts'
import { recordSnapshot, analyzeRecordings } from './recordings.ts'
import { autoHeal } from './healing.ts'

const logger = createLogger("guardian-agent");

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleOptions(req)
  }

  // Get CORS headers for this origin
  const { headers: corsHeaders } = corsFromRequest(req);

  // Reject only BROWSER requests from disallowed origins. A missing Origin header =
  // non-browser (server-to-server) caller — e.g. the pg_cron `monitor` trigger — which
  // the gateway JWT + admin client already authenticate. The old `if (!allowed)` check
  // 403'd every no-origin call, so the per-minute monitoring cron never ran.
  const originRejection = rejectDisallowedOrigin(req);
  if (originRejection) return originRejection;

  // Server-to-server callers (no Origin) are the cron path.
  const isServerToServer = !req.headers.get('origin');

  try {
    const supabase = createAdminClient()

    const { action, data } = await req.json()

    // Resolve tenant_id from request data or auth JWT
    const tenantId = data?.tenant_id || await resolveTenantId(supabase, req);

    // The cron posts `{action:'monitor'}` with no tenant_id and a service-role token
    // (which resolves no profile/tenant). Monitor every active tenant in that case so
    // the scheduled job actually covers the system instead of 400-ing.
    if (action === 'monitor' && !tenantId && isServerToServer) {
      const tenantIds = await getActiveTenantIds(supabase);
      const allAlerts: unknown[] = [];
      for (const t of tenantIds) {
        const tenantAlerts = await runMonitoringChecks(supabase, t);
        allAlerts.push(...tenantAlerts);
      }
      return new Response(
        JSON.stringify({ success: true, tenants_monitored: tenantIds.length, alerts: allAlerts }),
        { headers: corsHeaders }
      );
    }

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
 * Returns the ids of all active tenants (is_active true or null) for the cron
 * "monitor every tenant" path. Admin client — RLS does not apply.
 */
async function getActiveTenantIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .or('is_active.is.null,is_active.eq.true');
  if (error) {
    logger.error('Failed to load active tenants for monitoring', { message: error.message });
    return [];
  }
  return (data ?? []).map((t: { id: string }) => t.id);
}

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
