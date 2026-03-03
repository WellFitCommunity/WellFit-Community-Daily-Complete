/**
 * AI Care Plan Auto-Generator Edge Function
 *
 * Skill #20: Generates evidence-based care plans from diagnosis + SDOH factors.
 *
 * Integrates with:
 * - fhir_conditions (diagnoses)
 * - fhir_observations (vitals, lab results)
 * - fhir_medication_requests (current medications)
 * - sdoh_assessments (social determinants)
 * - patient_readmissions (utilization history)
 * - patient_diagnoses (chronic conditions)
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy and evidence-based recommendations.
 * HIPAA-compliant with audit logging.
 *
 * @module ai-care-plan-generator
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

import type {
  CarePlanRequest,
  GeneratedCarePlan,
  ParsedCarePlanResponse,
  PatientContext,
} from "./types.ts";
import { redact } from "./types.ts";
import { gatherPatientContext } from "./patientContext.ts";
import { buildCarePlanPrompt } from "./promptBuilder.ts";
import {
  normalizeCarePlanResponse,
  getDefaultCarePlan,
} from "./normalize.ts";
import { logUsage } from "./usageLogging.ts";
import { SONNET_MODEL } from "../_shared/models.ts";
import { fetchCulturalContext, formatCulturalContextForPrompt } from "../_shared/culturalCompetencyClient.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

serve(async (req) => {
  const logger = createLogger("ai-care-plan-generator", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: CarePlanRequest = await req.json();
    const {
      patientId,
      tenantId,
      planType,
      focusConditions,
      includeSDOH = true,
      includeMedications = true,
      careTeamRoles = ["nurse", "physician", "care_coordinator"],
      durationWeeks = 12,
      populationHints,
    } = body;

    if (!patientId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: patientId" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!planType) {
      return new Response(
        JSON.stringify({ error: "Missing required field: planType" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather comprehensive patient context
    const context = await gatherPatientContext(
      supabase,
      patientId,
      includeSDOH,
      includeMedications,
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
          .map((ctx) => formatCulturalContextForPrompt(ctx, "care_plan"))
          .join("\n");
        logger.info("Cultural context injected into care plan prompt", {
          populations: validContexts.map((c) => c.population),
        });
      }
    }

    // Generate care plan via Claude
    const startTime = Date.now();
    const carePlan = await generateCarePlan(
      context,
      planType,
      focusConditions || [],
      careTeamRoles,
      durationWeeks,
      logger,
      culturalPromptSection
    );
    const responseTime = Date.now() - startTime;

    // Log PHI access
    logger.phi("Generated AI care plan", {
      patientId: redact(patientId),
      planType,
      responseTimeMs: responseTime,
    });

    // Log usage for cost tracking
    await logUsage(
      supabase,
      patientId,
      tenantId,
      planType,
      responseTime,
      logger
    );

    return new Response(
      JSON.stringify({
        carePlan,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          plan_type: planType,
          context_summary: {
            conditions_count: context.conditions.length,
            medications_count: context.medications.length,
            has_sdoh: !!context.sdohFactors,
            utilization_risk:
              context.utilizationHistory.readmissionRisk,
          },
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Care plan generation failed", {
      error: error.message,
    });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

/**
 * Generate care plan using Claude Sonnet.
 *
 * Calls the Anthropic API with the constructed prompt,
 * parses the JSON response, and normalizes it. Falls back
 * to a template-based plan if parsing fails.
 */
async function generateCarePlan(
  context: PatientContext,
  planType: string,
  focusConditions: string[],
  careTeamRoles: string[],
  durationWeeks: number,
  logger: ReturnType<typeof createLogger>,
  culturalContext?: string
): Promise<GeneratedCarePlan> {
  const prompt = buildCarePlanPrompt(
    context,
    planType,
    focusConditions,
    careTeamRoles,
    durationWeeks,
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
    logger.error("Claude API error", {
      status: response.status,
      error: errorText,
    });
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(
        jsonMatch[0]
      ) as ParsedCarePlanResponse;
      return normalizeCarePlanResponse(parsed, planType, context);
    }
  } catch (parseErr: unknown) {
    const error =
      parseErr instanceof Error
        ? parseErr
        : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", {
      error: error.message,
    });
  }

  // Fallback to template
  return getDefaultCarePlan(planType, context);
}
