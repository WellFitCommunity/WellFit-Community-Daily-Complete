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
    // Fetch provider preferences
    const { data: prefs } = await supabaseClient
      .from('provider_scribe_preferences')
      .select('*')
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
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4000,
        messages: [{ role: "user", content: consultationPrompt }]
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

    const text: string = data?.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: ConsultationResponse;
    try {
      parsed = JSON.parse(cleaned) as ConsultationResponse;
    } catch (e: unknown) {
      logger.error("Claude consultation JSON parse failed", {
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

    // Track interaction
    if (prefs) {
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
