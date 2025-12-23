/**
 * AI Medication Reconciliation Edge Function
 *
 * AI-enhanced medication reconciliation that goes beyond rule-based detection
 * to provide clinical reasoning, deprescribing opportunities, and patient counseling.
 *
 * Skill #26 - Medication Reconciliation AI
 *
 * Features:
 * - Clinical reasoning for WHY discrepancies occurred
 * - Deprescribing opportunities for polypharmacy reduction
 * - Patient counseling point generation
 * - Pharmacy verification checklists
 * - Priority-ranked action items
 *
 * Uses Claude Sonnet 4.5 for clinical accuracy - medication safety is critical.
 *
 * @module ai-medication-reconciliation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Use Sonnet 4.5 for medication reconciliation - clinical safety is critical
const SONNET_MODEL = "claude-sonnet-4-20250514";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MedicationEntry {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  rxcui?: string;
  startDate?: string;
  endDate?: string;
  prescriber?: string;
  indication?: string;
}

interface MedicationSource {
  admission: MedicationEntry[];
  prescribed: MedicationEntry[];
  current: MedicationEntry[];
  discharge?: MedicationEntry[];
}

interface ReconciliationRequest {
  patientId: string;
  providerId: string;
  medications: MedicationSource;
  allergies?: string[];
  activeConditions?: Array<{ code: string; display: string }>;
  labValues?: {
    creatinine?: number;
    eGFR?: number;
    alt?: number;
    ast?: number;
  };
  patientAge?: number;
  encounterType?: "admission" | "discharge" | "transfer" | "ambulatory";
  tenantId?: string;
}

interface DiscrepancyAnalysis {
  medication: string;
  discrepancyType:
    | "missing"
    | "duplicate"
    | "dose_change"
    | "route_change"
    | "new"
    | "discontinued"
    | "frequency_change";
  likelyReason: string;
  clinicalSignificance: "critical" | "high" | "medium" | "low";
  recommendation: string;
  requiresPharmacistReview: boolean;
  confidence: number;
}

interface DeprescribingCandidate {
  medication: string;
  reason: string;
  evidence: string;
  riskIfContinued: string;
  suggestedApproach: string;
  priority: "high" | "medium" | "low";
}

interface PatientCounselingPoint {
  topic: string;
  keyPoints: string[];
  relatedMedications: string[];
  warningSignsToWatch?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PHI Redaction
// ─────────────────────────────────────────────────────────────────────────────

const redact = (s: string): string =>
  s
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]")
    .replace(/\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[PHONE]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, "[DOB]");

// ─────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const logger = createLogger("ai-medication-reconciliation", req);

  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const body: ReconciliationRequest = await req.json();
    const {
      patientId,
      providerId,
      medications,
      allergies = [],
      activeConditions = [],
      labValues,
      patientAge,
      encounterType = "ambulatory",
    } = body;

    // Validate required fields
    if (!patientId || !providerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientId, providerId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!medications) {
      return new Response(
        JSON.stringify({ error: "Missing required field: medications" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalMeds =
      (medications.admission?.length || 0) +
      (medications.prescribed?.length || 0) +
      (medications.current?.length || 0) +
      (medications.discharge?.length || 0);

    if (totalMeds === 0) {
      return new Response(
        JSON.stringify({ error: "At least one medication list is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      logger.error("ANTHROPIC_API_KEY not configured");
      throw new Error("AI service not configured");
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY);
    const startTime = Date.now();

    // Perform AI reconciliation analysis
    const result = await performReconciliationAnalysis(
      medications,
      allergies,
      activeConditions,
      labValues,
      patientAge,
      encounterType,
      logger
    );

    const responseTime = Date.now() - startTime;

    // Log usage
    await supabase.from("claude_usage_logs").insert({
      user_id: providerId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: "medication_reconciliation",
      input_tokens: 2000,
      output_tokens: 2500,
      cost: (2000 / 1_000_000) * 3.0 + (2500 / 1_000_000) * 15.0,
      response_time_ms: responseTime,
      success: true,
      metadata: {
        encounterType,
        totalMedications: totalMeds,
        discrepanciesFound: result.discrepancyAnalysis.length,
        deprescribingOpportunities: result.deprescribingCandidates.length,
      },
    });

    // Log PHI access for HIPAA audit
    logger.phi("Medication reconciliation performed", {
      patientId: redact(patientId),
      encounterType,
      totalMedications: totalMeds,
      discrepanciesFound: result.discrepancyAnalysis.length,
    });

    return new Response(
      JSON.stringify({
        result,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: SONNET_MODEL,
          responseTimeMs: responseTime,
          encounterType,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Medication reconciliation failed", { error: error.message });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI Analysis
// ─────────────────────────────────────────────────────────────────────────────

async function performReconciliationAnalysis(
  medications: MedicationSource,
  allergies: string[],
  activeConditions: Array<{ code: string; display: string }>,
  labValues: ReconciliationRequest["labValues"],
  patientAge: number | undefined,
  encounterType: string,
  logger: ReturnType<typeof createLogger>
): Promise<{
  reconciliationSummary: {
    continued: MedicationEntry[];
    new: MedicationEntry[];
    changed: Array<{ medication: string; changeType: string; from: string; to: string }>;
    discontinued: MedicationEntry[];
    allergiesConsidered: string[];
    interactionsIdentified: string[];
  };
  discrepancyAnalysis: DiscrepancyAnalysis[];
  deprescribingCandidates: DeprescribingCandidate[];
  patientCounseling: PatientCounselingPoint[];
  pharmacyChecklist: string[];
  actionItems: Array<{ priority: "immediate" | "high" | "medium" | "low"; action: string; rationale: string }>;
  statistics: {
    totalMedicationsReviewed: number;
    continued: number;
    new: number;
    changed: number;
    discontinued: number;
    discrepanciesFound: number;
    deprescribingOpportunities: number;
  };
  confidence: number;
  requiresReview: boolean;
  reviewReasons: string[];
  pharmacistReviewRequired: boolean;
  narrativeSummary: string;
}> {
  // Format medication lists for the prompt
  const formatMedList = (meds: MedicationEntry[]): string => {
    if (meds.length === 0) return "None";
    return meds
      .map(
        (m) =>
          `- ${m.name}${m.dosage ? ` ${m.dosage}` : ""}${m.frequency ? ` ${m.frequency}` : ""}${m.route ? ` (${m.route})` : ""}${m.indication ? ` for ${m.indication}` : ""}`
      )
      .join("\n");
  };

  const admissionMeds = formatMedList(medications.admission || []);
  const prescribedMeds = formatMedList(medications.prescribed || []);
  const currentMeds = formatMedList(medications.current || []);
  const dischargeMeds = medications.discharge ? formatMedList(medications.discharge) : "N/A";

  const conditionsText =
    activeConditions.length > 0
      ? activeConditions.map((c) => `${c.display} (${c.code})`).join(", ")
      : "None documented";

  const allergiesText = allergies.length > 0 ? allergies.join(", ") : "NKDA";

  const labText = labValues
    ? Object.entries(labValues)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ") || "Not available"
    : "Not available";

  const prompt = `You are an expert clinical pharmacist performing a comprehensive medication reconciliation for a ${encounterType} encounter. Analyze all medication lists and provide clinical insights.

PATIENT CONTEXT:
- Age: ${patientAge !== undefined ? `${patientAge} years` : "Unknown"}
- Allergies: ${allergiesText}
- Active Conditions: ${conditionsText}
- Recent Labs: ${labText}

MEDICATION LISTS TO RECONCILE:

ADMISSION/PRIOR MEDICATIONS:
${admissionMeds}

NEWLY PRESCRIBED (this encounter):
${prescribedMeds}

CURRENT/HOME MEDICATIONS:
${currentMeds}

DISCHARGE MEDICATIONS:
${dischargeMeds}

Perform comprehensive medication reconciliation with the following analysis:

1. RECONCILIATION SUMMARY
   - Identify medications that continue unchanged
   - Identify new medications
   - Identify medications with changes (dose, frequency, route)
   - Identify discontinued medications
   - Note any allergies that were considered
   - Note any drug interactions identified

2. DISCREPANCY ANALYSIS
   For each discrepancy found:
   - Explain WHY this discrepancy likely occurred (clinical reasoning)
   - Rate clinical significance (critical/high/medium/low)
   - Provide specific recommendations
   - Flag if pharmacist review is required

3. DEPRESCRIBING OPPORTUNITIES
   Consider polypharmacy reduction for:
   - Duplicate therapies
   - Medications without clear indication
   - Potentially inappropriate medications (especially if age > 65, use Beers criteria)
   - Medications with risk > benefit

4. PATIENT COUNSELING POINTS
   Generate key counseling topics based on:
   - New medications
   - Changed medications
   - High-alert medications
   - Medications with important warnings

5. PHARMACY VERIFICATION CHECKLIST
   Create verification items for pharmacy review

6. PRIORITY ACTION ITEMS
   List actions needed, ranked by priority

Return your analysis as JSON with this exact structure:
{
  "reconciliationSummary": {
    "continued": [{"name": "med name", "dosage": "dose", "frequency": "freq"}],
    "new": [{"name": "med name", "dosage": "dose", "frequency": "freq"}],
    "changed": [{"medication": "name", "changeType": "dose|frequency|route", "from": "old", "to": "new"}],
    "discontinued": [{"name": "med name", "dosage": "dose"}],
    "allergiesConsidered": ["allergy1"],
    "interactionsIdentified": ["interaction description"]
  },
  "discrepancyAnalysis": [
    {
      "medication": "name",
      "discrepancyType": "missing|duplicate|dose_change|route_change|new|discontinued|frequency_change",
      "likelyReason": "Clinical explanation",
      "clinicalSignificance": "critical|high|medium|low",
      "recommendation": "Action to take",
      "requiresPharmacistReview": true|false,
      "confidence": 0.85
    }
  ],
  "deprescribingCandidates": [
    {
      "medication": "name",
      "reason": "Why consider deprescribing",
      "evidence": "Supporting evidence/guideline",
      "riskIfContinued": "Risk of continuing",
      "suggestedApproach": "How to taper/stop",
      "priority": "high|medium|low"
    }
  ],
  "patientCounseling": [
    {
      "topic": "Topic title",
      "keyPoints": ["point1", "point2"],
      "relatedMedications": ["med1", "med2"],
      "warningSignsToWatch": ["sign1", "sign2"]
    }
  ],
  "pharmacyChecklist": ["Item 1", "Item 2"],
  "actionItems": [
    {
      "priority": "immediate|high|medium|low",
      "action": "What to do",
      "rationale": "Why important"
    }
  ],
  "statistics": {
    "totalMedicationsReviewed": 10,
    "continued": 5,
    "new": 2,
    "changed": 2,
    "discontinued": 1,
    "discrepanciesFound": 3,
    "deprescribingOpportunities": 1
  },
  "confidence": 0.85,
  "requiresReview": true,
  "reviewReasons": ["Reason 1", "Reason 2"],
  "pharmacistReviewRequired": false,
  "narrativeSummary": "2-3 sentence clinical summary"
}

SAFETY RULES:
- ALL medication reconciliations require clinical review (requiresReview: true always)
- Critical discrepancies require immediate pharmacist review
- Be conservative with clinical significance ratings
- Document clear rationale for each finding
- Flag drug interactions prominently

Return ONLY valid JSON.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 4000,
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

      // Ensure safety flags are set
      parsed.requiresReview = true;
      if (!parsed.reviewReasons || parsed.reviewReasons.length === 0) {
        parsed.reviewReasons = ["All medication reconciliations require clinician review"];
      }

      return {
        reconciliationSummary: parsed.reconciliationSummary || {
          continued: [],
          new: [],
          changed: [],
          discontinued: [],
          allergiesConsidered: [],
          interactionsIdentified: [],
        },
        discrepancyAnalysis: parsed.discrepancyAnalysis || [],
        deprescribingCandidates: parsed.deprescribingCandidates || [],
        patientCounseling: parsed.patientCounseling || [],
        pharmacyChecklist: parsed.pharmacyChecklist || [],
        actionItems: parsed.actionItems || [],
        statistics: parsed.statistics || {
          totalMedicationsReviewed: 0,
          continued: 0,
          new: 0,
          changed: 0,
          discontinued: 0,
          discrepanciesFound: 0,
          deprescribingOpportunities: 0,
        },
        confidence: parsed.confidence || 0.75,
        requiresReview: true,
        reviewReasons: parsed.reviewReasons,
        pharmacistReviewRequired: parsed.pharmacistReviewRequired || false,
        narrativeSummary:
          parsed.narrativeSummary || "Medication reconciliation complete. Please review all findings.",
      };
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  // Fallback response if parsing fails
  logger.warn("Using fallback reconciliation response");
  return {
    reconciliationSummary: {
      continued: [],
      new: [],
      changed: [],
      discontinued: [],
      allergiesConsidered: allergies,
      interactionsIdentified: [],
    },
    discrepancyAnalysis: [],
    deprescribingCandidates: [],
    patientCounseling: [],
    pharmacyChecklist: ["Verify all medication names and doses", "Check for drug-drug interactions"],
    actionItems: [
      {
        priority: "high",
        action: "Manual reconciliation required",
        rationale: "Automated analysis could not be completed",
      },
    ],
    statistics: {
      totalMedicationsReviewed: 0,
      continued: 0,
      new: 0,
      changed: 0,
      discontinued: 0,
      discrepanciesFound: 0,
      deprescribingOpportunities: 0,
    },
    confidence: 0.3,
    requiresReview: true,
    reviewReasons: ["Automated analysis incomplete - manual review required"],
    pharmacistReviewRequired: true,
    narrativeSummary:
      "Unable to complete automated medication reconciliation. Manual pharmacist and clinical review required.",
  };
}
