/**
 * AI Prompt Construction
 *
 * Builds the Claude API prompt from patient context, matched guidelines,
 * and preventive screening status.
 *
 * @module ai-clinical-guideline-matcher/promptBuilder
 */

import type {
  ClinicalGuideline,
  PatientContext,
  PreventiveScreening,
} from "./types.ts";
import { buildConstraintBlock } from "../_shared/clinicalGroundingRules.ts";
import { buildSafeDocumentSection } from "../_shared/promptInjectionGuard.ts";

/**
 * Constructs the full prompt for Claude to analyze patient data
 * against applicable clinical guidelines and identify gaps.
 */
export function buildGuidelinePrompt(
  context: PatientContext,
  matchedGuidelines: ClinicalGuideline[],
  preventiveScreenings: PreventiveScreening[]
): string {
  const sections: string[] = [];

  // Patient demographics
  sections.push(`PATIENT DEMOGRAPHICS:`);
  sections.push(`- Age: ${context.demographics.age}`);
  sections.push(`- Sex: ${context.demographics.sex}`);

  // Conditions
  if (context.conditions.length > 0) {
    sections.push(`\nACTIVE CONDITIONS:`);
    context.conditions.forEach((c) => {
      sections.push(`- ${c.display} (${c.code})`);
    });
  }

  // Current medications
  if (context.medications.length > 0) {
    sections.push(`\nCURRENT MEDICATIONS:`);
    context.medications.forEach((m) => {
      sections.push(`- ${m.name}`);
    });
  }

  // Allergies
  if (context.allergies.length > 0) {
    sections.push(`\nALLERGIES: ${context.allergies.join(", ")}`);
  }

  // Recent labs
  if (Object.keys(context.recentLabs).length > 0) {
    sections.push(`\nRECENT LABS:`);
    for (const [name, data] of Object.entries(context.recentLabs)) {
      sections.push(`- ${name}: ${data.value} ${data.unit} (${new Date(data.date).toLocaleDateString()})`);
    }
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push(`\nVITALS:`);
    for (const [name, data] of Object.entries(context.vitals)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // Matched guidelines
  if (matchedGuidelines.length > 0) {
    sections.push(`\nAPPLICABLE GUIDELINES:`);
    matchedGuidelines.forEach((g) => {
      sections.push(`- ${g.guidelineName} (${g.organization}, ${g.year})`);
    });
  }

  // Preventive screenings
  if (preventiveScreenings.length > 0) {
    sections.push(`\nPREVENTIVE SCREENING STATUS:`);
    preventiveScreenings.forEach((s) => {
      sections.push(`- ${s.screeningName}: ${s.status} (${s.guidelineSource})`);
    });
  }

  const safeClinicalData = buildSafeDocumentSection(sections.join("\n"), 'Clinical Data');

  return `You are a clinical decision support system that matches patient data against evidence-based clinical guidelines.

${safeClinicalData.text}

Analyze this patient's data against the applicable clinical guidelines. Identify:
1. ADHERENCE GAPS - Where current care doesn't align with guideline recommendations
2. RECOMMENDATIONS - Specific evidence-based recommendations with guideline references
3. LAB/VITAL CONCERNS - Values outside guideline targets

CRITICAL REQUIREMENTS:
- Reference specific guideline sources (e.g., "ADA 2024 recommends...")
- Include evidence levels (A/B/C/D)
- Prioritize by clinical urgency
- Consider patient allergies and contraindications
- Flag items requiring clinician review

Return a JSON object with this structure:
{
  "recommendations": [
    {
      "recommendationId": "rec-001",
      "guideline": {
        "guidelineId": "guideline-id",
        "guidelineName": "Guideline Name",
        "organization": "Organization",
        "year": 2024,
        "condition": "Condition"
      },
      "category": "treatment|monitoring|screening|lifestyle|referral|diagnostic",
      "recommendation": "Specific recommendation",
      "rationale": "Clinical rationale with guideline reference",
      "evidenceLevel": "A|B|C|D|expert_consensus",
      "urgency": "routine|soon|urgent|emergent",
      "targetValue": "Target if applicable",
      "currentValue": "Current value if applicable",
      "gap": "Description of gap if applicable",
      "actionItems": ["Specific action items"]
    }
  ],
  "adherenceGaps": [
    {
      "gapId": "gap-001",
      "guideline": {
        "guidelineId": "guideline-id",
        "guidelineName": "Guideline Name",
        "organization": "Organization",
        "year": 2024,
        "condition": "Condition"
      },
      "gapType": "missing_medication|missing_test|suboptimal_control|missing_referral|missing_screening|lifestyle",
      "description": "Description of the gap",
      "expectedCare": "What guideline recommends",
      "currentState": "Current patient status",
      "recommendation": "How to address the gap",
      "priority": "low|medium|high|critical"
    }
  ],
  "confidence": 0.0-1.0,
  "reviewReasons": ["Reasons this needs clinician review"]
}

Respond with ONLY the JSON object, no other text.

${buildConstraintBlock(['care_planning'])}`;
}
