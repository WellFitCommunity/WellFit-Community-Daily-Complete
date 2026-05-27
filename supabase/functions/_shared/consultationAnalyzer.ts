// Consultation Analyzer — Edge function logic for consultation mode
// Extracted from realtime_medical_transcription/index.ts for 600-line compliance
// Session 7 of Compass Riley Clinical Reasoning Hardening

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { EncounterState } from './encounterStateManager.ts';
import { getConsultationPrompt } from './consultationPromptGenerators.ts';
import type { ConsultationResponse } from './consultationPromptGenerators.ts';
import { logClaudeAudit } from './scribeHelpers.ts';
import type { AuditLogger } from './scribeHelpers.ts';

interface ConsultationAnalysisParams {
  transcript: string;
  userId: string;
  supabaseClient: SupabaseClient;
  logger: AuditLogger;
  encounterState: EncounterState;
  anthropicApiKey: string;
}

interface ConsultationAnalysisResult {
  response: ConsultationResponse;
  conversationalNote: string;
}

/**
 * Tool schema for Anthropic forced tool_use — guarantees a parseable
 * ConsultationResponse instead of free-text the caller has to scrape.
 * Inner objects (`casePresentation`, `cannotMiss[]`, etc.) accept
 * additional properties to tolerate forward-compat shape drift; only
 * the top-level field set is locked. CR-2-SISTER-3 fix.
 */
const CONSULTATION_RESPONSE_TOOL = {
  name: "submit_consultation_response",
  description:
    "Return the full structured consultation response. All top-level " +
    "fields are required. Nested objects may include any properties Riley " +
    "needs to convey case structure, reasoning, cannot-miss diagnoses, " +
    "and grounding flags.",
  input_schema: {
    type: "object",
    properties: {
      casePresentation: {
        type: "object",
        description: "Structured case presentation. Shape is intentionally loose to allow Riley to express the case naturally.",
        additionalProperties: true,
      },
      reasoningSteps: {
        type: "array",
        items: { type: "object", additionalProperties: true },
        description: "Socratic reasoning steps walking through the case.",
      },
      cannotMiss: {
        type: "array",
        items: { type: "object", additionalProperties: true },
        description: "Cannot-miss diagnoses — life-threatening conditions to actively rule out.",
      },
      suggestedWorkup: {
        type: "array",
        items: { type: "string" },
        description: "Suggested additional workup steps (tests, exams, consults).",
      },
      guidelineNotes: {
        type: "array",
        items: { type: "string" },
        description: "Guideline-based recommendations with citations.",
      },
      confidenceCalibration: {
        type: "object",
        description: "What Riley is certain vs uncertain about.",
        properties: {
          highConfidence: { type: "array", items: { type: "string" } },
          uncertain: { type: "array", items: { type: "string" } },
          insufficientData: { type: "array", items: { type: "string" } },
        },
        required: ["highConfidence", "uncertain", "insufficientData"],
      },
      groundingFlags: {
        type: "object",
        description: "Anti-hallucination flags counting what is stated vs inferred vs missing.",
        properties: {
          statedCount: { type: "integer" },
          inferredCount: { type: "integer" },
          gapCount: { type: "integer" },
          gaps: { type: "array", items: { type: "string" } },
        },
        required: ["statedCount", "inferredCount", "gapCount", "gaps"],
      },
    },
    required: [
      "casePresentation",
      "reasoningSteps",
      "cannotMiss",
      "suggestedWorkup",
      "guidelineNotes",
      "confidenceCalibration",
      "groundingFlags",
    ],
  },
} as const;

/**
 * Run consultation analysis — clinical reasoning partner mode.
 * Returns the parsed consultation response or null on failure.
 */
export async function runConsultationAnalysis(
  params: ConsultationAnalysisParams
): Promise<ConsultationAnalysisResult | null> {
  const { transcript, userId, supabaseClient, logger, encounterState, anthropicApiKey } = params;
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Fetch provider preferences — explicit columns per supabase.md §9.
    const { data: prefs } = await supabaseClient
      .from('provider_scribe_preferences')
      .select(
        'formality_level, interaction_style, verbosity, humor_level, ' +
        'documentation_style, provider_type, interaction_count, ' +
        'common_phrases, preferred_specialties, billing_preferences, premium_mode'
      )
      .eq('provider_id', userId)
      .single();

    encounterState.transcriptWordCount = transcript.split(/\s+/).length;

    const consultationPrompt = prefs
      ? getConsultationPrompt(transcript, {
          formality_level: prefs.formality_level || 'relaxed',
          interaction_style: prefs.interaction_style || 'collaborative',
          verbosity: prefs.verbosity || 'balanced',
          humor_level: prefs.humor_level || 'light',
          documentation_style: prefs.documentation_style || 'SOAP',
          provider_type: prefs.provider_type || 'physician',
          interaction_count: prefs.interaction_count || 0,
          common_phrases: prefs.common_phrases || [],
          preferred_specialties: prefs.preferred_specialties || [],
          billing_preferences: prefs.billing_preferences || { balanced: true },
          premium_mode: prefs.premium_mode ?? false,
        }, encounterState)
      : getConsultationPrompt(transcript, {
          formality_level: 'professional',
          interaction_style: 'collaborative',
          verbosity: 'balanced',
          humor_level: 'none',
          documentation_style: 'SOAP',
          provider_type: 'physician',
          interaction_count: 0,
        }, encounterState);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      // CR-2-SISTER-3: structured output via forced tool_use.
      // Replaces text + ```json regex stripping + JSON.parse pipeline.
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        messages: [{ role: "user", content: consultationPrompt }],
        tools: [CONSULTATION_RESPONSE_TOOL],
        tool_choice: { type: "tool", name: "submit_consultation_response" },
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("Claude consultation HTTP error", { status: res.status, error: errorText, userId });
      await logClaudeAudit(supabaseClient, logger, {
        requestId, userId, inputTokens: 0, outputTokens: 0, cost: 0,
        responseTimeMs: Date.now() - startTime, success: false,
        errorCode: `HTTP_${res.status}`, errorMessage: `Claude consultation HTTP error: ${res.status}`,
        transcriptLength: transcript.length,
      });
      return null;
    }

    const data = await res.json();
    const responseTime = Date.now() - startTime;
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const inputCost = (inputTokens * 0.003) / 1000;
    const outputCost = (outputTokens * 0.015) / 1000;
    const totalCost = inputCost + outputCost;

    // Extract structured response from the tool_use block. With tool_choice
    // forcing a specific tool, Claude returns a content block of type
    // "tool_use" with the parsed object in .input — no text, no regex,
    // no JSON.parse.
    const toolBlock = (data?.content ?? []).find(
      (b: { type?: string }) => b?.type === "tool_use"
    ) as { type: "tool_use"; input?: ConsultationResponse } | undefined;

    if (!toolBlock || !toolBlock.input) {
      const blockTypes = (data?.content ?? []).map((b: { type?: string }) => b?.type);
      logger.error("Consultation: Claude did not return tool_use block", {
        blockTypes,
        userId,
      });
      await logClaudeAudit(supabaseClient, logger, {
        requestId, userId, inputTokens, outputTokens, cost: totalCost,
        responseTimeMs: responseTime, success: false,
        errorCode: 'NO_TOOL_USE_BLOCK',
        errorMessage: `Expected tool_use block, got: ${blockTypes.join(",")}`,
        transcriptLength: transcript.length,
      });
      return null;
    }

    const parsed = toolBlock.input;

    await logClaudeAudit(supabaseClient, logger, {
      requestId, userId, inputTokens, outputTokens, cost: totalCost,
      responseTimeMs: responseTime, success: true,
      transcriptLength: transcript.length,
      metadata: {
        mode: 'consultation',
        differentials_count: parsed.casePresentation?.differentials?.length || 0,
        reasoning_steps: parsed.reasoningSteps?.length || 0,
        cannot_miss_count: parsed.cannotMiss?.length || 0,
        grounding_stated: parsed.groundingFlags?.statedCount || 0,
        grounding_gaps: parsed.groundingFlags?.gapCount || 0,
      },
    });

    logger.phi('Consultation analysis completed', {
      requestId, userId, inputTokens, outputTokens, cost: totalCost, responseTimeMs: responseTime,
    });

    // Track interaction. Fire-and-forget; failure to log the interaction
    // must not block the consultation. PostgrestFilterBuilder is thenable
    // but not catchable, so wrap in a Promise.resolve() chain.
    if (prefs) {
      Promise.resolve(
        supabaseClient.from('scribe_interaction_history').insert({
          provider_id: userId,
          interaction_type: 'consultation',
          scribe_message: `Consultation: ${parsed.casePresentation?.oneLiner || 'Case analysis'}`,
          scribe_action: {
            differentials_count: parsed.casePresentation?.differentials?.length || 0,
            reasoning_steps: parsed.reasoningSteps?.length || 0,
            cannot_miss_count: parsed.cannotMiss?.length || 0,
          },
          session_phase: 'active',
        })
      ).then((res) => {
        if (res.error) {
          logger.error('Failed to log consultation interaction', {
            error: res.error.message,
          });
        }
      }).catch((err: unknown) =>
        logger.error('Failed to log consultation interaction', {
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }

    return {
      response: parsed,
      conversationalNote: `Consultation ready: ${parsed.casePresentation?.oneLiner || 'Case analysis'}. Check the Consultation panel for case presentation, reasoning, and differentials.`,
    };
  } catch (e: unknown) {
    logger.error("Consultation analysis exception", {
      error: e instanceof Error ? e.message : String(e),
      userId,
    });
    await logClaudeAudit(supabaseClient, logger, {
      requestId, userId, inputTokens: 0, outputTokens: 0, cost: 0,
      responseTimeMs: Date.now() - startTime, success: false,
      errorCode: e instanceof Error ? e.name : 'EXCEPTION',
      errorMessage: e instanceof Error ? e.message : String(e),
      transcriptLength: transcript.length,
    });
    return null;
  }
}
