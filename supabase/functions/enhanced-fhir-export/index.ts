import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createUserClient } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions } from "../_shared/cors.ts"
import { createLogger } from '../_shared/auditLogger.ts'
import {
  buildPatientResource,
  buildCheckInObservations,
  buildMobileVitalObservations,
  buildEmergencyReports,
  buildMovementObservations,
  buildRiskAssessments
} from './resourceBuilders.ts'

// Maximum resources per query to prevent memory exhaustion
const PAGE_SIZE = 500;

interface FHIRExportRequest {
  patient_id?: string
  start_date?: string
  end_date?: string
  include_mobile_data?: boolean
  include_ai_assessments?: boolean
  format?: 'bundle' | 'individual'
  page?: number // 0-indexed page number
}

serve(async (req) => {
  const logger = createLogger('enhanced-fhir-export', req);

  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const startTime = Date.now();

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      logger.warn('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createUserClient(authHeader)

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const exportRequest: FHIRExportRequest = await req.json()

    // Check permissions — users can only export own data unless admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role_code, tenant_id')
      .eq('user_id', user.id)
      .single()

    const isAdmin = profile?.role_code && [1, 2, 3, 12].includes(profile.role_code)
    const patientId = exportRequest.patient_id || user.id

    if (!isAdmin && patientId !== user.id) {
      logger.warn('Unauthorized FHIR export attempt', {
        userId: user.id,
        requestedPatientId: patientId
      });
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startDate = exportRequest.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = exportRequest.end_date || new Date().toISOString()
    const page = Math.max(0, exportRequest.page || 0);
    const offset = page * PAGE_SIZE;

    logger.info('FHIR export initiated', {
      userId: user.id,
      patientId,
      isAdmin,
      startDate,
      endDate,
      page,
      includeMobileData: exportRequest.include_mobile_data !== false,
      includeAIAssessments: exportRequest.include_ai_assessments !== false
    });

    // =========================================================================
    // Data fetching — specific columns, paginated, parallel
    // =========================================================================
    const includeMobile = exportRequest.include_mobile_data !== false;
    const includeAI = exportRequest.include_ai_assessments !== false;

    // Fetch profile (always needed, no pagination)
    const profilePromise = supabaseClient
      .from('profiles')
      .select('first_name, last_name, phone, email, dob, address')
      .eq('user_id', patientId)
      .single();

    // Fetch check-ins with pagination
    const checkInsPromise = supabaseClient
      .from('check_ins')
      .select('id, created_at, heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, mood')
      .eq('user_id', patientId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    // Mobile vitals (conditional, paginated)
    const mobileVitalsPromise = includeMobile
      ? supabaseClient
          .from('mobile_vitals')
          .select('id, measurement_type, measured_at, value_primary, unit, measurement_method, confidence_score, measurement_quality')
          .eq('patient_id', patientId)
          .gte('measured_at', startDate)
          .lte('measured_at', endDate)
          .order('measured_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
      : Promise.resolve({ data: null, error: null });

    // Emergency incidents (conditional, paginated)
    const emergencyPromise = includeMobile
      ? supabaseClient
          .from('mobile_emergency_incidents')
          .select('id, triggered_at, incident_type, severity, auto_detected, incident_resolved')
          .eq('patient_id', patientId)
          .gte('triggered_at', startDate)
          .lte('triggered_at', endDate)
          .order('triggered_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
      : Promise.resolve({ data: null, error: null });

    // Movement patterns (conditional, paginated)
    const movementPromise = includeMobile
      ? supabaseClient
          .from('movement_patterns')
          .select('id, date_tracked, total_distance_meters, active_time_minutes')
          .eq('patient_id', patientId)
          .gte('date_tracked', startDate.split('T')[0])
          .lte('date_tracked', endDate.split('T')[0])
          .order('date_tracked', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
      : Promise.resolve({ data: null, error: null });

    // AI risk assessments (conditional, paginated)
    const aiPromise = includeAI
      ? supabaseClient
          .from('ai_risk_assessments')
          .select('id, assessed_at, risk_level, risk_score, risk_factors, recommendations')
          .eq('patient_id', patientId)
          .gte('assessed_at', startDate)
          .lte('assessed_at', endDate)
          .order('assessed_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
      : Promise.resolve({ data: null, error: null });

    // Execute all queries in parallel
    const [
      { data: patientProfile },
      { data: checkIns },
      { data: mobileVitals },
      { data: emergencyIncidents },
      { data: movementPatterns },
      { data: riskAssessments }
    ] = await Promise.all([
      profilePromise,
      checkInsPromise,
      mobileVitalsPromise,
      emergencyPromise,
      movementPromise,
      aiPromise
    ]);

    logger.debug('FHIR data fetched', {
      patientId,
      checkInsCount: checkIns?.length || 0,
      mobileVitalsCount: mobileVitals?.length || 0,
      emergencyIncidentsCount: emergencyIncidents?.length || 0,
      movementPatternsCount: movementPatterns?.length || 0,
      riskAssessmentsCount: riskAssessments?.length || 0
    });

    // =========================================================================
    // Build validated FHIR resources
    // =========================================================================
    const entries: Array<{ fullUrl: string; resource: Record<string, unknown> }> = [];

    // Patient resource (page 0 only)
    if (page === 0 && patientProfile) {
      entries.push(buildPatientResource(patientId, patientProfile));
    }

    // Check-in observations
    if (checkIns?.length) {
      entries.push(...buildCheckInObservations(patientId, checkIns));
    }

    // Mobile data
    if (includeMobile) {
      if (mobileVitals?.length) {
        entries.push(...buildMobileVitalObservations(patientId, mobileVitals));
      }
      if (emergencyIncidents?.length) {
        entries.push(...buildEmergencyReports(patientId, emergencyIncidents));
      }
      if (movementPatterns?.length) {
        entries.push(...buildMovementObservations(patientId, movementPatterns));
      }
    }

    // AI assessments
    if (includeAI && riskAssessments?.length) {
      entries.push(...buildRiskAssessments(patientId, riskAssessments));
    }

    // Determine if there are more pages
    const hasMore = [checkIns, mobileVitals, emergencyIncidents, movementPatterns, riskAssessments]
      .some(arr => arr?.length === PAGE_SIZE);

    // Build FHIR Bundle
    const bundleId = `bundle-${patientId}-${Date.now()}`;
    const fhirBundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries,
      // Pagination links (FHIR-style)
      link: [
        { relation: 'self', url: `?page=${page}` },
        ...(hasMore ? [{ relation: 'next', url: `?page=${page + 1}` }] : []),
        ...(page > 0 ? [{ relation: 'previous', url: `?page=${page - 1}` }] : [])
      ]
    };

    // Cache the bundle (page 0 only — full export)
    if (page === 0) {
      const { error: cacheError } = await supabaseClient
        .from('fhir_bundles')
        .insert({
          patient_id: patientId,
          bundle_type: 'enhanced_patient_export',
          bundle_data: fhirBundle,
          validation_status: 'VALID',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });

      if (cacheError) {
        logger.warn('Failed to cache FHIR bundle', { error: cacheError.message });
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info('FHIR export completed', {
      userId: user.id,
      patientId,
      resourceCount: entries.length,
      page,
      hasMore,
      processingTimeMs: processingTime
    });

    return new Response(
      JSON.stringify(fhirBundle),
      { headers: { ...corsHeaders, 'Content-Type': 'application/fhir+json' } }
    )

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('FHIR export error', {
      error: errorMessage,
      processingTimeMs: Date.now() - startTime
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
