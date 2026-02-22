/**
 * Response Normalization and Default Care Plan Templates
 *
 * Handles normalization of parsed AI responses into the GeneratedCarePlan
 * structure, and provides fallback templates when AI generation fails.
 *
 * @module ai-care-plan-generator/normalize
 */

import type {
  GeneratedCarePlan,
  ParsedCarePlanResponse,
  PatientContext,
} from "./types.ts";

/**
 * Normalize a parsed AI response into a complete GeneratedCarePlan.
 *
 * Fills in defaults for any missing fields and derives values
 * (like CCM/TCM eligibility) from patient context when AI omits them.
 */
export function normalizeCarePlanResponse(
  parsed: ParsedCarePlanResponse,
  planType: string,
  context: PatientContext
): GeneratedCarePlan {
  return {
    title: parsed.title || `${planType.replace(/_/g, " ")} Care Plan`,
    description:
      parsed.description || "AI-generated care plan requiring review.",
    planType: parsed.planType || planType,
    priority: parsed.priority || "medium",
    goals: parsed.goals || [],
    interventions: parsed.interventions || [],
    barriers: parsed.barriers || [],
    activities: parsed.activities || [],
    careTeam: parsed.careTeam || [],
    estimatedDuration: parsed.estimatedDuration || "12 weeks",
    reviewSchedule: parsed.reviewSchedule || "Every 2 weeks",
    successCriteria: parsed.successCriteria || [],
    riskFactors: parsed.riskFactors || [],
    icd10Codes:
      parsed.icd10Codes ||
      context.conditions.map((c) => ({
        code: c.code,
        display: c.display,
      })),
    ccmEligible:
      parsed.ccmEligible ?? context.conditions.length >= 2,
    tcmEligible:
      parsed.tcmEligible ??
      context.utilizationHistory.admissions30Days > 0,
    confidence: parsed.confidence ?? 0.8,
    evidenceSources:
      parsed.evidenceSources || ["Clinical guidelines", "AI analysis"],
    requiresReview: parsed.requiresReview ?? true,
    reviewReasons:
      parsed.reviewReasons || [
        "AI-generated content requires clinician review",
      ],
  };
}

/**
 * Get a default (template-based) care plan when AI generation fails.
 *
 * Returns a clinically reasonable template based on plan type,
 * with a lower confidence score and a review flag indicating
 * the plan was not AI-generated.
 */
export function getDefaultCarePlan(
  planType: string,
  context: PatientContext
): GeneratedCarePlan {
  const templates: Record<string, Partial<GeneratedCarePlan>> = {
    readmission_prevention: {
      title: "Readmission Prevention Care Plan",
      description:
        "Focused on preventing hospital readmission through close monitoring and care coordination.",
      priority: "high",
      goals: [
        {
          goal: "Prevent 30-day readmission",
          target: "Zero hospital readmissions",
          timeframe: "30 days",
          measurementMethod: "Hospital admission tracking",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "Post-discharge phone calls",
          frequency: "Daily for 7 days, then weekly",
          responsible: "nurse",
          duration: "4 weeks",
          rationale: "Early identification of deterioration",
          billingEligible: true,
        },
        {
          intervention: "Medication reconciliation",
          frequency: "Within 48 hours of discharge",
          responsible: "pharmacist",
          duration: "One-time",
          rationale: "Prevent medication errors",
          cptCode: "99495",
          billingEligible: true,
        },
      ],
      tcmEligible: true,
    },
    chronic_care: {
      title: "Chronic Care Management Plan",
      description:
        "Comprehensive management of chronic conditions to improve outcomes and quality of life.",
      priority: "medium",
      goals: [
        {
          goal: "Improve chronic condition control",
          target: "Meet clinical targets for primary conditions",
          timeframe: "90 days",
          measurementMethod: "Lab values and clinical assessments",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "Monthly care coordination calls",
          frequency: "Monthly",
          responsible: "care_coordinator",
          duration: "Ongoing",
          rationale: "Regular monitoring and support",
          cptCode: "99490",
          billingEligible: true,
        },
      ],
      ccmEligible: true,
    },
    high_utilizer: {
      title: "High Utilizer Care Management Plan",
      description:
        "Intensive care management to reduce emergency utilization and improve care access.",
      priority: "critical",
      goals: [
        {
          goal: "Reduce ED visits",
          target: "Less than 2 ED visits per month",
          timeframe: "90 days",
          measurementMethod: "ED visit tracking",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "Weekly care coordination",
          frequency: "Weekly",
          responsible: "care_coordinator",
          duration: "12 weeks",
          rationale: "Intensive support for high-risk patients",
          billingEligible: true,
        },
      ],
    },
    transitional_care: {
      title: "Transitional Care Plan",
      description:
        "Supporting safe transition from hospital to home or next care setting.",
      priority: "high",
      goals: [
        {
          goal: "Safe transition to home",
          target: "No complications within 14 days",
          timeframe: "14 days",
          measurementMethod: "Follow-up assessments",
          priority: "high",
        },
      ],
      interventions: [
        {
          intervention: "48-hour post-discharge follow-up",
          frequency: "Within 48 hours",
          responsible: "nurse",
          duration: "One-time",
          rationale: "Identify early complications",
          cptCode: "99495",
          billingEligible: true,
        },
      ],
      tcmEligible: true,
    },
    preventive: {
      title: "Preventive Care Plan",
      description:
        "Focused on health maintenance and disease prevention.",
      priority: "low",
      goals: [
        {
          goal: "Complete all age-appropriate screenings",
          target: "100% screening compliance",
          timeframe: "12 months",
          measurementMethod: "Screening completion tracking",
          priority: "medium",
        },
      ],
      interventions: [
        {
          intervention: "Annual wellness visit coordination",
          frequency: "Annually",
          responsible: "care_coordinator",
          duration: "Ongoing",
          rationale: "Preventive care access",
          billingEligible: true,
        },
      ],
    },
  };

  const template = templates[planType] || templates.chronic_care;

  return {
    title: template.title || "Care Plan",
    description: template.description || "Care plan requiring review.",
    planType,
    priority: template.priority || "medium",
    goals: template.goals || [],
    interventions: template.interventions || [],
    barriers: [],
    activities: [],
    careTeam: [
      {
        role: "nurse",
        responsibilities: ["Daily monitoring", "Patient education"],
      },
      {
        role: "care_coordinator",
        responsibilities: [
          "Care plan oversight",
          "Resource coordination",
        ],
      },
    ],
    estimatedDuration: "12 weeks",
    reviewSchedule: "Every 2 weeks",
    successCriteria: ["Goals achieved", "No hospitalizations"],
    riskFactors:
      context.utilizationHistory.readmissionRisk !== "low"
        ? ["High utilization history"]
        : [],
    icd10Codes: context.conditions
      .slice(0, 5)
      .map((c) => ({ code: c.code, display: c.display })),
    ccmEligible:
      template.ccmEligible || context.conditions.length >= 2,
    tcmEligible: template.tcmEligible || false,
    confidence: 0.5,
    evidenceSources: ["Template-based fallback"],
    requiresReview: true,
    reviewReasons: [
      "AI generation failed - template-based plan requires complete review",
    ],
  };
}
