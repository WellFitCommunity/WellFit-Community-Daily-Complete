/**
 * SOAP Note Response Normalizer
 *
 * Normalizes AI responses to consistent GeneratedSOAPNote structure
 * and provides fallback notes when AI generation fails.
 */

import type {
  SOAPNoteSection,
  GeneratedSOAPNote,
  EncounterContext,
  ParsedSOAPResponse,
} from "./types.ts";

// PHI Redaction - HIPAA Compliance
export const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b(19|20)\d{2}[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, "[DATE]");

/**
 * Normalize the AI response to ensure consistent structure
 */
export function normalizeSOAPResponse(parsed: ParsedSOAPResponse): GeneratedSOAPNote {
  const normalizeSection = (section: string | SOAPNoteSection | undefined, defaultContent: string): SOAPNoteSection => {
    if (typeof section === "string") {
      return { content: section, confidence: 0.8, sources: [] };
    }
    return {
      content: section?.content || defaultContent,
      confidence: section?.confidence ?? 0.8,
      sources: section?.sources || [],
    };
  };

  return {
    subjective: normalizeSection(parsed.subjective, "Unable to generate subjective section."),
    objective: normalizeSection(parsed.objective, "Unable to generate objective section."),
    assessment: normalizeSection(parsed.assessment, "Assessment pending clinician review."),
    plan: normalizeSection(parsed.plan, "Plan pending clinician review."),
    hpi: parsed.hpi ? normalizeSection(parsed.hpi, "") : undefined,
    ros: parsed.ros ? normalizeSection(parsed.ros, "") : undefined,
    icd10Suggestions: parsed.icd10Suggestions || [],
    cptSuggestions: parsed.cptSuggestions || [],
    requiresReview: parsed.requiresReview ?? true,
    reviewReasons: parsed.reviewReasons || ["AI-generated content requires clinician review"],
  };
}

/**
 * Default SOAP note if AI generation fails
 */
export function getDefaultSOAPNote(context: EncounterContext): GeneratedSOAPNote {
  const subjective = context.chiefComplaint
    ? `Patient presents with: ${context.chiefComplaint}`
    : "Subjective information not documented.";

  const vitalStrings = [];
  if (context.vitals.blood_pressure_systolic && context.vitals.blood_pressure_diastolic) {
    vitalStrings.push(
      `BP: ${context.vitals.blood_pressure_systolic.value}/${context.vitals.blood_pressure_diastolic.value} mmHg`
    );
  }
  if (context.vitals.heart_rate) {
    vitalStrings.push(`HR: ${context.vitals.heart_rate.value} bpm`);
  }
  if (context.vitals.temperature) {
    vitalStrings.push(`Temp: ${context.vitals.temperature.value}°F`);
  }
  if (context.vitals.respiratory_rate) {
    vitalStrings.push(`RR: ${context.vitals.respiratory_rate.value}/min`);
  }
  if (context.vitals.oxygen_saturation) {
    vitalStrings.push(`SpO2: ${context.vitals.oxygen_saturation.value}%`);
  }

  const objective = vitalStrings.length > 0 ? `Vitals: ${vitalStrings.join(", ")}` : "No vitals documented.";

  const assessment =
    context.diagnoses.length > 0
      ? context.diagnoses.map((d, i) => `${i + 1}. ${d.display} (${d.code})`).join("\n")
      : "Assessment pending further evaluation.";

  const plan =
    context.medications.length > 0
      ? `Medications:\n${context.medications.map((m) => `- ${m.name} ${m.dosage} ${m.frequency}`).join("\n")}\n\nFollow-up as scheduled.`
      : "Plan pending clinician review.";

  return {
    subjective: { content: subjective, confidence: 0.6, sources: ["fallback"] },
    objective: { content: objective, confidence: 0.7, sources: ["vitals"] },
    assessment: { content: assessment, confidence: 0.5, sources: ["diagnoses"] },
    plan: { content: plan, confidence: 0.5, sources: ["medications"] },
    icd10Suggestions: context.diagnoses.map((d) => ({
      code: d.code,
      display: d.display,
      confidence: 0.7,
    })),
    cptSuggestions: [],
    requiresReview: true,
    reviewReasons: ["AI generation failed - fallback content requires complete review"],
  };
}
