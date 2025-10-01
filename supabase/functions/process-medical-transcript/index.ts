import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { transcript, sessionType, patientId, audioUrl, duration } = await req.json()

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Claude API key
    const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!claudeApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
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
        model: 'claude-sonnet-4-5-20250929', // Latest model for best nurse scribe performance
        max_tokens: 4000, // Increased for more detailed clinical notes
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: `You are an expert medical scribe AI. Analyze this medical transcript and provide structured output.

Session Type: ${sessionType}
Duration: ${duration} seconds
Patient ID: ${patientId || 'Not specified'}

Transcript:
${transcript}

Please provide a JSON response with the following structure:
{
  "summary": "Concise clinical summary (2-3 sentences)",
  "clinicalNotes": "Detailed SOAP-style clinical notes",
  "medicalCodes": [
    {
      "code": "ICD10/CPT/HCPCS code",
      "type": "ICD10|CPT|HCPCS",
      "description": "Code description",
      "confidence": 0.85
    }
  ],
  "actionItems": ["Follow-up in 2 weeks", "Order lab work"],
  "recommendations": ["Treatment recommendations"],
  "keyFindings": ["Important clinical findings"]
}

Guidelines:
- Only suggest codes you're confident about (>70% confidence)
- Focus on clear, actionable items
- Use standard medical terminology
- Be conservative with diagnoses - suggest "rule out" when uncertain
- Include relevant vital signs, symptoms, and assessment
- Format as valid JSON only`
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
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError)
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
      console.error('Audit log error:', auditError)
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

  } catch (error) {
    console.error('Medical transcript processing error:', error)

    // Log error for monitoring
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      await supabase
        .from('scribe_audit_log')
        .insert({
          session_type: 'error',
          error_message: error.message,
          success: false,
          processing_time_ms: Date.now()
        })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process medical transcript',
        details: error.message
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