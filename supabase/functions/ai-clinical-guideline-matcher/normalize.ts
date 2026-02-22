/**
 * Response Normalization
 *
 * Normalizes AI-generated guideline match results with safe defaults,
 * and provides fallback results when AI generation fails.
 *
 * @module ai-clinical-guideline-matcher/normalize
 */

import type {
  ClinicalGuideline,
  GuidelineMatchResult,
  PatientContext,
  PreventiveScreening,
  ParsedMatchResult,
  ParsedRecommendation,
  ParsedGap,
} from "./types.ts";

/**
 * Normalizes the parsed AI response into a fully-typed GuidelineMatchResult.
 * Fills in missing fields with safe defaults.
 */
export function normalizeMatchResult(
  parsed: ParsedMatchResult,
  matchedGuidelines: ClinicalGuideline[],
  preventiveScreenings: PreventiveScreening[],
  _context: PatientContext
): GuidelineMatchResult {
  const defaultGuideline: ClinicalGuideline = {
    guidelineId: "unknown",
    guidelineName: "Clinical Guidelines",
    organization: "Unknown",
    year: 2024,
    condition: "Unknown",
  };

  const recommendations = (parsed.recommendations || []).map(
    (r: ParsedRecommendation, i: number) => ({
      ...r,
      recommendationId: r.recommendationId || `rec-${i + 1}-${Date.now()}`,
      guideline: r.guideline || matchedGuidelines[0] || defaultGuideline,
      category: r.category || "treatment",
      evidenceLevel: r.evidenceLevel || "C",
      urgency: r.urgency || "routine",
      actionItems: r.actionItems || [],
    })
  );

  const adherenceGaps = (parsed.adherenceGaps || []).map(
    (g: ParsedGap, i: number) => ({
      ...g,
      gapId: g.gapId || `gap-${i + 1}-${Date.now()}`,
      guideline: g.guideline || matchedGuidelines[0] || defaultGuideline,
      gapType: g.gapType || "suboptimal_control",
      priority: g.priority || "medium",
    })
  );

  const criticalGaps = adherenceGaps.filter(
    (g: { priority?: string }) => g.priority === "critical"
  ).length;
  const highPriorityGaps = adherenceGaps.filter(
    (g: { priority?: string }) => g.priority === "high"
  ).length;
  const overdueScreenings = preventiveScreenings.filter(
    (s) => s.status === "overdue"
  ).length;

  const reviewReasons = [
    "All AI-generated guideline recommendations require clinician review",
    ...(parsed.reviewReasons || []),
  ];

  if (criticalGaps > 0) {
    reviewReasons.unshift(
      `CRITICAL: ${criticalGaps} critical adherence gap(s) identified`
    );
  }

  return {
    patientId: "",
    matchedGuidelines,
    recommendations,
    adherenceGaps,
    preventiveScreenings,
    summary: {
      totalGuidelines: matchedGuidelines.length,
      totalRecommendations: recommendations.length,
      criticalGaps,
      highPriorityGaps,
      overdueScreenings,
    },
    confidence: parsed.confidence ?? 0.8,
    requiresReview: true,
    reviewReasons,
    disclaimer:
      "These recommendations are for clinical decision support only and require verification by a licensed healthcare provider. Guidelines should be applied with consideration of individual patient circumstances.",
  };
}

/**
 * Returns a safe default result when AI recommendation generation fails.
 * Preserves matched guidelines and screening data from rule-based matching.
 */
export function getDefaultMatchResult(
  matchedGuidelines: ClinicalGuideline[],
  preventiveScreenings: PreventiveScreening[]
): GuidelineMatchResult {
  return {
    patientId: "",
    matchedGuidelines,
    recommendations: [],
    adherenceGaps: [],
    preventiveScreenings,
    summary: {
      totalGuidelines: matchedGuidelines.length,
      totalRecommendations: 0,
      criticalGaps: 0,
      highPriorityGaps: 0,
      overdueScreenings: preventiveScreenings.filter(
        (s) => s.status === "overdue"
      ).length,
    },
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: [
      "AI recommendation generation failed - manual clinician review required",
      "Fallback result provided for safety",
    ],
    disclaimer:
      "AI recommendation unavailable. Please consult clinical guidelines directly.",
  };
}
