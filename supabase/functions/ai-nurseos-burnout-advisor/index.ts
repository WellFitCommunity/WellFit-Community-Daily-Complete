/**
 * AI NurseOS Burnout Advisor Edge Function
 *
 * Analyzes MBI burnout assessment + daily check-in patterns to generate
 * personalized intervention recommendations for healthcare providers.
 *
 * Skill: nurseos_burnout_advisor (Sonnet — clinical analysis)
 * Tracker: docs/trackers/nurseos-completion-tracker.md (P4-1, P4-2)
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { SONNET_MODEL, calculateModelCost } from "../_shared/models.ts";
import { recordDecisionLink } from "../_shared/decisionChain.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// ============================================================================
// Types
// ============================================================================

interface AdvisorRequest {
  providerId: string;
  assessmentId?: string;
  tenantId?: string;
}

interface BurnoutAdvisorResponse {
  risk_summary: string;
  risk_level: "low" | "moderate" | "high" | "critical";
  primary_concern: string;
  intervention_recommendations: InterventionRecommendation[];
  self_care_suggestions: string[];
  escalation_needed: boolean;
  escalation_reason: string | null;
  confidence: number;
}

interface InterventionRecommendation {
  type: "immediate" | "short_term" | "long_term";
  action: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger("ai-nurseos-burnout-advisor", req);

  try {
    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AdvisorRequest = await req.json();
    const { providerId, assessmentId } = body;

    if (!providerId) {
      return new Response(
        JSON.stringify({ error: "providerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("NURSEOS_BURNOUT_ADVISOR_START", { providerId, assessmentId });

    const supabase = createAdminClient();

    // Fetch provider data in parallel
    const [assessmentResult, checkinsResult, completionsResult] = await Promise.all([
      assessmentId
        ? supabase
            .from("provider_burnout_assessments")
            .select("emotional_exhaustion_score, depersonalization_score, personal_accomplishment_score, composite_burnout_score, risk_level, intervention_triggered, assessment_date")
            .eq("id", assessmentId)
            .single()
        : supabase
            .from("provider_burnout_assessments")
            .select("emotional_exhaustion_score, depersonalization_score, personal_accomplishment_score, composite_burnout_score, risk_level, intervention_triggered, assessment_date")
            .eq("practitioner_id", providerId)
            .order("assessment_date", { ascending: false })
            .limit(1)
            .single(),
      supabase
        .from("provider_daily_checkins")
        .select("stress_level, energy_level, mood_rating, work_setting, shift_type, patient_census, overtime_hours, felt_overwhelmed, unsafe_staffing, missed_break, checkin_date")
        .eq("practitioner_id", providerId)
        .order("checkin_date", { ascending: false })
        .limit(14),
      supabase
        .from("provider_training_completions")
        .select("module_id, completed_at")
        .eq("practitioner_id", providerId)
        .order("completed_at", { ascending: false })
        .limit(10),
    ]);

    const assessment = assessmentResult.data;
    const checkins = checkinsResult.data ?? [];
    const completions = completionsResult.data ?? [];

    if (!assessment) {
      return new Response(
        JSON.stringify({ error: "No burnout assessment found for this provider" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt
    const prompt = buildAdvisorPrompt(assessment, checkins, completions);

    // Call Claude
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
        system: "You are a clinical burnout prevention advisor for healthcare workers. Respond ONLY with valid JSON matching the specified schema. Base recommendations on evidence-based burnout prevention strategies (MBI framework, NIOSH Total Worker Health). Never minimize burnout symptoms. Always recommend professional help for critical risk levels.",
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error("NURSEOS_BURNOUT_ADVISOR_AI_ERROR", { status: aiResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text;
    if (!content) {
      logger.error("NURSEOS_BURNOUT_ADVISOR_EMPTY_RESPONSE", { providerId });
      return new Response(
        JSON.stringify({ error: "AI returned empty response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse structured response
    let advisorResponse: BurnoutAdvisorResponse;
    try {
      advisorResponse = JSON.parse(content) as BurnoutAdvisorResponse;
    } catch {
      logger.error("NURSEOS_BURNOUT_ADVISOR_PARSE_ERROR", { providerId, rawContent: content.substring(0, 200) });
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate cost
    const inputTokens = aiResult.usage?.input_tokens ?? 0;
    const outputTokens = aiResult.usage?.output_tokens ?? 0;
    const cost = calculateModelCost(SONNET_MODEL, inputTokens, outputTokens);

    // Record decision chain
    await recordDecisionLink({
      skill_key: "nurseos_burnout_advisor",
      trigger_type: "user_request",
      decision_type: "clinical",
      input_summary: `Provider ${providerId} burnout analysis: EE=${assessment.emotional_exhaustion_score}, DP=${assessment.depersonalization_score}, PA=${assessment.personal_accomplishment_score}`,
      output_summary: `Risk: ${advisorResponse.risk_level}, Escalation: ${advisorResponse.escalation_needed}, Recommendations: ${advisorResponse.intervention_recommendations.length}`,
      model_used: SONNET_MODEL,
      confidence_score: advisorResponse.confidence,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
    });

    logger.info("NURSEOS_BURNOUT_ADVISOR_COMPLETE", {
      providerId,
      riskLevel: advisorResponse.risk_level,
      escalationNeeded: advisorResponse.escalation_needed,
      recommendationCount: advisorResponse.intervention_recommendations.length,
      inputTokens,
      outputTokens,
      cost,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: advisorResponse,
        metadata: {
          model: SONNET_MODEL,
          skill_key: "nurseos_burnout_advisor",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: cost,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("NURSEOS_BURNOUT_ADVISOR_FAILED", { error: error.message });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Prompt Builder
// ============================================================================

function buildAdvisorPrompt(
  assessment: Record<string, unknown>,
  checkins: Record<string, unknown>[],
  completions: Record<string, unknown>[]
): string {
  const recentStress = checkins.length > 0
    ? checkins.map(c => `${(c as Record<string, unknown>).checkin_date}: stress=${(c as Record<string, unknown>).stress_level}/10, energy=${(c as Record<string, unknown>).energy_level}/10, mood=${(c as Record<string, unknown>).mood_rating}/10`).join("\n  ")
    : "No recent check-ins available";

  const workloadFactors = checkins
    .filter(c => (c as Record<string, unknown>).felt_overwhelmed || (c as Record<string, unknown>).unsafe_staffing || (c as Record<string, unknown>).missed_break)
    .map(c => {
      const factors: string[] = [];
      if ((c as Record<string, unknown>).felt_overwhelmed) factors.push("felt overwhelmed");
      if ((c as Record<string, unknown>).unsafe_staffing) factors.push("unsafe staffing");
      if ((c as Record<string, unknown>).missed_break) factors.push("missed break");
      return `${(c as Record<string, unknown>).checkin_date}: ${factors.join(", ")}`;
    })
    .join("\n  ");

  return `Analyze this healthcare provider's burnout data and provide structured recommendations.

## MBI Assessment (Most Recent)
- Emotional Exhaustion Score: ${assessment.emotional_exhaustion_score}/54 (high ≥27)
- Depersonalization Score: ${assessment.depersonalization_score}/30 (high ≥13)
- Personal Accomplishment Score: ${assessment.personal_accomplishment_score}/48 (low ≤21 is concerning)
- Composite Burnout Score: ${assessment.composite_burnout_score ?? "not calculated"}/100
- Current Risk Level: ${assessment.risk_level ?? "unknown"}
- Assessment Date: ${assessment.assessment_date}
- Intervention Previously Triggered: ${assessment.intervention_triggered}

## Daily Check-In Trends (Last 14 Days)
  ${recentStress}

## Workload Red Flags
  ${workloadFactors || "None reported"}

## Training Completions (Recent)
  ${completions.length > 0 ? completions.map(c => `Module ${(c as Record<string, unknown>).module_id} completed ${(c as Record<string, unknown>).completed_at}`).join("\n  ") : "No modules completed yet"}

## Response Schema (respond with ONLY this JSON, no other text):
{
  "risk_summary": "2-3 sentence plain-language summary of burnout status",
  "risk_level": "low|moderate|high|critical",
  "primary_concern": "single most important concern to address",
  "intervention_recommendations": [
    {
      "type": "immediate|short_term|long_term",
      "action": "specific actionable recommendation",
      "rationale": "why this helps based on their data",
      "priority": "high|medium|low"
    }
  ],
  "self_care_suggestions": ["3-5 specific, actionable self-care activities"],
  "escalation_needed": true/false,
  "escalation_reason": "reason or null",
  "confidence": 0.0-1.0
}

RULES:
- For critical risk: ALWAYS set escalation_needed=true and recommend EAP referral
- For high risk: recommend peer support + supervisor notification
- Base recommendations on their specific MBI dimension scores, not just composite
- Reference their check-in trends to identify temporal patterns
- If no check-ins available, note reduced confidence
- Never dismiss or minimize burnout symptoms`;
}
