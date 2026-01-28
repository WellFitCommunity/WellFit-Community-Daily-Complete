/**
 * Bed Optimizer Edge Function
 *
 * Predictive analytics and optimization for bed management:
 * - LOS predictions based on diagnosis
 * - Capacity forecasting (24-72 hour windows)
 * - Surge detection and protocol triggering
 * - Optimal placement recommendations
 * - Throughput optimization
 *
 * Copyright (c) 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const logger = createLogger("bed-optimizer");

// =============================================================================
// ENVIRONMENT HELPERS
// =============================================================================

const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

// =============================================================================
// TYPES
// =============================================================================

interface BedOptimizerRequest {
  action: 'predict_los' | 'forecast_capacity' | 'check_surge' | 'recommend_placement' | 'optimize_throughput' | 'health';
  tenant_id?: string;
  unit_id?: string;
  facility_id?: string;
  patient_id?: string;
  diagnosis_category?: string;
  forecast_hours?: number;
  requirements?: {
    bed_type?: string;
    requires_telemetry?: boolean;
    requires_isolation?: boolean;
    requires_negative_pressure?: boolean;
    preferred_unit?: string;
  };
}

interface LOSPrediction {
  predicted_los_hours: number;
  confidence_interval: { lower: number; upper: number };
  based_on_samples: number;
  diagnosis_category: string;
}

interface CapacityForecast {
  hour: number;
  date: string;
  predicted_census: number;
  predicted_available: number;
  confidence: { lower: number; upper: number };
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

interface SurgeStatus {
  is_surge: boolean;
  level: 'normal' | 'warning' | 'critical' | 'diversion';
  current_occupancy_pct: number;
  threshold_pct: number;
  affected_units: string[];
  recommended_actions: string[];
}

interface PlacementRecommendation {
  bed_id: string;
  unit_id: string;
  unit_name: string;
  room_number: string;
  score: number;
  factors: {
    availability: number;
    requirements_match: number;
    unit_load_balance: number;
    predicted_turnover: number;
  };
}

// =============================================================================
// DEFAULT LOS DATA (used when database query fails)
// =============================================================================

const DEFAULT_LOS_HOURS: Record<string, number> = {
  'cardiac': 96,
  'respiratory': 72,
  'surgical': 48,
  'medical': 72,
  'observation': 24,
  'stroke': 120,
  'trauma': 96,
  'pneumonia': 96,
  'sepsis': 144,
  'chf': 96,
  'copd': 72,
  'hip_fracture': 120,
  'gi_bleed': 72,
  'diabetes_acute': 48,
  'default': 48
};

// =============================================================================
// PREDICTION ALGORITHMS
// =============================================================================

async function predictLOS(
  supabase: SupabaseClient,
  tenantId: string,
  diagnosisCategory: string,
  _unitId?: string
): Promise<LOSPrediction> {
  const lowerDiagnosis = diagnosisCategory.toLowerCase();

  try {
    // Try to use database function if available
    const { data: prediction, error } = await supabase.rpc('get_los_prediction', {
      p_tenant_id: tenantId,
      p_diagnosis_category: lowerDiagnosis,
      p_unit_id: null
    });

    if (!error && prediction && prediction.length > 0) {
      const pred = prediction[0];
      return {
        predicted_los_hours: pred.predicted_los_hours,
        confidence_interval: {
          lower: pred.confidence_lower,
          upper: pred.confidence_upper
        },
        based_on_samples: pred.sample_size,
        diagnosis_category: diagnosisCategory
      };
    }
  } catch {
    // Function may not exist yet, use fallback
  }

  // Fallback: query table directly
  const { data: historical } = await supabase
    .from('los_predictions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('diagnosis_category', lowerDiagnosis)
    .order('calculated_at', { ascending: false })
    .limit(1);

  if (historical && historical.length > 0) {
    const pred = historical[0];
    const zScore = 1.96; // 95% confidence
    const stdDev = pred.std_dev_hours || pred.avg_los_hours * 0.25;
    return {
      predicted_los_hours: pred.avg_los_hours,
      confidence_interval: {
        lower: Math.max(0, pred.avg_los_hours - zScore * stdDev),
        upper: pred.avg_los_hours + zScore * stdDev
      },
      based_on_samples: pred.sample_size,
      diagnosis_category: diagnosisCategory
    };
  }

  // Use defaults
  const baseLOS = DEFAULT_LOS_HOURS[lowerDiagnosis] || DEFAULT_LOS_HOURS['default'];

  return {
    predicted_los_hours: baseLOS,
    confidence_interval: { lower: baseLOS * 0.5, upper: baseLOS * 2 },
    based_on_samples: 0,
    diagnosis_category: diagnosisCategory
  };
}

async function forecastCapacity(
  supabase: SupabaseClient,
  tenantId: string,
  unitId: string,
  hoursAhead: number = 24
): Promise<CapacityForecast[]> {
  // Get unit data
  const { data: unitData, error: unitError } = await supabase
    .from('hospital_units')
    .select('total_beds, target_census, max_census')
    .eq('id', unitId)
    .single();

  if (unitError || !unitData) {
    throw new Error('Unit not found');
  }

  // Get current assignments with expected discharge times
  const { data: assignments } = await supabase
    .from('bed_assignments')
    .select('expected_discharge_at, admitted_at')
    .eq('unit_id', unitId)
    .is('discharged_at', null);

  const currentCensus = assignments?.length || 0;
  const forecasts: CapacityForecast[] = [];
  const now = new Date();

  for (let h = 0; h < hoursAhead; h++) {
    const forecastTime = new Date(now.getTime() + h * 3600000);

    // Predict discharges based on expected_discharge_at
    let predictedDischarges = 0;
    if (assignments) {
      const typedAssignments = assignments as Array<{ expected_discharge_at: string | null; admitted_at: string }>;
      predictedDischarges = typedAssignments.filter(a => {
        if (!a.expected_discharge_at) return false;
        const dischTime = new Date(a.expected_discharge_at);
        const hourStart = new Date(forecastTime.getTime() - 3600000);
        return dischTime <= forecastTime && dischTime > hourStart;
      }).length;
    }

    // Admission patterns based on time of day and day of week
    const hourOfDay = forecastTime.getHours();
    const dayOfWeek = forecastTime.getDay();

    let predictedAdmissions = 1;
    // Higher admissions during weekday mornings (8am-2pm)
    if (hourOfDay >= 8 && hourOfDay <= 14 && dayOfWeek >= 1 && dayOfWeek <= 5) {
      predictedAdmissions = 2;
    }
    // Lower admissions overnight
    if (hourOfDay >= 0 && hourOfDay <= 6) {
      predictedAdmissions = 0.5;
    }
    // Weekend adjustment
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      predictedAdmissions *= 0.8;
    }

    // Calculate predicted census
    const predictedCensus = Math.max(0,
      currentCensus - (predictedDischarges * h / 24) + (predictedAdmissions * h / 24)
    );

    const occupancyPct = (predictedCensus / unitData.total_beds) * 100;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (occupancyPct >= 95) riskLevel = 'critical';
    else if (occupancyPct >= 85) riskLevel = 'high';
    else if (occupancyPct >= 75) riskLevel = 'medium';

    forecasts.push({
      hour: h,
      date: forecastTime.toISOString(),
      predicted_census: Math.round(predictedCensus),
      predicted_available: Math.max(0, unitData.total_beds - Math.round(predictedCensus)),
      confidence: {
        lower: Math.max(0, Math.round(predictedCensus * 0.8)),
        upper: Math.min(unitData.total_beds, Math.round(predictedCensus * 1.2))
      },
      risk_level: riskLevel
    });
  }

  // Store forecast in database
  try {
    const forecastDate = now.toISOString().split('T')[0];
    const forecastsToStore = forecasts.slice(0, 24).map(f => ({
      tenant_id: tenantId,
      unit_id: unitId,
      forecast_date: forecastDate,
      forecast_hour: f.hour,
      predicted_census: f.predicted_census,
      confidence_lower: f.confidence.lower,
      confidence_upper: f.confidence.upper
    }));

    await supabase.from('capacity_forecasts').upsert(forecastsToStore, {
      onConflict: 'tenant_id,unit_id,forecast_date,forecast_hour'
    });
  } catch {
    // Ignore storage errors - forecasts table may not exist yet
  }

  return forecasts;
}

async function checkSurgeStatus(
  supabase: SupabaseClient,
  tenantId: string,
  facilityId?: string
): Promise<SurgeStatus> {
  // Get all active units
  let unitsQuery = supabase
    .from('hospital_units')
    .select('id, unit_name, total_beds, target_census, max_census')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (facilityId) {
    unitsQuery = unitsQuery.eq('facility_id', facilityId);
  }

  const { data: units, error: unitsError } = await unitsQuery;

  if (unitsError || !units || units.length === 0) {
    return {
      is_surge: false,
      level: 'normal',
      current_occupancy_pct: 0,
      threshold_pct: 85,
      affected_units: [],
      recommended_actions: []
    };
  }

  const affectedUnits: string[] = [];
  let totalBeds = 0;
  let totalOccupied = 0;

  // Get current occupancy for each unit
  for (const unit of units) {
    const { count } = await supabase
      .from('bed_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('unit_id', unit.id)
      .is('discharged_at', null);

    const occupied = count || 0;
    totalBeds += unit.total_beds;
    totalOccupied += occupied;

    const occupancyPct = (occupied / unit.total_beds) * 100;
    if (occupancyPct >= 90) {
      affectedUnits.push(unit.unit_name);
    }
  }

  const overallOccupancy = totalBeds > 0 ? (totalOccupied / totalBeds) * 100 : 0;

  let level: 'normal' | 'warning' | 'critical' | 'diversion' = 'normal';
  const recommendedActions: string[] = [];

  if (overallOccupancy >= 98) {
    level = 'diversion';
    recommendedActions.push('Activate diversion protocol');
    recommendedActions.push('Contact transfer center for outbound transfers');
    recommendedActions.push('Expedite all pending discharges');
    recommendedActions.push('Review observation patients for potential discharge');
  } else if (overallOccupancy >= 92) {
    level = 'critical';
    recommendedActions.push('Activate surge protocol');
    recommendedActions.push('Review all observation patients for discharge');
    recommendedActions.push('Open overflow areas if available');
    recommendedActions.push('Increase discharge planning rounds');
  } else if (overallOccupancy >= 85) {
    level = 'warning';
    recommendedActions.push('Monitor capacity hourly');
    recommendedActions.push('Accelerate discharge planning');
    recommendedActions.push('Pre-alert bed control team');
  }

  // Log surge event if needed
  if (level !== 'normal') {
    try {
      await supabase.from('surge_events').insert({
        tenant_id: tenantId,
        facility_id: facilityId || null,
        event_type: level === 'diversion' ? 'diversion' :
                    level === 'critical' ? 'capacity_critical' : 'capacity_warning',
        trigger_threshold: 85,
        actual_value: overallOccupancy,
        affected_units: affectedUnits,
        metadata: { total_beds: totalBeds, total_occupied: totalOccupied }
      });
    } catch {
      // Table may not exist yet
    }
  }

  return {
    is_surge: level !== 'normal',
    level,
    current_occupancy_pct: Math.round(overallOccupancy * 10) / 10,
    threshold_pct: 85,
    affected_units: affectedUnits,
    recommended_actions: recommendedActions
  };
}

async function recommendPlacement(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string,
  requirements?: BedOptimizerRequest['requirements']
): Promise<PlacementRecommendation[]> {
  // Find available beds from the bed board view
  const { data: availableBeds, error: bedsError } = await supabase
    .from('v_bed_board')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'available');

  if (bedsError || !availableBeds || availableBeds.length === 0) {
    return [];
  }

  // Score each bed based on requirements and load balancing
  const recommendations: PlacementRecommendation[] = availableBeds.map(bed => {
    let score = 50; // Base score
    const factors = {
      availability: 1.0, // Bed is available
      requirements_match: 0,
      unit_load_balance: 0,
      predicted_turnover: 0
    };

    // Requirements matching
    let reqScore = 1.0;
    if (requirements) {
      if (requirements.requires_telemetry && !bed.has_telemetry) reqScore -= 0.5;
      if (requirements.requires_isolation && !bed.is_isolation) reqScore -= 0.5;
      if (requirements.requires_negative_pressure && !bed.is_negative_pressure) reqScore -= 0.5;
      if (requirements.preferred_unit && bed.unit_id === requirements.preferred_unit) reqScore += 0.3;
      if (requirements.bed_type && bed.bed_type !== requirements.bed_type) reqScore -= 0.3;
    }
    factors.requirements_match = Math.max(0, Math.min(1, reqScore));
    score += factors.requirements_match * 30;

    // Unit load balance (prefer less full units)
    const unitOccupancy = bed.unit_occupancy_pct || 50;
    factors.unit_load_balance = 1 - (unitOccupancy / 100);
    score += factors.unit_load_balance * 15;

    // Predicted turnover (placeholder - could integrate with LOS predictions)
    factors.predicted_turnover = 0.5;
    score += factors.predicted_turnover * 5;

    return {
      bed_id: bed.bed_id || bed.id,
      unit_id: bed.unit_id,
      unit_name: bed.unit_name || 'Unknown',
      room_number: bed.room_number || 'N/A',
      score: Math.round(score * 10) / 10,
      factors
    };
  });

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Store top recommendations
  if (recommendations.length > 0) {
    try {
      const toStore = recommendations.slice(0, 3).map(r => ({
        tenant_id: tenantId,
        patient_id: patientId,
        recommended_bed_id: r.bed_id,
        recommended_unit_id: r.unit_id,
        score: r.score,
        factors: r.factors,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60000).toISOString() // 30 min expiry
      }));

      await supabase.from('placement_recommendations').insert(toStore);
    } catch {
      // Table may not exist yet
    }
  }

  return recommendations.slice(0, 5);
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders, allowed } = corsFromRequest(req);

  // Reject unauthorized origins
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Environment variables
  const SUPABASE_URL = getEnv("SUPABASE_URL");
  const SERVICE_KEY = getEnv("SB_SECRET_KEY", "SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    // For health checks, allow service role
    const body: BedOptimizerRequest = await req.json().catch(() => ({ action: 'health' as const }));

    if (body.action === 'health') {
      return new Response(
        JSON.stringify({ status: 'healthy', agent: 'bed-optimizer' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = body.tenant_id || profile.tenant_id;

    switch (body.action) {
      case 'predict_los': {
        if (!body.diagnosis_category) {
          return new Response(
            JSON.stringify({ error: "diagnosis_category required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const prediction = await predictLOS(
          supabase,
          tenantId,
          body.diagnosis_category,
          body.unit_id
        );

        logger.info("LOS prediction generated", {
          tenant_id: tenantId,
          diagnosis: body.diagnosis_category,
          predicted_hours: prediction.predicted_los_hours
        });

        return new Response(
          JSON.stringify({ success: true, prediction }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'forecast_capacity': {
        if (!body.unit_id) {
          return new Response(
            JSON.stringify({ error: "unit_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const forecasts = await forecastCapacity(
          supabase,
          tenantId,
          body.unit_id,
          body.forecast_hours || 24
        );

        logger.info("Capacity forecast generated", {
          tenant_id: tenantId,
          unit_id: body.unit_id,
          hours_ahead: body.forecast_hours || 24
        });

        return new Response(
          JSON.stringify({ success: true, forecasts }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'check_surge': {
        const surgeStatus = await checkSurgeStatus(
          supabase,
          tenantId,
          body.facility_id
        );

        if (surgeStatus.is_surge) {
          logger.warn("Surge condition detected", {
            tenant_id: tenantId,
            facility_id: body.facility_id,
            level: surgeStatus.level,
            occupancy: surgeStatus.current_occupancy_pct
          });
        }

        return new Response(
          JSON.stringify({ success: true, surge: surgeStatus }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'recommend_placement': {
        if (!body.patient_id) {
          return new Response(
            JSON.stringify({ error: "patient_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const recommendations = await recommendPlacement(
          supabase,
          tenantId,
          body.patient_id,
          body.requirements
        );

        logger.info("Placement recommendations generated", {
          tenant_id: tenantId,
          patient_id: body.patient_id,
          recommendation_count: recommendations.length
        });

        return new Response(
          JSON.stringify({ success: true, recommendations }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'optimize_throughput': {
        // Placeholder for throughput optimization
        // Would analyze discharge patterns, EVS turnaround, etc.
        return new Response(
          JSON.stringify({
            success: true,
            message: "Throughput optimization analysis not yet implemented",
            recommendations: [],
            metrics: {
              avg_turnaround_minutes: null,
              bottlenecks: [],
              improvement_opportunities: []
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: "Invalid action",
            valid_actions: ['predict_los', 'forecast_capacity', 'check_surge', 'recommend_placement', 'optimize_throughput', 'health']
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Bed optimizer error", { error: errorMessage });

    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
