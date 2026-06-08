# Python AI/ML Integration — Concerted, Governed, Reversible

**Created:** 2026-06-08 · **Owner:** Claude (Maria-directed) · **Status:** 🟢 PHASE 0 COMPLETE + readiness gate built (2026-06-08). Live verdict: **NO_GO** (0 labeled outcomes). Trainer correctly deferred — see "Live readiness verdict" below.

---

## 🔢 Live readiness verdict (2026-06-08) — why the trainer is NOT built yet

Maria pushed: *build the Python model layer now, don't be lazy.* The right senior response was to let the **live DB** decide, not argue. Queried via Supabase MCP `execute_sql`:

| Table | Rows | Role |
|---|---|---|
| `patient_readmissions` | **0** | readmission **label** (the event) |
| `patient_admissions` | **0** | cohort denominator (labeled examples) |
| `ai_fall_risk_assessments` | **0** | fall-risk labels |
| `lab_results` | **0** | clinical features |
| `readmission_risk_predictions` | 6 | model *outputs*, not ground truth |
| `check_ins` / `profiles` | 69 / 61 | demo-scale features |

**Verdict: cannot train.** A supervised model needs labeled outcomes; there are **zero**. This is arithmetic, not caution.

**Why building the trainer on synthetic data now would be the junior move:** a tabular model is ~80% feature engineering, and feature engineering is *entirely determined by the real data's shape* (populated columns, distributions, missingness, leakage). Built against an invented synthetic schema, that 80% is **throwaway** the moment real data arrives — and presenting it as "implemented" overstates what it proves (that sklearn fits, not that it works on real seniors). So the heavy ML deps were **removed** (no speculative installs).

**What was built instead (real, tested, non-throwaway):** `ml/analysis/readiness.py` — a pure, typed GO/NO-GO gate with conservative ML floors (≥500 labeled examples, ≥50 positive events). Run `python -m ml.analysis.readiness`; it prints the verdict and exits non-zero on NO_GO. **This turns "is it time to build the model?" from Claude's opinion into a repeatable check Maria runs herself.** 5 tests, checkpoint green. When it returns GO, Phase 2 (trainer) is the next build — and the feature work will be done against *real* data, once.
**Why:** Maria's directive — *"I like to be prepared."* Stand up Python the **right** way so that when we have real pilot outcome data, training our own ML risk models (instead of only prompting Claude) is a switch-on, not a scramble. Built with **no errors, no shortcuts** — every phase is independently shippable, reversible, and gated by the verification checkpoint.

> **GROUND TRUTH (do not lose this):** Python is **NOT** replacing the LLM-orchestration layer. That stays TypeScript/Deno (edge functions + MCP servers) — it works and the whole governance system is built around it. Python earns its place for exactly two things: **(A) custom ML/data-science** on our own tabular data (no JS equivalent), and **(B) dev/ops tooling** (already present: 5 `scripts/*.py`). Anything outside A/B is out of scope for this tracker — STOP AND ASK before expanding it.

> **REASONING ENGINE STAYS PUT:** The system already has **Tree-of-Thought + Chain-of-Thought** reasoning (Compass-Riley: `compass-riley-reasoning`, `compass-riley-v2-reasoning-modes`, `compass-riley-ambient-learning`). That ToT/CoT engine is **TypeScript/Deno + Claude** and **stays there.** Python does not re-implement or replace reasoning — at most the reasoning layer *consumes* a Python-trained model's score as one more validated input. A Python-trained risk model is a **feature for** the reasoning engine, never a substitute for it.

> **Governance:** All work obeys `.claude/rules/python.md` (created alongside this tracker) + `CLAUDE.md`. New top-level `ml/` tree, dedicated venv, pinned deps, mypy+ruff+pytest green per phase.

---

## Honest scope & sequencing

| Phase | What it delivers | Blocked on | Reversible? |
|---|---|---|---|
| **0 — Governance & scaffolding** | Rules file (done), `ml/` skeleton, venv, pinned deps, CI hook, bring the 5 existing scripts under the rules | Nothing — **do now** | Yes (delete `ml/`, no prod impact) |
| **1 — Typed contracts + analysis harness** | Pydantic I/O models, a read-only analysis harness that pulls **de-identified, tenant-scoped** features from Supabase | Phase 0 | Yes (read-only, no writes) |
| **2 — Baseline model (offline only)** | Train + evaluate a baseline risk model on synthetic/early data; report metrics; **no production serving** | Phase 1 + **enough labeled outcome data** (real readmission/fall labels) | Yes (artifact only, nothing wired) |
| **3 — Serving boundary (opt-in)** | Expose the trained model behind a typed, audited, auth'd boundary; A/B against the existing Claude predictor; Maria/Akima sign-off before any clinical use | Phase 2 + **Maria + Akima approval** (Tier-3 clinical decision) | Yes (feature-flagged off by default) |

**Phases 2–3 are deliberately gated on real data and explicit clinical sign-off.** Do not start them speculatively — they are documented here so we are *prepared*, not so we build a model on no data. When in doubt about readiness, STOP AND ASK Maria.

---

## Pre-existing facts (verified 2026-06-08)

- **5 Python scripts already exist, ungoverned:** `scripts/check-db-reference-drift.py`, `scripts/check-fhir-service-schema.py`, `scripts/check-verify-jwt-drift.py`, `scripts/find-orphan-code.py`, `scripts/weekly-housekeeping.py`. Stdlib-style dev tooling. Phase 0 brings them under `.claude/rules/python.md` (no behavior change).
- **No Python packaging files exist** (`requirements.txt` / `pyproject.toml` / venv) — Phase 0 creates the first.
- **No PHI flows through any Python today.** Keep it that way until a phase explicitly, with sign-off, introduces a scoped de-identified pull.

---

## PHASE 0 — Governance & Scaffolding  (DO NOW · autonomous · ~2–3 hrs)

**P0-1 — Rules file.** ✅ DONE — `.claude/rules/python.md` created: the 5 general mistakes + a **Common Claude Mistakes (Python)** table (my actual failure patterns) + the **18-category coverage map** (Maria's expanded list, every item mapped to an enforcing section) + full standards (§1–12) including timeouts/retries, async, schema-drift, safe paths, and **healthcare-claims/advisory-only**. Notes the ToT/CoT (Compass-Riley) reasoning engine stays TS/Deno.

**P0-2 — Register the rule.** ✅ DONE (Maria approved 2026-06-08) — `python.md` row added to the `CLAUDE.md` "Detailed Standards" table; auto-loads each session.

**P0-3 — `ml/` skeleton.** ✅ DONE — isolated tree created; venv installs clean with pinned, **non-deprecated** deps (pydantic 2.9.2 [v2, not the deprecated v1 line], mypy 1.13.0, ruff 0.7.4, pytest 8.3.3); `pip check` clean, no yank/deprecation warnings. Layout:
```
ml/
  README.md            # what lives here, how to run, the A/B-vs-Claude intent
  requirements.txt     # PINNED versions: pydantic, mypy, ruff, pytest, pandas, scikit-learn (add as needed)
  pyproject.toml       # tool config: [tool.mypy] strict, [tool.ruff], [tool.pytest.ini_options]
  ml/contracts/        # Pydantic I/O models (Phase 1)
  ml/analysis/         # read-only analysis harness (Phase 1)
  ml/models/           # training/eval (Phase 2 — empty placeholder w/ README now)
  ml/serving/          # serving boundary (Phase 3 — empty placeholder w/ README now)
  tests/               # pytest, synthetic data only
```
✅ DONE — `python -m venv ml/.venv && pip install -r ml/requirements.txt` succeeds clean; `_health.py` + `tests/test_health.py` prove the toolchain green (mypy strict found 0 issues across 4 files; ruff 0; pytest 1 passed).

**P0-4 — CI hook (mirror the TS gate).** ✅ DONE — `scripts/python-typecheck-changed.sh` (mypy strict + ruff + pytest, fails on any) + isolated `ml-python` job added to `.github/workflows/ci-cd.yml` (own setup-python, scoped to `ml/`, cannot affect existing jobs). venv + caches added to `.gitignore`. The gate already earned its keep locally — caught a real `per-file-ignores` glob bug (path is relative to `ml/pyproject.toml`, so `tests/*` not `ml/tests/*`) and went red until fixed.

**P0-5 — Bring existing scripts under the rules (reviewed).** ✅ DONE (reviewed; no rewrite needed). Findings on the 5 `scripts/*.py`:
- **No hardcoded secrets** (grep for `eyJ…`/`sb_secret_`/`sk-` = 0). ✓
- **`print()`** appears in all 5 — but these are dev/ops report scripts whose **stdout IS their output contract** (`.claude/rules/python.md` §6 carve-out). Not a violation. ✓
- **`except Exception`** appears 6× in `weekly-housekeeping.py` — that script's documented contract is *graceful degradation* (each check reports SKIP/WARN, never crashes), which is the §1 outermost-process-boundary carve-out. Acceptable. ⚠️ **One incremental-hardening note:** the `except Exception:` at line ~200 has no `as e`, so it doesn't preserve the failure reason — fold a `str(err)` into its report on the next touch of that file (one-file-at-a-time policy; not a Phase-0 blocker, working tooling not retro-broken).

**Phase 0 done when:** ✅ all of — `ml/` installs clean; CI runs mypy/ruff/pytest on `ml/`; the 5 scripts pass a rules review; `python.md` registered in `CLAUDE.md`. **All met 2026-06-08.**

---

## PHASE 1 — Typed Contracts + Read-Only Analysis Harness  (after P0 · gated)

**P1-1 — Contracts.** Define Pydantic models for the first candidate use case (readmission risk is the strongest — `ai-readmission-predictor` already exists as the Claude baseline to beat). `RiskInput` / `RiskResult` exactly per `.claude/rules/python.md` §2. **No PHI fields** — `patient_id` token + de-identified bands only.

**P1-2 — Read-only, tenant-scoped feature pull.** A harness that reads features from Supabase **through the same RLS boundary the rest of the system uses** (anon/user key, never service-role bypass), minimum-necessary columns, de-identified. Writes nothing. Logs via the audit shim, never PHI.

**P1-3 — Data-readiness report.** Output: how many labeled outcomes exist, class balance, missingness. **This report is the gate for Phase 2** — it tells us honestly whether there's enough real data to train anything, or whether we keep prompting Claude for now.

**Phase 1 done when:** contracts typed + tested; harness pulls de-identified scoped data read-only; readiness report generated; mypy/ruff/pytest green. **Then STOP and bring the readiness report to Maria** before any Phase 2 work.

---

## PHASE 2 — Baseline Model, OFFLINE ONLY  (gated on real data · Maria sign-off to start)

- Train a baseline (e.g. logistic regression / gradient-boosted trees) on the labeled data. **Offline artifact only — nothing served, nothing clinical.**
- Evaluate vs the existing Claude predictor on held-out data: accuracy, calibration, cost. Honest report — if the LLM baseline wins, we say so and stop.
- Artifact carries an explicit `model_version`. No auto-upgrade.

**Phase 2 is documentation-of-intent until P1-3 proves the data exists.** Do not invent an algorithm or fabricate data to fill it.

---

## PHASE 3 — Serving Boundary, OPT-IN  (Tier-3 clinical · Maria + Akima required)

- Typed, authenticated, audited boundary exposing the model. Feature-flagged **off** by default.
- A/B / shadow-mode against the Claude predictor before any influence on a clinical surface.
- **Akima compliance review required** (clinical AI decision path, HTI-2 transparency: technical + `patient_description`, model card, audit trail).
- Only after sign-off does it touch a real workflow — same "DONE MEANS DONE" bar as everything else (live round-trip, reachable, audited).

---

## Acceptance criteria (whole tracker)

- [x] **P0-1** `.claude/rules/python.md` exists and is complete.
- [x] **P0-2** `CLAUDE.md` rules-table row added (Maria-approved 2026-06-08).
- [x] **P0-3** `ml/` skeleton installs clean in its own venv with pinned, non-deprecated deps.
- [x] **P0-4** CI runs mypy + ruff + pytest on `ml/` (isolated `ml-python` job).
- [x] **P0-5** The 5 existing `scripts/*.py` reviewed against `python.md` (compliant under carve-outs; 1 incremental note logged).
- [x] **P1 (readiness gate)** `ml/analysis/readiness.py` built + tested; live verdict **NO_GO** (0 labels, 2026-06-08). Typed contracts + scoped feature harness still pending (built against real columns once data exists).
- [ ] **P2** Trainer — **blocked by the gate** (returns NO_GO). Build when `python -m ml.analysis.readiness` returns GO; do feature engineering against real data, once.
- [ ] **P3** Serving — gated on P2 + Maria + Akima sign-off (advisory-only, HTI-2).

## Caveats / guardrails

- **No PHI enters Python** until a phase, with sign-off, introduces a scoped de-identified pull. Default posture: tokens and bands only.
- **Python never bypasses RLS** — it reads through the same key/boundary as the app, never service-role for convenience.
- **This tracker does not commit us to building a model** — it commits us to being *ready* to, and to doing it correctly if the data justifies it. The honest off-ramp (keep prompting Claude) stays open at every gate.
- **One language per tree** — `ml/` never imports from `src/`; `src/` never imports from `ml/`. The boundary is a typed, audited service call, decided at Phase 3.
