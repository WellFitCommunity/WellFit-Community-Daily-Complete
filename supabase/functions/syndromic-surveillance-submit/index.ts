/**
 * Syndromic Surveillance Submit Edge Function
 *
 * ONC Criteria: 170.315(f)(2) - Transmission to Public Health Agencies - Syndromic Surveillance
 *
 * Submits HL7 ADT messages to state health departments for syndromic surveillance.
 * Configured for Texas DSHS initially, extensible to other states.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { getStateConfig, type StateConfig } from '../_shared/stateConfigLookup.ts';

// Hardcoded fallback — used when no database row exists for the tenant+state
const FALLBACK_CONFIGS: Record<string, StateConfig> = {
  TX: {
    name: 'Texas DSHS',
    endpoint: 'https://syndromic.dshs.texas.gov/api/submit',
    testEndpoint: 'https://syndromic-test.dshs.texas.gov/api/submit',
    format: 'HL7v2',
    authType: 'certificate',
  },
};

interface SubmitRequest {
  tenantId: string;
  encounterId: string;
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
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request
    const body: SubmitRequest = await req.json();
    const { tenantId, encounterId, state, useTestEndpoint = false } = body;

    if (!tenantId || !encounterId || !state) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: tenantId, encounterId, state' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get state configuration — DB first, hardcoded fallback
    const dbConfig = await getStateConfig(supabase, tenantId, state, 'syndromic');
    const stateConfig = dbConfig || FALLBACK_CONFIGS[state.toUpperCase()] || null;
    if (!stateConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `State ${state} not configured for syndromic surveillance` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch the encounter. NOTE (live-verified 2026-07-25): the live table has
    // NO hl7_message / message_type columns — HL7 generation + storage is part
    // of the unbuilt transport work, so this function currently always exits
    // at the hl7Message check below. That is the honest behavior until built.
    const { data: encounter, error: encounterError } = await supabase
      .from('syndromic_surveillance_encounters')
      .select('id, status, chief_complaint, encounter_date')
      .eq('tenant_id', tenantId)
      .eq('id', encounterId)
      .single();

    if (encounterError || !encounter) {
      return new Response(
        JSON.stringify({ success: false, error: 'Encounter not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // HL7 message + type — always absent today (columns do not exist live)
    const encounterExtra = encounter as Record<string, unknown>;
    const hl7Message = encounterExtra.hl7_message as string | undefined;
    const messageType = encounterExtra.message_type as string | undefined;
    if (!hl7Message) {
      return new Response(
        JSON.stringify({ success: false, error: 'HL7 message not generated for this encounter' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Determine endpoint
    const endpoint = useTestEndpoint ? stateConfig.testEndpoint : stateConfig.endpoint;

    // No live state-endpoint transport is configured. This function records
    // the transmission intent honestly as pending_transport — it does NOT
    // transmit and does NOT fabricate an acceptance response.
    const submissionId = crypto.randomUUID();
    const submissionTimestamp = new Date().toISOString();

    // Record the transmission
    const { error: insertError } = await supabase
      .from('syndromic_surveillance_transmissions')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounterId,
        submission_id: submissionId,
        destination: stateConfig.name,
        destination_endpoint: endpoint,
        message_type: messageType,
        hl7_message: hl7Message,
        submission_timestamp: submissionTimestamp,
        status: 'pending_transport',
        response_code: null,
        response_message: 'Not transmitted — no live state surveillance connection configured. Awaiting registry enrollment and transport wiring.',
        is_test: useTestEndpoint,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record transmission' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Update encounter status
    await supabase
      .from('syndromic_surveillance_encounters')
      .update({
        transmission_status: 'pending_transport',
        last_submission_id: submissionId,
        last_submission_date: submissionTimestamp,
      })
      .eq('id', encounterId);

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
          messageType,
          message: 'Recorded for transmission. Not transmitted — no live state connection configured.',
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
