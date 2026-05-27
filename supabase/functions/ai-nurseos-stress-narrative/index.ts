/**
 * AI NurseOS Stress Trend Narrative Edge Function
 *
 * Generates plain-language stress trend summaries correlating
 * stress spikes with workload factors.
 *
 * Skill: nurseos_stress_narrative (Haiku — fast narrative generation)
 * Tracker: docs/trackers/nurseos-completion-tracker.md (P4-3)
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { createAdminClient } from "../_shared/supabaseClient.ts";
import { HAIKU_MODEL, calculateModelCost } from "../_shared/models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// ============================================================================
// Types
// ============================================================================

interface NarrativeRequest {
  providerId: string;
  period?: "7d" | "30d";
}

interface StressNarrativeResponse {
  narrative: string;
  trend: "improving" | "stable" | "worsening";
  key_insights: string[];
  contributing_factors: ContributingFactor[];
  positive_patterns: string[];
  action_items: string[];
  confidence: number;
}

interface ContributingFactor {
  factor: string;
  correlation: "strong" | "moderate" | "weak";
  description: string;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger("ai-nurseos-stress-narrative", req);

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
      logger.error("NURSEOS_STRESS_NARRATIVE_PROFILE_LOOKUP_FAILED", {
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

    const body: NarrativeRequest = await req.json();
    const { providerId, period = "7d" } = body;

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
      logger.warn("NURSEOS_STRESS_NARRATIVE_FORBIDDEN", {
        callerUserId: user.id,
        callerRole: roleName,
        targetProviderId: providerId,
      });
      return new Response(
        JSON.stringify({
          error: "Forbidden — cannot access another provider's data",
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
        logger.warn("NURSEOS_STRESS_NARRATIVE_TARGET_NOT_FOUND", {
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
            event_type: "STRESS_NARRATIVE_CROSS_TENANT_BLOCKED",
            event_category: "PHI_ACCESS",
            actor_user_id: user.id,
            actor_ip_address:
              req.headers.get("x-forwarded-for") ||
              req.headers.get("cf-connecting-ip"),
            actor_user_agent: req.headers.get("user-agent"),
            operation: "NURSEOS_STRESS_NARRATIVE",
            resource_type: "provider_stress_narrative",
            success: false,
            metadata: {
              target_practitioner_id: providerId,
              caller_role: roleName,
              caller_tenant_id: callerProfile.tenant_id,
              target_tenant_id: targetTenantId,
              period,
            },
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error("STRESS_NARRATIVE_CROSS_TENANT_AUDIT_FAILED", { error: errorMessage });
        }

        return new Response(
          JSON.stringify({
            error: "Forbidden — cannot access another provider's data",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Audit log admin cross-provider access (HIPAA traceability for PHI access).
    if (isAdminAccess) {
      try {
        await supabase.from("audit_logs").insert({
          event_type: "STRESS_NARRATIVE_ADMIN_ACCESS",
          event_category: "PHI_ACCESS",
          actor_user_id: user.id,
          actor_ip_address:
            req.headers.get("x-forwarded-for") ||
            req.headers.get("cf-connecting-ip"),
          actor_user_agent: req.headers.get("user-agent"),
          operation: "NURSEOS_STRESS_NARRATIVE",
          resource_type: "provider_stress_narrative",
          success: true,
          metadata: {
            target_practitioner_id: providerId,
            caller_role: roleName,
            caller_tenant_id: callerProfile.tenant_id,
            period,
          },
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error("STRESS_NARRATIVE_ADMIN_AUDIT_FAILED", { error: errorMessage });
      }
    }

    logger.info("NURSEOS_STRESS_NARRATIVE_START", {
      providerId,
      period,
      accessType: isSelfAccess ? "self" : "admin",
      callerRole: roleName,
    });

    const limit = period === "30d" ? 30 : 7;

    const { data: checkins, error: checkinsError } = await supabase
      .from("provider_daily_checkins")
      .select("stress_level, energy_level, mood_rating, work_setting, shift_type, patient_census, patient_acuity_score, overtime_hours, felt_overwhelmed, felt_supported_by_team, unsafe_staffing, missed_break, lateral_violence_incident, codes_responded_to, checkin_date")
      .eq("practitioner_id", providerId)
      .order("checkin_date", { ascending: true })
      .limit(limit);

    if (checkinsError) {
      logger.error("NURSEOS_STRESS_NARRATIVE_DB_ERROR", { error: checkinsError.message });
      return new Response(
        JSON.stringify({ error: "Failed to fetch check-in data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkins || checkins.length < 2) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            narrative: "Not enough check-in data yet to identify trends. Keep checking in daily to build a picture of your stress patterns.",
            trend: "stable" as const,
            key_insights: ["Continue daily check-ins to enable trend analysis"],
            contributing_factors: [],
            positive_patterns: [],
            action_items: ["Complete daily check-ins for at least 3 days"],
            confidence: 0.2,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildNarrativePrompt(checkins, period);

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 768,
        messages: [{ role: "user", content: prompt }],
        system: "You are a compassionate wellness analyst for healthcare workers. Generate warm, insightful narratives about stress trends. Respond ONLY with valid JSON. Never use clinical jargon. Be honest but encouraging — acknowledge difficulty without minimizing it.",
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error("NURSEOS_STRESS_NARRATIVE_AI_ERROR", { status: aiResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ error: "AI narrative generation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text;
    if (!content) {
      logger.error("NURSEOS_STRESS_NARRATIVE_EMPTY", { providerId });
      return new Response(
        JSON.stringify({ error: "AI returned empty response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let narrativeResponse: StressNarrativeResponse;
    try {
      narrativeResponse = JSON.parse(content) as StressNarrativeResponse;
    } catch {
      logger.error("NURSEOS_STRESS_NARRATIVE_PARSE_ERROR", { providerId, rawContent: content.substring(0, 200) });
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inputTokens = aiResult.usage?.input_tokens ?? 0;
    const outputTokens = aiResult.usage?.output_tokens ?? 0;
    const cost = calculateModelCost(HAIKU_MODEL, inputTokens, outputTokens);

    logger.info("NURSEOS_STRESS_NARRATIVE_COMPLETE", {
      providerId,
      trend: narrativeResponse.trend,
      insightCount: narrativeResponse.key_insights.length,
      inputTokens,
      outputTokens,
      cost,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: narrativeResponse,
        metadata: {
          model: HAIKU_MODEL,
          skill_key: "nurseos_stress_narrative",
          period,
          checkin_count: checkins.length,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: cost,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("NURSEOS_STRESS_NARRATIVE_FAILED", { error: error.message });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Prompt Builder
// ============================================================================

function buildNarrativePrompt(
  checkins: Record<string, unknown>[],
  period: string
): string {
  const dataRows = checkins.map(c => {
    const flags: string[] = [];
    if (c.felt_overwhelmed) flags.push("overwhelmed");
    if (c.unsafe_staffing) flags.push("unsafe staffing");
    if (c.missed_break) flags.push("missed break");
    if (c.lateral_violence_incident) flags.push("lateral violence");
    if (!c.felt_supported_by_team) flags.push("unsupported");

    return `${c.checkin_date} | stress=${c.stress_level}/10 energy=${c.energy_level}/10 mood=${c.mood_rating}/10 | setting=${c.work_setting ?? "?"} shift=${c.shift_type ?? "?"} census=${c.patient_census ?? "?"} acuity=${c.patient_acuity_score ?? "?"} OT=${c.overtime_hours ?? 0}h codes=${c.codes_responded_to ?? 0} | ${flags.length > 0 ? flags.join(", ") : "no flags"}`;
  }).join("\n");

  // Calculate basic stats for context
  const stressValues = checkins.map(c => Number(c.stress_level ?? 0));
  const avgStress = (stressValues.reduce((a, b) => a + b, 0) / stressValues.length).toFixed(1);
  const maxStress = Math.max(...stressValues);
  const firstHalf = stressValues.slice(0, Math.floor(stressValues.length / 2));
  const secondHalf = stressValues.slice(Math.floor(stressValues.length / 2));
  const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
  const trendDirection = secondAvg > firstAvg + 0.5 ? "increasing" : secondAvg < firstAvg - 0.5 ? "decreasing" : "stable";

  return `Generate a plain-language stress trend narrative for this healthcare provider over the last ${period === "30d" ? "30 days" : "7 days"}.

## Check-In Data (chronological)
${dataRows}

## Computed Stats
- Average Stress: ${avgStress}/10
- Peak Stress: ${maxStress}/10
- Trend Direction: ${trendDirection} (first half avg: ${firstAvg.toFixed(1)}, second half avg: ${secondAvg.toFixed(1)})
- Days with overwhelm: ${checkins.filter(c => c.felt_overwhelmed).length}/${checkins.length}
- Days with missed breaks: ${checkins.filter(c => c.missed_break).length}/${checkins.length}
- Overtime days: ${checkins.filter(c => Number(c.overtime_hours ?? 0) > 0).length}/${checkins.length}

## Response Schema (respond with ONLY this JSON):
{
  "narrative": "3-4 sentence plain-language summary of their stress story this period. Use second person ('Your stress...'). Correlate stress spikes with specific workload factors from the data.",
  "trend": "improving|stable|worsening",
  "key_insights": ["2-3 data-driven insights about patterns"],
  "contributing_factors": [
    {
      "factor": "workload factor name",
      "correlation": "strong|moderate|weak",
      "description": "how this factor relates to their stress"
    }
  ],
  "positive_patterns": ["any positive trends or resilient moments to highlight"],
  "action_items": ["1-2 specific, actionable next steps"],
  "confidence": 0.0-1.0
}

RULES:
- Write as if speaking TO the provider ("Your stress...")
- Correlate stress spikes with specific workload data (census, overtime, shift type)
- Highlight BOTH concerns AND positive patterns
- If stress is consistently high (≥7), acknowledge the difficulty first
- Keep narrative warm and human, not clinical
- Confidence reflects data quality (more check-ins = higher confidence)`;
}
