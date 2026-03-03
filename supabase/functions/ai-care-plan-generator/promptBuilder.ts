/**
 * AI Prompt Construction for Care Plan Generation
 *
 * Builds the Claude prompt from patient context, plan type,
 * focus conditions, care team roles, and duration.
 *
 * @module ai-care-plan-generator/promptBuilder
 */

import type { PatientContext } from "./types.ts";

/**
 * Build the prompt for care plan generation.
 *
 * Assembles patient demographics, conditions, medications, vitals,
 * SDOH factors, utilization history, and allergies into a structured
 * prompt that requests a JSON care plan response.
 * When culturalContext is provided (Session 2.6), cultural competency
 * guidance is injected for culturally-informed care planning.
 */
export function buildCarePlanPrompt(
  context: PatientContext,
  planType: string,
  focusConditions: string[],
  careTeamRoles: string[],
  durationWeeks: number,
  culturalContext?: string
): string {
  const sections: string[] = [];

  // Plan type context
  sections.push(
    `CARE PLAN TYPE: ${planType.replace(/_/g, " ").toUpperCase()}`
  );
  sections.push(`DURATION: ${durationWeeks} weeks`);
  sections.push(`CARE TEAM ROLES: ${careTeamRoles.join(", ")}`);

  // Demographics
  sections.push(`\nPATIENT DEMOGRAPHICS:`);
  sections.push(`- Age Group: ${context.demographics.ageGroup}`);
  sections.push(
    `- Preferred Language: ${context.demographics.preferredLanguage}`
  );

  // Conditions
  if (context.conditions.length > 0) {
    sections.push(`\nACTIVE CONDITIONS:`);
    context.conditions.forEach((c, i) => {
      const primary = c.isPrimary ? " (PRIMARY)" : "";
      sections.push(`${i + 1}. ${c.display} (${c.code})${primary}`);
    });
  }

  // Focus conditions
  if (focusConditions.length > 0) {
    sections.push(
      `\nFOCUS CONDITIONS (prioritize in plan): ${focusConditions.join(", ")}`
    );
  }

  // Medications
  if (context.medications.length > 0) {
    sections.push(`\nCURRENT MEDICATIONS:`);
    context.medications.forEach((m) => {
      sections.push(`- ${m.name} ${m.dosage} ${m.frequency}`.trim());
    });
  }

  // Vitals
  if (Object.keys(context.vitals).length > 0) {
    sections.push(`\nRECENT VITALS:`);
    for (const [name, data] of Object.entries(context.vitals)) {
      sections.push(
        `- ${name.replace(/_/g, " ")}: ${data.value} ${data.unit}`
      );
    }
  }

  // SDOH
  if (context.sdohFactors) {
    sections.push(`\nSOCIAL DETERMINANTS OF HEALTH:`);
    sections.push(`- Housing: ${context.sdohFactors.housing}`);
    sections.push(`- Food Security: ${context.sdohFactors.food}`);
    sections.push(
      `- Transportation: ${context.sdohFactors.transportation}`
    );
    sections.push(`- Social Support: ${context.sdohFactors.social}`);
    sections.push(
      `- Financial Status: ${context.sdohFactors.financial}`
    );
    sections.push(
      `- Overall SDOH Risk: ${context.sdohFactors.overallRisk}`
    );
    sections.push(
      `- Complexity Score: ${context.sdohFactors.complexityScore}/10`
    );
  }

  // Utilization
  sections.push(`\nUTILIZATION HISTORY:`);
  sections.push(
    `- ED Visits (30 days): ${context.utilizationHistory.edVisits30Days}`
  );
  sections.push(
    `- ED Visits (90 days): ${context.utilizationHistory.edVisits90Days}`
  );
  sections.push(
    `- Admissions (30 days): ${context.utilizationHistory.admissions30Days}`
  );
  sections.push(
    `- Admissions (90 days): ${context.utilizationHistory.admissions90Days}`
  );
  sections.push(
    `- Readmission Risk: ${context.utilizationHistory.readmissionRisk.toUpperCase()}`
  );

  // Allergies
  if (context.allergies.length > 0) {
    sections.push(`\nALLERGIES: ${context.allergies.join(", ")}`);
  }

  return `You are an expert clinical care coordinator creating an evidence-based care plan.

${sections.join("\n")}${culturalContext ? `\n\n${culturalContext}` : ""}

Generate a comprehensive, individualized care plan following these guidelines:
1. Goals should be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
2. Interventions should include specific frequencies and responsible parties
3. Address identified SDOH barriers with practical solutions
4. Include CCM/TCM billing eligibility assessment
5. Reference clinical guidelines where applicable

Return a JSON object with this structure:
{
  "title": "Descriptive care plan title",
  "description": "Brief 2-3 sentence summary of the plan focus",
  "planType": "${planType}",
  "priority": "critical|high|medium|low",
  "goals": [
    {
      "goal": "Specific goal statement",
      "target": "Measurable target (e.g., 'A1c below 7.0')",
      "timeframe": "e.g., '8 weeks'",
      "measurementMethod": "How progress will be tracked",
      "priority": "high|medium|low",
      "evidenceBasis": "Clinical guideline or evidence source"
    }
  ],
  "interventions": [
    {
      "intervention": "Specific action",
      "frequency": "e.g., 'weekly', 'daily', 'monthly'",
      "responsible": "Role responsible (e.g., 'nurse', 'physician')",
      "duration": "How long (e.g., '4 weeks')",
      "rationale": "Why this intervention",
      "cptCode": "Optional CPT code if billable",
      "billingEligible": true/false
    }
  ],
  "barriers": [
    {
      "barrier": "Identified obstacle",
      "category": "transportation|financial|social|cognitive|physical|language|other",
      "solution": "How to address",
      "resources": ["Available resources to help"],
      "priority": "high|medium|low"
    }
  ],
  "activities": [
    {
      "activityType": "appointment|medication|education|monitoring|referral|follow_up",
      "description": "What needs to happen",
      "frequency": "How often",
      "status": "scheduled|pending"
    }
  ],
  "careTeam": [
    {
      "role": "Role name",
      "responsibilities": ["List of responsibilities"]
    }
  ],
  "estimatedDuration": "e.g., '12 weeks'",
  "reviewSchedule": "e.g., 'Every 2 weeks'",
  "successCriteria": ["Measurable outcomes indicating success"],
  "riskFactors": ["Factors that could impede success"],
  "icd10Codes": [{"code": "E11.9", "display": "Type 2 diabetes"}],
  "ccmEligible": true/false,
  "tcmEligible": true/false,
  "confidence": 0.0-1.0,
  "evidenceSources": ["Guidelines or evidence used"],
  "requiresReview": true/false,
  "reviewReasons": ["Reasons requiring clinician review"]
}

Respond with ONLY the JSON object, no other text.`;
}
