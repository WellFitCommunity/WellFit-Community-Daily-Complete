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
import { runReasoningPipeline, serializeReasoningForClient } from '../_shared/compass-riley/reasoningPipeline.ts';
import type { ReasoningEncounterInput } from '../_shared/compass-riley/types.ts';
import { createLogger } from '../_shared/auditLogger.ts';
import { fetchCulturalContext, formatCulturalContextCompact } from '../_shared/culturalCompetencyClient.ts';
import { recordDecisionLink } from '../_shared/decisionChain.ts';

const SERVICE_KEY = SB_SECRET_KEY!;

const supabase = createClient(SUPABASE_URL!, SERVICE_KEY, {
  auth: { persistSession: false }
});

// Patient readmission data interface
interface PatientReadmissionData {
  readmissionCount: number;
  sdohRiskFactors: number;
  checkInCompletionRate: number;
  hasActiveCarePlan: boolean;
}

// Check-in status record
interface CheckInRecord {
  status: string;
}

// Profile with joined role data
interface ProfileWithRole {
  tenant_id: string | null;
  is_admin: boolean;
  role_id: string | null;
  roles: { name: string } | null;
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

    // Check if user has clinical/admin role (readmission predictor requires elevated access)
    const typedProfile = profile as unknown as ProfileWithRole;
    const roleName = typedProfile.roles?.name;
    const allowedRoles = ['admin', 'super_admin', 'physician', 'nurse', 'case_manager', 'social_worker', 'discharge_planner'];
    const hasAccess = profile.is_admin || (roleName ? allowedRoles.includes(roleName) : false);

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

    let requestBody: Record<string, unknown>;
    try {
      requestBody = await req.json();
    } catch (_parseErr: unknown) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty request body — expected JSON with patientId and dischargeDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const patientId = requestBody.patientId as string | undefined;
    const tenantId = requestBody.tenantId as string | undefined;
    const dischargeDate = requestBody.dischargeDate as string | undefined;
    const dischargeFacility = requestBody.dischargeFacility as string | undefined;
    const dischargeDisposition = requestBody.dischargeDisposition as string | undefined;
    const primaryDiagnosisCode = requestBody.primaryDiagnosisCode as string | undefined;
    const primaryDiagnosisDescription = requestBody.primaryDiagnosisDescription as string | undefined;
    const populationHints = requestBody.populationHints as Record<string, unknown> | undefined;

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

    // 4a. Fetch cultural competency context if population hints are provided
    const readmissionLogger = createLogger('ai-readmission-predictor', req);
    let culturalBarrierNotes: string[] = [];
    let reasoningCulturalContext: ReasoningEncounterInput['culturalContext'];
    if (populationHints && Array.isArray(populationHints) && populationHints.length > 0) {
      const culturalContexts = await Promise.all(
        populationHints.map((pop: string) => fetchCulturalContext(pop, readmissionLogger))
      );
      const validContexts = culturalContexts.filter(
        (ctx): ctx is NonNullable<typeof ctx> => ctx !== null
      );
      if (validContexts.length > 0) {
        culturalBarrierNotes = validContexts.flatMap((ctx) =>
          ctx.barriers.map((b) => `${b.barrier}: ${b.impact}`)
        );
        reasoningCulturalContext = {
          populations: validContexts.map((c) => c.population),
          barriers: validContexts.flatMap((ctx) => ctx.barriers.map((b) => b.barrier)),
          clinicalNotes: validContexts.flatMap((ctx) =>
            ctx.clinicalConsiderations.slice(0, 2).map((cc) => `${cc.condition}: ${cc.clinicalNote}`)
          ),
        };
        readmissionLogger.info("Cultural context injected into readmission predictor", {
          populations: validContexts.map((c) => c.population),
        });
      }
    }

    // 4b. Session 2: Run CoT/ToT reasoning to determine prediction complexity
    const { data: tenantSkillConfig } = await supabase
      .from('tenant_ai_skill_config')
      .select('settings')
      .eq('tenant_id', effectiveTenantId)
      .eq('skill_key', 'compass_riley')
      .maybeSingle();

    const reasoningInput: ReasoningEncounterInput = {
      chiefComplaint: primaryDiagnosisDescription ?? 'Discharge readmission risk assessment',
      diagnoses: primaryDiagnosisCode ? [{
        condition: primaryDiagnosisDescription || primaryDiagnosisCode,
        icd10: primaryDiagnosisCode,
        confidence: patientData.hasActiveCarePlan ? 0.7 : 0.5,
        supportingEvidence: [
          ...(patientData.readmissionCount > 0 ? [`${patientData.readmissionCount} prior readmissions in 90 days`] : []),
          ...(patientData.sdohRiskFactors > 0 ? [`${patientData.sdohRiskFactors} active SDOH risk factors`] : []),
          ...culturalBarrierNotes.slice(0, 3),
        ],
        refutingEvidence: [
          ...(patientData.hasActiveCarePlan ? ['Active care plan in place'] : []),
          ...(patientData.checkInCompletionRate > 0.8 ? ['High check-in compliance'] : []),
        ],
        status: 'working' as const,
      }] : [],
      medications: [],
      mdmComplexity: {
        riskLevel: patientData.readmissionCount >= 2 || patientData.sdohRiskFactors >= 3 ? 'high' : 'moderate',
      },
      completeness: { overallPercent: 60, expectedButMissing: ['medication reconciliation', 'follow-up plan'] },
      driftState: { driftDetected: false },
      patientSafety: { emergencyDetected: false },
      analysisCount: 1,
      transcriptWordCount: 100,
      culturalContext: reasoningCulturalContext,
    };

    const tenantSettings = (tenantSkillConfig?.settings ?? null) as Record<string, unknown> | null;
    const reasoningResult = runReasoningPipeline(reasoningInput, tenantSettings, 'auto');

    // 5. Record decision chain (fire-and-forget)
    const riskLevel = patientData.readmissionCount >= 2 || patientData.sdohRiskFactors >= 3 ? 'high' : 'moderate';
    recordDecisionLink({
      tenant_id: effectiveTenantId,
      trigger_type: 'system_event',
      trigger_source: 'ai-readmission-predictor',
      context_snapshot: { patient_id: patientId, discharge_date: dischargeDate },
      model_id: 'compass-riley-' + reasoningResult.modeUsed,
      skill_key: 'readmission_predictor',
      decision_type: 'clinical',
      decision_summary: `Readmission risk: ${riskLevel} (${patientData.readmissionCount} prior readmissions, ${patientData.sdohRiskFactors} SDOH risk factors)`,
      confidence_score: (reasoningResult.triggerResult.confidenceScore ?? 70) / 100,
      authority_tier: 1,
      action_taken: 'Readmission risk prediction returned to clinician',
      outcome: 'success',
    }).catch(() => { /* fire-and-forget */ });

    // 6. Return structure with reasoning metadata
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
        reasoning: serializeReasoningForClient(reasoningResult),
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

async function gatherPatientData(patientId: string, tenantId: string): Promise<PatientReadmissionData> {
  const data: PatientReadmissionData = {
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
      const typedCheckIns = checkIns as CheckInRecord[];
      const completed = typedCheckIns.filter((c) => c.status === 'completed').length;
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
