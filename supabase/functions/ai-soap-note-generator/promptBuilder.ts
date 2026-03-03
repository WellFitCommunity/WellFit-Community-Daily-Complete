/**
 * SOAP Note Prompt Builder
 *
 * Constructs the Claude API prompt from encounter context.
 * Supports cultural competency context injection (Session 2.5).
 */

import type { EncounterContext, PhysicianStyleHint } from "./types.ts";

/**
 * Build the prompt for SOAP note generation.
 * When physicianStyle is provided (Session 3 — 3.5), the prompt adapts to
 * the physician's learned documentation preferences.
 * When culturalContext is provided (Session 2.5), cultural competency
 * guidance is injected to produce culturally-informed documentation.
 */
export function buildSOAPPrompt(
  context: EncounterContext,
  templateStyle: string,
  physicianStyle?: PhysicianStyleHint,
  culturalContext?: string
): string {
  const sections = [];

  // Chief Complaint
  if (context.chiefComplaint) {
    sections.push(`Chief Complaint: ${context.chiefComplaint}`);
  }

  // Visit Information
  sections.push(`Visit Type: ${context.visitType}`);
  if (context.durationMinutes) {
    sections.push(`Visit Duration: ${context.durationMinutes} minutes`);
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push("\nVital Signs:");
    for (const [name, data] of Object.entries(context.vitals)) {
      const displayName = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      sections.push(`- ${displayName}: ${data.value} ${data.unit}`);
    }
  }

  // Active Diagnoses
  if (context.diagnoses.length > 0) {
    sections.push("\nActive Diagnoses:");
    context.diagnoses.forEach((d, i) => {
      sections.push(`${i + 1}. ${d.display} (${d.code}) - ${d.status}`);
    });
  }

  // Current Medications
  if (context.medications.length > 0) {
    sections.push("\nCurrent Medications:");
    context.medications.forEach((m) => {
      sections.push(`- ${m.name} ${m.dosage} ${m.frequency}`.trim());
    });
  }

  // Lab Results
  if (context.labResults.length > 0) {
    sections.push("\nRecent Lab Results:");
    context.labResults.forEach((l) => {
      sections.push(`- ${l.test}: ${l.value} ${l.unit}${l.interpretation ? ` (${l.interpretation})` : ""}`);
    });
  }

  // Allergies
  if (context.allergies.length > 0) {
    sections.push(`\nAllergies: ${context.allergies.join(", ")}`);
  }

  // Medical History
  if (context.medicalHistory.length > 0) {
    sections.push(`\nPast Medical History: ${context.medicalHistory.join(", ")}`);
  }

  // Transcript
  if (context.transcript) {
    sections.push(`\nEncounter Transcript:\n${context.transcript}`);
  }

  // Provider Notes
  if (context.providerNotes) {
    sections.push(`\nProvider Notes:\n${context.providerNotes}`);
  }

  const styleInstructions: Record<string, string> = {
    brief: "Keep sections concise (2-3 sentences each). Focus on key clinical points.",
    standard: "Use standard clinical documentation style with moderate detail.",
    comprehensive: "Include full detail with clinical reasoning and differential considerations.",
  };

  // Session 3 (3.5): Build physician style instructions if profile is available
  const styleAdaptationLines: string[] = [];
  if (physicianStyle) {
    const verbosityGuide: Record<string, string> = {
      terse: "Write concisely. The physician edits AI notes to be shorter — aim for 30% fewer words than a standard note.",
      verbose: "Write with full detail. The physician edits AI notes to be more comprehensive — include clinical reasoning and context.",
      moderate: "Use standard clinical documentation length.",
    };
    styleAdaptationLines.push(verbosityGuide[physicianStyle.preferredVerbosity] || verbosityGuide.moderate);

    if (physicianStyle.specialtyDetected) {
      styleAdaptationLines.push(`Specialty context: ${physicianStyle.specialtyDetected} — use specialty-appropriate terminology and emphasis.`);
    }

    if (physicianStyle.terminologyPreferences.length > 0) {
      const termLines = physicianStyle.terminologyPreferences
        .slice(0, 10)
        .map(t => `  - Use "${t.physicianPreferred}" instead of "${t.aiTerm}"`)
        .join("\n");
      styleAdaptationLines.push(`Preferred terminology (use these physician-preferred terms):\n${termLines}`);
    }

    if (physicianStyle.avgNoteWordCount > 0) {
      styleAdaptationLines.push(`Target note length: approximately ${physicianStyle.avgNoteWordCount} words total.`);
    }
  }

  return `You are an expert clinical documentation specialist. Generate a comprehensive SOAP note based on the following encounter data.

ENCOUNTER DATA:
${sections.join("\n")}

DOCUMENTATION STYLE: ${templateStyle}
${styleInstructions[templateStyle] || styleInstructions.standard}${styleAdaptationLines.length > 0 ? `\n\nPHYSICIAN STYLE ADAPTATION (learned from this physician's edits — follow these closely):\n${styleAdaptationLines.join("\n")}` : ""}${culturalContext ? `\n\n${culturalContext}` : ""}

Generate a complete SOAP note following these guidelines:
1. SUBJECTIVE: Patient's reported symptoms, concerns, and relevant history
2. OBJECTIVE: Measurable findings - vitals, exam findings, test results
3. ASSESSMENT: Clinical interpretation, working diagnoses with ICD-10 codes
4. PLAN: Treatment plan, medications, follow-up, patient education

Also include:
- HPI (History of Present Illness) using OLDCARTS format if chief complaint available
- ROS (Review of Systems) if enough data is available
- ICD-10 code suggestions with confidence scores
- CPT code suggestions for the encounter

Return a JSON object with this structure:
{
  "subjective": { "content": "...", "confidence": 0.95, "sources": ["chief_complaint", "transcript"] },
  "objective": { "content": "...", "confidence": 0.98, "sources": ["vitals", "lab_results"] },
  "assessment": { "content": "...", "confidence": 0.90, "sources": ["diagnoses", "clinical_reasoning"] },
  "plan": { "content": "...", "confidence": 0.92, "sources": ["medications", "guidelines"] },
  "hpi": { "content": "...", "confidence": 0.85, "sources": ["chief_complaint"] },
  "ros": { "content": "...", "confidence": 0.80, "sources": ["transcript"] },
  "icd10Suggestions": [{ "code": "E11.9", "display": "Type 2 diabetes", "confidence": 0.95 }],
  "cptSuggestions": [{ "code": "99214", "display": "Office visit, 30-39 min", "confidence": 0.90 }],
  "requiresReview": false,
  "reviewReasons": []
}

IMPORTANT:
- Use professional clinical language
- Be specific and accurate
- Flag uncertainty with lower confidence scores
- Set requiresReview=true if critical information is missing or unclear
- Add reviewReasons for any items requiring clinician attention

Respond with ONLY the JSON object, no other text.`;
}
