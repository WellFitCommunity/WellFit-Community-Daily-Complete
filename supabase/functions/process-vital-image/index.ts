// supabase/functions/process-vital-image/index.ts
// OCR processing for photo-captured vital signs
// Uses Tesseract.js for digit recognition from BP cuffs, glucometers, etc.

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

// Tesseract worker for OCR - using CDN for Deno compatibility
// Note: In production, consider self-hosting the worker for reliability
const TESSERACT_CORE_PATH = "https://unpkg.com/tesseract.js-core@v5.0.0/tesseract-core.wasm.js";

interface VitalReading {
  type: 'blood_pressure' | 'glucose' | 'weight' | 'heart_rate' | 'temperature' | 'pulse_oximeter';
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  value?: number;
  unit?: string;
  confidence: number;
}

interface ProcessRequest {
  job_id: string;
}

interface ProcessResponse {
  success: boolean;
  reading?: VitalReading;
  error?: string;
}

/**
 * Parse OCR text to extract vital readings
 * Handles common display formats from medical devices
 */
function parseVitalText(text: string, vitalType: string): VitalReading | null {
  // Normalize text: remove noise, normalize spaces
  const normalized = text
    .replace(/[oO]/g, '0')  // Common OCR mistake
    .replace(/[lI]/g, '1')  // Common OCR mistake
    .replace(/[sS]/g, '5')  // Common OCR mistake on some fonts
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`[OCR] Parsing text for ${vitalType}: "${normalized}"`);

  switch (vitalType) {
    case 'blood_pressure':
      return parseBloodPressure(normalized);
    case 'glucose':
      return parseGlucose(normalized);
    case 'weight':
      return parseWeight(normalized);
    case 'heart_rate':
      return parseHeartRate(normalized);
    case 'pulse_oximeter':
      return parsePulseOximeter(normalized);
    case 'temperature':
      return parseTemperature(normalized);
    default:
      return parseBloodPressure(normalized); // Default to BP
  }
}

/**
 * Parse blood pressure reading (e.g., "142/86" or "SYS 142 DIA 86 PUL 78")
 */
function parseBloodPressure(text: string): VitalReading | null {
  // Pattern 1: Simple format "142/86" or "142 / 86"
  const simplePattern = /(\d{2,3})\s*[\/\-]\s*(\d{2,3})/;
  const simpleMatch = text.match(simplePattern);

  if (simpleMatch) {
    const sys = parseInt(simpleMatch[1], 10);
    const dia = parseInt(simpleMatch[2], 10);

    // Validate ranges
    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150) {
      // Look for pulse nearby
      const pulsePattern = /(?:pulse|pul|hr|bpm)[:\s]*(\d{2,3})/i;
      const pulseMatch = text.match(pulsePattern);
      const pulse = pulseMatch ? parseInt(pulseMatch[1], 10) : undefined;

      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : undefined,
        unit: 'mmHg',
        confidence: 0.8
      };
    }
  }

  // Pattern 2: Labeled format "SYS 142 DIA 86"
  const labeledSysPattern = /(?:sys|systolic)[:\s]*(\d{2,3})/i;
  const labeledDiaPattern = /(?:dia|diastolic)[:\s]*(\d{2,3})/i;
  const sysMatch = text.match(labeledSysPattern);
  const diaMatch = text.match(labeledDiaPattern);

  if (sysMatch && diaMatch) {
    const sys = parseInt(sysMatch[1], 10);
    const dia = parseInt(diaMatch[1], 10);

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150) {
      const pulsePattern = /(?:pulse|pul|hr|bpm)[:\s]*(\d{2,3})/i;
      const pulseMatch = text.match(pulsePattern);
      const pulse = pulseMatch ? parseInt(pulseMatch[1], 10) : undefined;

      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : undefined,
        unit: 'mmHg',
        confidence: 0.9
      };
    }
  }

  // Pattern 3: Just three numbers in a row (common on digital displays)
  const threeNumbers = text.match(/(\d{2,3})\D+(\d{2,3})\D+(\d{2,3})/);
  if (threeNumbers) {
    const nums = [
      parseInt(threeNumbers[1], 10),
      parseInt(threeNumbers[2], 10),
      parseInt(threeNumbers[3], 10)
    ].sort((a, b) => b - a); // Sort descending

    // Largest is systolic, middle is diastolic, smallest is pulse
    const [sys, dia, pulse] = nums;

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && pulse >= 30 && pulse <= 220) {
      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse,
        unit: 'mmHg',
        confidence: 0.6 // Lower confidence for inferred order
      };
    }
  }

  return null;
}

/**
 * Parse glucose reading (e.g., "126 mg/dL" or "126")
 */
function parseGlucose(text: string): VitalReading | null {
  const pattern = /(\d{2,3})\s*(?:mg\/?dl)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 40 && value <= 600) {
      return {
        type: 'glucose',
        value: value,
        unit: 'mg/dL',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse weight reading (e.g., "185.4 lbs" or "185")
 */
function parseWeight(text: string): VitalReading | null {
  const pattern = /(\d{2,3}(?:\.\d)?)\s*(?:lbs?|pounds?|kg)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseFloat(match[1]);
    if (value >= 50 && value <= 500) {
      return {
        type: 'weight',
        value: value,
        unit: 'lbs',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse heart rate reading (e.g., "78 bpm" or "78")
 */
function parseHeartRate(text: string): VitalReading | null {
  const pattern = /(\d{2,3})\s*(?:bpm|beats?)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 30 && value <= 220) {
      return {
        type: 'heart_rate',
        value: value,
        unit: 'bpm',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse pulse oximeter reading (e.g., "98%" or "SpO2 98")
 */
function parsePulseOximeter(text: string): VitalReading | null {
  const pattern = /(?:spo2|o2|sat)?[:\s]*(\d{2,3})\s*%?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 50 && value <= 100) {
      return {
        type: 'pulse_oximeter',
        value: value,
        unit: '%',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Parse temperature reading (e.g., "98.6 F" or "98.6")
 */
function parseTemperature(text: string): VitalReading | null {
  const pattern = /(\d{2,3}(?:\.\d)?)\s*(?:°?[fF])?/;
  const match = text.match(pattern);

  if (match) {
    const value = parseFloat(match[1]);
    if (value >= 90 && value <= 110) {
      return {
        type: 'temperature',
        value: value,
        unit: '°F',
        confidence: 0.85
      };
    }
  }

  return null;
}

/**
 * Simple OCR using canvas and pattern matching
 * For production, use Tesseract.js or cloud OCR API
 */
async function performOCR(imageData: ArrayBuffer): Promise<string> {
  // TODO: Integrate actual Tesseract.js OCR
  // For now, return empty string - frontend will use client-side OCR
  // This function is a placeholder for server-side OCR capability

  // In production, you would:
  // 1. Use Tesseract.js with WASM worker
  // 2. Or call Google Cloud Vision API
  // 3. Or call AWS Textract

  console.log(`[OCR] Image size: ${imageData.byteLength} bytes`);

  // Placeholder: Return instruction to use client-side OCR
  throw new Error('OCR_CLIENT_SIDE_REQUIRED');
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
      .select("*")
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

    // Perform OCR
    let ocrText: string;
    try {
      ocrText = await performOCR(imageBuffer);
    } catch (ocrErr: any) {
      // If server-side OCR not available, indicate client should do OCR
      if (ocrErr.message === 'OCR_CLIENT_SIDE_REQUIRED') {
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
      throw ocrErr;
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

  } catch (error: any) {
    console.error("[process-vital-image] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Server error" }),
      { status: 500, headers: corsFromRequest(req).headers }
    );
  }
});
