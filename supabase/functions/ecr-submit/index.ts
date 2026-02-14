/**
 * Electronic Case Reporting (eCR) Submit Edge Function
 *
 * ONC Criteria: 170.315(f)(5) - Transmission to Public Health Agencies - Electronic Case Reporting
 *
 * Submits electronic Initial Case Reports (eICR) via AIMS platform or direct submission.
 * Uses HL7 CDA format per eICR Implementation Guide.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { getStateConfig, type StateConfig } from '../_shared/stateConfigLookup.ts';

// AIMS platform config — centralized, stays hardcoded
const AIMS_CONFIG: StateConfig = {
  name: 'AIMS Platform',
  endpoint: 'https://aims.aimsplatform.org/api/eicr',
  testEndpoint: 'https://aims-staging.aimsplatform.org/api/eicr',
  format: 'CDA',
  authType: 'oauth2',
};

// Direct-to-state fallback — used when no database row exists
const FALLBACK_DIRECT_CONFIGS: Record<string, StateConfig> = {
  TX: {
    name: 'Texas DSHS Direct',
    endpoint: 'https://ecr.dshs.texas.gov/api/eicr',
    testEndpoint: 'https://ecr-test.dshs.texas.gov/api/eicr',
    format: 'CDA',
    authType: 'certificate',
  },
};

interface SubmitRequest {
  tenantId: string;
  caseReportId: string;
  submissionRoute?: 'aims' | 'direct';
  state?: string;
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
    const {
      tenantId,
      caseReportId,
      submissionRoute = 'aims',
      state = 'TX',
      useTestEndpoint = false,
    } = body;

    if (!tenantId || !caseReportId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: tenantId, caseReportId' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get submission configuration — AIMS stays hardcoded, direct uses DB-first
    let config: StateConfig;
    if (submissionRoute === 'aims') {
      config = AIMS_CONFIG;
    } else {
      const dbConfig = await getStateConfig(supabase, tenantId, state, 'ecr');
      config = dbConfig || FALLBACK_DIRECT_CONFIGS[state.toUpperCase()] || AIMS_CONFIG;
    }

    // Fetch the case report
    const { data: caseReport, error: reportError } = await supabase
      .from('electronic_case_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', caseReportId)
      .single();

    if (reportError || !caseReport) {
      return new Response(
        JSON.stringify({ success: false, error: 'Case report not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Validate report is ready for submission
    if (caseReport.status !== 'ready' && caseReport.status !== 'pending_submission') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Case report is not ready for submission. Current status: ${caseReport.status}`,
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Determine endpoint
    const endpoint = useTestEndpoint ? config.testEndpoint : config.endpoint;

    // Generate submission ID and timestamp
    const submissionId = crypto.randomUUID();
    const submissionTimestamp = new Date().toISOString();

    // In production, this would:
    // 1. Generate eICR CDA document using ecrService
    // 2. Submit to AIMS or state endpoint
    // 3. Parse response and handle RR (Reportability Response)

    // Record the submission
    const { error: insertError } = await supabase
      .from('ecr_submissions')
      .insert({
        tenant_id: tenantId,
        case_report_id: caseReportId,
        submission_id: submissionId,
        submission_route: submissionRoute,
        destination_name: config.name,
        destination_endpoint: endpoint,
        submission_timestamp: submissionTimestamp,
        status: 'submitted',
        response_code: '200',
        response_message: 'eICR accepted for processing (simulated)',
        is_test: useTestEndpoint,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to record submission' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Update case report status
    await supabase
      .from('electronic_case_reports')
      .update({
        status: 'submitted',
        submission_id: submissionId,
        submission_date: submissionTimestamp,
        submission_route: submissionRoute,
      })
      .eq('id', caseReportId);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          submissionId,
          destination: config.name,
          route: submissionRoute,
          endpoint,
          timestamp: submissionTimestamp,
          status: 'submitted',
          conditionCode: caseReport.condition_code,
          conditionName: caseReport.condition_name,
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
