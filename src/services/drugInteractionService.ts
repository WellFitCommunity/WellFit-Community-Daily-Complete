/**
 * Drug Interaction Service with Claude Vision Enhancement
 *
 * Combines FREE RxNorm API with Claude's clinical reasoning to provide:
 * - Real-time drug interaction checking
 * - Clinical context and management recommendations
 * - Plain-language explanations for patients
 * - Evidence-based severity assessments
 *
 * Uses: RxNorm Interaction API (FREE, no API key needed)
 * Enhanced by: Claude for clinical context
 * SOC 2 Compliant: Uses auditLogger instead of console.log
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

export interface DrugInteraction {
  severity: 'high' | 'moderate' | 'low' | 'contraindicated';
  interacting_medication: string;
  interacting_rxcui?: string;
  description: string;
  clinical_effects?: string;
  management?: string;
  patient_friendly_explanation?: string;
  source: 'rxnorm' | 'cache' | 'fdb';
  confidence?: number;
}

export interface DrugInteractionResult {
  has_interactions: boolean;
  interactions: DrugInteraction[];
  checked_against: string[];
  medication_name: string;
  medication_rxcui: string;
  total_active_medications: number;
  cache_hit: boolean;
}

/**
 * Check drug interactions for a new medication against patient's active meds
 * Uses Supabase Edge Function with RxNorm API
 */
export async function checkDrugInteractions(
  medicationRxcui: string,
  patientId: string,
  medicationName: string
): Promise<DrugInteractionResult> {
  try {
    // Call the deployed edge function
    const { data, error } = await supabase.functions.invoke('check-drug-interactions', {
      body: {
        medication_rxcui: medicationRxcui,
        patient_id: patientId,
        medication_name: medicationName
      }
    });

    if (error) {
      await auditLogger.error('DRUG_INTERACTION_CHECK_FAILED', error, {
        category: 'CLINICAL',
        medicationRxcui,
        patientId,
        errorDetails: error.message
      });
      throw new Error(`Failed to check interactions: ${error.message}`);
    }

    return data as DrugInteractionResult;
  } catch (error) {
    await auditLogger.error('DRUG_INTERACTION_ERROR', error as Error, {
      category: 'CLINICAL',
      medicationRxcui,
      patientId
    });
    throw error;
  }
}

/**
 * Enhance interaction with Claude Vision for clinical context
 * Claude provides: management recommendations, patient education, severity assessment
 */
export async function enhanceInteractionWithClaude(
  interaction: DrugInteraction,
  medicationName: string,
  patientContext?: {
    age?: number;
    conditions?: string[];
    allergies?: string[];
  }
): Promise<DrugInteraction> {
  try {
    // Call Claude via existing chat service or direct API
    const prompt = buildClaudePrompt(interaction, medicationName, patientContext);

    // Use your existing Claude integration
    const { data, error } = await supabase.functions.invoke('claude-chat', {
      body: {
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'claude-sonnet-4.5',
        max_tokens: 1000,
        context: 'drug_interaction_analysis'
      }
    });

    if (error || !data?.response) {
      await auditLogger.warn('CLAUDE_ENHANCEMENT_FAILED', {
        category: 'CLINICAL',
        medicationName,
        interactionSeverity: interaction.severity,
        reason: error?.message || 'No response from Claude'
      });
      return interaction;
    }

    // Parse Claude's response and enhance the interaction
    const enhanced = await parseClaudeResponse(data.response, interaction);
    return enhanced;

  } catch (error) {
    await auditLogger.error('CLAUDE_ENHANCEMENT_ERROR', error as Error, {
      category: 'CLINICAL',
      medicationName,
      interactionSeverity: interaction.severity
    });
    return interaction; // Return basic interaction if Claude fails
  }
}

/**
 * Build prompt for Claude to analyze drug interaction
 */
function buildClaudePrompt(
  interaction: DrugInteraction,
  medicationName: string,
  patientContext?: {
    age?: number;
    conditions?: string[];
    allergies?: string[];
  }
): string {
  return `You are an expert clinical pharmacist. Analyze this drug-drug interaction and provide clinical guidance.

**Proposed Medication:** ${medicationName}
**Interacting Medication:** ${interaction.interacting_medication}
**Detected Severity:** ${interaction.severity}
**Interaction Description:** ${interaction.description}

${patientContext ? `
**Patient Context:**
- Age: ${patientContext.age || 'Unknown'}
- Active Conditions: ${patientContext.conditions?.join(', ') || 'None listed'}
- Known Allergies: ${patientContext.allergies?.join(', ') || 'None listed'}
` : ''}

Please provide:

1. **Clinical Effects** (2-3 sentences): What happens physiologically when these drugs interact?

2. **Management Recommendations** (3-5 bullet points):
   - Specific actions the prescriber should take
   - Monitoring parameters (labs, vitals, symptoms)
   - Dose adjustments if applicable
   - Alternative medications to consider

3. **Patient-Friendly Explanation** (2-3 sentences):
   - Simple language explanation for the patient
   - What symptoms to watch for
   - When to seek medical attention

4. **Severity Assessment** (confirm or adjust):
   - Rate as: contraindicated, high, moderate, or low
   - Brief justification

Return as JSON:
{
  "clinical_effects": "...",
  "management": ["...", "...", "..."],
  "patient_friendly_explanation": "...",
  "severity": "high|moderate|low|contraindicated",
  "severity_justification": "..."
}`;
}

/**
 * Parse Claude's JSON response and merge with interaction
 */
async function parseClaudeResponse(
  claudeResponse: string,
  baseInteraction: DrugInteraction
): Promise<DrugInteraction> {
  try {
    // Extract JSON from Claude's response (handles markdown code blocks)
    const jsonMatch = claudeResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await auditLogger.warn('CLAUDE_RESPONSE_PARSE_FAILED', {
        category: 'CLINICAL',
        reason: 'No JSON found in Claude response',
        responsePreview: claudeResponse.substring(0, 200)
      });
      return baseInteraction;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      ...baseInteraction,
      clinical_effects: parsed.clinical_effects || baseInteraction.clinical_effects,
      management: Array.isArray(parsed.management)
        ? parsed.management.join('\n• ')
        : parsed.management || baseInteraction.management,
      patient_friendly_explanation: parsed.patient_friendly_explanation,
      severity: parsed.severity || baseInteraction.severity,
      confidence: 0.95 // High confidence when Claude validates
    };
  } catch (error) {
    await auditLogger.error('CLAUDE_RESPONSE_PARSE_ERROR', error as Error, {
      category: 'CLINICAL',
      responsePreview: claudeResponse.substring(0, 200)
    });
    return baseInteraction;
  }
}

/**
 * Get RxCUI code from medication name using RxNorm API
 */
export async function findRxCUI(medicationName: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(medicationName)}`
    );
    const data = await response.json();
    return data?.idGroup?.rxnormId?.[0] || null;
  } catch (error) {
    await auditLogger.error('RXNORM_RXCUI_LOOKUP_FAILED', error as Error, {
      category: 'CLINICAL',
      medicationName
    });
    return null;
  }
}

/**
 * Get medication details from RxCUI
 */
export async function getMedicationDetails(rxcui: string): Promise<{
  name: string;
  genericName?: string;
  brandNames?: string[];
} | null> {
  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`
    );
    const data = await response.json();

    if (!data?.properties) return null;

    return {
      name: data.properties.name,
      genericName: data.properties.genericName,
      brandNames: data.properties.brandNames || []
    };
  } catch (error) {
    await auditLogger.error('RXNORM_MEDICATION_DETAILS_FAILED', error as Error, {
      category: 'CLINICAL',
      rxcui
    });
    return null;
  }
}

/**
 * Check interactions with Claude-enhanced results
 * This is the main function to use in your UI
 */
export async function checkInteractionsWithAI(
  medicationRxcui: string,
  medicationName: string,
  patientId: string,
  enhanceWithClaude: boolean = true,
  patientContext?: {
    age?: number;
    conditions?: string[];
    allergies?: string[];
  }
): Promise<DrugInteractionResult> {
  // Step 1: Check basic interactions via RxNorm
  const result = await checkDrugInteractions(medicationRxcui, patientId, medicationName);

  // Step 2: If Claude enhancement requested and interactions found
  if (enhanceWithClaude && result.has_interactions && result.interactions.length > 0) {
    const enhancedInteractions = await Promise.all(
      result.interactions.map(interaction =>
        enhanceInteractionWithClaude(interaction, medicationName, patientContext)
      )
    );

    return {
      ...result,
      interactions: enhancedInteractions
    };
  }

  return result;
}

/**
 * Format interaction severity for UI display
 */
export function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'contraindicated':
      return '#DC2626'; // Red
    case 'high':
      return '#EA580C'; // Orange
    case 'moderate':
      return '#F59E0B'; // Yellow
    case 'low':
      return '#10B981'; // Green
    default:
      return '#6B7280'; // Gray
  }
}

/**
 * Get severity icon for UI
 */
export function getSeverityIcon(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'contraindicated':
      return '🛑';
    case 'high':
      return '⚠️';
    case 'moderate':
      return '⚡';
    case 'low':
      return 'ℹ️';
    default:
      return '❓';
  }
}

/**
 * Helper: Search medications by name (for autocomplete)
 */
export async function searchMedications(query: string, limit: number = 10): Promise<Array<{
  rxcui: string;
  name: string;
}>> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(query)}`
    );
    const data = await response.json();

    const suggestions = data?.drugGroup?.conceptGroup?.flatMap((group: any) =>
      group.conceptProperties?.map((concept: any) => ({
        rxcui: concept.rxcui,
        name: concept.name
      })) || []
    ) || [];

    return suggestions.slice(0, limit);
  } catch (error) {
    await auditLogger.error('MEDICATION_SEARCH_FAILED', error as Error, {
      category: 'CLINICAL',
      query,
      limit
    });
    return [];
  }
}

export default {
  checkDrugInteractions,
  checkInteractionsWithAI,
  enhanceInteractionWithClaude,
  findRxCUI,
  getMedicationDetails,
  searchMedications,
  getSeverityColor,
  getSeverityIcon
};
