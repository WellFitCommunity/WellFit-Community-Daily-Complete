# Dashboard Drift Repair + Option-B Builds — Tracker

> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

**Created:** 2026-07-08
**Owner:** Claude (exec) / Maria (product) / Akima (clinical sign-off where flagged)
**Origin:** Runtime console errors on `wellfitcommunity.live` (production), triaged live-DB via Supabase MCP.
**Decision (Maria, 2026-07-08):** the divergence items get **Option B** (build the real data), not the UI-trim. Do the work; this tracker is the spec.

Project ref: `xkybsjnvuohpqpbkikyn`. Default tenant `WF-0001` (`2b902657-6a20-4435-a78a-576f397517ca`). Super-admin `ba4f20ad-2707-467b-a87f-d46fe9255d2f`.

---

## Already DONE (this session, on `main`) — context, not work

| Item | Fix | Commit | Proof |
|---|---|---|---|
| guardian_alerts 400 | select `status`/`resolved_at`, derive `resolved` | `4d8666ba` | live query returns rows |
| system_health_checks 400 | drop phantom `component_name/message/metrics` | `4d8666ba` | live query resolves |
| care_team_alerts 403 | `GRANT SELECT,INSERT,UPDATE … authenticated` + PostgREST reload | `3a03e129` | `has_table_privilege` = true |
| voice_profiles 406 | `.single()` → `.maybeSingle()` | `3a03e129` | super-admin has 0 rows (live) |
| priority-board readmission 400 | `readmission_risk_30_day` → live `readmission_risk_score` | `a00b9ebd` | live query returns row (0.25–0.68) |
| RLS≠GRANT rule | `.claude/rules/supabase.md` §2a | `3a03e129` | — |
| brittle-mock fix + helper | `src/test-utils/supabaseMock.ts` | `ec264919` | 20/20 tests |
| telehealth branch → main + migration resync | merge + cherry-pick | `850df0a3`,`65d9bc5f` | migrations present on main |

**Estimate for the work below:** ~16–24h across **3 sessions** (A ~1 session incl. Akima gate, B ~0.5, C ~1, D ~0.25).

---

## Chapter A — Readmission richer fields (Option B) — CLINICAL, Akima gate

**Problem:** `ReadmissionRiskPanel.tsx` + `PatientRiskStrip.tsx` render 5 fields the live `readmission_risk_predictions` table does not have → 400. Live columns confirmed ABSENT (2026-07-08): `plain_language_explanation`, `readmission_risk_7_day`, `readmission_risk_90_day`, `prediction_confidence`, `data_sources_analyzed`.

**Consumers (verify before/after):**
- `src/components/ai/ReadmissionRiskPanel.tsx` — L57 select; L73-84 map; L210 `predictionConfidence`; L224 `readmissionRisk7Day`; L232 `readmissionRisk90Day`; L344-347 `dataSourcesAnalyzed`.
- `src/components/patient/PatientRiskStrip.tsx` — L120 select `plain_language_explanation`; L149 map; tested at `__tests__/PatientRiskStrip.test.tsx:143` (behavioral — plain-language render).
- Predictor: `supabase/functions/ai-readmission-predictor/` (exists).

### A1 — Migration: add the 5 columns (nullable) + GRANT already covered
- [ ] **Live-verify first** (CLAUDE.md #18): re-confirm the 5 columns are absent via `information_schema.columns`.
- [ ] Migration `supabase/migrations/<ts>_readmission_richer_fields.sql`:
  - `ALTER TABLE public.readmission_risk_predictions ADD COLUMN IF NOT EXISTS readmission_risk_7_day numeric(4,3), ADD COLUMN IF NOT EXISTS readmission_risk_90_day numeric(4,3), ADD COLUMN IF NOT EXISTS prediction_confidence numeric(4,3), ADD COLUMN IF NOT EXISTS plain_language_explanation text, ADD COLUMN IF NOT EXISTS data_sources_analyzed jsonb DEFAULT '{}'::jsonb;`
  - **NO `migrate:down` block** (footgun — see `reference_migrate_down_db_push_footgun`).
  - `authenticated` already has table privileges (RLS unchanged); confirm `has_table_privilege` post-push.
- [ ] Range convention: scores are **0–1** (matches live `readmission_risk_score` 0.25–0.68 and the UI's `×100`).
- [ ] Apply. `db push` if main's migration folder is in sync; else apply SQL out-of-band + keep file (idempotent). Verify columns live.

### A2 — Predictor generates + persists the fields — 🔒 AKIMA (patient-facing clinical text)
- [ ] Update `ai-readmission-predictor` to produce, via **structured JSON output schema** (`.claude/rules/ai-services.md`), `readmission_risk_7_day`, `readmission_risk_90_day`, `prediction_confidence` (0–1), `plain_language_explanation` (6th-grade reading level), `data_sources_analyzed` (jsonb: `{readmissionHistory,sdohIndicators,…}` — match `ReadmissionRiskPanel` L344-347 keys).
- [ ] Model pinned (exact ID, never `latest`).
- [ ] **AKIMA SIGN-OFF** required before merge: `plain_language_explanation` is patient-facing clinical content; must not overstate/diagnose (advisory framing per `python.md` §10 / clinical rules).
- [ ] Persist into the new columns on prediction write.

### A3 — Restore UI selects
- [ ] `ReadmissionRiskPanel.tsx` L57: re-add the 5 columns; also fix `readmission_risk_30_day`→`readmission_risk_score`, `risk_factors`→`primary_risk_factors` (verify each vs live).
- [ ] `PatientRiskStrip.tsx` L120: re-add `plain_language_explanation`; keep its test (`:143`) green (now backed by real data).
- [ ] Migrate both tests to `createQueryBuilder` (from `src/test-utils`) — no hand-built chains.

**Acceptance (DONE MEANS DONE):** predictor run writes a row populating all 5 columns (show the row); `ReadmissionRiskPanel` renders 7d/90d/confidence/explanation with no 400 (screenshot); Akima approved the plain-language copy; scoped tsc/lint/tests green.

---

## Chapter B — Personalization aggregation (Option B)

**Problem:** `DashboardPersonalizationIndicator.tsx` (L34-66) queries `dashboard_personalization_events` for `feature_clicked`, `click_count`, `workflow_pattern_detected` — none exist. Live table is a **raw event log**: `id, user_id, section_name, action_type, time_of_day, day_of_week, section_position, session_id, created_at, tenant_id`. **⚠️ Table has 0 rows live (2026-07-08)** — nothing writes it yet, so even a correct query returns empty.

### B0 — Confirm the writer (don't build a view over a dead table)
- [ ] Grep for inserts to `dashboard_personalization_events` (`grep -rn "dashboard_personalization_events" src supabase/functions`). Determine if any code path records events. If NONE → the feature is inert; **STOP AND ASK Maria** whether to (i) wire event capture, or (ii) shelve the indicator. Do not build a view over a table nothing populates and call it done.

### B1 — Aggregating view (once B0 resolves to "events are/ will be written")
- [ ] `v_dashboard_personalization_summary` `WITH (security_invoker = on)`: `SELECT user_id, tenant_id, section_name AS feature, count(*) AS click_count, max(created_at) AS last_used FROM dashboard_personalization_events GROUP BY user_id, tenant_id, section_name;`
- [ ] `GRANT SELECT … authenticated` (RLS≠GRANT, §2a). Underlying table RLS enforces user/tenant.
- [ ] `workflow_pattern_detected`: **no backing column** — decide with Maria: derive from a specific `action_type`, or drop the metric. Document the choice.

### B2 — Rewire the indicator
- [ ] Point `DashboardPersonalizationIndicator` at the view; total interactions = count of events for user; last update = `max(last_used)`; most-used = top-N `feature` by `click_count`.
- [ ] Test via `createSupabaseMock`.

**Acceptance:** indicator loads with **no 400**; with seeded events, shows aggregated top features + totals; workflow-pattern decision documented.

---

## Chapter C — Parked edge-function failures (from prod logs 2026-07-08)

Each: read source + `get_logs`/`get_edge_function`, fix, redeploy (`/deploy-edge`), verify live (200), confirm auth intact (JWT+role+tenant per `adversarial-audit-lessons.md`).

- [x] **C1 `claude-personalization` 500** — ✅ ROOT CAUSE FOUND + FIXED. Invalid Haiku model ID: code used `claude-haiku-4-5-20250929` (that's **Sonnet 4.5's** date), plus `-20250514` and `-20250919` — none are real Haiku snapshots. Anthropic returns **404 → function throws → 500**. **Live-proven** against api.anthropic.com: `-20250929`/`-20250514`/`-20250919` → HTTP 404 `not_found_error`; `-20251001` → HTTP 200. Systemic: 90 code refs across 39 files + **23 `ai_skills` rows**. **Fix:** swept all → `claude-haiku-4-5-20251001` (the only valid Haiku 4.5 ID; honors the no-`latest` rule) in code + `UPDATE ai_skills` (24 skills now valid). Sonnet IDs (`claude-sonnet-4-5-20250929`) are valid — left alone. ⚠️ **Deploy needed**: frontend rebuild + `claude-personalization` (and other Haiku-using) edge-function redeploy for prod to pick it up; DB fix is already live.
- [ ] **C2 `send-consecutive-missed-alerts` 500** (v46). Community engagement — user-impacting.
- [ ] **C3 `send-checkin-reminders` 500** (v117). Seniors not getting reminders — user-impacting; likely highest real-user impact.
- [ ] **C4 `realtime_medical_transcription` 502** (repeated). Telehealth Compass-Riley scribe path — WebSocket/edge boundary; 502 ≠ app-layer, check the function is deployed/healthy.

**Acceptance:** each returns 200 on a real authorized call; failure cause named in the commit; no auth regressions.

---

## Chapter D — Migration-history hygiene

- [ ] Run `supabase migration list` (or inspect `schema_migrations`) — the live registry had earlier suggested `supabase migration repair --status reverted 20260707120000 20260707130000 20260708120000`. Confirm ordering/state is consistent now that main carries those files. Repair only if genuinely out-of-order; **do not** blindly run repair.

---

## Guardrails (every chapter)
- Live-verify DB state before writing any migration/query (CLAUDE.md #18) — the drift tracker's table guesses have been wrong 5×.
- No `migrate:down` blocks (footgun). GRANT explicitly (§2a). Views `security_invoker=on`.
- Tests use `createQueryBuilder`/`createSupabaseMock` — no hand-built `.single()` chains. Mock = regression guard; **prove each fix with a live round-trip**.
- Fixes land on `main` (Maria's preference); Claude does the push.
