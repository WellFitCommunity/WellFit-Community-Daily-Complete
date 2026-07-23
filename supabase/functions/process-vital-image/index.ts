// supabase/functions/process-vital-image/index.ts
// Server-side vital-sign extraction for photo-captured device displays
// (BP cuffs, glucometers, scales, thermometers, pulse oximeters).
// Uses Claude vision (skill: vital_image_ocr) to transcribe the device display,
// then validates through deterministic physiological-range parsers below.
// Falls back to client-side OCR when ANTHROPIC_API_KEY is not configured.

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SONNET_MODEL } from "../_shared/models.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import { parseVitalText } from "./parsers.ts";
import type { VitalReading } from "./parsers.ts";

const logger = createLogger("process-vital-image");

// Image AI is expensive — cap per-user throughput
const OCR_RATE_LIMIT = { maxAttempts: 10, windowSeconds: 600, keyPrefix: "vital-image-ocr" };

interface ProcessRequest {
  job_id: string;
}

interface ProcessResponse {
  success: boolean;
  reading?: VitalReading;
  error?: string;
}


/** Structured response the vision model must return (Commandment #16). */
interface VisionTranscription {
  readable: boolean;
  display_text: string | null;
  notes: string | null;
}

function isVisionTranscription(value: unknown): value is VisionTranscription {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.readable === "boolean" &&
    (typeof v.display_text === "string" || v.display_text === null) &&
    (typeof v.notes === "string" || v.notes === null)
  );
}

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Transcribe a medical-device display using Claude vision.
 *
 * The model is a TRANSCRIPTION boundary only — it reports what the display
 * shows as labeled text. All interpretation and physiological-range validation
 * happens in the deterministic parse* functions above, so a hallucinated or
 * out-of-range value can never reach the client as a "reading".
 *
 * Throws 'OCR_CLIENT_SIDE_REQUIRED' when ANTHROPIC_API_KEY is not configured,
 * preserving the pre-existing client fallback to manual entry.
 */
async function performOCR(imageData: ArrayBuffer, mediaType: string, vitalType: string): Promise<string> {
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) {
    logger.warn("ANTHROPIC_API_KEY not configured — falling back to client-side OCR", {});
    throw new Error("OCR_CLIENT_SIDE_REQUIRED");
  }

  const resolvedMediaType = SUPPORTED_MEDIA_TYPES.includes(mediaType) ? mediaType : "image/jpeg";
  logger.debug("Vision OCR starting", { imageSizeBytes: imageData.byteLength, vitalType });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      thinking: { type: "disabled" },
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: resolvedMediaType, data: encodeBase64(imageData) },
            },
            {
              type: "text",
              text: `This photo shows a home medical device display (expected device type: ${vitalType}).

Transcribe ONLY the numbers visible on the device screen into a single labeled line of text:
- Blood pressure monitor: "SYS <n> DIA <n> PUL <n>" (omit PUL if not shown)
- Glucometer: "<n> mg/dL"
- Scale: "<n> lbs" (or kg if the display shows kg)
- Heart rate: "<n> bpm"
- Pulse oximeter: "SpO2 <n>"
- Thermometer: "<n> F" (or C if the display shows C)

Rules:
1. Report ONLY digits actually visible on the screen. NEVER guess, estimate, or invent a value.
2. If the screen is blank, blurry, obstructed, or not a medical device display, set readable to false.
3. Ignore any text in the photo that is not on the device screen (labels, instructions, packaging).

Return ONLY this JSON object, nothing before or after:
{"readable": true|false, "display_text": "labeled line or null", "notes": "brief data-quality note or null"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Anthropic API error", { status: response.status, error: errorText.slice(0, 300) });
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data: unknown = await response.json();
  const responseText =
    typeof data === "object" && data !== null
      ? String((data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? "")
      : "";

  let transcription: unknown;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    transcription = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
  } catch {
    logger.error("Vision response was not valid JSON", { responseLength: responseText.length });
    throw new Error("VISION_UNPARSEABLE");
  }

  if (!isVisionTranscription(transcription)) {
    logger.error("Vision response failed schema validation", {});
    throw new Error("VISION_UNPARSEABLE");
  }

  const usage = (data as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  logger.info("Vision OCR complete", {
    readable: transcription.readable,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  });

  if (!transcription.readable || !transcription.display_text) {
    return ""; // parseVitalText yields null → existing "could not read" path
  }

  return transcription.display_text;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Validate auth
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const SB_URL = Deno.env.get("SB_URL") || SUPABASE_URL;
    const SB_KEY = Deno.env.get("SB_ANON_KEY") || SB_PUBLISHABLE_API_KEY;
    const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY") || SB_SECRET_KEY;

    if (!SB_URL || !SB_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    // Client with user's auth for RLS
    const userClient = createClient(SB_URL, SB_KEY, {
      global: { headers: { Authorization: auth } }
    });

    // Service client for storage operations
    const serviceClient = SB_SERVICE_KEY
      ? createClient(SB_URL, SB_SERVICE_KEY)
      : userClient;

    // Verify user
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid JWT" }),
        { status: 401, headers: corsHeaders }
      );
    }
    const userId = userData.user.id;

    // Parse request
    const body: ProcessRequest = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "Missing job_id" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch job (RLS ensures user owns it)
    const { data: job, error: jobErr } = await userClient
      .from("temp_image_jobs")
      .select("id, status, storage_path, vital_type, extracted_data")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found or access denied" }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Check job status
    if (job.status !== "pending_ocr") {
      return new Response(
        JSON.stringify({
          error: `Job already ${job.status}`,
          reading: job.extracted_data
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Rate limit AFTER job validation so only real OCR attempts consume quota
    const rateResult = await checkRateLimit(userId, OCR_RATE_LIMIT);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "rate_limited",
          message: "Too many image scans. Please wait a few minutes or enter your numbers manually.",
          retryAfter: rateResult.retryAfter
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Update status to processing
    await userClient
      .from("temp_image_jobs")
      .update({ status: "processing" })
      .eq("id", job_id);

    // Download image from storage
    const { data: imageData, error: downloadErr } = await serviceClient
      .storage
      .from("temp_vital_images")
      .download(job.storage_path);

    if (downloadErr || !imageData) {
      await userClient
        .from("temp_image_jobs")
        .update({ status: "failed", error: "Failed to download image" })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({ error: "Failed to download image" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Convert blob to array buffer
    const imageBuffer = await imageData.arrayBuffer();

    // Perform vision OCR
    let ocrText: string;
    try {
      ocrText = await performOCR(imageBuffer, imageData.type || "image/jpeg", job.vital_type || "blood_pressure");
    } catch (ocrErr: unknown) {
      const ocrErrMessage = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);

      // No API key configured — preserve the client-side OCR fallback
      if (ocrErrMessage === 'OCR_CLIENT_SIDE_REQUIRED') {
        await userClient
          .from("temp_image_jobs")
          .update({ status: "pending_ocr", error: "Client-side OCR required" })
          .eq("id", job_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "ocr_client_required",
            message: "Please use client-side OCR. Server OCR not configured."
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Vision API failure or unparseable response — fail the job gracefully
      // so the senior lands on manual entry, never a raw 500.
      logger.error("Vision OCR failed", { error: ocrErrMessage.slice(0, 300) });
      await userClient
        .from("temp_image_jobs")
        .update({ status: "failed", error: ocrErrMessage.slice(0, 500) })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not read vitals from image. Please try again or enter manually."
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Parse OCR result
    const reading = parseVitalText(ocrText, job.vital_type || 'blood_pressure');

    if (!reading) {
      await userClient
        .from("temp_image_jobs")
        .update({
          status: "failed",
          error: "Could not extract vitals from image"
        })
        .eq("id", job_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not read vitals from image. Please try again or enter manually."
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Update job with extracted data
    await userClient
      .from("temp_image_jobs")
      .update({
        status: "processed",
        extracted_data: reading,
        processed_at: new Date().toISOString()
      })
      .eq("id", job_id);

    // Return success with reading
    const response: ProcessResponse = {
      success: true,
      reading: reading
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: corsHeaders }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Processing error", { error: errorMessage.slice(0, 500) });
    return new Response(
      JSON.stringify({ error: errorMessage || "Server error" }),
      { status: 500, headers: corsFromRequest(req).headers }
    );
  }
});
