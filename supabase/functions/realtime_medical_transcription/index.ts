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

// Audit logger interface
interface AuditLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  security: (message: string, data?: Record<string, unknown>) => void;
  phi: (message: string, data?: Record<string, unknown>) => void;
}

// Parsed transcription analysis response
interface TranscriptionAnalysis {
  conversational_note?: string;
  suggestedCodes?: Array<{
    code: string;
    type?: string;
    description?: string;
    reimbursement?: number;
    confidence?: number;
    reasoning?: string;
    transcriptEvidence?: string;
    missingDocumentation?: string;
  }>;
  totalRevenueIncrease?: number;
  complianceRisk?: string;
  conversational_suggestions?: string[];
  soapNote?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    hpi?: string;
    ros?: string;
  };
  groundingFlags?: {
    statedCount?: number;
    inferredCount?: number;
    gapCount?: number;
    gaps?: string[];
  };
  /** Progressive reasoning: encounter state update from this analysis chunk */
  encounterStateUpdate?: Partial<EncounterState>;
}

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

  const { socket, response } = Deno.upgradeWebSocket(req);

  const userId = userData.user.id;
  logger.info('WebSocket connection established', { userId });

  // 3) Relay: browser <-> Deepgram
  let deepgramWs: WebSocket | null = null;
  let fullTranscript = "";
  let lastAnalysisTime = Date.now();

  // Progressive Clinical Reasoning: encounter state persists across analysis chunks
  let encounterState: EncounterState = createEmptyEncounterState();
  let evidenceRateLimiter = createEvidenceRateLimiter();
  const matchedConditions = new Set<string>();
  const matchedPathways = new Set<string>();

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
              analyzeCoding(fullTranscript, socket, userId, admin, logger, encounterState).then((updatedState) => {
                if (updatedState) {
                  encounterState = updatedState;
                  // Session 4: Evidence retrieval — fire-and-forget PubMed search
                  const triggers = detectEvidenceTriggers(deidentify(fullTranscript, logger), updatedState, evidenceRateLimiter);
                  if (triggers.shouldSearch) {
                    const svcKey = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SECRET_KEY') || '';
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
              }).catch((e) =>
                logger.error("Claude analysis error", { error: e instanceof Error ? e.message : String(e) })
              );
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
    if (typeof d === "string") return;

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

/** Helper: insert a claude_api_audit row (fire-and-forget) */
async function logClaudeAudit(
  client: SupabaseClient, logger: AuditLogger,
  params: { requestId: string; userId: string; inputTokens: number; outputTokens: number;
    cost: number; responseTimeMs: number; success: boolean; errorCode?: string;
    errorMessage?: string; transcriptLength: number; metadata?: Record<string, unknown> }
) {
  try {
    await client.from('claude_api_audit').insert({
      request_id: params.requestId, user_id: params.userId,
      request_type: 'transcription', model: 'claude-sonnet-4-5-20250929',
      input_tokens: params.inputTokens, output_tokens: params.outputTokens,
      cost: params.cost, response_time_ms: params.responseTimeMs,
      success: params.success, error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null, phi_scrubbed: true,
      metadata: { transcript_length: params.transcriptLength, ...(params.metadata || {}) }
    });
  } catch (logError) {
    logger.error('Audit log insertion failed', { error: logError instanceof Error ? logError.message : String(logError) });
  }
}

// 4) Periodic coding analysis (de-identified) - WITH CONVERSATIONAL AI + PROGRESSIVE REASONING + DRIFT GUARD
async function analyzeCoding(rawTranscript: string, socket: WebSocket, userId: string, supabaseClient: SupabaseClient, logger: AuditLogger, currentEncounterState: EncounterState): Promise<EncounterState | null> {
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
      : `You are an experienced, intelligent medical scribe with deep clinical knowledge. Analyze this encounter transcript and generate:

1. **Complete SOAP Note** - Professional clinical documentation ready for EHR
2. **Billing Codes** - Accurate CPT, ICD-10, HCPCS codes
3. **Conversational Coaching** - Helpful suggestions for the provider

TRANSCRIPT (PHI-SCRUBBED):
${transcript}

Return ONLY strict JSON:
{
  "conversational_note": "Brief friendly comment about the encounter (1-2 sentences, conversational tone)",

  "soapNote": {
    "subjective": "ONLY what the patient reported — quote key phrases from transcript. If OLDCARTS elements were not mentioned, write '[NOT DOCUMENTED]' for those elements. 2-4 sentences.",
    "objective": "ONLY vitals, exam findings, and labs explicitly stated in transcript. Do NOT add findings not described. Mark missing expected elements as '[GAP]'. 2-3 sentences.",
    "assessment": "Clinical reasoning connecting ONLY documented findings to diagnoses. Every diagnosis must trace to transcript evidence. Include ICD-10 codes. 2-3 sentences.",
    "plan": "ONLY actions the provider stated they will take. Do NOT invent follow-up plans, referrals, or medication changes not discussed. 3-5 bullet points.",
    "hpi": "Narrative HPI using ONLY information from the transcript. For OLDCARTS elements not mentioned, write '[NOT DOCUMENTED]'. 3-5 sentences.",
    "ros": "ONLY review-of-systems elements actually discussed. Systems not reviewed should be listed as '[NOT REVIEWED]' — never fabricate negative findings. 2-4 sentences."
  },

  "suggestedCodes": [
    {"code": "99214", "type": "CPT", "description": "Office visit, moderate complexity", "reimbursement": 164.00, "confidence": 0.92, "reasoning": "Why this code fits", "transcriptEvidence": "Quote from transcript", "missingDocumentation": "What to add"}
  ],
  "totalRevenueIncrease": 164.00,
  "complianceRisk": "low",
  "conversational_suggestions": ["1-2 tips"],
  "groundingFlags": {
    "statedCount": 0,
    "inferredCount": 0,
    "gapCount": 0,
    "gaps": ["List expected elements not found in transcript"]
  }
}

**ANTI-HALLUCINATION RULES — MANDATORY:**
- TRANSCRIPT IS TRUTH: If it was not said, it does not exist in this encounter
- NEVER add ROS elements, exam findings, lab values, or doses not in the transcript
- Every billing code MUST include transcriptEvidence — a quote or paraphrase from the transcript
- Tag SOAP elements: [STATED] (from transcript), [INFERRED] (explain why), [GAP] (expected but missing)
- Include groundingFlags — count stated/inferred/gap assertions and list all gaps

**DOCUMENTATION REQUIREMENTS:**
- SOAP note must be professional and EHR-ready — grounded in transcript content only
- Use proper medical terminology and standard abbreviations
- Assessment must include ICD-10 diagnoses where applicable
- Plan must be specific (include doses, frequencies, quantities ONLY if stated)
- HPI must address OLDCARTS when mentioned — mark unmentioned elements as [NOT DOCUMENTED]
- If the transcript is too brief (<50 words), generate a minimal SOAP note and flag all gaps
- NEVER make up clinical details — use "[NOT DOCUMENTED]" or "[GAP]" instead`;

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
      encounterState: {
        currentPhase: updatedEncounterState.currentPhase,
        analysisCount: updatedEncounterState.analysisCount,
        chiefComplaint: updatedEncounterState.chiefComplaint,
        diagnosisCount: updatedEncounterState.diagnoses.length,
        activeDiagnoses: updatedEncounterState.diagnoses
          .filter(d => d.status !== 'ruled_out')
          .map(d => ({ condition: d.condition, icd10: d.icd10, confidence: d.confidence })),
        mdmComplexity: {
          overallLevel: updatedEncounterState.mdmComplexity.overallLevel,
          suggestedEMCode: updatedEncounterState.mdmComplexity.suggestedEMCode,
          nextLevelGap: updatedEncounterState.mdmComplexity.nextLevelGap,
        },
        completeness: {
          overallPercent: updatedEncounterState.completeness.overallPercent,
          hpiLevel: updatedEncounterState.completeness.hpiLevel,
          rosLevel: updatedEncounterState.completeness.rosLevel,
          expectedButMissing: updatedEncounterState.completeness.expectedButMissing,
        },
        medicationCount: updatedEncounterState.medications.length,
        planItemCount: updatedEncounterState.planItems.length,
        driftState: {
          primaryDomain: updatedEncounterState.driftState.primaryDomain,
          relatedDomains: updatedEncounterState.driftState.relatedDomains,
          driftDetected: updatedEncounterState.driftState.driftDetected,
          driftDescription: updatedEncounterState.driftState.driftDescription ?? null,
        },
        patientSafety: {
          patientDirectAddress: updatedEncounterState.patientSafety.patientDirectAddress,
          emergencyDetected: updatedEncounterState.patientSafety.emergencyDetected,
          emergencyReason: updatedEncounterState.patientSafety.emergencyReason ?? null,
          requiresProviderConsult: updatedEncounterState.patientSafety.requiresProviderConsult,
          consultReason: updatedEncounterState.patientSafety.consultReason ?? null,
        },
      }
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
