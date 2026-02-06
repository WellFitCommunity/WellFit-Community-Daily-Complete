/**
 * AI Avatar Entity Extractor Edge Function
 *
 * Skill #37: Extracts medical entities (devices, conditions) from SmartScribe
 * transcription text using Claude Haiku 4.5 for context-aware parsing.
 *
 * Falls back gracefully if AI fails — client uses regex extraction.
 *
 * HIPAA-compliant: uses strictDeidentify() BEFORE sending to Claude.
 *
 * @module ai-avatar-entity-extractor
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { strictDeidentify } from "../_shared/phiDeidentifier.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// ============================================================================
// TYPES
// ============================================================================

interface ExtractionRequest {
  transcriptText: string;
  patientId: string;
  tenantId?: string;
}

interface ExtractedEntity {
  entity_type: "device_insertion" | "device_removal" | "condition_mention";
  raw_text: string;
  normalized_type: string;
  confidence: number;
  reasoning: string;
  body_region?: string;
  laterality?: "left" | "right" | "bilateral";
  icd10_suggestion?: string;
}

interface ExtractionResponse {
  entities: ExtractedEntity[];
  fallback: boolean;
  model?: string;
  response_time_ms?: number;
}

// ============================================================================
// PROMPT
// ============================================================================

const EXTRACTION_PROMPT = `You are a clinical NLP system. Extract medical entities from the following clinical transcription text.

For each entity found, return a JSON object with these fields:
- entity_type: one of "device_insertion", "device_removal", "condition_mention"
- raw_text: the exact text fragment that mentions this entity
- normalized_type: a normalized identifier (e.g., "central_line_jugular", "foley_catheter", "diabetes_type2", "parkinsons")
- confidence: a number between 0 and 1 indicating your confidence in this extraction
- reasoning: brief explanation of why you extracted this entity
- body_region: anatomical region if mentioned (e.g., "neck", "chest", "right_arm", "abdomen")
- laterality: "left", "right", or "bilateral" if mentioned
- icd10_suggestion: ICD-10 code if you can identify one (e.g., "E11" for Type 2 Diabetes)

Focus on:
1. Device insertions/placements (IV lines, catheters, tubes, drains, ports)
2. Device removals/discontinuations
3. Medical conditions/diagnoses mentioned

Return ONLY a JSON array of entities. If no entities are found, return an empty array [].
Do NOT include any text outside the JSON array.`;

// ============================================================================
// AI EXTRACTION
// ============================================================================

async function extractEntitiesWithAI(
  deidentifiedText: string,
  logger: ReturnType<typeof createLogger>
): Promise<ExtractedEntity[]> {
  if (!ANTHROPIC_API_KEY) {
    logger.error("ANTHROPIC_API_KEY not configured");
    throw new Error("AI service not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `${EXTRACTION_PROMPT}\n\nTranscription text:\n${deidentifiedText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result?.content?.[0]?.text;

  if (!content) {
    throw new Error("Empty response from AI");
  }

  // Parse the JSON response
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error("AI response is not an array");
  }

  // Validate each entity
  const validated: ExtractedEntity[] = [];
  for (const item of parsed) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof item.entity_type === "string" &&
      typeof item.raw_text === "string" &&
      typeof item.normalized_type === "string" &&
      typeof item.confidence === "number"
    ) {
      validated.push({
        entity_type: item.entity_type,
        raw_text: item.raw_text,
        normalized_type: item.normalized_type,
        confidence: Math.max(0, Math.min(1, item.confidence)),
        reasoning: typeof item.reasoning === "string" ? item.reasoning : "",
        body_region: typeof item.body_region === "string" ? item.body_region : undefined,
        laterality: ["left", "right", "bilateral"].includes(item.laterality)
          ? item.laterality
          : undefined,
        icd10_suggestion: typeof item.icd10_suggestion === "string"
          ? item.icd10_suggestion
          : undefined,
      });
    }
  }

  return validated;
}

// ============================================================================
// USAGE LOGGING
// ============================================================================

async function logUsage(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  tenantId: string | undefined,
  entityCount: number,
  responseTimeMs: number,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    await supabase.from("ai_usage_log").insert({
      skill_key: "smartscribe_avatar_extractor",
      model: HAIKU_MODEL,
      patient_id: patientId,
      tenant_id: tenantId || null,
      input_tokens: 0, // Approximated — actual from API would be better
      output_tokens: 0,
      response_time_ms: responseTimeMs,
      metadata: { entity_count: entityCount },
      created_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Failed to log AI usage", { error: error.message });
  }
}

// ============================================================================
// SERVER
// ============================================================================

serve(async (req) => {
  const logger = createLogger("ai-avatar-entity-extractor", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: ExtractionRequest = await req.json();
    const { transcriptText, patientId, tenantId } = body;

    if (!transcriptText || !patientId) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: transcriptText, patientId",
          entities: [],
          fallback: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // HIPAA: De-identify text BEFORE sending to Claude
    const deidentified = strictDeidentify(transcriptText);
    logger.phi("De-identified transcript for AI extraction", {
      originalLength: transcriptText.length,
      deidentifiedLength: deidentified.text.length,
      redactedCount: deidentified.redactedCount,
      confidence: deidentified.confidence,
    });

    // Extract entities
    const startTime = Date.now();
    const entities = await extractEntitiesWithAI(deidentified.text, logger);
    const responseTime = Date.now() - startTime;

    // Log usage
    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
    await logUsage(supabase, patientId, tenantId, entities.length, responseTime, logger);

    logger.info("AI entity extraction completed", {
      entityCount: entities.length,
      responseTimeMs: responseTime,
    });

    const response: ExtractionResponse = {
      entities,
      fallback: false,
      model: HAIKU_MODEL,
      response_time_ms: responseTime,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("AI entity extraction failed", { error: error.message });

    // Graceful degradation: return fallback flag so client uses regex
    const fallbackResponse: ExtractionResponse = {
      entities: [],
      fallback: true,
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
