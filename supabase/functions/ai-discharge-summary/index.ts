/**
 * AI Discharge Summary Generator Edge Function
 *
 * Skill #19: Auto-generate comprehensive discharge summaries with medication reconciliation.
 *
 * Generates structured discharge summaries including:
 * - Hospital course narrative
 * - Admission diagnosis and principal diagnoses
 * - Procedures performed
 * - Medication reconciliation (continued, new, changed, discontinued)
 * - Follow-up care instructions
 * - Patient education points
 * - Red flags and warning signs
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. ALL summaries require clinician review before finalization
 * 2. Medication changes are clearly flagged for pharmacist verification
 * 3. Allergy conflicts are prominently displayed
 * 4. High-risk patients get additional review flags
 * 5. Confidence scoring for transparency
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * @module ai-discharge-summary
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { requireUser } from "../_shared/auth.ts";

import type { DischargeSummaryRequest, DischargeSummary, PatientContext } from "./types.ts";
import { redact } from "./types.ts";
import { gatherPatientContext } from "./patientContext.ts";
import { buildDischargeSummaryPrompt } from "./promptBuilder.ts";
import { normalizeSummaryResponse, getDefaultSummary } from "./normalize.ts";
import { logUsage } from "./usageLogging.ts";
import { SONNET_MODEL } from "../_shared/models.ts";
import { fetchCulturalContext, formatCulturalContextForPrompt } from "../_shared/culturalCompetencyClient.ts";
import { validateClinicalOutput, logValidationResults } from "../_shared/clinicalOutputValidator.ts";
import type { CodingOutput } from "../_shared/clinicalOutputValidator.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const logger = createLogger("ai-discharge-summary", req);

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

    const body: DischargeSummaryRequest = await req.json();
    const {
      patientId,
      encounterId,
      tenantId,
      dischargePlanId,
      dischargeDisposition = "home",
      attendingPhysician = "Attending Physician",
      includePatientInstructions = true,
      populationHints,
    } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!encounterId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: encounterId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient and encounter context
    const context = await gatherPatientContext(
      supabase,
      patientId,
      encounterId,
      dischargePlanId,
      logger
    );

    // Fetch cultural competency context if population hints are provided
    let culturalPromptSection: string | undefined;
    if (populationHints && populationHints.length > 0) {
      const culturalContexts = await Promise.all(
        populationHints.map((pop) => fetchCulturalContext(pop, logger))
      );
      const validContexts = culturalContexts.filter(
        (ctx): ctx is NonNullable<typeof ctx> => ctx !== null
      );
      if (validContexts.length > 0) {
        culturalPromptSection = validContexts
          .map((ctx) => formatCulturalContextForPrompt(ctx, "discharge"))
          .join("\n");
        logger.info("Cultural context injected into discharge summary prompt", {
          populations: validContexts.map((c) => c.population),
        });
      }
    }

    // Generate discharge summary via Claude
    const startTime = Date.now();
    const summary = await generateDischargeSummary(
      context,
      dischargeDisposition,
      attendingPhysician,
      includePatientInstructions,
      logger,
      culturalPromptSection
    );
    const responseTime = Date.now() - startTime;

    // --- Clinical Validation Hook ---
    // Validate AI-generated diagnosis codes and risk score
    const codingOutput: CodingOutput = {
      icd10: summary.dischargeDiagnoses.map((d: { code: string; display: string }) => ({
        code: d.code, rationale: d.display,
      })),
      risk_score: summary.readmissionRiskScore,
    };
    const validationResult = await validateClinicalOutput(codingOutput, {
      source: "ai-discharge-summary",
      sb: supabase,
      patientId,
    });

    // Log validation results to DB (fire-and-forget)
    logValidationResults(validationResult, supabase, undefined, 0).catch(() => {});

    if (validationResult.rejectedCodes.length > 0) {
      (summary as Record<string, unknown>)._codeValidation = validationResult.flaggedOutput?._validationSummary ?? null;
      (summary as Record<string, unknown>)._rejectedCodes = validationResult.rejectedCodes;
    }

    // Log PHI access
    logger.phi("Generated discharge summary", {
      patientId: redact(patientId),
      encounterId,
      responseTimeMs: responseTime,
    });

    // Log usage
    await logUsage(supabase, patientId, tenantId, encounterId, responseTime, logger);

    return new Response(
      JSON.stringify({
        summary,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          encounter_id: encounterId,
          discharge_disposition: dischargeDisposition,
          context_summary: {
            conditions_count: context.conditions.length,
            procedures_count: context.procedures.length,
            medications_count: context.dischargeMedications.length,
            allergies_count: context.allergies.length,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Discharge summary generation failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =====================================================
// AI GENERATION (orchestrates prompt + normalize)
// =====================================================

async function generateDischargeSummary(
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string,
  includePatientInstructions: boolean,
  logger: ReturnType<typeof createLogger>,
  culturalContext?: string
): Promise<DischargeSummary> {
  const prompt = buildDischargeSummaryPrompt(
    context,
    dischargeDisposition,
    attendingPhysician,
    includePatientInstructions,
    culturalContext
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
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

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizeSummaryResponse(parsed, context, dischargeDisposition, attendingPhysician);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback when parsing fails
  return getDefaultSummary(context, dischargeDisposition, attendingPhysician);
}
