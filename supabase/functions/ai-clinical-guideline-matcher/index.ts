/**
 * AI Clinical Guideline Matcher Edge Function
 *
 * Skill #24: Smart guideline recommendations.
 *
 * Matches patient conditions, medications, and labs against evidence-based
 * clinical guidelines to identify:
 * - Applicable guidelines for the patient's conditions
 * - Adherence gaps (where care doesn't match guidelines)
 * - Specific recommendations with guideline references
 * - Preventive care opportunities
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. ALL recommendations require clinician review - never auto-actioned
 * 2. References specific guideline sources (ADA, ACC/AHA, USPSTF, etc.)
 * 3. Confidence scoring for transparency
 * 4. Identifies contraindications and allergies
 * 5. Prioritizes recommendations by clinical urgency
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-clinical-guideline-matcher
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

import type { GuidelineMatchRequest, ParsedMatchResult } from "./types.ts";
import { gatherPatientContext } from "./patientContext.ts";
import { matchGuidelinesToConditions, getApplicableScreenings } from "./matching.ts";
import { buildGuidelinePrompt } from "./promptBuilder.ts";
import { normalizeMatchResult, getDefaultMatchResult } from "./normalize.ts";
import { logUsage } from "./usageLogging.ts";
import { SONNET_MODEL } from "../_shared/models.ts";
import { requireUser } from "../_shared/auth.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

/** PHI Redaction for audit logs */
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const logger = createLogger("ai-clinical-guideline-matcher", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

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

    const body: GuidelineMatchRequest = await req.json();
    const {
      patientId,
      tenantId,
      focusConditions = [],
      includePreventiveCare = true,
    } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient context from database
    const context = await gatherPatientContext(supabase, patientId, logger);

    // Rule-based guideline matching
    const matchedGuidelines = matchGuidelinesToConditions(context.conditions, focusConditions);

    // Determine applicable preventive screenings
    const preventiveScreenings = includePreventiveCare
      ? getApplicableScreenings(context)
      : [];

    // AI-powered recommendation generation
    const startTime = Date.now();
    const prompt = buildGuidelinePrompt(context, matchedGuidelines, preventiveScreenings);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Claude API error", { status: response.status, error: errorText });
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || "";
    const responseTime = Date.now() - startTime;

    // Parse and normalize AI response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ParsedMatchResult;
        result = normalizeMatchResult(parsed, matchedGuidelines, preventiveScreenings, context);
      } else {
        result = getDefaultMatchResult(matchedGuidelines, preventiveScreenings);
      }
    } catch (parseErr: unknown) {
      const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      logger.warn("Failed to parse AI response", { error: error.message });
      result = getDefaultMatchResult(matchedGuidelines, preventiveScreenings);
    }

    result.patientId = patientId;

    // Log PHI access
    logger.phi("Generated clinical guideline matches", {
      patientId: redact(patientId),
      guidelinesMatched: result.matchedGuidelines.length,
      gapsIdentified: result.adherenceGaps.length,
      responseTimeMs: responseTime,
    });

    // Log usage for cost tracking
    await logUsage(supabase, patientId, tenantId, result.matchedGuidelines.length, responseTime, logger);

    return new Response(
      JSON.stringify({
        result,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          patient_context: {
            age: context.demographics.age,
            conditions_count: context.conditions.length,
            medications_count: context.medications.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Guideline matching failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
