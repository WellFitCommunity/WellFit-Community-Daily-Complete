/**
 * Claude Personalization Edge Function
 *
 * Uses Claude Haiku 4.5 for ultra-fast dashboard personalization
 * and usage pattern analysis
 */

import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from "../_shared/auditLogger.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_SERVICE_KEY = SB_SECRET_KEY;

interface PersonalizationRequest {
  model: string;
  prompt: string;
  userId: string;
  requestType: string;
}

// ---------- PHI Redaction (HIPAA Compliance) ----------
// Copied from coding-suggest/index.ts for consistency
const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{1,5}\s+[A-Za-z0-9'.\- ]+\b/g, (m) => (m.length > 6 ? "[ADDRESS]" : m))
    .replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

function deepDeidentify(obj: unknown): unknown {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepDeidentify);
  if (typeof obj === "string") return redact(obj);
  if (typeof obj === "object") {
    const strip = new Set([
      "patient_name", "first_name", "last_name", "middle_name",
      "dob", "date_of_birth", "ssn", "email", "phone", "address",
      "address_line1", "address_line2", "city", "state", "zip",
      "mrn", "member_id", "insurance_id", "subscriber_name",
      "patient_id", "person_id", "user_id", "uid"
    ]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (strip.has(k)) continue;
      out[k] = deepDeidentify(v);
    }
    return out;
  }
  return obj;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body = await req.json();
    const { model, prompt, userId, requestType }: PersonalizationRequest = body;

    // Validate required fields
    if (!model || !prompt || !userId || !requestType) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: model, prompt, userId, requestType',
          received: { model: !!model, prompt: !!prompt, userId: !!userId, requestType: !!requestType }
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validate Anthropic API key
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // HIPAA COMPLIANCE: Scrub PHI from prompt before sending to Claude
    const scrubbedPrompt = redact(prompt);

    const startTime = Date.now();

    // Call Claude API with scrubbed prompt
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: scrubbedPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const logger = createLogger('claude-personalization', req);
      logger.error('Claude API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    // Extract content
    const content = data.content[0]?.text || '';

    // Log usage for cost tracking
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Calculate cost based on model pricing (as of 2025)
    const inputCostPer1M = model.includes('haiku') ? 0.80 : 3.00; // Haiku vs Sonnet
    const outputCostPer1M = model.includes('haiku') ? 4.00 : 15.00;
    const cost = ((data.usage?.input_tokens || 0) / 1_000_000 * inputCostPer1M) +
                 ((data.usage?.output_tokens || 0) / 1_000_000 * outputCostPer1M);

    const { error: logError } = await supabase.from('claude_usage_logs').insert({
      user_id: userId,
      request_id: crypto.randomUUID(),
      model: model,
      request_type: requestType,
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cost: cost,
      response_time_ms: responseTime,
      success: true,
    });

    if (logError) {
      const logger = createLogger('claude-personalization', req);
      logger.warn('Failed to log Claude usage', { error: logError.message });
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        content,
        model,
        usage: data.usage,
        responseTime,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: unknown) {
    const logger = createLogger('claude-personalization', req);

    // More detailed error response for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log to help debug
    logger.error('Personalization error', {
      message: errorMessage,
      stack: errorStack,
      hasAnthropicKey: !!ANTHROPIC_API_KEY,
      keyPrefix: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.substring(0, 10) + '...' : 'MISSING'
    });

    // Check if running in development mode (Deno-compatible)
    const isDevelopment = Deno.env.get('DENO_ENV') === 'development' ||
                          Deno.env.get('SUPABASE_ENV') === 'local';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: isDevelopment ? errorStack : undefined,
        timestamp: new Date().toISOString(),
        hint: 'Check Edge Function logs for more details'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
