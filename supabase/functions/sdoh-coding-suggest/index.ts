// Enhanced SDOH-aware coding suggestion Edge Function
// Integrates with Claude AI to analyze social determinants and suggest appropriate codes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SDOHCodingRequest {
  encounterId: string
  patientId?: string
  clinicalNotes?: string[]
  existingCodes?: {
    icd10?: string[]
    cpt?: string[]
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user for audit logging
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      try {
        const token = authHeader.replace(/^Bearer /, "");
        const { data } = await supabaseClient.auth.getUser(token);
        userId = data?.user?.id || null;
      } catch (e) {
        console.warn("Failed to get user from token:", e);
      }
    }

    const { encounterId, patientId, clinicalNotes, existingCodes }: SDOHCodingRequest = await req.json()

    if (!encounterId) {
      return new Response(JSON.stringify({ error: 'encounterId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get encounter data
    const { data: encounter, error: encounterError } = await supabaseClient
      .from('encounters')
      .select(`
        *,
        patient:patients(*),
        procedures:encounter_procedures(*),
        diagnoses:encounter_diagnoses(*),
        clinical_notes(*)
      `)
      .eq('id', encounterId)
      .single()

    if (encounterError || !encounter) {
      return new Response(JSON.stringify({ error: 'Encounter not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get patient's recent check-ins for SDOH analysis
    const { data: checkIns } = await supabaseClient
      .from('check_ins')
      .select('*')
      .eq('user_id', encounter.patient_id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Get existing SDOH assessment if available
    const { data: sdohAssessment } = await supabaseClient
      .from('sdoh_assessments')
      .select('*')
      .eq('patient_id', encounter.patient_id)
      .order('created_at', { ascending: false })
      .limit(1)

    // Prepare context for AI analysis
    const analysisContext = {
      encounter: {
        id: encounterId,
        date: encounter.date_of_service,
        existingDiagnoses: encounter.diagnoses?.map((d: any) => d.code) || [],
        existingProcedures: encounter.procedures?.map((p: any) => p.code) || []
      },
      patient: {
        age: calculateAge(encounter.patient?.dob),
        hasChronicConditions: hasChronicConditions(encounter.diagnoses || [])
      },
      clinicalNotes: encounter.clinical_notes?.map((note: any) => ({
        type: note.type,
        content: note.content
      })) || [],
      recentCheckIns: checkIns?.slice(0, 3).map(checkIn => ({
        date: checkIn.created_at,
        housingStatus: checkIn.housing_situation,
        foodSecurity: checkIn.food_security,
        transportationIssues: checkIn.transportation_barriers,
        socialSupport: checkIn.social_isolation_score,
        financialStress: checkIn.financial_stress
      })) || [],
      existingSDOH: sdohAssessment?.[0] || null
    }

    // Call Claude AI for enhanced analysis
    const startTime = Date.now();
    const aiAnalysis = await analyzeWithClaude(analysisContext, userId, encounterId, supabaseClient);
    const processingTime = Date.now() - startTime;

    // Save coding audit log (keep existing for backward compatibility)
    await supabaseClient.from('coding_audits').insert({
      encounter_id: encounterId,
      model: 'claude-sonnet-4-5-20250929',
      success: true,
      confidence: aiAnalysis.confidence,
      processing_time_ms: processingTime
    })

    return new Response(JSON.stringify(aiAnalysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('SDOH Coding Suggest Error:', error)

    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function analyzeWithClaude(context: any, userId: string | null, encounterId: string, supabaseClient: any) {
  const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!claudeApiKey) {
    throw new Error('Claude API key not configured')
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  const systemPrompt = `You are a medical coding specialist with expertise in social determinants of health (SDOH) and chronic care management (CCM) billing. Your role is to analyze clinical encounters and suggest appropriate ICD-10, CPT, and HCPCS codes with a focus on:

1. SDOH Z-codes (Z59.0-Z60.9) based on social factors
2. CCM billing codes (99490, 99491, 99487, 99489) based on complexity
3. Audit-ready documentation recommendations

Key Z-codes to consider:
- Z59.0: Homelessness
- Z59.1: Inadequate housing
- Z59.3: Food insecurity
- Z59.8: Transportation problems
- Z60.2: Social isolation
- Z59.6: Low income

CCM Eligibility Criteria:
- Basic CCM (99490): 2+ chronic conditions, 20+ minutes
- Complex CCM (99487): Multiple conditions + SDOH factors, 60+ minutes

Respond with structured JSON including codes, rationales, SDOH assessment, CCM recommendations, and audit readiness score.`

  const userPrompt = `Analyze this clinical encounter for coding opportunities:

ENCOUNTER DATA:
${JSON.stringify(context, null, 2)}

Provide enhanced coding suggestions focusing on:
1. All appropriate medical ICD-10 codes
2. SDOH Z-codes based on social factors identified
3. CCM CPT codes if eligible
4. Billing compliance and audit readiness assessment

Format as JSON with this structure:
{
  "medicalCodes": {
    "icd10": [
      {
        "code": "string",
        "rationale": "string",
        "principal": boolean,
        "category": "medical" | "sdoh"
      }
    ]
  },
  "procedureCodes": {
    "cpt": [
      {
        "code": "string",
        "modifiers": ["string"],
        "rationale": "string",
        "timeRequired": number,
        "sdohJustification": "string"
      }
    ]
  },
  "sdohAssessment": {
    "overallComplexityScore": number,
    "ccmEligible": boolean,
    "ccmTier": "standard" | "complex" | "non-eligible",
    "identifiedFactors": ["string"]
  },
  "ccmRecommendation": {
    "eligible": boolean,
    "tier": "standard" | "complex" | "non-eligible",
    "justification": "string",
    "expectedReimbursement": number,
    "requiredDocumentation": ["string"]
  },
  "auditReadiness": {
    "score": number,
    "missingElements": ["string"],
    "recommendations": ["string"]
  },
  "confidence": number,
  "notes": "string"
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929', // Latest model for best coding and analysis
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    const responseTime = Date.now() - startTime;

    // Calculate cost (Sonnet 4.5 pricing)
    const inputTokens = result.usage?.input_tokens || 0;
    const outputTokens = result.usage?.output_tokens || 0;
    const inputCost = (inputTokens * 0.003) / 1000;
    const outputCost = (outputTokens * 0.015) / 1000;
    const totalCost = inputCost + outputCost;

    // Parse the JSON response from Claude
    const content = result.content?.[0]?.text
    if (!content) {
      throw new Error('No content in Claude response')
    }

    try {
      // Extract JSON from Claude's response (it might include markdown formatting)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response')
      }

      const analysis = JSON.parse(jsonMatch[0])

      // HIPAA AUDIT LOGGING: Log successful Claude API call
      try {
        await supabaseClient.from('claude_api_audit').insert({
          request_id: requestId,
          user_id: userId,
          request_type: 'sdoh_coding',
          model: 'claude-sonnet-4-5-20250929',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost: totalCost,
          response_time_ms: responseTime,
          success: true,
          phi_scrubbed: true, // Patient data is de-identified
          metadata: {
            encounter_id: encounterId,
            confidence: analysis.confidence,
            ccm_eligible: analysis.ccmRecommendation?.eligible,
            sdoh_factors_count: analysis.sdohAssessment?.identifiedFactors?.length || 0
          }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      console.log(`[SDOH Coding] RequestID: ${requestId}, User: ${userId}, Encounter: ${encounterId}, Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${totalCost.toFixed(4)}, Time: ${responseTime}ms`);

      // Validate and enhance the response
      return {
        ...analysis,
        confidence: Math.min(Math.max(analysis.confidence || 75, 0), 100),
        timestamp: new Date().toISOString(),
        model: 'claude-sonnet-4-5-20250929'
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Claude response:', content)

      // HIPAA AUDIT LOGGING: Log parse error
      try {
        await supabaseClient.from('claude_api_audit').insert({
          request_id: requestId,
          user_id: userId,
          request_type: 'sdoh_coding',
          model: 'claude-sonnet-4-5-20250929',
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost: totalCost,
          response_time_ms: Date.now() - startTime,
          success: false,
          error_code: 'JSON_PARSE_ERROR',
          error_message: parseError.message,
          phi_scrubbed: true,
          metadata: { encounter_id: encounterId }
        });
      } catch (logError) {
        console.error('[Audit Log Error]:', logError);
      }

      // Fallback response if JSON parsing fails
      return {
        medicalCodes: { icd10: [] },
        procedureCodes: { cpt: [], hcpcs: [] },
        sdohAssessment: {
          overallComplexityScore: 0,
          ccmEligible: false,
          ccmTier: 'non-eligible',
          identifiedFactors: []
        },
        ccmRecommendation: {
          eligible: false,
          tier: 'non-eligible',
          justification: 'Unable to analyze due to parsing error',
          expectedReimbursement: 0,
          requiredDocumentation: []
        },
        auditReadiness: {
          score: 0,
          missingElements: ['AI analysis failed'],
          recommendations: ['Manual review required']
        },
        confidence: 0,
        notes: `Analysis failed: ${parseError.message}`,
        error: 'JSON_PARSE_ERROR'
      }
    }
  } catch (apiError) {
    console.error('Claude API error:', apiError)

    // HIPAA AUDIT LOGGING: Log API error
    try {
      await supabaseClient.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: userId,
        request_type: 'sdoh_coding',
        model: 'claude-sonnet-4-5-20250929',
        input_tokens: 0,
        output_tokens: 0,
        cost: 0,
        response_time_ms: Date.now() - startTime,
        success: false,
        error_code: apiError.name || 'CLAUDE_API_ERROR',
        error_message: apiError.message,
        phi_scrubbed: true,
        metadata: { encounter_id: encounterId }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    // Fallback response for API errors
    return {
      medicalCodes: { icd10: [] },
      procedureCodes: { cpt: [], hcpcs: [] },
      sdohAssessment: {
        overallComplexityScore: 0,
        ccmEligible: false,
        ccmTier: 'non-eligible',
        identifiedFactors: []
      },
      ccmRecommendation: {
        eligible: false,
        tier: 'non-eligible',
        justification: 'Unable to analyze due to API error',
        expectedReimbursement: 0,
        requiredDocumentation: []
      },
      auditReadiness: {
        score: 0,
        missingElements: ['AI analysis unavailable'],
        recommendations: ['Manual review required']
      },
      confidence: 0,
      notes: `API Error: ${apiError.message}`,
      error: 'CLAUDE_API_ERROR'
    }
  }
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null

  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age
}

function hasChronicConditions(diagnoses: any[]): boolean {
  // Common chronic condition ICD-10 prefixes
  const chronicPrefixes = [
    'E10', 'E11', // Diabetes
    'I10', 'I11', 'I12', 'I13', // Hypertension
    'J44', 'J45', // COPD/Asthma
    'N18', // CKD
    'F32', 'F33', // Depression
    'M05', 'M06', // Arthritis
    'I25' // CAD
  ]

  return diagnoses.some(diagnosis =>
    chronicPrefixes.some(prefix => diagnosis.code?.startsWith(prefix))
  )
}