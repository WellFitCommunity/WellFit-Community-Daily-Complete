// supabase/functions/realtime-medical-transcription/index.ts
// SmartScribe Atlas - AI-Powered Medical Transcription & Billing Intelligence
// Authenticated WS relay: Browser -> Edge WS -> Deepgram WS (opus)
// Real-time transcript analysis with Claude Sonnet 4.5 for revenue-accurate coding
//
// Server env (set in Supabase):
//   DEEPGRAM_API_KEY
//   ANTHROPIC_API_KEY
//   SB_URL or SUPABASE_URL
//   SB_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
//
// Client connects via:
//   wss://<project>.supabase.co/functions/v1/realtime-medical-transcription?access_token=<JWT>

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseClient.ts';
import { createLogger } from '../_shared/auditLogger.ts';
import { strictDeidentify, validateDeidentification } from '../_shared/phiDeidentifier.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import type { EncounterState } from '../_shared/encounterStateManager.ts';
import { createEmptyEncounterState, mergeEncounterState } from '../_shared/encounterStateManager.ts';
import { detectEvidenceTriggers, searchPubMedEvidence, formatCitationsForDisplay, createEvidenceRateLimiter, updateRateLimiter } from '../_shared/evidenceRetrievalService.ts';
import { matchGuidelinesForEncounter } from '../_shared/guidelineReferenceEngine.ts';
import { matchTreatmentPathways } from '../_shared/treatmentPathwayReference.ts';
import { runConsultationAnalysis } from '../_shared/consultationAnalyzer.ts';
import { runConsultPrepAnalysis } from '../_shared/peerConsultAnalyzer.ts';
import type { ConsultationResponse } from '../_shared/consultationPromptGenerators.ts';
import { logClaudeAudit, serializeEncounterStateForClient, buildNurseFallbackPrompt, buildPhysicianFallbackPrompt } from '../_shared/scribeHelpers.ts';
import type { AuditLogger, TranscriptionAnalysis } from '../_shared/scribeHelpers.ts';
import { resolveMode } from '../_shared/compass-riley/modeRouter.ts';
import { fetchTenantSensitivity, runAndSendReasoning } from './reasoningIntegration.ts';


const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Fallback API keys for resilience
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SB_URL = Deno.env.get("SB_URL") ?? SUPABASE_URL;
const SB_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? SB_SECRET_KEY;

const initLogger = createLogger('realtime_medical_transcription');
if (!DEEPGRAM_API_KEY || !ANTHROPIC_API_KEY || !SB_URL || !SB_SECRET_KEY) {
  initLogger.error("Missing required env vars", {
    hasDeepgram: !!DEEPGRAM_API_KEY,
    hasAnthropic: !!ANTHROPIC_API_KEY,
    hasOpenAI: !!OPENAI_API_KEY,
    hasSbUrl: !!SB_URL,
    hasSbSecret: !!SB_SECRET_KEY
  });
}

// Token optimization: Increased interval from 10s to 15s - still responsive but 33% fewer API calls
const ANALYSIS_INTERVAL_MS = 15_000;

/**
 * De-identify PHI using the robust NLP-based service
 * Validates output and logs any concerns
 */
function deidentify(text: string, logger: AuditLogger): string {
  const result = strictDeidentify(text);

  // Validate the de-identification
  const validation = validateDeidentification(result.text);

  if (!validation.isValid) {
    logger.warn('PHI de-identification validation warning', {
      riskScore: validation.riskScore,
      issues: validation.issues,
      redactedCount: result.redactedCount
    });
  }

  if (result.warnings.length > 0) {
    logger.info('PHI de-identification warnings', {
      warnings: result.warnings,
      confidence: result.confidence
    });
  }

  return result.text;
}

function safeSend(ws: WebSocket, payload: unknown) {
  try { ws.send(JSON.stringify(payload)); } catch { /* socket closed */ }
}

serve(async (req: Request) => {
  const logger = createLogger('realtime_medical_transcription', req);

  // 1) Require WS upgrade
  if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  // 2) Auth via access_token (from your existing Scribe component)
  const url = new URL(req.url);
  const access_token = url.searchParams.get("access_token") ?? "";
  if (!access_token) {
    logger.security('WebSocket connection attempted without access token');
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(access_token);
  if (userErr || !userData?.user) {
    logger.security('WebSocket authentication failed', { error: userErr?.message });
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse and validate scribe mode from query parameters
  const VALID_SCRIBE_MODES = ['smartscribe', 'compass-riley', 'consultation'] as const;
  type ScribeMode = typeof VALID_SCRIBE_MODES[number];
  const rawMode = url.searchParams.get("mode") || "compass-riley";
  const scribeMode: ScribeMode = VALID_SCRIBE_MODES.includes(rawMode as ScribeMode)
    ? rawMode as ScribeMode
    : "compass-riley";
  if (rawMode !== scribeMode) {
    logger.warn('Invalid scribe mode rejected, defaulting to compass-riley', { rawMode });
  }
  const isConsultationMode = scribeMode === "consultation";
  const isNurseMode = scribeMode === "smartscribe";

  // Session 2: Parse reasoning mode (auto/chain/tree) from query params
  const reasoningModeParam = url.searchParams.get("reasoning_mode") || "auto";
  const reasoningMode = resolveMode(reasoningModeParam);

  // Session 2: Fetch tenant sensitivity for CoT/ToT thresholds
  const tenantSettings = await fetchTenantSensitivity(admin, userId, logger);

  const { socket, response } = Deno.upgradeWebSocket(req);

  const userId = userData.user.id;
  logger.info('WebSocket connection established', { userId, scribeMode });

  // 3) Relay: browser <-> Deepgram
  let deepgramWs: WebSocket | null = null;
  let fullTranscript = "";
  let lastAnalysisTime = Date.now();

  // Progressive Clinical Reasoning: encounter state persists across analysis chunks
  let encounterState: EncounterState = createEmptyEncounterState();
  let evidenceRateLimiter = createEvidenceRateLimiter();
  const matchedConditions = new Set<string>();
  const matchedPathways = new Set<string>();
  // Session 8: Track last consultation response for peer consult prep context
  let lastConsultationResponse: ConsultationResponse | null = null;

  socket.onopen = () => {
    const qs = new URLSearchParams({
      model: "nova-2-medical",
      language: "en-US",
      smart_format: "true",
      punctuate: "true",
      diarize: "true",
      interim_results: "true",
      endpointing: "300",
      utterance_end_ms: "1000",
      encoding: "opus",
      sample_rate: "16000",
    });

    deepgramWs = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${qs.toString()}`,
      ["token", DEEPGRAM_API_KEY],
    );

    deepgramWs.onopen = () => {
      safeSend(socket, { type: "ready", message: "Deepgram connected" });
    };

    deepgramWs.onmessage = (event: MessageEvent) => {
      try {
        const raw = typeof event.data === "string"
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer);
        const data = JSON.parse(raw);
        const alt = data?.channel?.alternatives?.[0];
        const transcript: string | undefined = alt?.transcript;
        const isFinal: boolean = !!data?.is_final;

        if (transcript && transcript.length > 0) {
          safeSend(socket, {
            type: "transcript",
            text: transcript,
            isFinal,
            confidence: alt?.confidence,
          });

          if (isFinal) {
            fullTranscript += (fullTranscript ? " " : "") + transcript;
            const now = Date.now();
            if (now - lastAnalysisTime >= ANALYSIS_INTERVAL_MS && fullTranscript.length > 50) {
              lastAnalysisTime = now;
              if (isConsultationMode) {
                runConsultationMode(fullTranscript, socket, userId, admin, logger, encounterState).then((consultResult) => {
                  if (consultResult) {
                    encounterState = consultResult.state;
                    lastConsultationResponse = consultResult.response;
                    // Session 2: Run CoT/ToT reasoning pipeline for consultation mode
                    runAndSendReasoning(consultResult.state, tenantSettings, reasoningMode, socket, userId, admin, logger, safeSend);
                  }
                }).catch((e) =>
                  logger.error("Consultation analysis error", { error: e instanceof Error ? e.message : String(e) })
                );
              } else {
                const analysisPromise = analyzeCoding(fullTranscript, socket, userId, admin, logger, encounterState, isNurseMode);
                analysisPromise.then((updatedState) => {
                  if (updatedState) {
                    encounterState = updatedState;
                    // Session 2: Run CoT/ToT reasoning pipeline (physician modes only)
                    if (!isNurseMode) {
                      runAndSendReasoning(updatedState, tenantSettings, reasoningMode, socket, userId, admin, logger, safeSend);
                    }
                    // Physician-only features: evidence citations, guidelines, treatment pathways
                    // Skip for nurse mode — nurses don't need billing/clinical reasoning intelligence
                    if (!isNurseMode) {
                      // Session 4: Evidence retrieval — fire-and-forget PubMed search
                      const triggers = detectEvidenceTriggers(deidentify(fullTranscript, logger), updatedState, evidenceRateLimiter);
                      if (triggers.shouldSearch) {
                        const svcKey = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
                        searchPubMedEvidence(triggers.queries, SB_URL!, svcKey).then(results => {
                          evidenceRateLimiter = updateRateLimiter(evidenceRateLimiter, results.length);
                          if (results.some(r => r.citations.length > 0)) {
                            safeSend(socket, { type: 'evidence_citations', results, display: formatCitationsForDisplay(results) });
                          }
                        }).catch(e => logger.warn('Evidence search non-fatal failure', { error: e instanceof Error ? e.message : String(e) }));
                      }
                      const gMatches = matchGuidelinesForEncounter(updatedState).filter(m => !matchedConditions.has(m.icd10));
                      if (gMatches.length > 0) { gMatches.forEach(m => matchedConditions.add(m.icd10)); safeSend(socket, { type: 'guideline_references', matches: gMatches }); }
                      const tMatches = matchTreatmentPathways(updatedState).filter(m => !matchedPathways.has(m.icd10));
                      if (tMatches.length > 0) { tMatches.forEach(m => matchedPathways.add(m.icd10)); safeSend(socket, { type: 'treatment_pathways', pathways: tMatches }); }
                    }
                  }
                }).catch((e) =>
                  logger.error("Claude analysis error", { error: e instanceof Error ? e.message : String(e) })
                );
              }
            }
          }
        }
      } catch (e) {
        logger.error("Deepgram message parse error", { error: e instanceof Error ? e.message : String(e) });
      }
    };

    deepgramWs.onerror = (e: Event) => {
      logger.error("Deepgram WebSocket error", { userId });
      safeSend(socket, { type: "error", message: "Transcription error" });
    };
  };

  socket.onmessage = async (event: MessageEvent) => {
    if (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) return;
    const d = event.data;

    if (d instanceof ArrayBuffer) {
      deepgramWs.send(d);
      return;
    }
    if (typeof Blob !== "undefined" && d instanceof Blob) {
      const buf = await d.arrayBuffer();
      deepgramWs.send(buf);
      return;
    }
    // Session 8: String messages are the command channel (e.g., consult prep requests)
    if (typeof d === "string") {
      handleClientCommand(d, socket, userId, admin, logger, encounterState, fullTranscript, lastConsultationResponse);
      return;
    }

    try {
      // @ts-ignore (best-effort fallback)
      if (typeof d?.arrayBuffer === "function") {
        const buf = await d.arrayBuffer();
        deepgramWs.send(buf);
      }
    } catch (e) {
      logger.warn("Unrecognized WS frame; dropping", { error: e instanceof Error ? e.message : String(e) });
    }
  };

  socket.onerror = () => { try { deepgramWs?.close(); } catch {} };
  socket.onclose  = () => { try { deepgramWs?.close(); } catch {} };

  return response;
});

// 4) Periodic coding analysis (de-identified) - WITH CONVERSATIONAL AI + PROGRESSIVE REASONING + DRIFT GUARD
async function analyzeCoding(rawTranscript: string, socket: WebSocket, userId: string, supabaseClient: SupabaseClient, logger: AuditLogger, currentEncounterState: EncounterState, nurseMode = false): Promise<EncounterState | null> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const transcript = deidentify(rawTranscript, logger);

    // Fetch provider preferences for personalized interaction
    const { data: prefs } = await supabaseClient
      .from('provider_scribe_preferences')
      .select('*')
      .eq('provider_id', userId)
      .single();

    // Get current context
    const currentHour = new Date().getHours();
    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : currentHour < 21 ? 'evening' : 'night';

    // Build conversational prompt (import will be added at top of file)
    const { getRealtimeCodingPrompt } = await import("../_shared/conversationalScribePrompts.ts");

    // Update encounter state with current word count
    currentEncounterState.transcriptWordCount = transcript.split(/\s+/).length;

    const conversationalPrompt = prefs
      ? getRealtimeCodingPrompt(transcript, {
          formality_level: prefs.formality_level || 'relaxed',
          interaction_style: prefs.interaction_style || 'collaborative',
          verbosity: prefs.verbosity || 'balanced',
          humor_level: prefs.humor_level || 'light',
          documentation_style: prefs.documentation_style || 'SOAP',
          provider_type: prefs.provider_type || 'physician',
          interaction_count: prefs.interaction_count || 0,
          common_phrases: prefs.common_phrases || [],
          preferred_specialties: prefs.preferred_specialties || [],
          billing_preferences: prefs.billing_preferences || { balanced: true }
        }, {
          time_of_day: timeOfDay,
          current_mood: prefs.last_interaction_at && (Date.now() - new Date(prefs.last_interaction_at).getTime() < 600000) ? 'focused' : 'neutral'
        }, currentEncounterState)
      : nurseMode
        ? buildNurseFallbackPrompt(transcript)
        : buildPhysicianFallbackPrompt(transcript);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929", // Sonnet 4.5 - revenue-critical accuracy for billing codes
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: conversationalPrompt
        }]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("Claude HTTP error", { status: res.status, error: errorText, userId });

      await logClaudeAudit(supabaseClient, logger, {
        requestId, userId, inputTokens: 0, outputTokens: 0, cost: 0,
        responseTimeMs: Date.now() - startTime, success: false,
        errorCode: `HTTP_${res.status}`, errorMessage: `Claude API HTTP error: ${res.status}`,
        transcriptLength: rawTranscript.length
      });
      return null;
    }

    const data = await res.json();
    const responseTime = Date.now() - startTime;

    // Calculate cost
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const inputCost = (inputTokens * 0.003) / 1000;
    const outputCost = (outputTokens * 0.015) / 1000;
    const totalCost = inputCost + outputCost;

    const text: string = data?.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: TranscriptionAnalysis;
    try { parsed = JSON.parse(cleaned) as TranscriptionAnalysis; }
    catch (e) {
      logger.error("Claude JSON parse failed", { error: e instanceof Error ? e.message : String(e), responsePreview: cleaned.slice(0, 400) });

      await logClaudeAudit(supabaseClient, logger, {
        requestId, userId, inputTokens, outputTokens, cost: totalCost,
        responseTimeMs: responseTime, success: false,
        errorCode: 'JSON_PARSE_ERROR', errorMessage: e.message,
        transcriptLength: rawTranscript.length
      });
      return null;
    }

    await logClaudeAudit(supabaseClient, logger, {
      requestId, userId, inputTokens, outputTokens, cost: totalCost,
      responseTimeMs: responseTime, success: true,
      transcriptLength: rawTranscript.length,
      metadata: {
        suggested_codes_count: parsed.suggestedCodes?.length || 0,
        revenue_increase: parsed.totalRevenueIncrease || 0,
        compliance_risk: parsed.complianceRisk || 'low',
        grounding_stated: parsed.groundingFlags?.statedCount || 0,
        grounding_inferred: parsed.groundingFlags?.inferredCount || 0,
        grounding_gaps: parsed.groundingFlags?.gapCount || 0,
        codes_without_evidence: (parsed.suggestedCodes || []).filter(c => !c.transcriptEvidence).length
      }
    });

    logger.phi('Medical transcription analysis completed', {
      requestId,
      userId,
      inputTokens,
      outputTokens,
      cost: totalCost,
      responseTimeMs: responseTime
    });

    // Track interaction for learning (batched to avoid sequential waits)
    if (prefs) {
      await Promise.all([
        supabaseClient.from('scribe_interaction_history').insert({
          provider_id: userId,
          interaction_type: 'code_recommendation',
          scribe_message: parsed.conversational_note || null,
          scribe_action: {
            suggested_codes: parsed.suggestedCodes?.map((c) => c.code) || [],
            revenue_impact: parsed.totalRevenueIncrease || 0
          },
          session_phase: 'active'
        }).catch((err: unknown) => logger.error('Failed to log interaction', { error: err instanceof Error ? err.message : String(err) })),

        supabaseClient.rpc('learn_from_interaction', {
          p_provider_id: userId,
          p_interaction_type: 'code_recommendation',
          p_was_helpful: null,
          p_sentiment: null
        }).catch((err: unknown) => logger.error('Failed to update learning', { error: err instanceof Error ? err.message : String(err) }))
      ]);
    }

    // Progressive reasoning: merge encounter state update from Claude
    let updatedEncounterState = currentEncounterState;
    if (parsed.encounterStateUpdate) {
      try {
        updatedEncounterState = mergeEncounterState(currentEncounterState, parsed.encounterStateUpdate);
        logger.info('Encounter state updated', {
          analysisCount: updatedEncounterState.analysisCount,
          phase: updatedEncounterState.currentPhase,
          diagnosisCount: updatedEncounterState.diagnoses.length,
          mdmLevel: updatedEncounterState.mdmComplexity.overallLevel,
          completenessPercent: updatedEncounterState.completeness.overallPercent,
          primaryDomain: updatedEncounterState.driftState.primaryDomain,
          driftDetected: updatedEncounterState.driftState.driftDetected,
        });

        // Log safety events
        if (updatedEncounterState.patientSafety.emergencyDetected) {
          logger.security('PATIENT_EMERGENCY_DETECTED', {
            userId,
            reason: updatedEncounterState.patientSafety.emergencyReason,
          });
        }
        if (updatedEncounterState.driftState.driftDetected) {
          logger.warn('Clinical reasoning drift detected', {
            userId,
            description: updatedEncounterState.driftState.driftDescription,
            driftEventCount: updatedEncounterState.driftState.driftEventCount,
          });
        }
      } catch (mergeErr) {
        logger.warn('Encounter state merge failed, continuing with previous state', {
          error: mergeErr instanceof Error ? mergeErr.message : String(mergeErr),
        });
      }
    }

    safeSend(socket, {
      type: "code_suggestion",
      conversational_note: parsed.conversational_note ?? null,
      codes: parsed.suggestedCodes ?? [],
      revenueIncrease: parsed.totalRevenueIncrease ?? 0,
      complianceRisk: parsed.complianceRisk ?? "low",
      suggestions: parsed.conversational_suggestions ?? [],
      soapNote: {
        subjective: parsed.soapNote?.subjective ?? null,
        objective: parsed.soapNote?.objective ?? null,
        assessment: parsed.soapNote?.assessment ?? null,
        plan: parsed.soapNote?.plan ?? null,
        hpi: parsed.soapNote?.hpi ?? null,
        ros: parsed.soapNote?.ros ?? null
      },
      groundingFlags: parsed.groundingFlags ?? null,
      encounterState: serializeEncounterStateForClient(updatedEncounterState),
    });

    return updatedEncounterState;
  } catch (e) {
    logger.error("Claude analysis exception", { error: e instanceof Error ? e.message : String(e), userId });

    await logClaudeAudit(supabaseClient, logger, {
      requestId, userId, inputTokens: 0, outputTokens: 0, cost: 0,
      responseTimeMs: Date.now() - startTime, success: false,
      errorCode: e?.name || 'EXCEPTION', errorMessage: e?.message || e?.toString(),
      transcriptLength: rawTranscript.length
    });
    return null;
  }
}

// 5) Consultation mode — delegates to shared consultationAnalyzer, sends WS messages
async function runConsultationMode(rawTranscript: string, socket: WebSocket, userId: string, supabaseClient: SupabaseClient, logger: AuditLogger, currentEncounterState: EncounterState): Promise<{ state: EncounterState; response: ConsultationResponse } | null> {
  const transcript = deidentify(rawTranscript, logger);
  const result = await runConsultationAnalysis({
    transcript, userId, supabaseClient, logger,
    encounterState: currentEncounterState,
    anthropicApiKey: ANTHROPIC_API_KEY!,
  });

  if (!result) return null;

  // Send consultation response to client
  safeSend(socket, { type: 'consultation_response', consultation: result.response });

  // Send conversational note so Riley's messages area updates
  safeSend(socket, {
    type: 'code_suggestion',
    conversational_note: result.conversationalNote,
    codes: [], revenueIncrease: 0, suggestions: [],
    groundingFlags: result.response.groundingFlags ?? null,
    encounterState: serializeEncounterStateForClient(currentEncounterState),
  });

  return { state: currentEncounterState, response: result.response };
}

// 6) Session 8: Client command channel — handles string WebSocket messages
function handleClientCommand(
  raw: string, socket: WebSocket, userId: string, supabaseClient: SupabaseClient,
  logger: AuditLogger, currentEncounterState: EncounterState,
  fullTranscript: string, consultResponse: ConsultationResponse | null
): void {
  let cmd: { type: string; specialty?: string };
  try { cmd = JSON.parse(raw) as { type: string; specialty?: string }; } catch { return; }

  if (cmd.type === 'prepare_consult' && cmd.specialty) {
    const specialty = cmd.specialty;
    logger.info('Consult prep requested', { userId, specialty });

    const transcript = deidentify(fullTranscript, logger);
    runConsultPrepAnalysis({
      transcript, specialty, userId, supabaseClient, logger,
      encounterState: currentEncounterState,
      anthropicApiKey: ANTHROPIC_API_KEY!,
      consultationResponse: consultResponse,
    }).then(result => {
      if (result) {
        safeSend(socket, { type: 'consult_prep', summary: result.summary });
        safeSend(socket, {
          type: 'code_suggestion',
          conversational_note: result.conversationalNote,
          codes: [], revenueIncrease: 0, suggestions: [],
          groundingFlags: null,
          encounterState: serializeEncounterStateForClient(currentEncounterState),
        });
      } else {
        safeSend(socket, { type: 'consult_prep_error', message: `Failed to generate ${specialty} consult prep. Please try again.` });
      }
    }).catch(e => {
      logger.error('Consult prep failed', { error: e instanceof Error ? e.message : String(e), userId, specialty });
      safeSend(socket, { type: 'consult_prep_error', message: 'Consult prep failed. Please try again.' });
    });
  }
}

