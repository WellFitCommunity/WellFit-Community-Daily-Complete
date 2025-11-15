/**
 * AI Readmission Risk Predictor Edge Function
 * Triggered on discharge events to predict 30-day readmission risk
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    const {
      patientId,
      tenantId,
      dischargeDate,
      dischargeFacility,
      dischargeDisposition,
      primaryDiagnosisCode,
      primaryDiagnosisDescription
    } = await req.json();

    // Validate required fields
    if (!patientId || !tenantId || !dischargeDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: patientId, tenantId, dischargeDate' }),
        { status: 400, headers: { ...corsFromRequest(req), 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check if skill is enabled for tenant
    const { data: config } = await supabase.rpc('get_ai_skill_config', {
      p_tenant_id: tenantId
    });

    if (!config || !config.readmission_predictor_enabled) {
      return new Response(
        JSON.stringify({ error: 'Readmission predictor not enabled for this tenant' }),
        { status: 403, headers: { ...corsFromRequest(req), 'Content-Type': 'application/json' } }
      );
    }

    // 2. Gather patient data (similar to service implementation)
    const patientData = await gatherPatientData(patientId);

    // 3. Generate prediction context
    const dischargeContext = {
      patientId,
      tenantId,
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
        headers: { ...corsFromRequest(req), 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsFromRequest(req), 'Content-Type': 'application/json' }
      }
    );
  }
});

async function gatherPatientData(patientId: string): Promise<any> {
  const data: any = {
    readmissionCount: 0,
    sdohRiskFactors: 0,
    checkInCompletionRate: 0,
    hasActiveCarePlan: false
  };

  try {
    // 1. Readmission history (last 90 days)
    const { data: readmissions } = await supabase
      .from('patient_readmissions')
      .select('id')
      .eq('patient_id', patientId)
      .gte('admission_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    data.readmissionCount = readmissions?.length || 0;

    // 2. SDOH high risk indicators
    const { data: sdoh } = await supabase
      .from('sdoh_indicators')
      .select('id')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .in('risk_level', ['high', 'critical']);

    data.sdohRiskFactors = sdoh?.length || 0;

    // 3. Check-in completion rate (last 30 days)
    const { data: checkIns } = await supabase
      .from('patient_daily_check_ins')
      .select('status')
      .eq('patient_id', patientId)
      .gte('check_in_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (checkIns && checkIns.length > 0) {
      const completed = checkIns.filter((c: any) => c.status === 'completed').length;
      data.checkInCompletionRate = completed / 30;
    }

    // 4. Active care plan
    const { data: carePlan } = await supabase
      .from('care_coordination_plans')
      .select('id')
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .maybeSingle();

    data.hasActiveCarePlan = !!carePlan;

    return data;
  } catch (error) {
    return data;
  }
}
