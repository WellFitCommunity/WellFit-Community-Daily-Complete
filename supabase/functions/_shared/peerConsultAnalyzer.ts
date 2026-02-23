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
    // Fetch provider preferences
    const { data: prefs } = await supabaseClient
      .from('provider_scribe_preferences')
      .select('*')
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
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
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

    const text: string = data?.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: PeerConsultSummary;
    try {
      parsed = JSON.parse(cleaned) as PeerConsultSummary;
    } catch (e: unknown) {
      logger.error("Consult prep JSON parse failed", {
        error: e instanceof Error ? e.message : String(e),
        responsePreview: cleaned.slice(0, 400),
      });
      await logClaudeAudit(supabaseClient, logger, {
        requestId, userId, inputTokens, outputTokens, cost: totalCost,
        responseTimeMs: responseTime, success: false,
        errorCode: 'JSON_PARSE_ERROR',
        errorMessage: e instanceof Error ? e.message : String(e),
        transcriptLength: transcript.length,
      });
      return null;
    }

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
