/**
 * Treatment pathway generation for the AI Treatment Pathway Recommender.
 *
 * Builds the grounded clinical prompt, calls Claude, and normalizes the response
 * with hard safety guardrails (always-require-review, allergy/contraindication
 * carry-through, low-confidence flagging). Falls back to a safe default pathway
 * when AI generation or parsing fails.
 *
 * @module ai-treatment-pathway/pathwayGenerator
 */

import { createLogger } from "../_shared/auditLogger.ts";
import { SONNET_MODEL } from "../_shared/models.ts";
import { buildConstraintBlock } from "../_shared/clinicalGroundingRules.ts";
import type {
  TreatmentPathway,
  TreatmentStep,
  MedicationRecommendation,
  PatientContext,
  ParsedPathwayResponse,
} from "./types.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// =====================================================
// CLINICAL GUIDELINES REFERENCE
// =====================================================

const CLINICAL_GUIDELINES: Record<string, string[]> = {
  diabetes: ["ADA Standards of Care 2024", "AACE Guidelines 2023"],
  hypertension: ["ACC/AHA Hypertension Guidelines 2017", "JNC 8"],
  hyperlipidemia: ["ACC/AHA Cholesterol Guidelines 2018"],
  heart_failure: ["ACC/AHA Heart Failure Guidelines 2022"],
  copd: ["GOLD Guidelines 2024"],
  asthma: ["GINA Guidelines 2024"],
  depression: ["APA Practice Guidelines", "CANMAT Guidelines 2023"],
  anxiety: ["APA Practice Guidelines", "NICE Guidelines"],
  obesity: ["Obesity Medicine Association Guidelines 2023"],
  ckd: ["KDIGO Guidelines 2024"],
  afib: ["ACC/AHA/HRS Atrial Fibrillation Guidelines 2023"],
  osteoporosis: ["AACE/ACE Osteoporosis Guidelines 2020"],
  thyroid: ["ATA Thyroid Guidelines 2023"],
};

export async function generateTreatmentPathway(
  condition: string,
  conditionCode: string,
  severity: string,
  isNewDiagnosis: boolean,
  treatmentGoals: string[],
  excludeMedications: string[],
  context: PatientContext,
  allergyConflicts: string[],
  logger: ReturnType<typeof createLogger>
): Promise<TreatmentPathway> {
  const prompt = buildTreatmentPrompt(
    condition,
    conditionCode,
    severity,
    isNewDiagnosis,
    treatmentGoals,
    excludeMedications,
    context,
    allergyConflicts
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error("Claude API error", { status: response.status, error: errorText });
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return normalizePathwayResponse(parsed, condition, conditionCode, allergyConflicts, context);
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback
  return getDefaultPathway(condition, conditionCode, severity, allergyConflicts, context);
}

function buildTreatmentPrompt(
  condition: string,
  conditionCode: string,
  severity: string,
  isNewDiagnosis: boolean,
  treatmentGoals: string[],
  excludeMedications: string[],
  context: PatientContext,
  allergyConflicts: string[]
): string {
  const sections = [];

  // Condition info
  sections.push(`CONDITION: ${condition}${conditionCode ? ` (${conditionCode})` : ""}`);
  sections.push(`SEVERITY: ${severity}`);
  sections.push(`NEW DIAGNOSIS: ${isNewDiagnosis ? "Yes" : "No (established)"}`);

  // Patient demographics
  sections.push(`\nPATIENT DEMOGRAPHICS:`);
  sections.push(`- Age Group: ${context.demographics.ageGroup}`);
  sections.push(`- Sex: ${context.demographics.sex}`);

  // Treatment goals
  if (treatmentGoals.length > 0) {
    sections.push(`\nTREATMENT GOALS: ${treatmentGoals.join(", ")}`);
  }

  // Comorbidities
  if (context.conditions.length > 0) {
    sections.push(`\nCOMORBIDITIES:`);
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
    sections.push(`\n⚠️ ALLERGIES: ${context.allergies.join(", ")}`);
  }

  // Allergy conflicts
  if (allergyConflicts.length > 0) {
    sections.push(`\n🚨 ALLERGY CONFLICTS:`);
    allergyConflicts.forEach((c) => {
      sections.push(`- ${c}`);
    });
  }

  // Contraindications
  if (context.contraindications.length > 0) {
    sections.push(`\n⚠️ CONTRAINDICATIONS:`);
    context.contraindications.forEach((c) => {
      sections.push(`- ${c}`);
    });
  }

  // Exclusions
  if (excludeMedications.length > 0) {
    sections.push(`\nEXCLUDE MEDICATIONS: ${excludeMedications.join(", ")}`);
  }

  // Recent labs
  if (Object.keys(context.recentLabs).length > 0) {
    sections.push(`\nRECENT LABS:`);
    for (const [name, data] of Object.entries(context.recentLabs)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push(`\nVITALS:`);
    for (const [name, data] of Object.entries(context.vitals)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // SDOH factors
  sections.push(`\nSDOH CONSIDERATIONS:`);
  sections.push(`- Transportation barriers: ${context.sdohFactors.hasTransportationBarriers ? "Yes" : "No"}`);
  sections.push(`- Financial barriers: ${context.sdohFactors.hasFinancialBarriers ? "Yes" : "No"}`);
  sections.push(`- Social support: ${context.sdohFactors.hasSocialSupport ? "Yes" : "Limited"}`);

  // Get relevant guidelines
  const conditionKey = Object.keys(CLINICAL_GUIDELINES).find((k) =>
    condition.toLowerCase().includes(k)
  );
  const guidelines = conditionKey ? CLINICAL_GUIDELINES[conditionKey] : [];

  if (guidelines.length > 0) {
    sections.push(`\nRELEVANT CLINICAL GUIDELINES: ${guidelines.join(", ")}`);
  }

  return `You are a clinical decision support system providing evidence-based treatment pathway recommendations.

${sections.join("\n")}

Generate a comprehensive, evidence-based treatment pathway following these guidelines:
1. Reference specific clinical guidelines (ADA, ACC, USPSTF, etc.)
2. Consider patient-specific factors (age, comorbidities, medications)
3. STRICTLY AVOID any medications the patient is allergic to
4. Respect listed contraindications
5. Include lifestyle modifications as first-line when appropriate
6. Provide stepwise treatment approach (first-line, second-line, etc.)
7. Include monitoring parameters and follow-up schedule

CRITICAL SAFETY REQUIREMENTS:
- Flag ALL recommendations as requiring clinician review
- Highlight any potential drug interactions
- Note renal/hepatic dosing considerations
- Include red flag symptoms requiring immediate attention

Return a JSON object with this structure:
{
  "condition": "${condition}",
  "conditionCode": "${conditionCode}",
  "pathwayTitle": "Treatment Pathway for ${condition}",
  "summary": "Brief 2-3 sentence summary of the recommended approach",
  "severity": "${severity}",
  "treatmentGoal": "Primary treatment goal",
  "steps": [
    {
      "stepNumber": 1,
      "phase": "first_line",
      "intervention": "Specific intervention",
      "interventionType": "medication|lifestyle|procedure|referral|monitoring|education",
      "rationale": "Clinical rationale",
      "expectedOutcome": "Expected outcome",
      "timeframe": "Duration/timing",
      "guidelineSource": "Specific guideline reference",
      "evidenceLevel": "A|B|C|D|expert_consensus",
      "considerations": ["Patient-specific considerations"],
      "contraindications": ["Who should not receive this"],
      "monitoringRequired": ["What to monitor"]
    }
  ],
  "medications": [
    {
      "medicationClass": "Drug class name",
      "examples": ["Generic names only"],
      "startingApproach": "Initial dosing approach",
      "targetOutcome": "Treatment target",
      "commonSideEffects": ["Side effects to counsel about"],
      "monitoringParameters": ["What to monitor"],
      "contraindicatedIn": ["Contraindications"],
      "guidelineSource": "Guideline reference",
      "requiresReview": true
    }
  ],
  "lifestyle": [
    {
      "category": "diet|exercise|smoking_cessation|alcohol|sleep|stress|weight",
      "recommendation": "Specific recommendation",
      "specificGuidance": "Detailed guidance",
      "expectedBenefit": "Expected benefit",
      "timeframe": "When to expect results",
      "resources": ["Patient resources"]
    }
  ],
  "referrals": [
    { "specialty": "Specialist type", "reason": "Reason for referral", "urgency": "routine|urgent|emergent" }
  ],
  "monitoringPlan": [
    { "parameter": "What to monitor", "frequency": "How often", "target": "Target value/range" }
  ],
  "followUpSchedule": "Recommended follow-up timing",
  "redFlags": ["Symptoms requiring immediate attention"],
  "patientEducation": ["Key points for patient education"],
  "guidelinesSummary": [
    { "guideline": "Guideline name", "year": 2024, "recommendation": "Key recommendation" }
  ],
  "contraindications": ["Pathway-level contraindications"],
  "allergyConflicts": ${JSON.stringify(allergyConflicts)},
  "confidence": 0.0-1.0,
  "requiresReview": true,
  "reviewReasons": ["All AI recommendations require clinician review"],
  "disclaimer": "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider."
}

Respond with ONLY the JSON object, no other text.

${buildConstraintBlock(['care_planning'])}`;
}

function normalizePathwayResponse(
  parsed: ParsedPathwayResponse,
  condition: string,
  conditionCode: string,
  allergyConflicts: string[],
  context: PatientContext
): TreatmentPathway {
  // SAFETY: Always require review
  const pathway: TreatmentPathway = {
    condition: parsed.condition || condition,
    conditionCode: parsed.conditionCode || conditionCode,
    pathwayTitle: parsed.pathwayTitle || `Treatment Pathway for ${condition}`,
    summary: parsed.summary || "Treatment pathway requiring clinician review.",
    severity: parsed.severity || "moderate",
    treatmentGoal: parsed.treatmentGoal || "Symptom management and disease control",
    steps: (parsed.steps || []).map((s, i: number) => ({
      ...s,
      stepNumber: s.stepNumber || i + 1,
      phase: s.phase || "first_line",
      evidenceLevel: s.evidenceLevel || "C",
    })) as TreatmentStep[],
    medications: (parsed.medications || []).map((m) => ({
      ...m,
      requiresReview: true, // SAFETY: Always require review
    })) as MedicationRecommendation[],
    lifestyle: parsed.lifestyle || [],
    referrals: parsed.referrals || [],
    monitoringPlan: parsed.monitoringPlan || [],
    followUpSchedule: parsed.followUpSchedule || "Follow up in 2-4 weeks",
    redFlags: parsed.redFlags || ["Any concerning symptoms should prompt immediate evaluation"],
    patientEducation: parsed.patientEducation || [],
    guidelinesSummary: parsed.guidelinesSummary || [],
    contraindications: [
      ...context.contraindications,
      ...(parsed.contraindications || []),
    ],
    allergyConflicts: [
      ...allergyConflicts,
      ...(parsed.allergyConflicts || []),
    ],
    confidence: parsed.confidence ?? 0.8,
    requiresReview: true, // SAFETY: Always require review
    reviewReasons: [
      "All AI-generated treatment recommendations require clinician review",
      ...(parsed.reviewReasons || []),
    ],
    disclaimer: parsed.disclaimer || "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider. This is not a substitute for professional medical judgment.",
  };

  // SAFETY: Flag low confidence
  if (pathway.confidence < 0.6) {
    pathway.reviewReasons.push("Low confidence score - careful review recommended");
  }

  return pathway;
}

function getDefaultPathway(
  condition: string,
  conditionCode: string,
  severity: string,
  allergyConflicts: string[],
  context: PatientContext
): TreatmentPathway {
  return {
    condition,
    conditionCode,
    pathwayTitle: `Treatment Pathway for ${condition}`,
    summary: "Unable to generate AI recommendations. Please consult clinical guidelines directly.",
    severity,
    treatmentGoal: "Disease management and symptom control",
    steps: [
      {
        stepNumber: 1,
        phase: "first_line",
        intervention: "Clinical assessment and guideline consultation",
        interventionType: "monitoring",
        rationale: "AI pathway generation failed - manual review required",
        expectedOutcome: "Appropriate treatment plan",
        timeframe: "Immediate",
        guidelineSource: "Consult relevant clinical guidelines",
        evidenceLevel: "expert_consensus",
        considerations: ["Requires full clinician review"],
        contraindications: context.contraindications,
        monitoringRequired: ["Per clinical judgment"],
      },
    ],
    medications: [],
    lifestyle: [
      {
        category: "diet",
        recommendation: "Healthy diet appropriate for condition",
        specificGuidance: "Consult with dietitian as needed",
        expectedBenefit: "Supports overall health",
        timeframe: "Ongoing",
        resources: ["Patient education materials"],
      },
    ],
    referrals: [],
    monitoringPlan: [
      { parameter: "Clinical status", frequency: "As clinically indicated", target: "Improvement" },
    ],
    followUpSchedule: "Follow up as clinically indicated",
    redFlags: ["Any concerning symptoms should prompt immediate evaluation"],
    patientEducation: ["Discuss condition and treatment options with your healthcare provider"],
    guidelinesSummary: [],
    contraindications: context.contraindications,
    allergyConflicts,
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: [
      "AI pathway generation failed - manual clinician review required",
      "Fallback pathway provided for safety",
    ],
    disclaimer: "AI recommendation unavailable. Please consult clinical guidelines and make independent clinical decisions.",
  };
}
