/**
 * PDMP Query Edge Function
 *
 * ONC Criteria: 170.315(b)(3) - Electronic Prescribing (PDMP integration)
 *
 * Queries state Prescription Drug Monitoring Programs for patient prescription history.
 * Required before prescribing controlled substances (DEA Schedule II-V).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { requireUser, requireRole, requirePatientAccess, supabaseAdmin } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

// A-1c remediation: this endpoint gates CONTROLLED-SUBSTANCE prescription
// history. The previous check accepted any string shaped like "Bearer x".
// Now: verified JWT + prescriber-class role + patient authorization (tenant
// isolation) before the 24h cache path is reachable. The tenant is resolved
// from the CALLER's profile — the body's tenantId is honored only for
// super_admin and must otherwise match the caller's tenant.
const PRESCRIBER_ROLES = [
  'admin', 'super_admin', 'physician', 'doctor',
  'nurse_practitioner', 'physician_assistant',
];

// State PDMP configurations
const STATE_CONFIGS: Record<string, {
  name: string;
  endpoint: string;
  testEndpoint: string;
  authType: 'pmix' | 'nabp' | 'state_specific';
  mandatoryQuery: boolean;
  queryBeforeSchedule: number[]; // DEA schedules that require PDMP query
}> = {
  TX: {
    name: 'Texas PMP AWARxE',
    endpoint: 'https://texas.pmpaware.net/api/query',
    testEndpoint: 'https://texas-test.pmpaware.net/api/query',
    authType: 'pmix',
    mandatoryQuery: true,
    queryBeforeSchedule: [2, 3, 4, 5],
  },
  // Add more states as needed
};

interface PDMPQueryRequest {
  tenantId: string;
  providerId: string;
  providerNpi: string;
  providerDea: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientDob: string; // ISO date
  state: string;
  dateRangeMonths?: number;
  useTestEndpoint?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Re-emit a Response thrown by the shared auth helpers with CORS attached.
  const withCors = async (e: Response): Promise<Response> => {
    const body = await e.text();
    return new Response(body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  };

  try {
    // A-1c: verified prescriber-class caller required before anything else.
    let callerId: string;
    let callerRole: string;
    try {
      const user = await requireUser(req);
      callerRole = await requireRole(user.id, PRESCRIBER_ROLES);
      callerId = user.id;
    } catch (e: unknown) {
      if (e instanceof Response) return await withCors(e);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rl = await checkRateLimit(callerId, { maxAttempts: 30, windowSeconds: 3600, keyPrefix: 'pdmp-query' });
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded', retryAfter: rl.retryAfter }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: PDMPQueryRequest = await req.json();
    const {
      tenantId,
      providerId,
      providerNpi,
      providerDea,
      patientId,
      patientFirstName,
      patientLastName,
      patientDob,
      state,
      dateRangeMonths = 12,
      useTestEndpoint = false,
    } = body;

    // Validate required fields
    if (!tenantId || !providerId || !patientId || !state) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // A-1c: the tenant is the CALLER's tenant, not the body's. super_admin may
    // pass an explicit tenantId; anyone else's body tenantId must match.
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', callerId)
      .maybeSingle();

    if (callerProfileError || !callerProfile?.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Caller tenant could not be resolved' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveTenantId =
      callerRole === 'super_admin' ? tenantId : callerProfile.tenant_id;

    if (callerRole !== 'super_admin' && tenantId !== callerProfile.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: tenant mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // A-1c: patient-level authorization (clinical role + tenant isolation) —
    // the cached controlled-substance path is unreachable without it.
    try {
      await requirePatientAccess(callerId, patientId, PRESCRIBER_ROLES);
    } catch (e: unknown) {
      if (e instanceof Response) return await withCors(e);
      throw e;
    }

    // Get state configuration
    const stateConfig = STATE_CONFIGS[state.toUpperCase()];
    if (!stateConfig) {
      return new Response(
        JSON.stringify({ success: false, error: `State ${state} not configured for PDMP` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = supabaseAdmin;

    // Check for recent query (avoid duplicate queries within 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: recentQuery } = await supabase
      .from('pdmp_queries')
      .select('id, query_timestamp, response_status')
      .eq('tenant_id', effectiveTenantId)
      .eq('patient_id', patientId)
      .eq('pdmp_state', state.toUpperCase())
      .gte('query_timestamp', twentyFourHoursAgo.toISOString())
      .eq('response_status', 'success')
      .order('query_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (recentQuery) {
      // Return cached result
      // Explicit live columns; FK column is pdmp_query_id (live-verified
      // 2026-07-25 — the previous 'query_id' filter silently errored)
      const { data: prescriptions } = await supabase
        .from('pdmp_prescription_history')
        .select('id, medication_name, medication_ndc, dea_schedule, quantity, days_supply, refills_authorized, written_date, filled_date, prescriber_name, prescriber_npi, pharmacy_name, pharmacy_npi, morphine_milligram_equivalent, overlaps_with_other, early_refill')
        .eq('pdmp_query_id', recentQuery.id);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            queryId: recentQuery.id,
            cached: true,
            cacheTimestamp: recentQuery.query_timestamp,
            prescriptions: prescriptions || [],
            message: 'Using cached PDMP query from within 24 hours',
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Determine endpoint
    const endpoint = useTestEndpoint ? stateConfig.testEndpoint : stateConfig.endpoint;

    // Calculate date range
    const dateRangeStart = new Date();
    dateRangeStart.setMonth(dateRangeStart.getMonth() - dateRangeMonths);
    const dateRangeEnd = new Date();

    // Generate query ID and timestamp
    const queryId = crypto.randomUUID();
    const queryTimestamp = new Date().toISOString();

    // No live PDMP connection (PMIX/NABP) is configured. This function MUST
    // NOT fabricate prescription history — fabricated (or fabricated-empty)
    // controlled-substance data could directly influence prescribing
    // decisions. It records the attempted query honestly as an error and
    // fails closed. Real operation requires state PDMP (TX AWARxE) onboarding
    // + PMIX/NABP request/response wiring + MME/risk-flag analysis.

    // Record the attempted query for the audit trail.
    // Live column set verified 2026-08-15: pdmp_queries has NO response_code
    // and NO is_test column (the old insert failed on every call) — the
    // test-endpoint flag rides in request_payload instead.
    const { error: insertError } = await supabase
      .from('pdmp_queries')
      .insert({
        id: queryId,
        tenant_id: effectiveTenantId,
        query_type: 'patient_history',
        provider_id: providerId,
        provider_npi: providerNpi,
        provider_dea: providerDea,
        patient_id: patientId,
        patient_first_name: patientFirstName,
        patient_last_name: patientLastName,
        patient_dob: patientDob,
        pdmp_state: state.toUpperCase(),
        pdmp_system_name: stateConfig.name,
        request_payload: { is_test: useTestEndpoint, endpoint, date_range_months: dateRangeMonths },
        date_range_start: dateRangeStart.toISOString(),
        date_range_end: dateRangeEnd.toISOString(),
        query_timestamp: queryTimestamp,
        response_status: 'error',
        prescriptions_found: 0,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record PDMP query' }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'PDMP_NOT_CONNECTED',
        message:
          'No live PDMP connection is configured — prescription history is UNAVAILABLE. ' +
          'Do NOT interpret this as a negative (clean) history. Use the state PDMP web portal until a live connection is provisioned.',
        data: {
          queryId,
          state: state.toUpperCase(),
          pdmpName: stateConfig.name,
          endpoint,
          queryTimestamp,
          isTest: useTestEndpoint,
        },
      }),
      { status: 501, headers: corsHeaders }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
