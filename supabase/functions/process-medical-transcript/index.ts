import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createAdminClient } from '../_shared/supabaseClient.ts'
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const logger = createLogger("process-medical-transcript");

interface MedicalCode {
  code: string;
  type: 'ICD10' | 'CPT' | 'HCPCS';
  description: string;
  confidence: number;
}

interface ProcessingResult {
  summary: string;
  medicalCodes: MedicalCode[];
  actionItems: string[];
  clinicalNotes: string;
  recommendations: string[];
}

serve(async (req) => {
  // Handle CORS preflight with dynamic origin validation
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const { transcript, sessionType, patientId, audioUrl, duration } = await req.json()

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with connection pooling
    const supabase = createAdminClient()

    // Get Claude API key
    const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    // Get authorization header to identify user
    const authHeader = req.headers.get('authorization');
    let userId = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Fetch provider preferences if authenticated
    let prefs = null;
    if (userId) {
      const { data } = await supabase
        .from('provider_scribe_preferences')
        .select('*')
        .eq('provider_id', userId)
        .single();
      prefs = data;
    }

    // Get current context
    const currentHour = new Date().getHours();
    const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : currentHour < 21 ? 'evening' : 'night';

    // Build conversational prompt
    let promptContent: string;

    if (prefs) {
      // Dynamic import of conversational prompts
      const { getDocumentationPrompt } = await import("../_shared/conversationalScribePrompts.ts");

      promptContent = getDocumentationPrompt(transcript, {
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
      }, sessionType, {
        time_of_day: timeOfDay,
        current_mood: 'neutral'
      });
    } else {
      // Default conversational prompt for unauthenticated users
      promptContent = `You are an experienced medical scribe - like a trusted coworker who's been doing this for years.
Analyze this medical transcript and provide structured, helpful output.

Session Type: ${sessionType}
Duration: ${duration} seconds
Patient ID: ${patientId || 'Not specified'}

Transcript:
${transcript}

Return JSON with this structure:
{
  "conversational_note": "Brief, friendly comment about the visit",
  "summary": "Concise clinical summary (2-3 sentences)",
  "clinicalNotes": "Detailed SOAP-style clinical notes",
  "medicalCodes": [
    {
      "code": "ICD10/CPT/HCPCS code",
      "type": "ICD10|CPT|HCPCS",
      "description": "Code description",
      "confidence": 0.85,
      "reasoning": "Why this code fits"
    }
  ],
  "actionItems": ["Specific, actionable items"],
  "recommendations": ["Clinical recommendations"],
  "keyFindings": ["Important findings"],
  "questions_for_provider": ["Things you're unsure about"]
}

Be helpful and precise - suggest the RIGHT codes, not just any codes. Quality over quantity.`;
    }

    // Process transcript with Claude AI
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929', // Latest model for best scribe performance
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: promptContent
        }]
      })
    })

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.status}`)
    }

    const claudeData = await claudeResponse.json()
    const aiContent = claudeData.content[0].text

    // Parse AI response
    let aiResult: ProcessingResult
    try {
      // Extract JSON from AI response (handle potential markdown formatting)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        aiResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No valid JSON found in AI response')
      }
    } catch (parseError: unknown) {
      const parseErrMsg = parseError instanceof Error ? parseError.message : String(parseError);
      logger.error("Failed to parse AI response", { error: parseErrMsg.slice(0, 500) });
      // Fallback response
      aiResult = {
        summary: 'Medical transcript processed. Please review for accuracy.',
        medicalCodes: [],
        actionItems: ['Review transcript for accuracy', 'Complete documentation'],
        clinicalNotes: transcript,
        recommendations: []
      }
    }

    // Validate and clean medical codes
    const validatedCodes = aiResult.medicalCodes?.filter(code =>
      code.confidence >= 0.7 &&
      code.code &&
      code.type &&
      code.description
    ) || []

    // Create audit log entry
    const { error: auditError } = await supabase
      .from('scribe_audit_log')
      .insert({
        session_type: sessionType,
        transcript_length: transcript.length,
        duration_seconds: duration,
        ai_model_used: 'claude-sonnet-4.5',
        codes_suggested: validatedCodes.length,
        processing_time_ms: Date.now(),
        success: true
      })

    if (auditError) {
      logger.error("Audit log error", { error: auditError.message?.slice(0, 500) });
    }

    // Return processed results
    const response = {
      summary: aiResult.summary,
      clinicalNotes: aiResult.clinicalNotes || transcript,
      medicalCodes: validatedCodes,
      actionItems: aiResult.actionItems || [],
      recommendations: aiResult.recommendations || [],
      keyFindings: aiResult.keyFindings || [],
      processingTime: Date.now(),
      confidence: validatedCodes.length > 0 ?
        validatedCodes.reduce((sum, code) => sum + code.confidence, 0) / validatedCodes.length : 0
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Medical transcript processing error", { error: errorMessage.slice(0, 500) });

    // Log error for monitoring
    try {
      const supabaseUrl = SUPABASE_URL ?? ''
      const supabaseKey = SB_SECRET_KEY ?? ''
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase
        .from('scribe_audit_log')
        .insert({
          session_type: 'error',
          error_message: errorMessage.slice(0, 500),
          success: false,
          processing_time_ms: Date.now()
        })
    } catch (logErr: unknown) {
      const logErrMsg = logErr instanceof Error ? logErr.message : String(logErr);
      logger.error("Failed to log error to audit table", { error: logErrMsg.slice(0, 500) });
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process medical transcript',
        details: errorMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})