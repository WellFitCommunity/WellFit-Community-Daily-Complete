# Tracker — Equity & Population-Health Analytics Query System

**Created:** 2026-06-09
**Owner:** Maria (product) + Akima (clinical measures)
**Estimate:** ~16–48h, 3–4 sessions
**Litmus test:** a fresh Claude can execute Session 1 from this file without asking questions.

---

## Goal

Let an **admin / physician / researcher** ask a question **in plain language** ("What % of diabetic patients over 65 have controlled blood pressure, broken down by race and language?") and get back an **aggregated chart** — percentages, trends, and intersectional cross-tabs — **never raw rows, never patient identifiers**. Built to assist **care coordination and health equity**.

**Intent (Maria, 2026-06-09): this is forward infrastructure.** Build the capability NOW so it is ready and at our fingertips as data-collection fill-rates rise — it does NOT need high usage on day one. The value compounds as demographic/SDOH/clinical fields populate over time. Therefore the engine MUST **degrade gracefully on thin data**: a sparse or fully-suppressed result must render as an intentional, explained state ("Insufficient data for this breakdown — fewer than k records"), never a broken/empty/error-looking chart. Graceful low-N behavior is a Session 1 + Session 3 acceptance criterion, not a polish item.

## Non-negotiable safety invariants (the feature lives or dies on these)

1. **Aggregate-only by construction.** The engine emits only `COUNT` / `AVG` / `%` with `GROUP BY`. There is NO code path that returns a raw patient row.
2. **No LLM-authored SQL.** Plain-language input → Claude fills a **whitelisted JSON spec** (dimensions + measure + filters chosen from a server catalog) → engine compiles the spec into one parameterized aggregation query. Claude never writes SQL.
3. **Small-cell suppression (k-anonymity).** Any result cell with `n < k` is masked (`"<11"`). Default **k = 11** (HHS/CMS standard), per-tenant configurable.
4. **Geography is bucketed.** `zip_code` → **3-digit ZCTA** for everyone; full 5-digit zip never returned. Researcher tier suppresses zip beyond region entirely.
5. **Role-gated, tenant-scoped, audit-logged.** Every query is logged (who, what spec, row counts pre/post suppression). Admin/physician = full-resolution tenant aggregates. **Researcher = stricter de-identified tier** (higher k, coarser age/date buckets, no tenant-identifying detail).

---

## Verified data substrate (live DB, confirmed 2026-06-09)

Demographic spine = `profiles`:
- `race` (text), `race_omb_categories` (text[]), `ethnicity` (text), `ethnicity_omb` (text) — OMB-coded
- `gender` (text), `dob` (date → age bands)
- `zip_code` (text → 3-digit ZCTA), `income_range` (text), `insurance_type` / `primary_insurance` (text)
- `sdoh_risk_factors` (jsonb)

Supporting: `senior_demographics.preferred_language`, `senior_sdoh`, `passive_sdoh_detections.sdoh_category`, `sdoh_goals`.
Clinical/measure sources: `check_ins` (adherence/vitals), `readmission_risk_predictions`, `care_coordination_plans.sdoh_factors`, `ai_predictions` (denormalized race/language/payer).

---

## Catalog (v1 starter — extend later)

**Dimensions** (group-by axes): `race_omb`, `ethnicity_omb`, `gender`, `age_band` (`<65,65-74,75-84,85+`), `preferred_language`, `zcta3` (3-digit zip), `income_range`, `insurance_type`, `sdoh_category`.
**Measures** (the "what"): `member_count`, `checkin_rate`, `missed_checkin_rate`, `risk_level_distribution`, plus a **clinical measure list to be supplied by Akima** (e.g. BP-control %, A1c-in-range %, med-adherence %). Engine accepts any whitelisted measure; do NOT invent clinical thresholds.
**Filters:** equality / range on any dimension + a date range.

---

## Session 1 — Engine spine (no UI, no NL yet)

**Build:**
- `supabase/functions/equity-analytics/` edge function (Deno). Auth via `_shared/auth.ts requireRole(['admin','physician','researcher'])`; CORS via `_shared/cors.ts`; rate-limit via `_shared/rateLimiter.ts`.
- Spec schema (Zod): `{ measure, dimensions[], filters[], tenantScope }`. Reject any field not in the catalog.
- Catalog module: server-side map of allowed dimension/measure → safe SQL fragments. Single source of truth.
- Compiler: spec → ONE parameterized aggregate query (`GROUP BY` dimensions, whitelisted measure expr). Parameterized values only — no interpolation.
- Suppression: post-query, collapse any cell `n < k` (k from `tenant_module_config`, default 11). Researcher tier overrides k upward + coarsens age/date.
- Audit: write spec + pre/post row counts to `audit_logs` (or a dedicated `analytics_query_log`).
- `src/services/equityAnalyticsService.ts` (ServiceResult pattern) — typed client wrapper.

**Acceptance (live proof required):**
- `deno check` clean; scoped tsc 0; lint 0/0; behavioral tests (deletion-test passing).
- Live curl as admin with a real spec → returns aggregate JSON, cells `<11` masked, **proven no raw row can be requested** (attempt a raw-style spec → rejected).
- Unauth → 401; wrong role → 403; cross-tenant scope → empty/denied.
- Akima's clinical measure list captured (or a placeholder list confirmed). Don't invent algorithms.

## Session 2 — Plain-language layer

**Build:**
- NL → spec translator via `claude-chat` with **forced tool_use / structured output** (Rule #16). Tool schema = the validated spec. Claude picks from the catalog ONLY; out-of-catalog asks → return a clarifying question, never guess.
- Guardrail: the returned spec is re-validated against the Zod catalog server-side before it touches the engine (defense in depth — never trust model output, per python.md §3 / ai-services.md).

**Acceptance:**
- "% of members 65+ with controlled BP by race" → correct spec → engine result.
- Ambiguous/out-of-scope question → clarifying prompt, not a hallucinated answer or an error.
- Spec round-trip logged for transparency (`ai_transparency_log`).

## Session 3 — UI + researcher tier + hardening

**Build:**
- `EquityInsightsDashboard` (EA design system) at route `/admin/equity-insights` (lazy-loaded, nav link wired — Commandment #21: reachable from real UI).
- Plain-language box + dimension/measure picker (both feed the same spec). Chart render (bar / stacked / heatmap for intersections) via a charting lib.
- Researcher tier: higher k, 3-digit-zip suppression, coarse buckets, no tenant detail.
- RLS/role hardening + codebase-wide auth sweep.

**Acceptance:**
- End-to-end live: question → chart, small cells masked in the rendered chart.
- **Maria visual acceptance** of the dashboard (visual-acceptance.md).
- Researcher login proves stricter suppression vs physician on the same query.

---

## Open product/clinical decisions (surface, don't assume)
- **Clinical measure priority list — Akima.** Which equity measures matter first.
- **Charting library** — engineering call (lightweight, accessible, WCAG-AA per accessibility.md); will recommend at Session 3.
- **Audit destination** — reuse `audit_logs` vs dedicated `analytics_query_log` (lean dedicated; confirm at Session 1).

## Decisions locked (2026-06-09)
- Interactive **query builder + plain-language** input (both compile to the same spec).
- **Researcher = stricter de-identified tier.**
- **All four dimension families** in scope.
- **k = 11** default suppression; **3-digit ZCTA** geography.
