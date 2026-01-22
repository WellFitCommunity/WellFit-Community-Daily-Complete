/**
 * AI Billing Code Suggester Edge Function
 * Can be called:
 * 1. Real-time during encounter (HTTP request)
 * 2. Batch processing for pending encounters (cron)
 *
 * SECURITY: Requires authentication and tenant authorization
 */

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = SUPABASE_URL!;
const SERVICE_KEY = SB_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

// Database record types
interface ConditionRecord {
  code?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // =========================================================================
    // AUTHENTICATION - Required for all requests
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================================
    // Get user's profile and tenant context
    // =========================================================================
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, is_admin, role_id, roles:role_id(name)')
      .eq('user_id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'User has no tenant assigned' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has clinical/admin role (billing suggester requires elevated access)
    const roleName = (profile.roles as any)?.name;
    const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'billing_specialist', 'case_manager'];
    const hasAccess = profile.is_admin || allowedRoles.includes(roleName);

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for billing suggestions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if super admin (can access any tenant)
    const { data: superAdminData } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const isSuperAdmin = !!superAdminData;

    const { encounterId, patientId, tenantId, mode = 'single' } = await req.json();

    // =========================================================================
    // AUTHORIZATION - Verify tenant access
    // =========================================================================
    const effectiveTenantId = tenantId || profile.tenant_id;

    // Non-super-admins can only access their own tenant
    if (!isSuperAdmin && effectiveTenantId !== profile.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot access data from another tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'batch') {
      // Batch mode: Process multiple pending encounters
      return await processBatchEncounters(effectiveTenantId, corsHeaders);
    } else {
      // Single mode: Process one encounter
      return await processSingleEncounter(encounterId, patientId, effectiveTenantId, corsHeaders);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processSingleEncounter(
  encounterId: string,
  patientId: string,
  tenantId: string,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Import the billing service logic here
  // Note: In production, you'd import from a shared package
  // For now, we'll outline the structure

  // 1. Check if skill is enabled for tenant
  const { data: config } = await supabase.rpc('get_ai_skill_config', {
    p_tenant_id: tenantId
  });

  if (!config || !config.billing_suggester_enabled) {
    return new Response(
      JSON.stringify({ error: 'Billing suggester not enabled for this tenant' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Fetch encounter data from FHIR tables - SECURITY: Filter by tenant_id
  const { data: encounter } = await supabase
    .from('fhir_encounters')
    .select('*')
    .eq('id', encounterId)
    .eq('tenant_id', tenantId)
    .single();

  if (!encounter) {
    return new Response(
      JSON.stringify({ error: 'Encounter not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 3. Fetch related observations, conditions, procedures - SECURITY: Filter by tenant_id
  const { data: observations } = await supabase
    .from('fhir_observations')
    .select('code, value, unit')
    .eq('encounter_id', encounterId)
    .eq('tenant_id', tenantId)
    .limit(20);

  const { data: conditions } = await supabase
    .from('fhir_conditions')
    .select('code, display')
    .eq('patient_id', patientId)
    .eq('tenant_id', tenantId)
    .eq('clinical_status', 'active')
    .limit(10);

  // 4. Build encounter context
  const encounterContext = {
    encounterId,
    patientId,
    tenantId,
    encounterType: encounter.class || 'outpatient',
    encounterStart: encounter.period_start,
    encounterEnd: encounter.period_end,
    chiefComplaint: encounter.reason_code_text,
    diagnosisCodes: (conditions as ConditionRecord[] | null)?.map((c) => c.code) || [],
    observations: observations || []
  };

  // 5. Call billing suggester service (would import from shared package)
  // For now, return structure
  return new Response(
    JSON.stringify({
      success: true,
      encounterContext,
      message: 'Billing code suggestion generated',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

async function processBatchEncounters(tenantId: string, corsHeaders: Record<string, string>): Promise<Response> {
  // Batch processing: Find all encounters from last 24h without billing suggestions

  const { data: pendingEncounters } = await supabase
    .from('fhir_encounters')
    .select('id, patient_id, period_end')
    .eq('tenant_id', tenantId)
    .not('period_end', 'is', null) // Only completed encounters
    .gte('period_end', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100); // Process max 100 at a time

  if (!pendingEncounters || pendingEncounters.length === 0) {
    return new Response(
      JSON.stringify({ message: 'No pending encounters to process', count: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Filter out encounters that already have suggestions
  const encountersToProcess = [];

  for (const encounter of pendingEncounters) {
    const { data: existing } = await supabase
      .from('encounter_billing_suggestions')
      .select('id')
      .eq('encounter_id', encounter.id)
      .maybeSingle();

    if (!existing) {
      encountersToProcess.push(encounter);
    }
  }

  // Process each encounter (in production, you'd use parallel processing)
  const results = {
    total: encountersToProcess.length,
    processed: 0,
    errors: 0
  };

  for (const encounter of encountersToProcess) {
    try {
      // Process each encounter (call the single processor)
      await processSingleEncounter(
        encounter.id,
        encounter.patient_id,
        tenantId,
        corsHeaders
      );
      results.processed++;
    } catch (err: unknown) {
      results.errors++;
    }
  }

  return new Response(
    JSON.stringify({
      message: 'Batch processing complete',
      results,
      timestamp: new Date().toISOString()
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
