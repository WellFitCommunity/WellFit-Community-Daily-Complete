// Guardian Agent Edge Function - Production Ready
// Backend service that monitors the system and creates security alerts.
// Decomposed into focused modules (CLAUDE.md #12): types/monitoring/notifications/
// recordings/healing. This file is the HTTP entry + action dispatch only.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions } from '../_shared/cors.ts'
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
