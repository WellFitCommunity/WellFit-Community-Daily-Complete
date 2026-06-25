// equity-analytics — Equity & Population-Health Analytics engine (edge entry point).
//
// Returns REPORT-GENERATED aggregates (counts/%, distributions, cross-tabs) — never raw rows.
// The actual aggregation is done by the equity_aggregate() SQL function, whose whitelist makes a
// raw-row response structurally impossible. This function adds: auth, role gating, tenant scoping,
// rate limiting, request validation, researcher-tier handling, and audit logging.
//
// Routes (POST JSON body):
//   { action: "catalog" }                  -> returns the dimension/measure catalog (for UI building)
//   { action: "query", spec: EquitySpec }  -> runs an aggregate and returns the report rows
//   (a bare spec body with no action is treated as a query)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import { z } from "https://esm.sh/zod@3.21.4";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rateLimiter.ts";
import { CATALOG, MAX_DIMENSIONS, TIME_GRAINS, validateAgainstCatalog } from "./catalog.ts";
import { NL_TRANSLATOR_MODEL, translateQuestion } from "./nlTranslator.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
const SB_SECRET_KEY = Deno.env.get("SB_SECRET_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Roles permitted to run population-health analytics. Aggregate-only + tenant-scoped, but still
// gated to leadership / clinical / care-coordination / analytics roles (never general members).
const ANALYTICS_ROLES = new Set([
  "admin", "super_admin", "physician", "nurse_practitioner", "clinical_supervisor",
  "department_head", "quality_manager", "social_worker", "case_manager",
  "community_health_worker", "chw", "researcher",
]);

// Researcher tier = stricter de-identified view: small cells are dropped (not just flagged), since a
// researcher export is the one path where re-identification of a small group is a real risk.
const RESEARCHER_MIN_CELL = 11;
const LOW_N_THRESHOLD = 11;

const SpecSchema = z.object({
  source: z.string(),
  measure: z.string(),
  dimensions: z.array(z.string()).max(MAX_DIMENSIONS).default([]),
  filters: z.array(z.object({ dimension: z.string(), value: z.string() })).default([]),
  timeGrain: z.enum(TIME_GRAINS).nullable().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // Optional per-report filter to EXCLUDE small cells (default: keep them, flagged low_n).
  minCellSize: z.number().int().positive().max(10000).nullable().optional(),
});

type Spec = z.infer<typeof SpecSchema>;

interface Cell {
  value: number | null;
  cell_n: number;
  low_n: boolean;
  [dimension: string]: unknown;
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const { headers: cors } = corsFromRequest(req);

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, cors);
  }

  const admin = createClient(SUPABASE_URL, SB_SECRET_KEY);

  // 1. Authenticate
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing authorization" }, 401, cors);
  }
  const token = authHeader.slice(7).trim();
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData?.user) {
    return json({ error: "Invalid token" }, 401, cors);
  }
  const userId = userData.user.id;

  // 2. Resolve caller's tenant + role (profiles.user_id, never id)
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile?.tenant_id) {
    return json({ error: "Profile/tenant not found" }, 403, cors);
  }
  const role = (profile.role ?? "").toLowerCase();
  if (!ANALYTICS_ROLES.has(role)) {
    return json({ error: "Forbidden: analytics access requires an admin/clinical/analyst role" }, 403, cors);
  }
  const tenantId = profile.tenant_id as string;
  const tier = role === "researcher" ? "researcher" : "standard";

  // 3. Rate limit (read-tier; per-user)
  const rl = await checkRateLimit(`equity-analytics:${userId}`, RATE_LIMITS.READ);
  if (!rl.allowed) {
    return json({ error: "Rate limit exceeded", resetAt: rl.resetAt }, 429, cors);
  }

  // 4. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  const action = (body as { action?: string })?.action ?? "query";

  // Catalog request — served so the UI never hardcodes fields.
  if (action === "catalog") {
    return json({ catalog: CATALOG, tier }, 200, cors);
  }

  // Normalize + validate any spec against the catalog (shared by query/ask).
  function normalizeSpec(raw: unknown): { ok: true; spec: Spec } | { ok: false; error: string } {
    const parsed = SpecSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: "Invalid spec" };
    const check = validateAgainstCatalog(parsed.data);
    if (!check.ok) return { ok: false, error: check.error };
    return { ok: true, spec: parsed.data };
  }

  // Run the deterministic engine + audit. nlProvenance records the AI translation for transparency.
  async function runAggregate(
    spec: Spec,
    nlProvenance?: { question: string; model: string; usage: { input: number; output: number } },
  ): Promise<{ status: number; body: unknown }> {
    // Researcher tier enforces a minimum cell size (drops small cells); standard tier flags only.
    const effectiveMinCell = tier === "researcher"
      ? Math.max(RESEARCHER_MIN_CELL, spec.minCellSize ?? 0)
      : (spec.minCellSize ?? null);

    const { data, error } = await admin.rpc("equity_aggregate", {
      p_tenant: tenantId,
      p_source: spec.source,
      p_dimensions: spec.dimensions,
      p_measure: spec.measure,
      p_filters: spec.filters,
      p_time_grain: spec.timeGrain ?? null,
      p_date_from: spec.dateFrom ?? null,
      p_date_to: spec.dateTo ?? null,
      p_low_n_threshold: LOW_N_THRESHOLD,
      p_min_cell_size: effectiveMinCell,
      p_row_limit: 2000,
    });
    if (error) {
      return { status: 400, body: { error: "Aggregation failed", details: error.message } };
    }

    const rows: Cell[] = (data ?? []).map((r: { cell: Cell }) => r.cell);
    const lowNCount = rows.filter((c) => c.low_n).length;
    const minCellN = rows.length ? rows.reduce((acc, c) => Math.min(acc, c.cell_n), Infinity) : null;

    await admin.from("analytics_query_log").insert({
      tenant_id: tenantId,
      requested_by: userId,
      requester_role: role,
      source: spec.source,
      measure: spec.measure,
      dimensions: spec.dimensions,
      // Full provenance for transparency: the spec verbatim plus the NL question + AI model when applicable.
      spec: { ...spec, ...(nlProvenance ? { _nl: nlProvenance } : {}) } as unknown as Record<string, unknown>,
      cell_count: rows.length,
      low_n_cell_count: lowNCount,
      min_cell_n: minCellN,
      tier,
    });

    return {
      status: 200,
      body: {
        rows,
        meta: {
          source: spec.source,
          measure: spec.measure,
          dimensions: spec.dimensions,
          timeGrain: spec.timeGrain ?? null,
          tier,
          cellCount: rows.length,
          lowNCellCount: lowNCount,
          // Small cells are flagged (low_n), never masked, unless the report explicitly drops them.
          smallCellsDropped: effectiveMinCell != null,
          generatedAt: new Date().toISOString(),
          ...(nlProvenance ? { interpretedFrom: nlProvenance.question, translatedBy: nlProvenance.model } : {}),
        },
      },
    };
  }

  // --- AI plain-language layer (translate / ask) ---
  if (action === "translate" || action === "ask") {
    const question = String((body as { question?: unknown }).question ?? "");
    const t = await translateQuestion(question);

    if (t.kind === "error") return json({ error: t.message }, 400, cors);
    if (t.kind === "clarify") {
      return json({ clarification: t.message, question }, 200, cors);
    }

    // t.kind === "spec": re-validate the AI's output against the catalog (never trust model output).
    const norm = normalizeSpec(t.spec);
    if (!norm.ok) {
      return json({
        clarification: `I couldn't map that to the available data: ${norm.error}. Try naming a specific measure or breakdown.`,
        question,
      }, 200, cors);
    }

    if (action === "translate") {
      return json({ spec: norm.spec, interpretedFrom: question, translatedBy: NL_TRANSLATOR_MODEL }, 200, cors);
    }
    const result = await runAggregate(norm.spec, { question, model: NL_TRANSLATOR_MODEL, usage: t.usage });
    return json(result.body, result.status, cors);
  }

  // --- Direct structured query (no AI) ---
  const norm = normalizeSpec((body as { spec?: unknown }).spec ?? body);
  if (!norm.ok) {
    return json({ error: norm.error }, 400, cors);
  }
  const result = await runAggregate(norm.spec);
  return json(result.body, result.status, cors);
});
