/**
 * AI NurseOS Module Recommendations Edge Function
 *
 * Analyzes provider check-in patterns, burnout dimensions, and training
 * completion history to recommend specific resilience modules.
 *
 * Skill: nurseos_module_recommendations (Haiku — fast, low-cost)
 * Tracker: docs/trackers/nurseos-completion-tracker.md (P4-2)
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

interface RecommendationRequest {
  providerId: string;
  productLine?: "clarity" | "shield";
}

interface ModuleRecommendation {
  module_category: string;
  module_name: string;
  reason: string;
  priority: "high" | "medium" | "low";
  estimated_minutes: number;
}

interface RecommendationResponse {
  recommendations: ModuleRecommendation[];
  overall_focus: string;
  encouragement: string;
  confidence: number;
}

// Available module categories in the resilience library
const AVAILABLE_MODULES = [
  { category: "Stress Management", modules: ["Box Breathing", "Progressive Muscle Relaxation", "Mindful Meditation", "Grounding Techniques"] },
  { category: "Emotional Resilience", modules: ["Emotional Intelligence Workshop", "Compassion Fatigue Recovery", "Moral Injury Processing", "Boundary Setting"] },
  { category: "Physical Wellness", modules: ["Micro-Break Routines", "Sleep Hygiene", "Nutrition for Shift Workers", "Exercise for Healthcare Workers"] },
  { category: "Communication", modules: ["Difficult Conversations", "Assertive Communication Scripts", "Conflict De-escalation", "Team Building"] },
  { category: "Professional Growth", modules: ["Career Resilience", "Work-Life Integration", "Leadership Under Pressure", "Peer Support Training"] },
];

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger("ai-nurseos-module-recommendations", req);

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

    const body: RecommendationRequest = await req.json();
    const { providerId, productLine } = body;

    if (!providerId) {
      return new Response(
        JSON.stringify({ error: "providerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logger.info("NURSEOS_MODULE_RECS_START", { providerId, productLine });

    const supabase = createAdminClient();

    // Fetch provider context
    const [assessmentResult, checkinsResult, completionsResult] = await Promise.all([
      supabase
        .from("provider_burnout_assessments")
        .select("emotional_exhaustion_score, depersonalization_score, personal_accomplishment_score, risk_level")
        .eq("practitioner_id", providerId)
        .order("assessment_date", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("provider_daily_checkins")
        .select("stress_level, energy_level, mood_rating, work_setting, felt_overwhelmed, missed_break, compassion_fatigue_level, checkin_date")
        .eq("practitioner_id", providerId)
        .order("checkin_date", { ascending: false })
        .limit(7),
      supabase
        .from("provider_training_completions")
        .select("module_id, completed_at")
        .eq("practitioner_id", providerId)
        .limit(20),
    ]);

    const assessment = assessmentResult.data;
    const checkins = checkinsResult.data ?? [];
    const completedModules = (completionsResult.data ?? []).map(c => String(c.module_id));

    // Build prompt
    const prompt = buildRecommendationPrompt(assessment, checkins, completedModules, productLine);

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
        system: "You are a wellness coach for healthcare workers. Recommend specific resilience training modules based on their burnout data. Respond ONLY with valid JSON. Be warm and encouraging, never judgmental.",
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error("NURSEOS_MODULE_RECS_AI_ERROR", { status: aiResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ error: "AI recommendation failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.content?.[0]?.text;
    if (!content) {
      logger.error("NURSEOS_MODULE_RECS_EMPTY", { providerId });
      return new Response(
        JSON.stringify({ error: "AI returned empty response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let recommendations: RecommendationResponse;
    try {
      recommendations = JSON.parse(content) as RecommendationResponse;
    } catch {
      logger.error("NURSEOS_MODULE_RECS_PARSE_ERROR", { providerId, rawContent: content.substring(0, 200) });
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inputTokens = aiResult.usage?.input_tokens ?? 0;
    const outputTokens = aiResult.usage?.output_tokens ?? 0;
    const cost = calculateModelCost(HAIKU_MODEL, inputTokens, outputTokens);

    logger.info("NURSEOS_MODULE_RECS_COMPLETE", {
      providerId,
      recommendationCount: recommendations.recommendations.length,
      inputTokens,
      outputTokens,
      cost,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: recommendations,
        metadata: {
          model: HAIKU_MODEL,
          skill_key: "nurseos_module_recommendations",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: cost,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("NURSEOS_MODULE_RECS_FAILED", { error: error.message });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================================
// Prompt Builder
// ============================================================================

function buildRecommendationPrompt(
  assessment: Record<string, unknown> | null,
  checkins: Record<string, unknown>[],
  completedModules: string[],
  productLine?: string
): string {
  const avgStress = checkins.length > 0
    ? (checkins.reduce((sum, c) => sum + Number(c.stress_level ?? 0), 0) / checkins.length).toFixed(1)
    : "unknown";

  const avgEnergy = checkins.length > 0
    ? (checkins.reduce((sum, c) => sum + Number(c.energy_level ?? 0), 0) / checkins.length).toFixed(1)
    : "unknown";

  return `Recommend resilience training modules for this healthcare provider.

## Provider Profile
- Product Line: ${productLine ?? "unknown"} (clarity=community nurse, shield=hospital nurse)
- Average Stress (7 days): ${avgStress}/10
- Average Energy (7 days): ${avgEnergy}/10
- Recent Overwhelmed Reports: ${checkins.filter(c => c.felt_overwhelmed).length}/${checkins.length} days
- Missed Breaks: ${checkins.filter(c => c.missed_break).length}/${checkins.length} days
${assessment ? `
## Latest MBI Assessment
- Emotional Exhaustion: ${assessment.emotional_exhaustion_score}/54
- Depersonalization: ${assessment.depersonalization_score}/30
- Personal Accomplishment: ${assessment.personal_accomplishment_score}/48
- Risk Level: ${assessment.risk_level}` : "- No MBI assessment yet"}

## Already Completed Modules
${completedModules.length > 0 ? completedModules.join(", ") : "None yet"}

## Available Module Categories
${AVAILABLE_MODULES.map(cat => `- ${cat.category}: ${cat.modules.join(", ")}`).join("\n")}

## Response Schema (respond with ONLY this JSON):
{
  "recommendations": [
    {
      "module_category": "category name from available list",
      "module_name": "specific module name from available list",
      "reason": "why this module specifically addresses their data",
      "priority": "high|medium|low",
      "estimated_minutes": 5-30
    }
  ],
  "overall_focus": "1-sentence focus area for this provider right now",
  "encouragement": "1-sentence warm, encouraging message",
  "confidence": 0.0-1.0
}

RULES:
- Recommend 3-5 modules maximum
- Prioritize modules NOT already completed
- Match modules to their specific MBI dimension weaknesses
- High emotional exhaustion → stress management + physical wellness
- High depersonalization → emotional resilience + communication
- Low personal accomplishment → professional growth + peer support
- If no assessment data, recommend starter modules (Box Breathing, Micro-Break Routines)`;
}
