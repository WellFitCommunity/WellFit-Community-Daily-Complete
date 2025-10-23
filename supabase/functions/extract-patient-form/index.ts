import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

interface ExtractedPatientData {
  // Demographics
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  dob?: string; // MM/DD/YYYY
  age?: number;
  gender?: string;
  mrn?: string;
  ssn?: string;

  // Contact
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  // Emergency Contact
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;

  // Hospital Details
  admissionDate?: string;
  admissionTime?: string;
  hospitalUnit?: string;
  roomNumber?: string;
  bedNumber?: string;
  admissionSource?: string;
  acuityLevel?: string;
  codeStatus?: string;

  // Insurance
  primaryInsurance?: string;
  insuranceId?: string;
  insuranceGroupNumber?: string;
  medicareNumber?: string;
  medicaidNumber?: string;

  // Clinical
  clinicalNotes?: string;
  allergies?: string[];
  nkda?: boolean; // No Known Drug Allergies

  // Staff
  staffName?: string;
  dateCompleted?: string;
  timeCompleted?: string;
}

/**
 * Extract Patient Form Edge Function
 *
 * Uses Claude Vision API (Sonnet 4.5) to extract structured data from handwritten/printed
 * patient enrollment forms.
 *
 * Cost: ~$0.005 per form
 * - Input: ~1000 tokens (image) @ $3/1M = $0.003
 * - Output: ~500 tokens (JSON) @ $15/1M = $0.0075
 * - Total: ~$0.005 per form
 *
 * Accuracy: Claude Vision can read both handwriting and printed text with high accuracy
 */

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Get request body
    const { image, mimeType } = await req.json();

    if (!image) {
      return new Response(
        JSON.stringify({ success: false, error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Anthropic API key from environment
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Claude Vision API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType || 'image/jpeg',
                  data: image,
                },
              },
              {
                type: 'text',
                text: `You are an expert medical data entry assistant. Analyze this patient enrollment form image and extract ALL visible information into structured JSON format.

IMPORTANT INSTRUCTIONS:
1. Read BOTH handwritten and printed text carefully
2. Extract data from ALL sections of the form
3. If a field is blank/empty, use null (not empty string)
4. For checkboxes, look for X marks or checks
5. For dates, use MM/DD/YYYY format
6. For allergies, extract as array of strings
7. Preserve exact spelling of names and medications
8. If text is unclear, make your best attempt and note uncertainty

Return ONLY valid JSON in this exact structure:
{
  "firstName": "string or null",
  "lastName": "string or null",
  "middleInitial": "string or null",
  "dob": "MM/DD/YYYY or null",
  "age": number or null,
  "gender": "Male|Female|Other or null",
  "mrn": "string or null",
  "ssn": "string or null",
  "phone": "string or null",
  "email": "string or null",
  "address": "string or null",
  "city": "string or null",
  "state": "string or null",
  "zipCode": "string or null",
  "emergencyContactName": "string or null",
  "emergencyContactRelationship": "string or null",
  "emergencyContactPhone": "string or null",
  "admissionDate": "MM/DD/YYYY or null",
  "admissionTime": "string or null",
  "hospitalUnit": "string or null",
  "roomNumber": "string or null",
  "bedNumber": "string or null",
  "admissionSource": "Emergency Room|Physician Referral|Transfer|Other or null",
  "acuityLevel": "1-Critical|2-High|3-Moderate|4-Low|5-Stable or null",
  "codeStatus": "Full Code|DNR|DNR/DNI|Comfort Care|AND or null",
  "primaryInsurance": "string or null",
  "insuranceId": "string or null",
  "insuranceGroupNumber": "string or null",
  "medicareNumber": "string or null",
  "medicaidNumber": "string or null",
  "clinicalNotes": "string or null",
  "allergies": ["string"] or null,
  "nkda": boolean,
  "staffName": "string or null",
  "dateCompleted": "MM/DD/YYYY or null",
  "timeCompleted": "string or null",
  "confidence": "high|medium|low",
  "uncertainFields": ["field names where you're uncertain"],
  "notes": "Any important notes about data quality or unclear fields"
}

DO NOT include any text before or after the JSON. Return ONLY the JSON object.`,
              },
            ],
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API error:', errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Claude Vision API error: ${anthropicResponse.status}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicData = await anthropicResponse.json();

    // Extract JSON from Claude's response
    const responseText = anthropicData.content[0].text;

    // Try to parse the JSON
    let extractedData: ExtractedPatientData & { confidence?: string; uncertainFields?: string[]; notes?: string };
    try {
      // Claude should return pure JSON, but just in case, try to extract it
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        extractedData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to parse extracted data',
          details: responseText,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful extraction
    console.log('Successfully extracted patient data:', {
      name: `${extractedData.firstName} ${extractedData.lastName}`,
      mrn: extractedData.mrn,
      confidence: extractedData.confidence,
    });

    // Return extracted data
    return new Response(
      JSON.stringify({
        success: true,
        extractedData,
        usage: {
          inputTokens: anthropicData.usage?.input_tokens || 0,
          outputTokens: anthropicData.usage?.output_tokens || 0,
          estimatedCost: calculateCost(
            anthropicData.usage?.input_tokens || 0,
            anthropicData.usage?.output_tokens || 0
          ),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in extract-patient-form function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Calculate estimated cost for API usage
 * Claude Sonnet 4.5 pricing:
 * - Input: $3 per 1M tokens
 * - Output: $15 per 1M tokens
 */
function calculateCost(inputTokens: number, outputTokens: number): string {
  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;
  const totalCost = inputCost + outputCost;
  return `$${totalCost.toFixed(4)}`;
}
