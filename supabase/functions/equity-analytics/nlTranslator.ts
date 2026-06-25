// equity-analytics — plain-language → spec translator (the AI "front door").
//
// The AI NEVER sees patient data and NEVER writes SQL. It only fills a whitelisted JSON spec by
// choosing source/measure/dimension keys from the catalog it is shown. The returned spec is
// re-validated against the catalog (and again by the SQL engine's own whitelist) before it runs —
// defense in depth. If the question can't be answered from the catalog, the model asks a clarifying
// question instead of guessing (ai-services.md structured-output rule; python.md §3 untrusted-output).

import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0?target=deno";
import { SONNET_MODEL } from "../_shared/models.ts";
import { CATALOG, MAX_DIMENSIONS } from "./catalog.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

export const NL_TRANSLATOR_MODEL = SONNET_MODEL;
export const NL_SKILL_KEY = "equity_analytics_nl_translator";

export interface TranslatedSpec {
  source: string;
  measure: string;
  dimensions: string[];
  filters?: { dimension: string; value: string }[];
  timeGrain?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export type TranslationResult =
  | { kind: "spec"; spec: TranslatedSpec; usage: { input: number; output: number } }
  | { kind: "clarify"; message: string; usage: { input: number; output: number } }
  | { kind: "error"; message: string };

// Compact catalog the model is allowed to choose from.
function catalogForPrompt(): string {
  const lines: string[] = [];
  for (const src of Object.values(CATALOG)) {
    lines.push(`SOURCE "${src.key}" — ${src.label}: ${src.description}${src.timeSeries ? " (supports time trends)" : ""}`);
    lines.push(`  measures: ${src.measures.map((m) => `${m.key} (${m.label})`).join("; ")}`);
    lines.push(`  dimensions: ${src.dimensions.map((d) => `${d.key} (${d.label})`).join("; ")}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `You translate a person's plain-language question about population health into a STRUCTURED AGGREGATE SPEC for a health-equity analytics engine.

The engine returns ONLY aggregate reports — counts, percentages, averages, and cross-tabs grouped by demographic/SDOH dimensions. It NEVER returns individual people. You never see any patient data; you only choose fields.

Rules:
- Choose a "source", one "measure", and 0–${MAX_DIMENSIONS} "dimensions" using ONLY the exact keys from the catalog below. Never invent a key.
- Demographic/SDOH breakdowns ("by race", "by language", "for veterans") map to dimensions or filters.
- A constraint that selects a group ("members over 75", "Spanish speakers") is a filter {dimension, value} OR, for age, prefer a dimension/filter on age_band.
- Geography is already coarse (zcta3 = 3-digit ZIP region). There is no finer geography.
- "over time"/"trend"/"by month" → set timeGrain (only for time-series sources).
- If the question asks for a measure, field, or breakdown that is NOT in the catalog (e.g. a specific clinical lab the engine doesn't have), DO NOT guess — call request_clarification and say what is and isn't available.
- If the question is ambiguous about which source or measure, call request_clarification with a short, specific question.
- Otherwise call build_equity_spec with your best valid mapping.

CATALOG:
${catalogForPrompt()}`;

const TOOLS = [
  {
    name: "build_equity_spec",
    description: "Build a validated aggregate spec from catalog keys only. Use when the question maps cleanly to an available source + measure.",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", enum: Object.keys(CATALOG), description: "Catalog source key." },
        measure: { type: "string", description: "A measure key valid for the chosen source." },
        dimensions: {
          type: "array",
          items: { type: "string" },
          maxItems: MAX_DIMENSIONS,
          description: "0–3 dimension keys valid for the chosen source (group-by axes / cross-tab).",
        },
        filters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dimension: { type: "string" },
              value: { type: "string" },
            },
            required: ["dimension", "value"],
            additionalProperties: false,
          },
          description: "Equality filters on dimension keys (e.g. {dimension:'gender', value:'Female'}).",
        },
        timeGrain: { type: ["string", "null"], enum: ["month", "quarter", "year", null], description: "Time bucket for trends; only for time-series sources." },
        dateFrom: { type: ["string", "null"], description: "Optional ISO date lower bound (YYYY-MM-DD)." },
        dateTo: { type: ["string", "null"], description: "Optional ISO date upper bound (YYYY-MM-DD)." },
      },
      required: ["source", "measure", "dimensions"],
      additionalProperties: false,
    },
  },
  {
    name: "request_clarification",
    description: "Use when the question is ambiguous, out of scope, or asks for data/fields not in the catalog. Ask one concise, specific clarifying question.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "A short clarifying question for the user." },
      },
      required: ["message"],
      additionalProperties: false,
    },
  },
];

interface ToolUseBlock {
  type: string;
  name?: string;
  input?: Record<string, unknown>;
}

/** Translate a natural-language question into a spec (or a clarification request). */
export async function translateQuestion(question: string): Promise<TranslationResult> {
  if (!ANTHROPIC_API_KEY) {
    return { kind: "error", message: "AI translation is not configured (missing ANTHROPIC_API_KEY)." };
  }
  const trimmed = (question ?? "").trim();
  if (!trimmed) return { kind: "error", message: "Please enter a question." };
  if (trimmed.length > 1000) return { kind: "error", message: "Question is too long (max 1000 characters)." };

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  let response: { content?: ToolUseBlock[]; usage?: { input_tokens?: number; output_tokens?: number } };
  try {
    response = await anthropic.messages.create({
      model: NL_TRANSLATOR_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS as unknown as Anthropic.Tool[],
      tool_choice: { type: "any" }, // MUST call one of the tools — never free-text
      messages: [{ role: "user", content: trimmed }],
    }) as unknown as { content?: ToolUseBlock[]; usage?: { input_tokens?: number; output_tokens?: number } };
  } catch (err: unknown) {
    return { kind: "error", message: err instanceof Error ? err.message : "AI translation failed." };
  }

  const usage = {
    input: response.usage?.input_tokens ?? 0,
    output: response.usage?.output_tokens ?? 0,
  };
  const toolUse = (response.content ?? []).find((b) => b.type === "tool_use");
  if (!toolUse || !toolUse.name) {
    return { kind: "error", message: "AI did not return a structured spec." };
  }

  if (toolUse.name === "request_clarification") {
    const message = String(toolUse.input?.message ?? "Could you rephrase your question?");
    return { kind: "clarify", message, usage };
  }

  if (toolUse.name === "build_equity_spec") {
    const input = toolUse.input ?? {};
    const spec: TranslatedSpec = {
      source: String(input.source ?? ""),
      measure: String(input.measure ?? ""),
      dimensions: Array.isArray(input.dimensions) ? (input.dimensions as unknown[]).map(String) : [],
      filters: Array.isArray(input.filters)
        ? (input.filters as { dimension?: unknown; value?: unknown }[]).map((f) => ({
            dimension: String(f.dimension ?? ""),
            value: String(f.value ?? ""),
          }))
        : [],
      timeGrain: (input.timeGrain as string | null) ?? null,
      dateFrom: (input.dateFrom as string | null) ?? null,
      dateTo: (input.dateTo as string | null) ?? null,
    };
    return { kind: "spec", spec, usage };
  }

  return { kind: "error", message: `Unexpected tool "${toolUse.name}".` };
}
