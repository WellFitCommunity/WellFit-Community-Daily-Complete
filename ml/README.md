# `ml/` — Python AI/ML Tree (Isolated)

> Governed by [`.claude/rules/python.md`](../.claude/rules/python.md). One language per tree:
> `ml/` is Python only. It never imports from `src/` (TypeScript) or `supabase/functions/` (Deno),
> and they never import from it. Any future hand-off is a typed, audited service call (Phase 3).

## Why this exists

Python here is **not** the LLM-orchestration layer — that stays TypeScript/Deno. `ml/` exists for
**custom ML / data science on our own tabular data** (risk predictors, analytics) where there is no
JS equivalent. The intent is to eventually train our own readmission/fall-risk models and A/B them
against the existing Claude-based predictors — **only when real pilot outcome data justifies it.**

See the tracker: [`docs/trackers/python-ai-integration-tracker.md`](../docs/trackers/python-ai-integration-tracker.md).

## Layout

```
ml/
  README.md            # this file
  requirements.txt     # PINNED deps (governance toolchain; ML deps added at Phase 2)
  pyproject.toml       # mypy (strict) + ruff + pytest config
  __init__.py          # top-level package
  _health.py           # scaffolding sanity module (proves the toolchain is green)
  contracts/           # Pydantic I/O models            (Phase 1)
  analysis/            # read-only, scoped analysis harness (Phase 1)
  models/              # training + evaluation           (Phase 2 — gated on real data)
  serving/             # serving boundary                (Phase 3 — Maria + Akima sign-off)
  tests/               # pytest, SYNTHETIC data only
```

## Setup

```bash
python3 -m venv ml/.venv
ml/.venv/bin/pip install -r ml/requirements.txt
```

## Verification checkpoint (run before any commit — mirrors the TS hard gate)

```bash
ml/.venv/bin/mypy ml          # 0 errors
ml/.venv/bin/ruff check ml    # 0 errors
ml/.venv/bin/pytest ml/tests  # all pass, 0 skipped
```

## Non-negotiables (from `.claude/rules/python.md`)

- No PHI in Python until a phase, with sign-off, introduces a scoped de-identified pull. Tokens + bands only.
- Never bypass RLS — read through the same key/boundary as the app, never service-role for convenience.
- Typed I/O on every boundary; validate model output before use; secrets from env only; `audit_logger`, never `print`.
