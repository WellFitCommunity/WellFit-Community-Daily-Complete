/**
 * AI Patient Education Generator Edge Function
 *
 * Generates patient-friendly health education content:
 * - 6th-grade reading level (Flesch-Kincaid)
 * - Culturally appropriate when language specified
 * - Condition-specific with actionable guidance
 *
 * Uses Claude Haiku 4.5 for cost-effective, fast generation.
 *
 * @module ai-patient-education
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { HAIKU_MODEL } from "../_shared/models.ts";
import { fetchCulturalContext, formatCulturalContextForPrompt } from "../_shared/culturalCompetencyClient.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

interface EducationRequest {
  topic: string;
  condition?: string;
  patientId?: string;
  language?: string;
  format?: "article" | "bullet_points" | "qa" | "instructions";
  includeWarnings?: boolean;
  maxLength?: number;
  /** Cultural competency: population hints for culturally-informed education */
  populationHints?: string[];
}

interface EducationContent {
  title: string;
  content: string;
  format: string;
  reading_level: string;
  key_points: string[];
  action_items: string[];
  warnings?: string[];
  sources?: string[];
  language: string;
}

// PHI Redaction
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");

serve(async (req) => {
  const logger = createLogger("ai-patient-education", req);

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

    const body: EducationRequest = await req.json();
    const {
      topic,
      condition,
      patientId,
      language = "English",
      format = "article",
      includeWarnings = true,
      maxLength = 500,
      populationHints,
    } = body;

    if (!topic) {
      return new Response(
        JSON.stringify({ error: "Missing required field: topic" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);

    // Fetch cultural competency context if population hints are provided
    let culturalPromptSection = "";
    if (populationHints && populationHints.length > 0) {
      const culturalContexts = await Promise.all(
        populationHints.map((pop) => fetchCulturalContext(pop, logger))
      );
      const validContexts = culturalContexts.filter(
        (ctx): ctx is NonNullable<typeof ctx> => ctx !== null
      );
      if (validContexts.length > 0) {
        culturalPromptSection = validContexts
          .map((ctx) => formatCulturalContextForPrompt(ctx))
          .join("\n");
        logger.info("Cultural context injected into patient education prompt", {
          populations: validContexts.map((c) => c.population),
        });
      }
    }

    // Build prompt
    const prompt = buildEducationPrompt(topic, condition, language, format, includeWarnings, maxLength, culturalPromptSection);

    const startTime = Date.now();

    // Call Claude API
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
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Claude API error", { status: response.status, error: errorText });
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;
    const rawContent = data.content[0]?.text || "";

    // Parse JSON response
    let educationContent: EducationContent;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        educationContent = JSON.parse(jsonMatch[0]);
        educationContent.language = language;
        educationContent.format = format;
        educationContent.reading_level = "6th grade";
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseErr: unknown) {
      const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      logger.warn("Failed to parse AI response", { error: error.message });

      // Create structured response from raw content
      educationContent = {
        title: `Understanding ${topic}`,
        content: rawContent,
        format,
        reading_level: "6th grade",
        key_points: [],
        action_items: [],
        language,
      };
    }

    // Log usage
    const inputTokens = data.usage?.input_tokens || 200;
    const outputTokens = data.usage?.output_tokens || 400;
    const cost = (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;

    await supabase.from("claude_usage_logs").insert({
      user_id: patientId || "anonymous",
      request_id: crypto.randomUUID(),
      model: HAIKU_MODEL,
      request_type: "patient_education",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost,
      response_time_ms: responseTime,
      success: true,
    });

    logger.info("Generated patient education content", {
      topic: redact(topic),
      format,
      language,
      responseTimeMs: responseTime,
    });

    return new Response(
      JSON.stringify({
        education: educationContent,
        metadata: {
          generated_at: new Date().toISOString(),
          model: HAIKU_MODEL,
          response_time_ms: responseTime,
          tokens_used: inputTokens + outputTokens,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Patient education generation failed", { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEducationPrompt(
  topic: string,
  condition: string | undefined,
  language: string,
  format: string,
  includeWarnings: boolean,
  maxLength: number,
  culturalContext?: string
): string {
  const formatInstructions: Record<string, string> = {
    article: "Write as a short article with introduction, body, and conclusion.",
    bullet_points: "Present information as organized bullet points with headers.",
    qa: "Format as frequently asked questions with clear answers.",
    instructions: "Write as step-by-step instructions the patient can follow.",
  };

  return `You are a patient education specialist. Generate health education content about "${topic}"${
    condition ? ` for patients with ${condition}` : ""
  }.

CRITICAL REQUIREMENTS:
1. Write at a 6th-grade reading level (simple words, short sentences)
2. Use ${language} language
3. Maximum ${maxLength} words for the main content
4. Be empathetic and encouraging
5. Include practical, actionable guidance
6. ${formatInstructions[format] || formatInstructions.article}
${includeWarnings ? "7. Include important warnings or when to seek medical help" : ""}${culturalContext ? `\n\n${culturalContext}` : ""}

IMPORTANT MEDICAL DISCLAIMER:
- Do NOT provide specific medical diagnoses
- Do NOT recommend specific medications or dosages
- Always encourage consulting with healthcare providers
- Focus on general education and self-care guidance

Return a JSON object with this exact structure:
{
  "title": "Patient-friendly title",
  "content": "Main educational content (${maxLength} words max)",
  "key_points": ["3-5 key takeaways"],
  "action_items": ["2-4 things the patient can do"],
  "warnings": ["When to call doctor", "Emergency signs"]${includeWarnings ? "" : " // omit if not needed"},
  "sources": ["General references for credibility"]
}

Respond with ONLY the JSON object, no other text.`;
}
