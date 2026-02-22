/**
 * Response normalization and default templates for discharge summaries
 *
 * Transforms raw AI output into a fully populated DischargeSummary,
 * filling in defaults for missing fields and applying safety guardrails.
 * Also provides a fallback template when AI generation fails entirely.
 *
 * @module ai-discharge-summary/normalize
 */

import type {
  DischargeSummary,
  PatientContext,
  ParsedSummary,
} from "./types.ts";

/**
 * Normalize a parsed AI response into a complete DischargeSummary.
 *
 * Fills in defaults from patient context for any fields the AI omitted,
 * calculates derived values (length of stay, risk category), and applies
 * mandatory safety flags (requiresReview, medication change alerts).
 */
export function normalizeSummaryResponse(
  parsed: ParsedSummary,
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string
): DischargeSummary {
  // Calculate length of stay
  const admissionDate = new Date(context.admissionDate);
  const dischargeDate = new Date();
  const lengthOfStay = Math.max(
    1,
    Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (24 * 60 * 60 * 1000))
  );

  // Determine risk category from score
  const riskScore = parsed.readmissionRiskScore || context.dischargePlan?.readmissionRiskScore || 50;
  const riskCategory = categorizeRisk(riskScore);

  const summary: DischargeSummary = {
    // Header
    patientName: parsed.patientName || context.name,
    dateOfBirth: parsed.dateOfBirth || context.dateOfBirth,
    admissionDate: parsed.admissionDate || context.admissionDate,
    dischargeDate: parsed.dischargeDate || new Date().toISOString(),
    lengthOfStay: parsed.lengthOfStay || lengthOfStay,
    attendingPhysician: parsed.attendingPhysician || attendingPhysician,
    dischargeDisposition: parsed.dischargeDisposition || dischargeDisposition,

    // Clinical Content
    chiefComplaint: parsed.chiefComplaint || context.chiefComplaint,
    admissionDiagnosis: parsed.admissionDiagnosis || context.admissionDiagnosis,
    hospitalCourse: parsed.hospitalCourse || "Hospital course documentation requires physician review.",
    dischargeDiagnoses: parsed.dischargeDiagnoses || context.conditions.map((c, i) => ({
      code: c.code,
      display: c.display,
      type: i === 0 ? "principal" as const : "secondary" as const,
    })),
    proceduresPerformed: parsed.proceduresPerformed || context.procedures.map((p) => ({
      code: p.code,
      display: p.display,
      date: p.date,
    })),

    // Medications
    medicationReconciliation: {
      continued: parsed.medicationReconciliation?.continued || [],
      new: parsed.medicationReconciliation?.new || [],
      changed: parsed.medicationReconciliation?.changed || [],
      discontinued: parsed.medicationReconciliation?.discontinued || [],
      allergies: context.allergies,
      interactions: parsed.medicationReconciliation?.interactions || [],
    },
    dischargePharmacy: parsed.dischargePharmacy,

    // Follow-up
    followUpAppointments: parsed.followUpAppointments || [
      {
        specialty: "Primary Care",
        timeframe: "7 days",
        purpose: "Post-discharge follow-up",
        urgency: "routine",
      },
    ],
    pendingTests: parsed.pendingTests || [],
    pendingConsults: parsed.pendingConsults || [],

    // Patient Instructions
    patientInstructions: parsed.patientInstructions || [],
    warningSigns: parsed.warningSigns || getDefaultWarningSigns(),
    activityRestrictions: parsed.activityRestrictions || [],
    dietaryInstructions: parsed.dietaryInstructions || [],

    // Care Coordination
    homeHealthOrdered: parsed.homeHealthOrdered || context.dischargePlan?.homeHealthNeeded || false,
    homeHealthAgency: parsed.homeHealthAgency,
    dmeOrdered: parsed.dmeOrdered || context.dischargePlan?.dmeNeeded || false,
    dmeItems: parsed.dmeItems,

    // Quality Metrics
    readmissionRiskScore: riskScore,
    readmissionRiskCategory: riskCategory,

    // Safety - ALWAYS require review
    confidence: parsed.confidence ?? 0.8,
    requiresReview: true,
    reviewReasons: [
      "All AI-generated discharge summaries require physician review and approval",
      ...(parsed.reviewReasons || []),
    ],
    disclaimer: parsed.disclaimer ||
      "This discharge summary was generated with AI assistance and requires physician review and approval before release to the patient or external providers.",
  };

  // SAFETY: Add additional review flags based on content
  applySafetyReviewFlags(summary, riskCategory);

  return summary;
}

/**
 * Generate a default/fallback discharge summary when AI generation fails.
 *
 * Uses patient context data directly without AI augmentation.
 * Marked with low confidence and mandatory manual review flags.
 */
export function getDefaultSummary(
  context: PatientContext,
  dischargeDisposition: string,
  attendingPhysician: string
): DischargeSummary {
  const admissionDate = new Date(context.admissionDate);
  const dischargeDate = new Date();
  const lengthOfStay = Math.max(
    1,
    Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    patientName: context.name,
    dateOfBirth: context.dateOfBirth,
    admissionDate: context.admissionDate,
    dischargeDate: dischargeDate.toISOString(),
    lengthOfStay,
    attendingPhysician,
    dischargeDisposition,
    chiefComplaint: context.chiefComplaint || "Not documented",
    admissionDiagnosis: context.admissionDiagnosis || "Not documented",
    hospitalCourse: "AI summary generation failed. Please document hospital course manually.",
    dischargeDiagnoses: context.conditions.slice(0, 5).map((c, i) => ({
      code: c.code,
      display: c.display,
      type: i === 0 ? "principal" as const : "secondary" as const,
    })),
    proceduresPerformed: context.procedures.slice(0, 10).map((p) => ({
      code: p.code,
      display: p.display,
      date: p.date,
    })),
    medicationReconciliation: {
      continued: [],
      new: [],
      changed: [],
      discontinued: [],
      allergies: context.allergies,
      interactions: [],
    },
    followUpAppointments: [
      {
        specialty: "Primary Care",
        timeframe: "7 days",
        purpose: "Post-discharge follow-up",
        urgency: "routine",
      },
    ],
    pendingTests: [],
    pendingConsults: [],
    patientInstructions: [
      {
        category: "general",
        instruction: "Follow up with your primary care provider within 7 days",
        importance: "critical",
      },
    ],
    warningSigns: [
      {
        sign: "Fever over 101F that does not respond to medication",
        action: "Contact your doctor or go to urgent care",
        urgency: "urgent_care",
      },
      {
        sign: "Severe chest pain or difficulty breathing",
        action: "Call 911 or go to the emergency room immediately",
        urgency: "emergency",
      },
    ],
    activityRestrictions: [],
    dietaryInstructions: [],
    homeHealthOrdered: context.dischargePlan?.homeHealthNeeded || false,
    dmeOrdered: context.dischargePlan?.dmeNeeded || false,
    readmissionRiskScore: context.dischargePlan?.readmissionRiskScore || 50,
    readmissionRiskCategory: "moderate",
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: [
      "AI summary generation failed - manual documentation required",
      "Medication reconciliation requires manual review",
      "All fields require physician verification",
    ],
    disclaimer: "This is a template discharge summary. Complete documentation and physician review required before release.",
  };
}

// =====================================================
// HELPERS
// =====================================================

function categorizeRisk(score: number): "low" | "moderate" | "high" | "very_high" {
  if (score < 30) return "low";
  if (score < 60) return "moderate";
  if (score < 80) return "high";
  return "very_high";
}

function getDefaultWarningSigns() {
  return [
    {
      sign: "Fever over 101F",
      action: "Contact your doctor or go to urgent care",
      urgency: "urgent_care" as const,
    },
    {
      sign: "Severe chest pain or difficulty breathing",
      action: "Call 911 or go to the emergency room immediately",
      urgency: "emergency" as const,
    },
  ];
}

/**
 * Add safety review flags based on summary content.
 * Mutates summary.reviewReasons in place.
 */
function applySafetyReviewFlags(
  summary: DischargeSummary,
  riskCategory: "low" | "moderate" | "high" | "very_high"
): void {
  if (summary.medicationReconciliation.new.length > 0 || summary.medicationReconciliation.changed.length > 0) {
    summary.reviewReasons.push("Medication changes require pharmacist verification");
  }

  if (summary.medicationReconciliation.interactions.length > 0) {
    summary.reviewReasons.unshift("ALERT: Potential drug interactions identified");
  }

  if (riskCategory === "high" || riskCategory === "very_high") {
    summary.reviewReasons.push("High readmission risk - ensure comprehensive discharge planning");
  }

  if (summary.confidence < 0.6) {
    summary.reviewReasons.push("Low confidence score - careful review recommended");
  }
}
