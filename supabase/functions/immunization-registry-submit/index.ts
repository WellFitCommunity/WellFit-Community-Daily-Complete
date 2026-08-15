/**
 * Immunization Registry Submit Edge Function
 *
 * ONC Criteria: 170.315(f)(1) - Transmission to Immunization Registries
 *
 * Submits HL7 VXU messages to state immunization registries.
 * Configured for Texas ImmTrac2 initially, extensible to other states.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { getStateConfig, type StateConfig } from '../_shared/stateConfigLookup.ts';
import { requirePublicHealthIntegrationAccess } from '../_shared/publicHealthGate.ts';

// Hardcoded fallback — used when no database row exists for the tenant+state
const FALLBACK_CONFIGS: Record<string, StateConfig> = {
  TX: {
    name: 'Texas ImmTrac2',
    endpoint: 'https://immtrac.dshs.texas.gov/api/vxu',
    testEndpoint: 'https://immtrac-test.dshs.texas.gov/api/vxu',
    format: 'HL7v2',
    authType: 'certificate',
  },
};

interface SubmitRequest {
  tenantId: string;
  immunizationId: string;
  patientId: string;
  state: string;
  useTestEndpoint?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Parse request
    const body: SubmitRequest = await req.json();
    const { tenantId, immunizationId, patientId, state, useTestEndpoint = false } = body;

    if (!tenantId || !immunizationId || !patientId || !state) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // A-2 (S3): verified caller via the shared public-health gate — JWT +
    // public-health role, tenant derived from the CALLER's profile (body
    // tenantId honored only for super_admin / internal service callers).
    let effectiveTenantId: string;
    try {
      const caller = await requirePublicHealthIntegrationAccess(req, tenantId);
      effectiveTenantId = caller.tenantId;
    } catch (e: unknown) {
      if (e instanceof Response) {
        const errBody = await e.text();
        return new Response(errBody, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw e;
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get state configuration — DB first, hardcoded fallback
    const dbConfig = await getStateConfig(supabase, effectiveTenantId, state, 'immunization');
    const stateConfig = dbConfig || FALLBACK_CONFIGS[state.toUpperCase()] || null;
    if (!stateConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `State ${state} not configured for immunization registry` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch the immunization record
    const { data: immunization, error: immError } = await supabase
      .from('immunizations')
      .select(`
        *,
        patients!inner(id, first_name, last_name, date_of_birth, gender, mrn)
      `)
      .eq('tenant_id', effectiveTenantId)
      .eq('id', immunizationId)
      .single();

    if (immError || !immunization) {
      return new Response(
        JSON.stringify({ success: false, error: 'Immunization record not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if already submitted
    const { data: existing } = await supabase
      .from('immunization_registry_submissions')
      .select('id, submission_id, status')
      .eq('immunization_id', immunizationId)
      .eq('registry_state', state.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing?.status === 'accepted') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            submissionId: existing.submission_id,
            status: 'already_submitted',
            message: 'This immunization was already submitted and accepted',
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Determine endpoint
    const endpoint = useTestEndpoint ? stateConfig.testEndpoint : stateConfig.endpoint;

    // Generate submission ID and timestamp
    const submissionId = crypto.randomUUID();
    const submissionTimestamp = new Date().toISOString();

    // No live registry transport is configured. This function records the
    // submission intent honestly as pending_transport — it does NOT transmit
    // and does NOT fabricate a registry ACK. Real transmission requires
    // ImmTrac2 (or other state registry) enrollment + HL7 VXU transport wiring.

    // Record the submission intent
    const { error: insertError } = await supabase
      .from('immunization_registry_submissions')
      .insert({
        tenant_id: effectiveTenantId,
        immunization_id: immunizationId,
        patient_id: patientId,
        submission_id: submissionId,
        registry_name: stateConfig.name,
        registry_state: state.toUpperCase(),
        registry_endpoint: endpoint,
        submission_timestamp: submissionTimestamp,
        status: 'pending_transport',
        ack_code: null,
        ack_message: 'Not transmitted — no live registry connection configured. Awaiting registry enrollment and transport wiring.',
        is_test: useTestEndpoint,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record submission' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Update immunization record
    await supabase
      .from('immunizations')
      .update({
        registry_status: 'pending_transport',
        registry_submission_id: submissionId,
        registry_submission_date: submissionTimestamp,
      })
      .eq('id', immunizationId)
      .eq('tenant_id', effectiveTenantId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          submissionId,
          destination: stateConfig.name,
          endpoint,
          timestamp: submissionTimestamp,
          status: 'pending_transport',
          transmitted: false,
          message: 'Recorded for submission. Not transmitted — no live registry connection configured.',
        },
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
