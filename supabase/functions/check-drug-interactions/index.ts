// supabase/functions/check-drug-interactions/index.ts
// Drug Interaction Checker using FREE RxNorm API from NLM
// Enhanced with AI-powered alternative medication suggestions
// API Documentation: https://rxnav.nlm.nih.gov/InteractionAPIs.html

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from "../_shared/auditLogger.ts";

const SUPABASE_SERVICE_ROLE_KEY = SB_SECRET_KEY;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const HAIKU_MODEL = "claude-haiku-4-5-20250919";

const RXNORM_API_BASE = "https://rxnav.nlm.nih.gov/REST";

interface DrugInteractionRequest {
  medication_rxcui: string;
  patient_id: string;
  medication_name?: string;
  suggestAlternatives?: boolean;
  patientConditions?: string[];
}

interface DrugInteractionResponse {
  has_interactions: boolean;
  interactions: Array<{
    severity: string;
    interacting_medication: string;
    description: string;
    source: string;
  }>;
  checked_against: string[];
  alternatives?: AlternativeSuggestion[];
  ai_analysis?: string;
}

interface AlternativeSuggestion {
  medication_name: string;
  drug_class: string;
  rationale: string;
  considerations: string[];
  requires_review: boolean;
}

serve(async (req) => {
  try {
    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      return handleOptions(req, { methods: ["POST"] });
    }

    // Get CORS headers for this origin
    const { headers: corsHeaders, allowed } = corsFromRequest(req);

    // Reject requests from unauthorized origins
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request
    const {
      medication_rxcui,
      patient_id,
      medication_name,
      suggestAlternatives = true,
      patientConditions = [],
    }: DrugInteractionRequest = await req.json();

    const logger = createLogger("check-drug-interactions", req);

    if (!medication_rxcui || !patient_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: medication_rxcui, patient_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logger.info(`Checking drug interactions for RxCUI: ${medication_rxcui}`);

    // Step 1: Get patient's active medications
    const { data: activeMeds, error: medsError } = await supabase
      .from("fhir_medication_requests")
      .select("medication_codeable_concept, id")
      .eq("patient_id", patient_id)
      .eq("status", "active");

    if (medsError) {
      throw new Error(`Failed to fetch active medications: ${medsError.message}`);
    }

    // Extract RxCUI codes from active medications
    const activeRxcuis: string[] = [];
    const rxcuiToMedName: Record<string, string> = {};

    for (const med of activeMeds || []) {
      const rxcui = med.medication_codeable_concept?.rxcui;
      const medName = med.medication_codeable_concept?.coding?.[0]?.display || "Unknown medication";

      if (rxcui && rxcui !== medication_rxcui) {
        activeRxcuis.push(rxcui);
        rxcuiToMedName[rxcui] = medName;
      }
    }

    if (activeRxcuis.length === 0) {
      // No active medications to check against
      return new Response(
        JSON.stringify({
          has_interactions: false,
          interactions: [],
          checked_against: [],
          message: "Patient has no other active medications",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking ${medication_rxcui} against ${activeRxcuis.length} active medications`);

    // Step 2: Check cache first
    const interactions: Array<{
      severity: string;
      interacting_medication: string;
      description: string;
      source: string;
    }> = [];

    const uncachedRxcuis: string[] = [];

    for (const activeRxcui of activeRxcuis) {
      // Check cache (bidirectional)
      const { data: cached, error: cacheError } = await supabase
        .from("drug_interaction_cache")
        .select("*")
        .or(
          `and(drug_a_rxcui.eq.${medication_rxcui},drug_b_rxcui.eq.${activeRxcui}),and(drug_a_rxcui.eq.${activeRxcui},drug_b_rxcui.eq.${medication_rxcui})`
        )
        .gt("cache_expires_at", new Date().toISOString())
        .limit(1)
        .single();

      if (!cacheError && cached && cached.has_interaction) {
        // Use cached interaction
        interactions.push({
          severity: cached.severity || "unknown",
          interacting_medication: rxcuiToMedName[activeRxcui],
          description: cached.interaction_description || "",
          source: "cache",
        });
      } else if (cacheError?.code === "PGRST116") {
        // Not in cache - need to check API
        uncachedRxcuis.push(activeRxcui);
      }
    }

    // Step 3: Check RxNorm API for uncached medications
    if (uncachedRxcuis.length > 0) {
      console.log(`Checking RxNorm API for ${uncachedRxcuis.length} uncached medications`);

      // RxNorm API can check multiple RxCUIs at once
      const rxcuiList = uncachedRxcuis.join("+");
      const rxnormUrl = `${RXNORM_API_BASE}/interaction/list.json?rxcuis=${medication_rxcui}+${rxcuiList}&sources=DrugBank`;

      const rxnormResponse = await fetch(rxnormUrl);
      const rxnormData = await rxnormResponse.json();

      // Parse RxNorm response
      const interactionTypeGroups = rxnormData?.fullInteractionTypeGroup || [];

      for (const typeGroup of interactionTypeGroups) {
        const interactionTypes = typeGroup?.fullInteractionType || [];

        for (const interactionType of interactionTypes) {
          const interactionPairs = interactionType?.interactionPair || [];

          for (const pair of interactionPairs) {
            const description = pair?.description || "";
            const severity = pair?.severity || "N/A";

            // Determine which drug is the interacting one
            const minConcept = pair?.interactionConcept?.[0];
            const interactingRxcui = minConcept?.minConceptItem?.rxcui;
            const interactingName = minConcept?.minConceptItem?.name || rxcuiToMedName[interactingRxcui] || "Unknown";

            if (interactingRxcui && interactingRxcui !== medication_rxcui) {
              interactions.push({
                severity: severity.toLowerCase(),
                interacting_medication: interactingName,
                description,
                source: "rxnorm",
              });

              // Cache this interaction
              await supabase.from("drug_interaction_cache").insert({
                drug_a_rxcui: medication_rxcui,
                drug_a_name: medication_name || "Unknown",
                drug_b_rxcui: interactingRxcui,
                drug_b_name: interactingName,
                has_interaction: true,
                severity: severity.toLowerCase(),
                interaction_description: description,
                source_api: "rxnorm",
                source_version: "DrugBank",
              });
            }
          }
        }
      }

      // Cache negative results too (no interaction found)
      for (const rxcui of uncachedRxcuis) {
        const foundInteraction = interactions.some(
          (i) => rxcuiToMedName[rxcui]?.includes(i.interacting_medication)
        );

        if (!foundInteraction) {
          await supabase.from("drug_interaction_cache").insert({
            drug_a_rxcui: medication_rxcui,
            drug_a_name: medication_name || "Unknown",
            drug_b_rxcui: rxcui,
            drug_b_name: rxcuiToMedName[rxcui],
            has_interaction: false,
            source_api: "rxnorm",
            source_version: "DrugBank",
          });
        }
      }
    }

    // Step 4: Log this check for audit compliance
    await supabase.from("drug_interaction_check_logs").insert({
      patient_id,
      medication_rxcui,
      medication_name: medication_name || "Unknown",
      check_performed: true,
      interactions_found: interactions.length,
      highest_severity: interactions.length > 0
        ? interactions.reduce((max, i) => {
            const severityOrder = { high: 3, moderate: 2, low: 1, "n/a": 0 };
            return (severityOrder[i.severity as keyof typeof severityOrder] || 0) >
                   (severityOrder[max as keyof typeof severityOrder] || 0)
              ? i.severity
              : max;
          }, "n/a")
        : null,
      api_used: "rxnorm",
      prescriber_id: user.id,
    });

    // Step 5: Get AI-powered alternative suggestions if interactions found
    let alternatives: AlternativeSuggestion[] = [];
    let aiAnalysis: string | undefined;

    if (interactions.length > 0 && suggestAlternatives && ANTHROPIC_API_KEY) {
      try {
        const aiResult = await getAlternativeSuggestions(
          medication_name || "Unknown medication",
          interactions,
          patientConditions,
          logger
        );
        alternatives = aiResult.alternatives;
        aiAnalysis = aiResult.analysis;

        // Log AI usage
        await supabase.from("claude_usage_logs").insert({
          user_id: user.id,
          request_id: crypto.randomUUID(),
          model: HAIKU_MODEL,
          request_type: "drug_interaction_alternatives",
          input_tokens: 300,
          output_tokens: 500,
          cost: (300 / 1_000_000) * 0.8 + (500 / 1_000_000) * 4.0,
          response_time_ms: 0,
          success: true,
        });
      } catch (aiError: unknown) {
        const error = aiError instanceof Error ? aiError : new Error(String(aiError));
        logger.warn("AI alternative suggestion failed", { error: error.message });
        // Continue without alternatives - core interaction check succeeded
      }
    }

    // Step 6: Return results
    return new Response(
      JSON.stringify({
        has_interactions: interactions.length > 0,
        interactions,
        checked_against: activeRxcuis.map((rxcui) => rxcuiToMedName[rxcui]),
        medication_rxcui,
        patient_id,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
        ai_analysis: aiAnalysis,
      } as DrugInteractionResponse),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("Drug interaction check error:", error);
    const { headers: corsHeaders } = corsFromRequest(req);
    return new Response(
      JSON.stringify({
        error: "Failed to check drug interactions",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});

/**
 * Get AI-powered alternative medication suggestions
 */
async function getAlternativeSuggestions(
  medicationName: string,
  interactions: Array<{ severity: string; interacting_medication: string; description: string }>,
  patientConditions: string[],
  logger: ReturnType<typeof createLogger>
): Promise<{ alternatives: AlternativeSuggestion[]; analysis: string }> {
  const interactionSummary = interactions
    .map((i) => `- ${i.interacting_medication} (${i.severity}): ${i.description}`)
    .join("\n");

  const conditionsNote = patientConditions.length > 0
    ? `Patient conditions: ${patientConditions.join(", ")}`
    : "No specific conditions provided";

  const prompt = `You are a clinical pharmacist assistant. A drug interaction has been detected.

MEDICATION BEING PRESCRIBED: ${medicationName}

DETECTED INTERACTIONS:
${interactionSummary}

${conditionsNote}

Provide:
1. A brief clinical analysis of the interaction severity and risks
2. 2-3 alternative medications that could be considered (same therapeutic class, fewer interactions)

IMPORTANT DISCLAIMERS:
- These are suggestions only, requiring prescriber review
- Do not provide dosing recommendations
- All alternatives require clinical verification

Return JSON:
{
  "analysis": "Brief clinical analysis of the interactions",
  "alternatives": [
    {
      "medication_name": "Generic name",
      "drug_class": "Therapeutic class",
      "rationale": "Why this is a potential alternative",
      "considerations": ["Key consideration 1", "Key consideration 2"],
      "requires_review": true
    }
  ]
}

Respond with ONLY the JSON, no other text.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 1024,
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
      return {
        alternatives: parsed.alternatives || [],
        analysis: parsed.analysis || "",
      };
    }
  } catch (parseErr: unknown) {
    const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
    logger.warn("Failed to parse AI response", { error: error.message });
  }

  return { alternatives: [], analysis: "" };
}
