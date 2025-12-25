/**
 * AI Provider Assistant Edge Function
 *
 * Role-adaptive conversational AI assistant for clinical staff.
 * Supports different roles with appropriate context and guardrails:
 * - Physicians: Clinical decision support, drug info, guidelines
 * - Nurses: Care coordination, patient education, assessments
 * - Care Coordinators: Discharge planning, referrals, resources
 * - Admin Staff: Scheduling, billing questions, workflows
 *
 * Safety guardrails:
 * - All clinical recommendations require physician confirmation
 * - Never provides definitive diagnoses
 * - Flags when questions require escalation
 * - PHI protection in all logs
 *
 * @skill #57 - Provider Assistant
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/auditLogger.ts';

// ============================================================================
// Types
// ============================================================================

type ProviderRole = 'physician' | 'nurse' | 'care_coordinator' | 'pharmacist' | 'admin' | 'other';
type QueryCategory = 'clinical' | 'medication' | 'documentation' | 'workflow' | 'patient_specific' | 'general';
type UrgencyLevel = 'routine' | 'soon' | 'urgent' | 'stat';

interface ProviderContext {
  role: ProviderRole;
  department?: string;
  specialization?: string;
}

interface PatientContext {
  patientId?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  recentVitals?: Record<string, number>;
  age?: number;
}

interface AssistantRequest {
  query: string;
  providerId: string;
  providerContext: ProviderContext;
  patientContext?: PatientContext;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  tenantId?: string;
}

interface AssistantResponse {
  response: string;
  category: QueryCategory;
  confidence: number;
  sources?: string[];
  suggestedActions?: Array<{
    action: string;
    urgency: UrgencyLevel;
    rationale: string;
  }>;
  relatedQueries?: string[];
  requiresPhysicianConfirmation: boolean;
  requiresEscalation: boolean;
  escalationReason?: string;
  disclaimers: string[];
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
    queryCategory: QueryCategory;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${keys.join(' or ')}`);
}

function classifyQuery(query: string): QueryCategory {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('patient') && (
    lowerQuery.includes('this') || lowerQuery.includes('my') ||
    lowerQuery.includes('current') || lowerQuery.includes('their')
  )) {
    return 'patient_specific';
  }

  if (lowerQuery.includes('drug') || lowerQuery.includes('medication') ||
      lowerQuery.includes('dose') || lowerQuery.includes('interaction') ||
      lowerQuery.includes('prescribe')) {
    return 'medication';
  }

  if (lowerQuery.includes('document') || lowerQuery.includes('note') ||
      lowerQuery.includes('chart') || lowerQuery.includes('record') ||
      lowerQuery.includes('icd') || lowerQuery.includes('cpt')) {
    return 'documentation';
  }

  if (lowerQuery.includes('schedule') || lowerQuery.includes('workflow') ||
      lowerQuery.includes('process') || lowerQuery.includes('policy')) {
    return 'workflow';
  }

  if (lowerQuery.includes('diagnos') || lowerQuery.includes('treatment') ||
      lowerQuery.includes('symptom') || lowerQuery.includes('guideline') ||
      lowerQuery.includes('protocol') || lowerQuery.includes('clinical')) {
    return 'clinical';
  }

  return 'general';
}

function getRoleSystemPrompt(role: ProviderRole): string {
  const basePrompt = `You are a clinical AI assistant helping healthcare providers. You provide accurate, evidence-based information while maintaining appropriate guardrails.

CRITICAL SAFETY RULES:
1. NEVER provide definitive diagnoses - always frame as considerations or differentials
2. ALWAYS recommend physician review for clinical decisions
3. NEVER recommend stopping prescribed medications without physician approval
4. Flag any situation requiring immediate attention
5. When uncertain, say so clearly
6. Cite guidelines and evidence when possible

`;

  switch (role) {
    case 'physician':
      return basePrompt + `You are assisting a PHYSICIAN. You can discuss:
- Differential diagnoses and clinical reasoning
- Treatment options with evidence levels
- Drug dosing and interactions
- Clinical guidelines and protocols
- Specialist referral criteria

Frame responses at an appropriate medical level. Include relevant ICD-10/CPT codes when helpful.`;

    case 'nurse':
      return basePrompt + `You are assisting a NURSE. You can help with:
- Patient assessment findings and documentation
- Care coordination tasks
- Patient education materials
- Medication administration guidance
- When to escalate to physician

Focus on nursing scope of practice. Recommend physician consultation for diagnostic or prescribing decisions.`;

    case 'care_coordinator':
      return basePrompt + `You are assisting a CARE COORDINATOR. You can help with:
- Discharge planning considerations
- Resource identification (DME, home health, SNF)
- Insurance and authorization guidance
- Care transitions and follow-up needs
- Community resource referrals

Focus on coordination of care across settings.`;

    case 'pharmacist':
      return basePrompt + `You are assisting a PHARMACIST. You can discuss:
- Drug interactions and contraindications
- Dosing adjustments for renal/hepatic impairment
- Therapeutic alternatives
- Medication reconciliation
- Patient counseling points

Provide detailed pharmacological information appropriate for clinical pharmacy practice.`;

    case 'admin':
      return basePrompt + `You are assisting ADMINISTRATIVE STAFF. You can help with:
- Scheduling and workflow questions
- Billing and coding guidance
- Policy and procedure information
- Patient communication templates
- Documentation requirements

Keep responses appropriate for non-clinical staff. Escalate clinical questions to appropriate providers.`;

    default:
      return basePrompt + `You are assisting a healthcare team member. Provide helpful information while being mindful that clinical decisions should involve appropriate licensed providers.`;
  }
}

function buildPrompt(
  request: AssistantRequest,
  category: QueryCategory
): string {
  const systemPrompt = getRoleSystemPrompt(request.providerContext.role);

  let contextSection = '';

  if (request.patientContext) {
    const pc = request.patientContext;
    contextSection = `
PATIENT CONTEXT (if relevant to query):
${pc.age ? `- Age: ${pc.age}` : ''}
${pc.conditions?.length ? `- Conditions: ${pc.conditions.join(', ')}` : ''}
${pc.medications?.length ? `- Current Medications: ${pc.medications.join(', ')}` : ''}
${pc.allergies?.length ? `- Allergies: ${pc.allergies.join(', ')}` : ''}
${pc.recentVitals ? `- Recent Vitals: ${JSON.stringify(pc.recentVitals)}` : ''}
`;
  }

  const categoryGuidance = {
    clinical: 'Focus on evidence-based clinical information. Cite guidelines when relevant.',
    medication: 'Provide accurate drug information. Include contraindications and interactions.',
    documentation: 'Help with coding, documentation requirements, and best practices.',
    workflow: 'Provide clear process guidance and policy information.',
    patient_specific: 'Use the patient context provided. Be specific but maintain appropriate guardrails.',
    general: 'Provide helpful, accurate information within appropriate scope.',
  };

  return `${systemPrompt}

QUERY CATEGORY: ${category}
GUIDANCE: ${categoryGuidance[category]}
${contextSection}
PROVIDER ROLE: ${request.providerContext.role}
${request.providerContext.department ? `DEPARTMENT: ${request.providerContext.department}` : ''}
${request.providerContext.specialization ? `SPECIALIZATION: ${request.providerContext.specialization}` : ''}

Respond in a structured, actionable format. If the query requires escalation or physician review, clearly indicate this.`;
}

function determineEscalation(
  query: string,
  category: QueryCategory,
  role: ProviderRole
): { requires: boolean; reason?: string } {
  const lowerQuery = query.toLowerCase();

  // Emergency keywords
  if (lowerQuery.includes('code') || lowerQuery.includes('arrest') ||
      lowerQuery.includes('emergency') || lowerQuery.includes('stat') ||
      lowerQuery.includes('unstable')) {
    return {
      requires: true,
      reason: 'Query indicates potential emergency - ensure appropriate resources are engaged',
    };
  }

  // Scope issues for non-physicians
  if (role !== 'physician' && role !== 'pharmacist') {
    if (lowerQuery.includes('prescribe') || lowerQuery.includes('diagnos') ||
        lowerQuery.includes('order')) {
      return {
        requires: true,
        reason: 'This query involves prescribing or diagnostic decisions requiring physician involvement',
      };
    }
  }

  return { requires: false };
}

async function generateResponse(
  request: AssistantRequest,
  category: QueryCategory,
  escalation: { requires: boolean; reason?: string }
): Promise<Omit<AssistantResponse, 'metadata'>> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!apiKey) {
    return generateFallbackResponse(request, category, escalation);
  }

  try {
    const systemPrompt = buildPrompt(request, category);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history if provided
    if (request.conversationHistory) {
      messages.push(...request.conversationHistory.slice(-6)); // Last 6 messages for context
    }

    messages.push({ role: 'user', content: request.query });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      return generateFallbackResponse(request, category, escalation);
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text || '';

    // Determine if physician confirmation is needed
    const requiresPhysicianConfirmation =
      category === 'clinical' ||
      category === 'medication' ||
      (category === 'patient_specific' && request.providerContext.role !== 'physician');

    // Build disclaimers based on context
    const disclaimers: string[] = [];
    if (requiresPhysicianConfirmation) {
      disclaimers.push('Clinical recommendations should be confirmed by the treating physician.');
    }
    if (category === 'medication') {
      disclaimers.push('Verify drug information in official references before clinical use.');
    }
    if (request.patientContext) {
      disclaimers.push('Patient-specific recommendations are based on provided context only.');
    }

    // Generate suggested actions if clinical
    const suggestedActions: AssistantResponse['suggestedActions'] = [];
    if (category === 'clinical' || category === 'patient_specific') {
      if (content.toLowerCase().includes('consider')) {
        suggestedActions.push({
          action: 'Review suggested considerations with care team',
          urgency: 'routine',
          rationale: 'AI-generated suggestions require clinical validation',
        });
      }
    }

    // Generate related queries
    const relatedQueries = generateRelatedQueries(request.query, category);

    return {
      response: content,
      category,
      confidence: 0.85,
      suggestedActions,
      relatedQueries,
      requiresPhysicianConfirmation,
      requiresEscalation: escalation.requires,
      escalationReason: escalation.reason,
      disclaimers,
    };
  } catch {
    return generateFallbackResponse(request, category, escalation);
  }
}

function generateFallbackResponse(
  request: AssistantRequest,
  category: QueryCategory,
  escalation: { requires: boolean; reason?: string }
): Omit<AssistantResponse, 'metadata'> {
  let response = '';
  const disclaimers: string[] = ['This is a fallback response. AI service may be temporarily unavailable.'];

  if (escalation.requires) {
    response = `This query has been flagged for escalation: ${escalation.reason}\n\nPlease consult with the appropriate clinical team member directly.`;
  } else {
    switch (category) {
      case 'medication':
        response = 'For medication-related questions, please consult your pharmacy team or reference sources like UpToDate, Lexicomp, or the prescribing information.';
        break;
      case 'clinical':
        response = 'For clinical questions, please reference clinical guidelines (e.g., UpToDate, specialty society guidelines) or consult with the care team.';
        break;
      case 'documentation':
        response = 'For documentation questions, please reference your facility\'s documentation policies or contact Health Information Management.';
        break;
      case 'workflow':
        response = 'For workflow questions, please consult your department\'s policies and procedures or contact your supervisor.';
        break;
      default:
        response = 'I apologize, but I\'m unable to process your request at this time. Please try again or contact the appropriate department for assistance.';
    }
  }

  return {
    response,
    category,
    confidence: 0.3,
    requiresPhysicianConfirmation: category === 'clinical' || category === 'medication',
    requiresEscalation: escalation.requires,
    escalationReason: escalation.reason,
    disclaimers,
  };
}

function generateRelatedQueries(query: string, category: QueryCategory): string[] {
  const related: string[] = [];

  switch (category) {
    case 'medication':
      related.push(
        'What are the common side effects?',
        'Are there any drug interactions to consider?',
        'What is the dosing for renal impairment?'
      );
      break;
    case 'clinical':
      related.push(
        'What are the current guidelines?',
        'When should I escalate care?',
        'What are the key monitoring parameters?'
      );
      break;
    case 'documentation':
      related.push(
        'What documentation is required for billing?',
        'What are the key elements to include?',
        'Are there any compliance considerations?'
      );
      break;
    default:
      related.push(
        'Can you provide more details?',
        'What resources are available?'
      );
  }

  return related.slice(0, 3);
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const startTime = Date.now();
  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger('ai-provider-assistant', req);

  try {
    const request = await req.json() as AssistantRequest;

    if (!request.query || !request.providerId || !request.providerContext) {
      return new Response(
        JSON.stringify({ error: 'Query, Provider ID, and Provider Context are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles: ProviderRole[] = ['physician', 'nurse', 'care_coordinator', 'pharmacist', 'admin', 'other'];
    if (!validRoles.includes(request.providerContext.role)) {
      request.providerContext.role = 'other';
    }

    // Classify the query
    const category = classifyQuery(request.query);

    // Check for escalation needs
    const escalation = determineEscalation(
      request.query,
      category,
      request.providerContext.role
    );

    // Generate response
    const result = await generateResponse(request, category, escalation);

    // Log the interaction (no PHI)
    logger.info('Provider assistant query processed', {
      providerId: request.providerId.substring(0, 8) + '...',
      role: request.providerContext.role,
      category,
      hasPatientContext: !!request.patientContext,
      requiresEscalation: escalation.requires,
      responseTimeMs: Date.now() - startTime,
    });

    // Store interaction for analytics (optional)
    try {
      const supabaseUrl = getEnv('SUPABASE_URL', 'SB_URL');
      const supabaseKey = getEnv('SB_SERVICE_ROLE_KEY', 'SB_SECRET_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('ai_assistant_interactions').insert({
        provider_id: request.providerId,
        provider_role: request.providerContext.role,
        query_category: category,
        requires_escalation: escalation.requires,
        requires_physician_confirmation: result.requiresPhysicianConfirmation,
        confidence: result.confidence,
        tenant_id: request.tenantId,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal - continue with response
    }

    const response: AssistantResponse = {
      ...result,
      metadata: {
        generatedAt: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
        model: 'claude-sonnet-4-20250514',
        queryCategory: category,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Provider assistant error', { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
