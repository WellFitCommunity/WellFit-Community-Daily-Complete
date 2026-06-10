/**
 * AI Treatment Pathway Recommender Edge Function
 *
 * Skill #23: Evidence-based treatment pathway recommendations.
 *
 * Provides clinical decision support by recommending treatment pathways based on:
 * - Patient diagnosis/condition
 * - Current medications and allergies
 * - Contraindications
 * - SDOH factors
 * - Clinical guidelines (ADA, ACC, USPSTF, etc.)
 *
 * CRITICAL SAFETY GUARDRAILS:
 * 1. ALL recommendations require clinician review - never auto-prescribed
 * 2. Contraindications are prominently flagged
 * 3. Allergies are checked against recommendations
 * 4. References to clinical guidelines are required
 * 5. Confidence scoring for transparency
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 *
 * Decomposed (2026-06-10) into focused modules under the 600-line rule:
 * - types.ts            — shared interfaces
 * - patientContext.ts   — patient context gathering + contraindication/allergy derivation
 * - pathwayGenerator.ts — prompt build, Claude call, response normalization, safe fallback
 * - usageLogger.ts      — Claude usage/cost logging
 *
 * @module ai-treatment-pathway
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { requireUser, requirePatientAccess } from "../_shared/auth.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { SONNET_MODEL } from "../_shared/models.ts";
import { validateClinicalOutput, logValidationResults } from "../_shared/clinicalOutputValidator.ts";
import type { CodingOutput } from "../_shared/clinicalOutputValidator.ts";
import type { TreatmentPathwayRequest } from "./types.ts";
import { gatherPatientContext, checkAllergyConflicts } from "./patientContext.ts";
import { generateTreatmentPathway } from "./pathwayGenerator.ts";
import { logUsage } from "./usageLogger.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  const logger = createLogger("ai-treatment-pathway", req);

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

    // RATE LIMITING — AI generation is expensive; cap per authenticated user (EQ-5)
    const rateLimit = await checkRateLimit(user.id, RATE_LIMITS.AI);
    if (!rateLimit.allowed) {
      logger.warn("ai-treatment-pathway rate limit exceeded", { userId: user.id, retryAfter: rateLimit.retryAfter });
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `Too many requests. Try again in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfter ?? RATE_LIMITS.AI.windowSeconds),
          },
        }
      );
    }

    const body: TreatmentPathwayRequest = await req.json();
    const {
      patientId,
      tenantId,
      condition,
      conditionCode,
      severity = "moderate",
      isNewDiagnosis = false,
      treatmentGoals = [],
      excludeMedications = [],
    } = body;

    // Validate required fields
    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!condition) {
      return new Response(
        JSON.stringify({ error: "Missing required field: condition" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI-1-SWEEP fix: confirm caller is allowed to query this patientId.
    try {
      await requirePatientAccess(user.id, patientId);
    } catch (authzResponse: unknown) {
      if (authzResponse instanceof Response) {
        logger.security("AI_TREATMENT_PATHWAY_AUTHZ_DENIED", {
          callerUserId: user.id,
          requestedPatientId: patientId,
        });
        return authzResponse;
      }
      throw authzResponse;
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather patient context
    const context = await gatherPatientContext(supabase, patientId, logger);

    // Check for allergy conflicts with common treatments
    const allergyConflicts = checkAllergyConflicts(context.allergies, condition);

    // Generate treatment pathway
    const startTime = Date.now();
    const pathway = await generateTreatmentPathway(
      condition,
      conditionCode || "",
      severity,
      isNewDiagnosis,
      treatmentGoals,
      excludeMedications,
      context,
      allergyConflicts,
      logger
    );
    const responseTime = Date.now() - startTime;

    // --- Clinical Validation Hook ---
    // Validate AI-generated condition code
    if (pathway.conditionCode) {
      const codingOutput: CodingOutput = {
        icd10: [{ code: pathway.conditionCode, rationale: pathway.condition }],
        risk_score: undefined,
      };
      const validationResult = await validateClinicalOutput(codingOutput, {
        source: "ai-treatment-pathway",
        sb: supabase,
        patientId,
      });

      // Log validation results to DB (fire-and-forget)
      logValidationResults(validationResult, supabase, undefined, 0).catch(() => {});

      if (validationResult.rejectedCodes.length > 0) {
        (pathway as Record<string, unknown>)._codeValidation = validationResult.flaggedOutput?._validationSummary ?? null;
        (pathway as Record<string, unknown>)._rejectedCodes = validationResult.rejectedCodes;
      }
    }

    // Log PHI access
    logger.phi("Generated treatment pathway recommendation", {
      patientId: redact(patientId),
      condition,
      responseTimeMs: responseTime,
    });

    // Log usage
    await logUsage(supabase, patientId, tenantId, condition, responseTime, logger);

    return new Response(
      JSON.stringify({
        pathway,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          condition,
          severity,
          patient_context: {
            conditions_count: context.conditions.length,
            medications_count: context.medications.length,
            allergies_count: context.allergies.length,
            has_contraindications: context.contraindications.length > 0,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Treatment pathway generation failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
