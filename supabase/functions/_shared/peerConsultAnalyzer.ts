// Peer Consult Analyzer — Edge function logic for consult prep mode
// Session 8 of Compass Riley Clinical Reasoning Hardening (2026-02-23)
//
// When a physician says "prepare a consult for cardiology," this module
// generates a specialty-tailored SBAR summary using the encounter transcript.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { EncounterState } from './encounterStateManager.ts';
import type { ConsultationResponse, PeerConsultSummary } from './consultationPromptGenerators.ts';
import { getConsultPrepPrompt } from './consultationPromptGenerators.ts';
import { logClaudeAudit } from './scribeHelpers.ts';
import type { AuditLogger } from './scribeHelpers.ts';

export interface ConsultPrepParams {
  transcript: string;
  specialty: string;
  userId: string;
  supabaseClient: SupabaseClient;
  logger: AuditLogger;
  encounterState: EncounterState;
  anthropicApiKey: string;
  /** Existing consultation response if available — provides richer context */
  consultationResponse: ConsultationResponse | null;
}

export interface ConsultPrepResult {
  summary: PeerConsultSummary;
  conversationalNote: string;
}

/**
 * Tool schema for Anthropic forced tool_use — guarantees a parseable
 * PeerConsultSummary instead of free-text the caller has to scrape.
 * Field set mirrors the PeerConsultSummary interface in
 * consultationPromptGenerators.ts. CR-2-SISTER-2 fix.
 */
const PEER_CONSULT_SUMMARY_TOOL = {
  name: "submit_peer_consult_summary",
  description:
    "Return the SBAR-formatted peer-consult summary for the receiving specialty. " +
    "All fields are required and must be filled with the most clinically accurate " +
    "values extracted from the encounter transcript.",
  input_schema: {
    type: "object",
    properties: {
      targetSpecialty: { type: "string", description: "Receiving specialty, e.g., 'Cardiology', 'Neurology'." },
      situation: { type: "string", description: "SBAR: Situation — concise statement of why the consult is needed." },
      background: { type: "string", description: "SBAR: Background — relevant history and prior workup." },
      assessment: { type: "string", description: "SBAR: Assessment — your clinical impression." },
      recommendation: { type: "string", description: "SBAR: Recommendation — what you want the consultant to do." },
      criticalData: {
        type: "array",
        items: { type: "string" },
        description: "Key data points the consultant will want at hand (vitals, labs, imaging findings).",
      },
      consultQuestion: { type: "string", description: "The single specific question for the consultant." },
      urgency: {
        type: "string",
        enum: ["stat", "urgent", "routine"],
        description: "Urgency level for the consult.",
      },
    },
    required: [
      "targetSpecialty",
      "situation",
      "background",
      "assessment",
      "recommendation",
      "criticalData",
      "consultQuestion",
      "urgency",
    ],
  },
} as const;

/**
 * Run peer consult prep analysis — generates SBAR summary for a specific specialty.
 * Returns null on failure (non-blocking — consult prep is supplementary).
 */
export async function runConsultPrepAnalysis(
  params: ConsultPrepParams
): Promise<ConsultPrepResult | null> {
  const {
    transcript, specialty, userId, supabaseClient, logger,
    encounterState, anthropicApiKey, consultationResponse,
  } = params;
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // Fetch provider preferences — explicit columns per supabase.md §9.
    const { data: prefs } = await supabaseClient
      .from('provider_scribe_preferences')
      .select(
        'formality_level, interaction_style, verbosity, humor_level, ' +
        'documentation_style, provider_type, interaction_count'
      )
      .eq('provider_id', userId)
      .single();

    const prompt = getConsultPrepPrompt(
      transcript,
      specialty,
      consultationResponse,
      prefs ? {
        formality_level: prefs.formality_level || 'professional',
        interaction_style: prefs.interaction_style || 'collaborative',
        verbosity: prefs.verbosity || 'balanced',
        humor_level: prefs.humor_level || 'none',
        documentation_style: prefs.documentation_style || 'SOAP',
        provider_type: prefs.provider_type || 'physician',
        interaction_count: prefs.interaction_count || 0,
      } : {
        formality_level: 'professional',
        interaction_style: 'collaborative',
        verbosity: 'balanced',
        humor_level: 'none',
        documentation_style: 'SOAP',
        provider_type: 'physician',
        interaction_count: 0,
      },
      encounterState
    );

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      // CR-2-SISTER-2: structured output via forced tool_use.
      // Replaces text + ```json regex stripping + JSON.parse pipeline that
      // was the original Rule #16 violation. Same pattern as the canonical
      // CR-2 fix in realtime_medical_transcription/index.ts.
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
        tools: [PEER_CONSULT_SUMMARY_TOOL],
        tool_choice: { type: "tool", name: "submit_peer_consult_summary" },
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("Claude consult prep HTTP error", { status: res.status, error: errorText, userId });
      await logClaudeAudit(supabaseClient, logger, {
        requestId, userId, inputTokens: 0, outputTokens: 0, cost: 0,
        responseTimeMs: Date.now() - startTime, success: false,
        errorCode: `HTTP_${res.status}`, errorMessage: `Consult prep HTTP error: ${res.status}`,
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
    ) as { type: "tool_use"; input?: PeerConsultSummary } | undefined;

    if (!toolBlock || !toolBlock.input) {
      const blockTypes = (data?.content ?? []).map((b: { type?: string }) => b?.type);
      logger.error("Consult prep: Claude did not return tool_use block", {
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
        mode: 'consult_prep',
        specialty,
        urgency: parsed.urgency,
        critical_data_count: parsed.criticalData?.length || 0,
      },
    });

    logger.phi('Consult prep completed', {
      requestId, userId, specialty, inputTokens, outputTokens, cost: totalCost, responseTimeMs: responseTime,
    });

    return {
      summary: parsed,
      conversationalNote: `${specialty} consult prep ready. SBAR summary generated — check the Consult Prep panel.`,
    };
  } catch (e: unknown) {
    logger.error("Consult prep exception", {
      error: e instanceof Error ? e.message : String(e),
      userId, specialty,
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
