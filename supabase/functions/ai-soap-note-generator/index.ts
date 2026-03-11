/**
 * AI SOAP Note Auto-Generator Edge Function
 *
 * Skill #18: Generates comprehensive SOAP notes from encounter data using Claude Sonnet.
 * Uses Claude Sonnet 4.5 for clinical accuracy.
 * HIPAA-compliant with audit logging.
 *
 * @module ai-soap-note-generator
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { SONNET_MODEL } from "../_shared/models.ts";

import type { SOAPNoteRequest, GeneratedSOAPNote, ParsedSOAPResponse, PhysicianStyleHint } from "./types.ts";
import { gatherEncounterContext } from "./contextGatherer.ts";
import { buildSOAPPrompt } from "./promptBuilder.ts";
import { FULL_DRIFT_GUARD } from "../_shared/conversationDriftGuard.ts";
import { normalizeSOAPResponse, getDefaultSOAPNote, redact } from "./responseNormalizer.ts";
import { logUsage } from "./usageLogger.ts";
import { fetchCulturalContext, formatCulturalContextForPrompt } from "../_shared/culturalCompetencyClient.ts";
import { validateClinicalOutput, logValidationResults } from "../_shared/clinicalOutputValidator.ts";
import type { CodingOutput } from "../_shared/clinicalOutputValidator.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

serve(async (req) => {
  const logger = createLogger("ai-soap-note-generator", req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Parse request
    const body: SOAPNoteRequest = await req.json();
    const {
      encounterId,
      patientId,
      tenantId,
      includeTranscript = true,
      providerNotes,
      templateStyle = "standard",
      physicianStyle,
      populationHints,
    } = body;

    // Session 3 (3.5): If no style was passed by the client, fetch from DB using the request JWT
    let resolvedStyle: PhysicianStyleHint | undefined = physicianStyle;
    if (!resolvedStyle) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) {
          const { data: styleRow } = await supabase
            .from("physician_style_profiles")
            .select("preferred_verbosity, specialty_detected, terminology_overrides, avg_note_word_count")
            .eq("provider_id", user.id)
            .maybeSingle();
          if (styleRow) {
            interface StyleRow {
              preferred_verbosity: string;
              specialty_detected: string | null;
              terminology_overrides: Array<{ aiTerm: string; physicianPreferred: string }> | null;
              avg_note_word_count: number | null;
            }
            const typed = styleRow as StyleRow;
            resolvedStyle = {
              preferredVerbosity: typed.preferred_verbosity as PhysicianStyleHint["preferredVerbosity"],
              specialtyDetected: typed.specialty_detected,
              terminologyPreferences: (typed.terminology_overrides ?? []).slice(0, 15),
              avgNoteWordCount: typed.avg_note_word_count ?? 0,
            };
          }
        }
      }
    }

    // Validate required fields
    if (!encounterId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: encounterId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Anthropic API key
    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Gather encounter context
    const context = await gatherEncounterContext(
      supabase,
      encounterId,
      patientId,
      includeTranscript,
      providerNotes,
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
          .map((ctx) => formatCulturalContextForPrompt(ctx, "diagnosis"))
          .join("\n");
        logger.info("Cultural context injected into SOAP prompt", {
          populations: validContexts.map((c) => c.population),
        });
      }
    }

    // Generate SOAP note via Claude (Session 3: pass style for adaptive generation)
    const startTime = Date.now();
    const soapNote = await generateSOAPNote(context, templateStyle, logger, resolvedStyle, culturalPromptSection);
    const responseTime = Date.now() - startTime;

    // --- Clinical Validation Hook ---
    // Validate AI-suggested ICD-10 and CPT codes in the SOAP note
    const codingOutput: CodingOutput = {
      icd10: soapNote.icd10Suggestions.map((s: { code: string; display: string }) => ({
        code: s.code, rationale: s.display,
      })),
      cpt: soapNote.cptSuggestions.map((s: { code: string; display: string }) => ({
        code: s.code, rationale: s.display,
      })),
    };
    const validationResult = await validateClinicalOutput(codingOutput, {
      source: "ai-soap-note-generator",
      sb: supabase,
    });

    // Log validation results to DB (fire-and-forget)
    logValidationResults(validationResult, supabase, undefined, 0).catch(() => {});

    // Attach validation flags to the SOAP note code suggestions
    if (validationResult.flaggedOutput) {
      (soapNote as Record<string, unknown>)._codeValidation = validationResult.flaggedOutput._validationSummary;
      (soapNote as Record<string, unknown>)._rejectedCodes = validationResult.rejectedCodes;
    }

    // Log PHI access for HIPAA compliance
    logger.phi("Generated AI SOAP note", {
      encounterId: redact(encounterId),
      patientId: patientId ? redact(patientId) : undefined,
      responseTimeMs: responseTime,
    });

    // Log usage for cost tracking
    await logUsage(supabase, encounterId, tenantId, responseTime, logger);

    return new Response(
      JSON.stringify({
        soapNote,
        metadata: {
          generated_at: new Date().toISOString(),
          model: SONNET_MODEL,
          response_time_ms: responseTime,
          template_style: templateStyle,
          context_sources: {
            vitals_count: Object.keys(context.vitals).length,
            diagnoses_count: context.diagnoses.length,
            medications_count: context.medications.length,
            lab_results_count: context.labResults.length,
            has_transcript: !!context.transcript,
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("SOAP note generation failed", { error: error.message });

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Generate SOAP note using Claude Sonnet
 */
async function generateSOAPNote(
  context: ReturnType<typeof gatherEncounterContext> extends Promise<infer T> ? T : never,
  templateStyle: string,
  logger: ReturnType<typeof createLogger>,
  physicianStyle?: PhysicianStyleHint,
  culturalContext?: string
): Promise<GeneratedSOAPNote> {
  const prompt = buildSOAPPrompt(context, templateStyle, physicianStyle, culturalContext);

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
      system: FULL_DRIFT_GUARD,
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

  // Parse JSON response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed: ParsedSOAPResponse = JSON.parse(jsonMatch[0]);
      return normalizeSOAPResponse(parsed);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response, using fallback", { error: error.message });
  }

  // Fallback - return structured but incomplete SOAP note
  return getDefaultSOAPNote(context);
}
