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

import type { SOAPNoteRequest, GeneratedSOAPNote, ParsedSOAPResponse } from "./types.ts";
import { gatherEncounterContext } from "./contextGatherer.ts";
import { buildSOAPPrompt } from "./promptBuilder.ts";
import { normalizeSOAPResponse, getDefaultSOAPNote, redact } from "./responseNormalizer.ts";
import { logUsage } from "./usageLogger.ts";

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
    } = body;

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

    // Generate SOAP note via Claude
    const startTime = Date.now();
    const soapNote = await generateSOAPNote(context, templateStyle, logger);
    const responseTime = Date.now() - startTime;

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
  logger: ReturnType<typeof createLogger>
): Promise<GeneratedSOAPNote> {
  const prompt = buildSOAPPrompt(context, templateStyle);

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
