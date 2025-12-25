/**
 * Bed Management Edge Function
 *
 * Handles bed operations for the Predictive Bed Management System:
 * - Get bed board (real-time view of all beds)
 * - Get unit capacity summary
 * - Assign patient to bed
 * - Discharge patient (release bed)
 * - Update bed status
 * - Generate bed forecast
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

/** Prefer robust, side-effect-free env reads */
const getEnv = (...keys: string[]): string => {
  for (const k of keys) {
    const v = Deno.env.get(k);
    if (v && v.trim().length > 0) return v.trim();
  }
  return "";
};

interface BedManagementRequest {
  action: 'get_bed_board' | 'get_unit_capacity' | 'assign_bed' | 'discharge' |
          'update_status' | 'find_available' | 'generate_forecast' | 'get_census';
  unit_id?: string;
  facility_id?: string;
  bed_id?: string;
  patient_id?: string;
  expected_los_days?: number;
  disposition?: string;
  new_status?: string;
  reason?: string;
  requires_telemetry?: boolean;
  requires_isolation?: boolean;
  requires_negative_pressure?: boolean;
  bed_type?: string;
  forecast_date?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const logger = createLogger('bed-management', req);

  // Handle CORS
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Environment variables
  const SUPABASE_URL = getEnv("SB_URL", "SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = getEnv("SB_SERVICE_ROLE_KEY", "SB_SECRET_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get authorization header for user context
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Create authenticated Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, tenant_id, is_admin')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check role authorization
    const allowedRoles = ['admin', 'super_admin', 'nurse', 'care_manager', 'bed_control', 'physician'];
    if (!allowedRoles.includes(profile.role) && !profile.is_admin) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions for bed management" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: BedManagementRequest = req.method === 'POST'
      ? await req.json().catch(() => ({ action: 'get_bed_board' }))
      : { action: 'get_bed_board' };

    const { action } = body;

    switch (action) {
      case 'get_bed_board': {
        // Get real-time bed board view
        const { unit_id, facility_id } = body;

        let query = supabase
          .from('v_bed_board')
          .select('*')
          .eq('tenant_id', profile.tenant_id);

        if (unit_id) query = query.eq('unit_id', unit_id);
        if (facility_id) query = query.eq('facility_id', facility_id);

        const { data, error } = await query.order('unit_name').order('room_number');

        if (error) {
          logger.error("Failed to fetch bed board", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to fetch bed board" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, beds: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_unit_capacity': {
        // Get unit capacity summary
        const { unit_id, facility_id } = body;

        let query = supabase
          .from('v_unit_capacity')
          .select('*')
          .eq('tenant_id', profile.tenant_id);

        if (unit_id) query = query.eq('unit_id', unit_id);
        if (facility_id) {
          // Join with hospital_units to filter by facility
          query = supabase
            .from('hospital_units')
            .select(`
              id,
              unit_code,
              unit_name,
              unit_type,
              total_beds,
              target_census,
              max_census,
              facility_id
            `)
            .eq('tenant_id', profile.tenant_id)
            .eq('facility_id', facility_id)
            .eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
          logger.error("Failed to fetch unit capacity", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to fetch unit capacity" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, units: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_census': {
        // Get real-time census for a unit
        const { unit_id } = body;

        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "unit_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase.rpc('get_unit_census', {
          p_unit_id: unit_id
        });

        if (error) {
          logger.error("Failed to get unit census", { error: error.message, unit_id });
          return new Response(
            JSON.stringify({ error: "Failed to get census" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, census: data?.[0] || null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'find_available': {
        // Find available beds matching criteria
        const {
          unit_id,
          bed_type,
          requires_telemetry = false,
          requires_isolation = false,
          requires_negative_pressure = false
        } = body;

        const { data, error } = await supabase.rpc('find_available_beds', {
          p_unit_id: unit_id || null,
          p_bed_type: bed_type || null,
          p_requires_telemetry: requires_telemetry,
          p_requires_isolation: requires_isolation,
          p_requires_negative_pressure: requires_negative_pressure,
          p_limit: 20
        });

        if (error) {
          logger.error("Failed to find available beds", { error: error.message });
          return new Response(
            JSON.stringify({ error: "Failed to find available beds" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, available_beds: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'assign_bed': {
        // Assign patient to bed
        const { patient_id, bed_id, expected_los_days } = body;

        if (!patient_id || !bed_id) {
          return new Response(
            JSON.stringify({ error: "patient_id and bed_id are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase.rpc('assign_patient_to_bed', {
          p_patient_id: patient_id,
          p_bed_id: bed_id,
          p_expected_los_days: expected_los_days || null,
          p_adt_source: 'manual'
        });

        if (error) {
          logger.error("Failed to assign bed", {
            error: error.message,
            patient_id,
            bed_id
          });
          return new Response(
            JSON.stringify({ error: error.message || "Failed to assign bed" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logger.info("Patient assigned to bed", {
          patient_id,
          bed_id,
          assignment_id: data,
          assigned_by: user.id
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'BED_ASSIGNED',
          resource_type: 'bed_assignment',
          resource_id: data,
          metadata: { patient_id, bed_id, expected_los_days }
        }).catch(() => {});

        return new Response(
          JSON.stringify({
            success: true,
            assignment_id: data,
            message: "Patient assigned to bed successfully"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'discharge': {
        // Discharge patient
        const { patient_id, disposition = 'Home' } = body;

        if (!patient_id) {
          return new Response(
            JSON.stringify({ error: "patient_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase.rpc('discharge_patient', {
          p_patient_id: patient_id,
          p_disposition: disposition
        });

        if (error) {
          logger.error("Failed to discharge patient", {
            error: error.message,
            patient_id
          });
          return new Response(
            JSON.stringify({ error: "Failed to discharge patient" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: "Patient not found or not assigned to a bed" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logger.info("Patient discharged", {
          patient_id,
          disposition,
          discharged_by: user.id
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'PATIENT_DISCHARGED',
          resource_type: 'bed_assignment',
          resource_id: patient_id,
          metadata: { disposition }
        }).catch(() => {});

        return new Response(
          JSON.stringify({
            success: true,
            message: "Patient discharged successfully"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'update_status': {
        // Update bed status
        const { bed_id, new_status, reason } = body;

        if (!bed_id || !new_status) {
          return new Response(
            JSON.stringify({ error: "bed_id and new_status are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const validStatuses = ['available', 'occupied', 'dirty', 'cleaning', 'blocked', 'maintenance', 'reserved'];
        if (!validStatuses.includes(new_status)) {
          return new Response(
            JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase.rpc('update_bed_status', {
          p_bed_id: bed_id,
          p_new_status: new_status,
          p_reason: reason || null
        });

        if (error) {
          logger.error("Failed to update bed status", {
            error: error.message,
            bed_id,
            new_status
          });
          return new Response(
            JSON.stringify({ error: "Failed to update bed status" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!data) {
          return new Response(
            JSON.stringify({ error: "Bed not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logger.info("Bed status updated", {
          bed_id,
          new_status,
          reason,
          updated_by: user.id
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: `Bed status updated to ${new_status}`
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'generate_forecast': {
        // Generate bed availability forecast
        const { unit_id, forecast_date } = body;

        if (!unit_id) {
          return new Response(
            JSON.stringify({ error: "unit_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const targetDate = forecast_date || new Date().toISOString().split('T')[0];

        const { data, error } = await supabase.rpc('generate_bed_forecast', {
          p_unit_id: unit_id,
          p_forecast_date: targetDate
        });

        if (error) {
          logger.error("Failed to generate forecast", {
            error: error.message,
            unit_id,
            forecast_date: targetDate
          });
          return new Response(
            JSON.stringify({ error: "Failed to generate forecast" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch the generated forecast
        const { data: forecast } = await supabase
          .from('bed_availability_forecasts')
          .select('*')
          .eq('id', data)
          .single();

        logger.info("Forecast generated", {
          unit_id,
          forecast_date: targetDate,
          forecast_id: data
        });

        return new Response(
          JSON.stringify({
            success: true,
            forecast_id: data,
            forecast
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: "Invalid action",
            valid_actions: [
              'get_bed_board', 'get_unit_capacity', 'get_census',
              'find_available', 'assign_bed', 'discharge',
              'update_status', 'generate_forecast'
            ]
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Fatal error in bed-management", { error: msg });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
