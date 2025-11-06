// =====================================================
// LOG AI CONFIDENCE SCORE - Edge Function
// Purpose: Log AI suggestion confidence scores for transparency
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConfidenceScoreLog {
  patient_id?: string
  encounter_id?: string
  suggestion_type: 'billing_code_icd10' | 'billing_code_cpt' | 'billing_code_hcpcs' | 'soap_note' | 'clinical_recommendation' | 'drug_interaction' | 'risk_assessment'
  suggested_value: string
  confidence_score: number
  model_used: string
  processing_time_ms?: number
  reasoning_explanation?: string
  supporting_evidence?: Record<string, any>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const logData: ConfidenceScoreLog = await req.json()

    // Validate required fields
    if (!logData.suggestion_type || !logData.suggested_value || logData.confidence_score === undefined || !logData.model_used) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: suggestion_type, suggested_value, confidence_score, model_used' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate confidence score range
    if (logData.confidence_score < 0 || logData.confidence_score > 100) {
      return new Response(
        JSON.stringify({ error: 'Confidence score must be between 0 and 100' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Calculate confidence level
    let confidenceLevel = 'low'
    if (logData.confidence_score >= 90) {
      confidenceLevel = 'high'
    } else if (logData.confidence_score >= 75) {
      confidenceLevel = 'medium'
    }

    // Insert confidence score log
    const { data: insertedLog, error: insertError } = await supabaseClient
      .from('ai_confidence_scores')
      .insert({
        user_id: user.id,
        patient_id: logData.patient_id,
        encounter_id: logData.encounter_id,
        suggestion_type: logData.suggestion_type,
        suggested_value: logData.suggested_value,
        confidence_score: logData.confidence_score,
        confidence_level: confidenceLevel,
        model_used: logData.model_used,
        processing_time_ms: logData.processing_time_ms,
        reasoning_explanation: logData.reasoning_explanation,
        supporting_evidence: logData.supporting_evidence || {},
        provider_validated: false,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Check if this is first confidence validation - trigger milestone
    const { count } = await supabaseClient
      .from('ai_confidence_scores')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count === 1) {
      // First confidence score logged
      await supabaseClient.from('ai_learning_milestones').insert({
        user_id: user.id,
        milestone_type: 'first_confidence_validation',
        milestone_title: 'First AI Suggestion!',
        milestone_description: 'You received your first AI-powered clinical suggestion.',
        badge_icon: '🤖',
        celebration_type: 'toast',
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        log: insertedLog,
        confidence_level: confidenceLevel,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error logging AI confidence score:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
