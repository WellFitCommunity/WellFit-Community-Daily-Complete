/**
 * AI prompt construction for discharge summary generation
 *
 * Builds a structured clinical prompt from patient context data,
 * including medication reconciliation instructions and safety guardrails.
 *
 * @module ai-discharge-summary/promptBuilder
 */

import type { PatientContext } from "./types.ts";
import { buildConstraintBlock } from "../_shared/clinicalGroundingRules.ts";
import { buildSafeDocumentSection } from "../_shared/promptInjectionGuard.ts";

/**
 * Build the Claude prompt for discharge summary generation.
 *
 * Assembles patient demographics, clinical data, medication lists,
 * vitals, labs, and notes into a structured prompt that instructs
 * Claude to produce a JSON discharge summary.
 */
export function buildDischargeSummaryPrompt(
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string,
  includePatientInstructions: boolean,
  culturalContext?: string
): string {
  const sections: string[] = [];

  // Patient demographics
  sections.push(`PATIENT INFORMATION:`);
  sections.push(`- Name: ${context.name}`);
  sections.push(`- Date of Birth: ${context.dateOfBirth}`);
  sections.push(`- Sex: ${context.sex}`);
  sections.push(`- Admission Date: ${context.admissionDate}`);
  sections.push(`- Discharge Disposition: ${dischargeDisposition}`);
  sections.push(`- Attending Physician: ${attendingPhysician}`);

  // Chief complaint and admission diagnosis
  sections.push(`\nCHIEF COMPLAINT: ${context.chiefComplaint || "Not documented"}`);
  sections.push(`ADMISSION DIAGNOSIS: ${context.admissionDiagnosis || "Not documented"}`);

  // Allergies (safety-critical)
  if (context.allergies.length > 0) {
    sections.push(`\nALLERGIES: ${context.allergies.join(", ")}`);
  } else {
    sections.push(`\nALLERGIES: NKDA (No Known Drug Allergies)`);
  }

  // Active diagnoses
  if (context.conditions.length > 0) {
    sections.push(`\nACTIVE DIAGNOSES:`);
    context.conditions.slice(0, 10).forEach((c, i) => {
      sections.push(`${i + 1}. ${c.display} (${c.code})`);
    });
  }

  // Procedures
  if (context.procedures.length > 0) {
    sections.push(`\nPROCEDURES PERFORMED:`);
    context.procedures.slice(0, 10).forEach((p) => {
      sections.push(`- ${p.display} (${p.date})`);
    });
  }

  // Admission medications
  sections.push(`\nADMISSION MEDICATIONS (${context.admissionMedications.length} total):`);
  context.admissionMedications.slice(0, 15).forEach((m) => {
    sections.push(`- ${m.name} ${m.dose} ${m.frequency}`.trim());
  });

  // Discharge medications
  sections.push(`\nDISCHARGE MEDICATIONS (${context.dischargeMedications.length} total):`);
  context.dischargeMedications.slice(0, 15).forEach((m) => {
    sections.push(`- ${m.name} ${m.dose} ${m.frequency} [${m.status}]`.trim());
  });

  // Vital signs
  if (Object.keys(context.vitalSigns).length > 0) {
    sections.push(`\nMOST RECENT VITAL SIGNS:`);
    for (const [name, data] of Object.entries(context.vitalSigns)) {
      sections.push(`- ${name}: ${data.value} ${data.unit}`);
    }
  }

  // Lab results (highlight abnormals)
  if (context.labResults.length > 0) {
    sections.push(`\nKEY LAB RESULTS:`);
    const abnormalLabs = context.labResults.filter((l) => l.abnormal);
    if (abnormalLabs.length > 0) {
      sections.push(`ABNORMAL:`);
      abnormalLabs.slice(0, 10).forEach((l) => {
        sections.push(`- ${l.name}: ${l.value} ${l.unit}`);
      });
    }
  }

  // Clinical notes
  if (context.notes.length > 0) {
    sections.push(`\nCLINICAL NOTES SUMMARY:`);
    context.notes.slice(0, 5).forEach((n) => {
      sections.push(`- ${n.substring(0, 200)}...`);
    });
  }

  // Discharge plan
  if (context.dischargePlan) {
    sections.push(`\nDISCHARGE PLAN:`);
    sections.push(`- Disposition: ${context.dischargePlan.disposition}`);
    if (context.dischargePlan.followUpDate) {
      sections.push(`- Follow-up: ${context.dischargePlan.followUpDate} with ${context.dischargePlan.followUpProvider || "PCP"}`);
    }
    sections.push(`- Home Health: ${context.dischargePlan.homeHealthNeeded ? "Yes" : "No"}`);
    sections.push(`- DME: ${context.dischargePlan.dmeNeeded ? "Yes" : "No"}`);
    sections.push(`- Readmission Risk Score: ${context.dischargePlan.readmissionRiskScore}%`);
  }

  // Build the full prompt with JSON output schema
  const safePatientData = buildSafeDocumentSection(sections.join("\n"), 'Patient Data');

  return `You are a clinical documentation specialist generating a comprehensive discharge summary.

${safePatientData.text}${culturalContext ? `\n\n${culturalContext}` : ""}

Generate a complete discharge summary following hospital standards. Compare admission and discharge medications to identify:
- CONTINUED: Medications that were continued unchanged
- NEW: Medications started during hospitalization
- CHANGED: Medications with dose/frequency changes
- DISCONTINUED: Medications that were stopped

${includePatientInstructions ? "Include patient-friendly discharge instructions and warning signs." : "Focus on clinical documentation without patient instructions."}

CRITICAL SAFETY REQUIREMENTS:
- Flag all medication changes prominently
- Note any allergy-medication conflicts
- Include red flags/warning signs for the patient
- All summaries require physician review before release

Return a JSON object with this structure:
{
  "patientName": "${context.name}",
  "dateOfBirth": "${context.dateOfBirth}",
  "admissionDate": "${context.admissionDate}",
  "dischargeDate": "${new Date().toISOString()}",
  "lengthOfStay": <calculated days>,
  "attendingPhysician": "${attendingPhysician}",
  "dischargeDisposition": "${dischargeDisposition}",
  "chiefComplaint": "<brief chief complaint>",
  "admissionDiagnosis": "<admission diagnosis>",
  "hospitalCourse": "<1-2 paragraph narrative of hospital course>",
  "dischargeDiagnoses": [
    { "code": "<ICD-10>", "display": "<diagnosis>", "type": "principal|secondary|complication" }
  ],
  "proceduresPerformed": [
    { "code": "<CPT>", "display": "<procedure>", "date": "<date>", "provider": "<name>" }
  ],
  "medicationReconciliation": {
    "continued": [
      { "name": "<drug>", "dose": "<dose>", "route": "oral", "frequency": "<freq>", "indication": "<why>", "instructions": "<how to take>" }
    ],
    "new": [...],
    "changed": [
      { "name": "<drug>", "previousDose": "<old>", "newDose": "<new>", "reason": "<why changed>", "instructions": "<how to take>" }
    ],
    "discontinued": [...],
    "allergies": ${JSON.stringify(context.allergies)},
    "interactions": ["<any drug interactions to note>"]
  },
  "followUpAppointments": [
    { "specialty": "Primary Care", "provider": "<name>", "timeframe": "7 days", "purpose": "<reason>", "urgency": "routine|urgent|as_needed" }
  ],
  "pendingTests": ["<any pending results to follow up>"],
  "pendingConsults": ["<any pending consults>"],
  "patientInstructions": [
    { "category": "activity|diet|wound_care|medication|symptoms|general", "instruction": "<instruction>", "importance": "critical|important|informational" }
  ],
  "warningSigns": [
    { "sign": "<symptom to watch for>", "action": "<what to do>", "urgency": "call_office|urgent_care|emergency" }
  ],
  "activityRestrictions": ["<activity limits>"],
  "dietaryInstructions": ["<diet guidance>"],
  "homeHealthOrdered": ${context.dischargePlan?.homeHealthNeeded || false},
  "homeHealthAgency": "<agency name if ordered>",
  "dmeOrdered": ${context.dischargePlan?.dmeNeeded || false},
  "dmeItems": ["<equipment if ordered>"],
  "readmissionRiskScore": ${context.dischargePlan?.readmissionRiskScore || 50},
  "readmissionRiskCategory": "low|moderate|high|very_high",
  "confidence": 0.0-1.0,
  "requiresReview": true,
  "reviewReasons": ["All AI-generated summaries require physician review"],
  "disclaimer": "This discharge summary was generated with AI assistance and requires physician review and approval before release."
}

Respond with ONLY the JSON object, no other text.

${buildConstraintBlock(['care_planning'])}`;
}
