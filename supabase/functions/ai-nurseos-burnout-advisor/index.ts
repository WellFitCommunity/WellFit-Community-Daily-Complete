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
import { requireUser } from "../_shared/auth.ts";
import { checkPersistentRateLimit, MCP_RATE_LIMITS } from "../_shared/mcpRateLimiter.ts";

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
// Structured Output Schema (CLAUDE.md Rule #16)
//
// Forces Claude to return JSON matching BurnoutAdvisorResponse via the
// Anthropic tool_choice pattern. Guarantees structure without regex parsing.
// ============================================================================

const BURNOUT_ADVISOR_TOOL = {
  name: "submit_burnout_advice",
  description: "Submit the structured burnout advisor analysis result",
  input_schema: {
    type: "object" as const,
    required: [
      "risk_summary",
      "risk_level",
      "primary_concern",
      "intervention_recommendations",
      "self_care_suggestions",
      "escalation_needed",
      "escalation_reason",
      "confidence",
    ],
    properties: {
      risk_summary: {
        type: "string" as const,
        description: "2-3 sentence plain-language summary of burnout status",
      },
      risk_level: {
        type: "string" as const,
        enum: ["low", "moderate", "high", "critical"],
      },
      primary_concern: {
        type: "string" as const,
        description: "Single most important concern to address",
      },
      intervention_recommendations: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["type", "action", "rationale", "priority"],
          properties: {
            type: {
              type: "string" as const,
              enum: ["immediate", "short_term", "long_term"],
            },
            action: { type: "string" as const },
            rationale: { type: "string" as const },
            priority: {
              type: "string" as const,
              enum: ["high", "medium", "low"],
            },
          },
        },
      },
      self_care_suggestions: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "3-5 specific, actionable self-care activities",
      },
      escalation_needed: { type: "boolean" as const },
      escalation_reason: {
        type: ["string", "null"] as unknown as "string",
        description: "Reason for escalation, or null if not needed",
      },
      confidence: {
        type: "number" as const,
        description: "Confidence score 0.0 to 1.0",
      },
    },
  },
};

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
    // Auth gate — require valid JWT
    let user;
    try {
      user = await requireUser(req);
    } catch (authResponse: unknown) {
      if (authResponse instanceof Response) return authResponse;
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createAdminClient();

    // Resolve caller's profile (tenant + role) for authorization.
    // NOTE: profiles uses user_id, NOT id (adversarial-audit-lessons.md Rule 8)
    const { data: callerProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, tenant_id, role_id, roles:role_id ( id, name )")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr || !callerProfile) {
      logger.error("NURSEOS_BURNOUT_ADVISOR_PROFILE_LOOKUP_FAILED", {
        userId: user.id,
        error: profileErr?.message ?? "no profile",
      });
      return new Response(
        JSON.stringify({ error: "Caller profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Supabase join returns object for single FK, but TS types it as array — handle both
    const rolesRaw = callerProfile.roles as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const roleName = Array.isArray(rolesRaw) ? rolesRaw[0]?.name ?? null : rolesRaw?.name ?? null;

    // Resolve caller's own practitioner_id (if they are a practitioner) for self-access check.
    // profiles does NOT have practitioner_id — the link lives on fhir_practitioners.user_id.
    const { data: callerPractitioner } = await supabase
      .from("fhir_practitioners")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const callerPractitionerId: string | null = callerPractitioner?.id ?? null;

    const body: AdvisorRequest = await req.json();
    const { providerId, assessmentId } = body;

    if (!providerId) {
      return new Response(
        JSON.stringify({ error: "providerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // AUTHORIZATION GATE
    // Per HIPAA § 164.502 (minimum necessary) and § 164.312 (access control):
    //   - Self-access: always allowed
    //   - Admin/care_manager/super_admin/department_head: allowed but audit-logged
    //   - Otherwise: 403
    // Also enforce tenant isolation (unless super_admin).
    // ========================================================================
    const ADMIN_ROLES = ["admin", "care_manager", "super_admin", "department_head"];
    const isSelfAccess = callerPractitionerId !== null && callerPractitionerId === providerId;
    const isAdminAccess = !isSelfAccess && roleName !== null && ADMIN_ROLES.includes(roleName);

    if (!isSelfAccess && !isAdminAccess) {
      logger.warn("NURSEOS_BURNOUT_ADVISOR_FORBIDDEN", {
        callerUserId: user.id,
        callerRole: roleName,
        targetProviderId: providerId,
      });
      return new Response(
        JSON.stringify({
          error: "Forbidden — cannot access another provider's burnout data",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Tenant isolation — target practitioner must share caller's tenant
    // (super_admin bypass for cross-tenant operations).
    if (!isSelfAccess && roleName !== "super_admin") {
      const { data: targetPractitioner, error: targetErr } = await supabase
        .from("fhir_practitioners")
        .select("user_id")
        .eq("id", providerId)
        .maybeSingle();

      if (targetErr || !targetPractitioner?.user_id) {
        logger.warn("NURSEOS_BURNOUT_ADVISOR_TARGET_NOT_FOUND", {
          targetProviderId: providerId,
          error: targetErr?.message,
        });
        return new Response(
          JSON.stringify({ error: "Target provider not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", targetPractitioner.user_id)
        .maybeSingle();

      const targetTenantId = targetProfile?.tenant_id ?? null;
      if (!targetTenantId || targetTenantId !== callerProfile.tenant_id) {
        // Audit the cross-tenant block before refusing
        try {
          await supabase.from("audit_logs").insert({
            event_type: "BURNOUT_ADVISOR_CROSS_TENANT_BLOCKED",
            event_category: "PHI_ACCESS",
            actor_user_id: user.id,
            actor_ip_address:
              req.headers.get("x-forwarded-for") ||
              req.headers.get("cf-connecting-ip"),
            actor_user_agent: req.headers.get("user-agent"),
            operation: "NURSEOS_BURNOUT_ADVISOR",
            resource_type: "provider_burnout_assessment",
            success: false,
            metadata: {
              target_practitioner_id: providerId,
              caller_role: roleName,
              caller_tenant_id: callerProfile.tenant_id,
              target_tenant_id: targetTenantId,
              assessment_id: assessmentId ?? null,
            },
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error("BURNOUT_ADVISOR_CROSS_TENANT_AUDIT_FAILED", { error: errorMessage });
        }

        return new Response(
          JSON.stringify({
            error: "Forbidden — cannot access another provider's burnout data",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Audit log admin cross-provider access (HIPAA traceability for PHI access).
    if (isAdminAccess) {
      try {
        await supabase.from("audit_logs").insert({
          event_type: "BURNOUT_ADVISOR_ADMIN_ACCESS",
          event_category: "PHI_ACCESS",
          actor_user_id: user.id,
          actor_ip_address:
            req.headers.get("x-forwarded-for") ||
            req.headers.get("cf-connecting-ip"),
          actor_user_agent: req.headers.get("user-agent"),
          operation: "NURSEOS_BURNOUT_ADVISOR",
          resource_type: "provider_burnout_assessment",
          success: true,
          metadata: {
            target_practitioner_id: providerId,
            caller_role: roleName,
            assessment_id: assessmentId ?? null,
            caller_tenant_id: callerProfile.tenant_id,
          },
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("BURNOUT_ADVISOR_ADMIN_AUDIT_FAILED", { error: errorMessage });
      }
    }

    // ========================================================================
    // RATE LIMIT (persistent, post-auth)
    // Per-user identity limit to prevent abuse of expensive Claude calls.
    // Uses MCP_RATE_LIMITS.claude (15 req/min) — appropriate for AI workloads.
    // ========================================================================
    const rateLimit = await checkPersistentRateLimit(
      supabase,
      user.id,
      MCP_RATE_LIMITS.claude
    );
    if (!rateLimit.allowed) {
      logger.warn("NURSEOS_BURNOUT_ADVISOR_RATE_LIMITED", {
        userId: user.id,
        retryAfterMs: rateLimit.retryAfterMs,
      });
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 1000) / 1000)),
          },
        }
      );
    }

    logger.info("NURSEOS_BURNOUT_ADVISOR_START", {
      providerId,
      assessmentId,
      accessType: isSelfAccess ? "self" : "admin",
      callerRole: roleName,
    });

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

    // Call Claude with structured output (tool_choice pattern — CLAUDE.md Rule #16)
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
        system: "You are a clinical burnout prevention advisor for healthcare workers. Submit your analysis by calling the submit_burnout_advice tool. Base recommendations on evidence-based burnout prevention strategies (MBI framework, NIOSH Total Worker Health). Never minimize burnout symptoms. Always recommend professional help for critical risk levels.",
        tools: [BURNOUT_ADVISOR_TOOL],
        tool_choice: { type: "tool", name: "submit_burnout_advice" },
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

    const aiResult = await aiResponse.json() as {
      content: Array<{ type: string; input?: unknown; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    // Extract structured response from tool_use block
    const toolBlock = aiResult.content?.find(
      (block) => block.type === "tool_use"
    ) as { type: "tool_use"; input: unknown } | undefined;

    if (!toolBlock || !toolBlock.input) {
      logger.error("NURSEOS_BURNOUT_ADVISOR_NO_TOOL_USE", {
        providerId,
        blockTypes: aiResult.content?.map((b) => b.type) ?? [],
      });
      return new Response(
        JSON.stringify({ error: "AI did not return structured output" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const advisorResponse = toolBlock.input as unknown as BurnoutAdvisorResponse;

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

## Output
Call the submit_burnout_advice tool with your structured analysis. The tool schema enforces the required fields and value enums.

RULES:
- For critical risk: ALWAYS set escalation_needed=true and recommend EAP referral
- For high risk: recommend peer support + supervisor notification
- Base recommendations on their specific MBI dimension scores, not just composite
- Reference their check-in trends to identify temporal patterns
- If no check-ins available, note reduced confidence
- Never dismiss or minimize burnout symptoms`;
}
