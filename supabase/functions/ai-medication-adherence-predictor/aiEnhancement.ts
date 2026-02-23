/**
 * AI Enhancement for Medication Adherence Prediction
 *
 * Uses Claude API to enrich rule-based adherence predictions with
 * clinical summaries, patient talking points, and nuanced assessments
 * of health literacy and social support.
 *
 * @skill #31 - Medication Adherence Predictor
 */

import type { AdherencePrediction, MedicationInfo } from './types.ts';
import { SONNET_MODEL } from '../_shared/models.ts';

/**
 * Shape of the parsed AI enhancement response.
 * Used for type-safe extraction from Claude's JSON output.
 */
interface AIEnhancementResponse {
  clinicalSummary?: string;
  patientTalkingPoints?: string[];
  healthLiteracy?: AdherencePrediction['healthLiteracy'];
  socialSupport?: AdherencePrediction['socialSupport'];
}

/**
 * Type guard to verify the AI response is a valid object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validate and extract AI enhancement fields from parsed JSON.
 */
function extractEnhancements(parsed: unknown): AIEnhancementResponse {
  if (!isRecord(parsed)) {
    return {};
  }

  const result: AIEnhancementResponse = {};

  if (typeof parsed.clinicalSummary === 'string') {
    result.clinicalSummary = parsed.clinicalSummary;
  }

  if (Array.isArray(parsed.patientTalkingPoints)) {
    result.patientTalkingPoints = parsed.patientTalkingPoints.filter(
      (p: unknown): p is string => typeof p === 'string'
    );
  }

  const validLiteracy = ['low', 'moderate', 'adequate', 'high'];
  if (typeof parsed.healthLiteracy === 'string' && validLiteracy.includes(parsed.healthLiteracy)) {
    result.healthLiteracy = parsed.healthLiteracy as AIEnhancementResponse['healthLiteracy'];
  }

  const validSupport = ['none', 'limited', 'moderate', 'strong'];
  if (typeof parsed.socialSupport === 'string' && validSupport.includes(parsed.socialSupport)) {
    result.socialSupport = parsed.socialSupport as AIEnhancementResponse['socialSupport'];
  }

  return result;
}

/**
 * Build the clinical prompt for Claude based on prediction data and context.
 */
function buildPrompt(
  prediction: AdherencePrediction,
  medications: MedicationInfo[],
  context: Record<string, unknown>
): string {
  const barrierList = prediction.barriers.map(b => b.barrier).join(', ') || 'None identified';
  const historyInfo = prediction.historicalAdherence
    ? `Refill: ${prediction.historicalAdherence.refillAdherence}%, Check-ins: ${prediction.historicalAdherence.checkInAdherence}%`
    : 'No history available';

  const medList = medications
    .map(m => `- ${m.name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`)
    .join('\n');

  return `You are a clinical pharmacist analyzing medication adherence risk.

PATIENT CONTEXT:
- Age: ${context.age || 'Unknown'}
- Medications: ${medications.length}
- Regimen Complexity: ${prediction.regimenComplexity.complexityLevel}
- Identified Barriers: ${barrierList}
- Historical Adherence: ${historyInfo}

MEDICATIONS:
${medList}

HIGH-RISK MEDICATIONS:
${prediction.highRiskMedications.join(', ') || 'None'}

Provide a JSON response with:
1. clinicalSummary: 2-3 sentence clinical summary of adherence risk
2. patientTalkingPoints: Array of 3-4 key points to discuss with the patient in plain language
3. additionalBarriers: Array of any barriers not yet identified (or empty array)
4. healthLiteracy: Assessment of health literacy needs ('low', 'moderate', 'adequate', 'high')
5. socialSupport: Assessment of social support ('none', 'limited', 'moderate', 'strong')

SAFETY: Focus on patient-centered communication. Do not make assumptions about patient capability.

Respond with valid JSON only.`;
}

/**
 * Enhance a rule-based adherence prediction with AI-generated insights.
 * Falls back gracefully to the original prediction if AI is unavailable or fails.
 */
export async function enhanceWithAI(
  prediction: AdherencePrediction,
  medications: MedicationInfo[],
  context: Record<string, unknown>
): Promise<AdherencePrediction> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return prediction;
  }

  try {
    const prompt = buildPrompt(prediction, medications, context);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return prediction;
    }

    const aiResponse = await response.json() as Record<string, unknown>;
    const contentArray = aiResponse.content as Array<{ text?: string }> | undefined;
    const content = contentArray?.[0]?.text;

    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed: unknown = JSON.parse(jsonMatch[0]);
        const enhancements = extractEnhancements(parsed);

        if (enhancements.clinicalSummary) {
          prediction.clinicalSummary = enhancements.clinicalSummary;
        }
        if (enhancements.patientTalkingPoints && enhancements.patientTalkingPoints.length > 0) {
          prediction.patientTalkingPoints = enhancements.patientTalkingPoints;
        }
        if (enhancements.healthLiteracy) {
          prediction.healthLiteracy = enhancements.healthLiteracy;
        }
        if (enhancements.socialSupport) {
          prediction.socialSupport = enhancements.socialSupport;
        }
      }
    }

    return prediction;
  } catch (_err: unknown) {
    // AI enhancement is non-critical; fall back to rule-based prediction
    return prediction;
  }
}
