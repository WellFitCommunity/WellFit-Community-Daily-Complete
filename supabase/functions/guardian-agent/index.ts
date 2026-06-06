// Guardian Agent Edge Function - Production Ready
// Backend service that monitors the system and creates security alerts.
// Decomposed into focused modules (CLAUDE.md #12): types/monitoring/notifications/
// recordings/healing. This file is the HTTP entry + action dispatch only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions, rejectDisallowedOrigin } from '../_shared/cors.ts'
import { createLogger } from "../_shared/auditLogger.ts";
import { SB_SECRET_KEY } from '../_shared/env.ts'
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

  // Gateway JWT verification is DISABLED for this function (supabase/config.toml:
  // [functions.guardian-agent] verify_jwt=false) because the pg_cron trigger
  // authenticates with the NEW `sb_secret_*` key, which is NOT a JWT — the gateway
  // rejected it as UNAUTHORIZED_INVALID_JWT_FORMAT before the function ever ran.
  // We therefore enforce caller auth HERE. Server-to-server (no Origin) callers —
  // the crons — must present the cron secret (X-Cron-Secret header or Bearer)
  // matching CRON_SECRET or the new SB_SECRET_KEY (what trigger_guardian_monitoring
  // sends). Browser callers carry an Origin and keep the verified-JWT path below
  // (rejectDisallowedOrigin above + resolveTenantId's auth.getUser).
  if (isServerToServer && !isAuthorizedServerCaller(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized — cron secret required' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createAdminClient()

    const { action, data } = await req.json()

    // Resolve tenant_id from request data or auth JWT
    const tenantId = data?.tenant_id || await resolveTenantId(supabase, req);

    // The scheduled crons post `{action:'monitor'}` (every 5 min) and
    // `{action:'analyze'}` (daily summary) with NO tenant_id and a secret-key token
    // (which resolves no profile/tenant). Fan the work across every active tenant in
    // that case so the scheduled jobs actually cover the system instead of 400-ing.
    if (!tenantId && isServerToServer && (action === 'monitor' || action === 'analyze')) {
      const tenantIds = await getActiveTenantIds(supabase);

      if (action === 'monitor') {
        const allAlerts: unknown[] = [];
        for (const t of tenantIds) {
          allAlerts.push(...await runMonitoringChecks(supabase, t));
        }
        return new Response(
          JSON.stringify({ success: true, tenants_monitored: tenantIds.length, alerts: allAlerts }),
          { headers: corsHeaders }
        );
      }

      // action === 'analyze'
      const analyses: unknown[] = [];
      for (const t of tenantIds) {
        analyses.push(await analyzeRecordings(supabase, t));
      }
      return new Response(
        JSON.stringify({ success: true, tenants_analyzed: tenantIds.length, analyses }),
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
 * Authenticates a server-to-server (no-Origin) caller — i.e. the pg_cron jobs.
 * The platform gateway's verify_jwt is OFF for this function, so this IS the auth
 * layer for cron calls. Accepts an `X-Cron-Secret` header or a `Bearer` token that
 * equals the dedicated `CRON_SECRET` or the new-format `SB_SECRET_KEY` (the value
 * `trigger_guardian_monitoring()` reads from Vault and sends). It deliberately does
 * NOT accept the legacy JWT service-role key — that is a different, deprecated
 * credential (CLAUDE.md supabase §14: new keys primary, legacy JWT keys phased out).
 */
function isAuthorizedServerCaller(req: Request): boolean {
  const headerSecret = req.headers.get('X-Cron-Secret');
  const bearerToken = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const candidate = headerSecret ?? bearerToken;
  if (!candidate) return false;

  const accepted = [Deno.env.get('CRON_SECRET'), SB_SECRET_KEY]
    .filter((s): s is string => typeof s === 'string' && s.length > 0);

  return accepted.some((s) => s === candidate);
}

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
