/**
 * Guideline Matching Logic
 *
 * Rule-based matching of patient conditions to clinical guidelines,
 * and preventive screening eligibility determination.
 *
 * @module ai-clinical-guideline-matcher/matching
 */

import type {
  ClinicalGuideline,
  PatientContext,
  PreventiveScreening,
} from "./types.ts";
import { MAJOR_GUIDELINES, PREVENTIVE_SCREENINGS } from "./guidelines.ts";

// =====================================================
// CONDITION-TO-GUIDELINE MATCHING
// =====================================================

/**
 * Matches patient conditions against the clinical guidelines database.
 * Uses both text matching and ICD-10 code prefix matching.
 * Automatically includes cardiovascular guidelines for patients with
 * diabetes, hypertension, or hyperlipidemia risk factors.
 */
export function matchGuidelinesToConditions(
  conditions: Array<{ code: string; display: string }>,
  focusConditions: string[]
): ClinicalGuideline[] {
  const matched: ClinicalGuideline[] = [];
  const conditionText = conditions.map((c) => c.display.toLowerCase()).join(" ");

  // If focus conditions specified, use those; otherwise search all guideline keys
  const searchTerms =
    focusConditions.length > 0
      ? focusConditions.map((c) => c.toLowerCase())
      : Object.keys(MAJOR_GUIDELINES);

  for (const key of searchTerms) {
    // Check if patient has condition matching this guideline category
    const hasCondition =
      conditionText.includes(key) ||
      conditions.some((c) =>
        c.code.startsWith(MAJOR_GUIDELINES[key]?.[0]?.conditionCode || "XXX")
      );

    if (hasCondition && MAJOR_GUIDELINES[key]) {
      matched.push(...MAJOR_GUIDELINES[key]);
    }
  }

  // Always include cardiovascular guidelines for patients with risk factors
  if (
    (conditionText.includes("diabetes") ||
      conditionText.includes("hypertension") ||
      conditionText.includes("hyperlipidemia")) &&
    !matched.some((g) => g.guidelineId.includes("cad"))
  ) {
    const cadGuidelines = MAJOR_GUIDELINES["cad"];
    if (cadGuidelines) {
      matched.push(...cadGuidelines);
    }
  }

  return matched;
}

// =====================================================
// PREVENTIVE SCREENING ELIGIBILITY
// =====================================================

/**
 * Determines which preventive screenings are applicable for the patient
 * based on age, sex, and screening history.
 * Calculates status (current, overdue, never_done) and next due dates.
 */
export function getApplicableScreenings(context: PatientContext): PreventiveScreening[] {
  const screenings: PreventiveScreening[] = [];
  const { age, sex } = context.demographics;

  for (const [key, screening] of Object.entries(PREVENTIVE_SCREENINGS)) {
    // Check age eligibility
    if (age < screening.ages.min) continue;
    if (screening.ages.max && age > screening.ages.max) continue;

    // Check sex eligibility
    if (screening.sex && screening.sex !== sex) continue;

    const lastPerformed = context.lastScreenings[key];
    let status: PreventiveScreening["status"] = "never_done";
    let nextDue: string | undefined;

    if (lastPerformed) {
      const lastDate = new Date(lastPerformed);
      const frequencyMatch = screening.frequency.match(/(\d+)\s+(year|month)/);

      if (frequencyMatch) {
        const amount = parseInt(frequencyMatch[1]);
        const unit = frequencyMatch[2];

        const nextDueDate = new Date(lastDate);
        if (unit === "year") {
          nextDueDate.setFullYear(nextDueDate.getFullYear() + amount);
        } else {
          nextDueDate.setMonth(nextDueDate.getMonth() + amount);
        }

        nextDue = nextDueDate.toISOString().split("T")[0];

        if (nextDueDate > new Date()) {
          status = "current";
        } else {
          status = "overdue";
        }
      } else if (screening.frequency.includes("one-time")) {
        status = "current";
      }
    }

    const recommendation = buildScreeningRecommendation(screening.name, status, nextDue);

    screenings.push({
      screeningId: `screen-${key}-${Date.now()}`,
      screeningName: screening.name,
      guidelineSource: screening.guidelineSource,
      applicableFor: `Ages ${screening.ages.min}${screening.ages.max ? `-${screening.ages.max}` : "+"}${screening.sex ? `, ${screening.sex}` : ""}`,
      frequency: screening.frequency,
      lastPerformed,
      nextDue,
      status,
      recommendation,
    });
  }

  return screenings;
}

/**
 * Builds a user-friendly screening recommendation string based on status.
 */
function buildScreeningRecommendation(
  screeningName: string,
  status: PreventiveScreening["status"],
  nextDue: string | undefined
): string {
  switch (status) {
    case "overdue":
      return `${screeningName} is overdue. Schedule as soon as possible.`;
    case "never_done":
      return `${screeningName} recommended for your age group. Discuss with your provider.`;
    case "current":
      return nextDue
        ? `Next ${screeningName} due around ${nextDue}.`
        : `${screeningName} is current.`;
    default:
      return `${screeningName} status unknown. Discuss with your provider.`;
  }
}
