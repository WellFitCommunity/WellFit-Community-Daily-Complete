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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SB_URL = Deno.env.get("SB_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SB_SECRET_KEY =
  Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!DEEPGRAM_API_KEY || !ANTHROPIC_API_KEY || !SB_URL || !SB_SECRET_KEY) {
  console.error("Missing required env vars (DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, SB_URL, SB_SECRET_KEY).");
}

const ANALYSIS_INTERVAL_MS = 10_000;

// Minimal PHI redaction before Claude (upgrade later to shared util)
function deidentify(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]") // emails
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED]") // SSN
    .replace(/\b(?:\(\d{3}\)\s?\d{3}-\d{4}|\d{3}-\d{3}-\d{4})\b/g, "[REDACTED]") // phones
    .replace(/\b(MRN|Patient|Member|Address|Name|DOB)[:#\s]+[^\n]+/gi, "[REDACTED]") // common PHI lines
    .trim();
}

function safeSend(ws: WebSocket, payload: unknown) {
  try { ws.send(JSON.stringify(payload)); } catch { /* socket closed */ }
}

serve(async (req: Request) => {
  // 1) Require WS upgrade
  if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 426 });
  }

  // 2) Auth via access_token (from your existing Scribe component)
  const url = new URL(req.url);
  const access_token = url.searchParams.get("access_token") ?? "";
  if (!access_token) return new Response("Unauthorized", { status: 401 });

  const admin = createClient(SB_URL, SB_SECRET_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(access_token);
  if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });

  const { socket, response } = Deno.upgradeWebSocket(req);

  const userId = userData.user.id;

  // 3) Relay: browser <-> Deepgram
  let deepgramWs: WebSocket | null = null;
  let fullTranscript = "";
  let lastAnalysisTime = Date.now();

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
              analyzeCoding(fullTranscript, socket, userId, admin).catch((e) =>
                console.error("Claude analysis error:", e)
              );
            }
          }
        }
      } catch (e) {
        console.error("Deepgram message parse error:", e);
      }
    };

    deepgramWs.onerror = (e: Event) => {
      console.error("Deepgram error:", e);
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
      console.warn("Unrecognized WS frame; dropping", e);
    }
  };

  socket.onerror = () => { try { deepgramWs?.close(); } catch {} };
  socket.onclose  = () => { try { deepgramWs?.close(); } catch {} };

  return response;
});

// 4) Periodic coding analysis (de-identified) - NOW WITH CONVERSATIONAL AI
async function analyzeCoding(rawTranscript: string, socket: WebSocket, userId: string, supabaseClient: any) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const transcript = deidentify(rawTranscript);

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
        })
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
    "subjective": "Chief complaint, HPI (onset, location, duration, character, alleviating/aggravating factors, radiation, timing, severity - OLDCARTS), and pertinent ROS. Write as a physician would chart in their EHR. 2-4 sentences.",
    "objective": "Vital signs if mentioned, physical exam findings, relevant labs/imaging results. Use clinical terminology. 2-3 sentences.",
    "assessment": "Primary and secondary diagnoses with clinical reasoning. Link symptoms to diagnoses. Include ICD-10 codes. 2-3 sentences.",
    "plan": "Treatment plan including: medications (with dosing), procedures, referrals, patient education, follow-up timeline. Be specific and actionable. 3-5 bullet points.",
    "hpi": "Detailed narrative HPI suitable for medical chart. Include all OLDCARTS elements mentioned. 3-5 sentences.",
    "ros": "Pertinent positive and negative findings from review of systems. Format: 'Constitutional: denies fever, chills. Cardiovascular: endorses dyspnea on exertion. Respiratory: denies cough.' 2-4 sentences."
  },

  "suggestedCodes": [
    {
      "code": "99214",
      "type": "CPT",
      "description": "Office/outpatient visit, established patient, 30-39 minutes",
      "reimbursement": 164.00,
      "confidence": 0.92,
      "reasoning": "Detailed history, detailed exam, moderate complexity MDM based on transcript",
      "missingDocumentation": "Document time spent counseling if >50% of visit"
    },
    {
      "code": "E11.65",
      "type": "ICD10",
      "description": "Type 2 diabetes mellitus with hyperglycemia",
      "confidence": 0.95,
      "reasoning": "Patient has documented T2DM with elevated blood sugar"
    }
  ],

  "totalRevenueIncrease": 164.00,
  "complianceRisk": "low",
  "conversational_suggestions": [
    "Great job documenting the patient's diabetes management",
    "Consider adding PHQ-9 for depression screening to capture Z-code"
  ]
}

**CRITICAL REQUIREMENTS:**
- SOAP note must be complete, professional, and EHR-ready
- Use proper medical terminology and standard abbreviations
- Assessment must include ICD-10 diagnoses where applicable
- Plan must be specific (include doses, frequencies, quantities for medications)
- HPI must address OLDCARTS when mentioned: Onset, Location, Duration, Character, Alleviating/Aggravating factors, Radiation, Timing, Severity
- Be thorough but concise - this goes directly in the patient's medical record
- If the transcript is too brief (<50 words), generate a minimal SOAP note based on available information
- Never make up clinical details not in the transcript - use "not documented" if missing`;

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
      console.error("Claude HTTP error", res.status, await res.text());

      // HIPAA AUDIT LOGGING: Log API error
      try {
        await supabaseClient.from('claude_api_audit').insert({
          request_id: requestId,
          user_id: userId,
          request_type: 'transcription',
          model: 'claude-sonnet-4-5-20250929',
          input_tokens: 0,
          output_tokens: 0,
          cost: 0,
          response_time_ms: Date.now() - startTime,
          success: false,
          error_code: `HTTP_${res.status}`,
          error_message: `Claude API HTTP error: ${res.status}`,
          phi_scrubbed: true,
          metadata: { transcript_length: rawTranscript.length }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return;
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

    let parsed: any;
    try { parsed = JSON.parse(cleaned); }
    catch (e) {
      console.error("Claude JSON parse failed", e, cleaned.slice(0, 400));

      // HIPAA AUDIT LOGGING: Log parse error
      try {
        await supabaseClient.from('claude_api_audit').insert({
          request_id: requestId,
          user_id: userId,
          request_type: 'transcription',
          model: 'claude-sonnet-4-5-20250929',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost: totalCost,
          response_time_ms: responseTime,
          success: false,
          error_code: 'JSON_PARSE_ERROR',
          error_message: e.message,
          phi_scrubbed: true,
          metadata: { transcript_length: rawTranscript.length }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      return;
    }

    // HIPAA AUDIT LOGGING: Log successful analysis
    try {
      await supabaseClient.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: userId,
        request_type: 'transcription',
        model: 'claude-sonnet-4-5-20250929',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: totalCost,
        response_time_ms: responseTime,
        success: true,
        phi_scrubbed: true,
        metadata: {
          transcript_length: rawTranscript.length,
          suggested_codes_count: parsed.suggestedCodes?.length || 0,
          revenue_increase: parsed.totalRevenueIncrease || 0,
          compliance_risk: parsed.complianceRisk || 'low'
        }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    console.log(`[Medical Transcription] RequestID: ${requestId}, User: ${userId}, Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${totalCost.toFixed(4)}, Time: ${responseTime}ms`);

    // Track interaction for learning
    if (prefs) {
      await supabaseClient.from('scribe_interaction_history').insert({
        provider_id: userId,
        interaction_type: 'code_recommendation',
        scribe_message: parsed.conversational_note || null,
        scribe_action: {
          suggested_codes: parsed.suggestedCodes?.map((c: any) => c.code) || [],
          revenue_impact: parsed.totalRevenueIncrease || 0
        },
        session_phase: 'active'
      }).catch((err: any) => console.error('Failed to log interaction:', err));

      // Update interaction count
      await supabaseClient.rpc('learn_from_interaction', {
        p_provider_id: userId,
        p_interaction_type: 'code_recommendation',
        p_was_helpful: null, // Will be updated based on provider response
        p_sentiment: null
      }).catch((err: any) => console.error('Failed to update learning:', err));
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
      }
    });
  } catch (e) {
    console.error("Claude analysis exception:", e);

    // HIPAA AUDIT LOGGING: Log exception
    try {
      await supabaseClient.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: userId,
        request_type: 'transcription',
        model: 'claude-sonnet-4-5-20250929',
        input_tokens: 0,
        output_tokens: 0,
        cost: 0,
        response_time_ms: Date.now() - startTime,
        success: false,
        error_code: e?.name || 'EXCEPTION',
        error_message: e?.message || e?.toString(),
        phi_scrubbed: true,
        metadata: { transcript_length: rawTranscript.length }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }
  }
}
