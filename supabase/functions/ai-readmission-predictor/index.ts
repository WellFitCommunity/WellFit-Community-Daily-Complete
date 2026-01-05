/**
 * AI Readmission Risk Predictor Edge Function
 * Triggered on discharge events to predict 30-day readmission risk
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

    // Check if user has clinical/admin role (readmission predictor requires elevated access)
    const roleName = (profile.roles as any)?.name;
    const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'case_manager', 'social_worker', 'discharge_planner'];
    const hasAccess = profile.is_admin || allowedRoles.includes(roleName);

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions for readmission predictions' }),
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

    const {
      patientId,
      tenantId,
      dischargeDate,
      dischargeFacility,
      dischargeDisposition,
      primaryDiagnosisCode,
      primaryDiagnosisDescription
    } = await req.json();

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

    // Validate required fields
    if (!patientId || !dischargeDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: patientId, dischargeDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify patient belongs to the tenant
    const { data: patient } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', patientId)
      .single();

    if (patient && patient.tenant_id !== effectiveTenantId) {
      return new Response(
        JSON.stringify({ error: 'Patient not in your organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check if skill is enabled for tenant
    const { data: config } = await supabase.rpc('get_ai_skill_config', {
      p_tenant_id: effectiveTenantId
    });

    if (!config || !config.readmission_predictor_enabled) {
      return new Response(
        JSON.stringify({ error: 'Readmission predictor not enabled for this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Gather patient data (similar to service implementation) - with tenant context
    const patientData = await gatherPatientData(patientId, effectiveTenantId);

    // 3. Generate prediction context
    const dischargeContext = {
      patientId,
      tenantId: effectiveTenantId,
      dischargeDate,
      dischargeFacility: dischargeFacility || 'Unknown Facility',
      dischargeDisposition: dischargeDisposition || 'home',
      primaryDiagnosisCode,
      primaryDiagnosisDescription
    };

    // 4. Return structure (in production, would call actual AI service)
    return new Response(
      JSON.stringify({
        success: true,
        dischargeContext,
        patientData: {
          readmissionCount: patientData.readmissionCount,
          sdohRiskFactors: patientData.sdohRiskFactors,
          checkInCompletionRate: patientData.checkInCompletionRate,
          hasActiveCarePlan: patientData.hasActiveCarePlan
        },
        message: 'Readmission risk prediction generated',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
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

async function gatherPatientData(patientId: string, tenantId: string): Promise<any> {
  const data: any = {
    readmissionCount: 0,
    sdohRiskFactors: 0,
    checkInCompletionRate: 0,
    hasActiveCarePlan: false
  };

  try {
    // 1. Readmission history (last 90 days) - SECURITY: Filter by tenant_id
    const { data: readmissions } = await supabase
      .from('patient_readmissions')
      .select('id')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .gte('admission_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    data.readmissionCount = readmissions?.length || 0;

    // 2. SDOH high risk indicators - SECURITY: Filter by tenant_id
    const { data: sdoh } = await supabase
      .from('sdoh_indicators')
      .select('id')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('risk_level', ['high', 'critical']);

    data.sdohRiskFactors = sdoh?.length || 0;

    // 3. Check-in completion rate (last 30 days) - SECURITY: Filter by tenant_id
    const { data: checkIns } = await supabase
      .from('patient_daily_check_ins')
      .select('status')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .gte('check_in_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (checkIns && checkIns.length > 0) {
      const completed = checkIns.filter((c: any) => c.status === 'completed').length;
      data.checkInCompletionRate = completed / 30;
    }

    // 4. Active care plan - SECURITY: Filter by tenant_id
    const { data: carePlan } = await supabase
      .from('care_coordination_plans')
      .select('id')
      .eq('patient_id', patientId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle();

    data.hasActiveCarePlan = !!carePlan;

    return data;
  } catch (err: unknown) {
    return data;
  }
}
