// supabase/functions/realtime-medical-transcription/index.ts
// Authenticated WS relay: Browser -> Edge WS -> Deepgram WS (opus)
// Periodic de-identified transcript analysis with Claude.
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
              analyzeCoding(fullTranscript, socket).catch((e) =>
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

// 4) Periodic coding analysis (de-identified)
async function analyzeCoding(rawTranscript: string, socket: WebSocket) {
  try {
    const transcript = deidentify(rawTranscript);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3.7-sonnet-20250219",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are a conservative, compliance-first medical coding assistant. Analyze the de-identified encounter and suggest codes justified by documentation.

TRANSCRIPT:
${transcript}

Return ONLY strict JSON:
{
  "suggestedCodes": [
    {
      "code": "99214",
      "type": "CPT",
      "description": "Office visit, moderate complexity",
      "reimbursement": 0,
      "confidence": 0.0,
      "missingDocumentation": "Short, specific prompt the clinician could add"
    }
  ],
  "totalRevenueIncrease": 0,
  "complianceRisk": "low" | "medium" | "high"
}

// Rules:
// - If unsure, keep confidence <= 0.6 and include missingDocumentation.
// - If reimbursement varies by payer/region, keep "reimbursement": 0.
`
        }]
      })
    });

    if (!res.ok) {
      console.error("Claude HTTP error", res.status, await res.text());
      return;
    }

    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let parsed: any;
    try { parsed = JSON.parse(cleaned); }
    catch (e) {
      console.error("Claude JSON parse failed", e, cleaned.slice(0, 400));
      return;
    }

    safeSend(socket, {
      type: "code_suggestion",
      codes: parsed.suggestedCodes ?? [],
      revenueIncrease: parsed.totalRevenueIncrease ?? 0,
      complianceRisk: parsed.complianceRisk ?? "low",
    });
  } catch (e) {
    console.error("Claude analysis exception:", e);
  }
}
