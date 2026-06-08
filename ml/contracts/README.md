# `ml/contracts/` — Pydantic I/O Models (Phase 1)

Typed input/output shapes for every boundary (`.claude/rules/python.md` §2).
The Python ban on loose dicts. **No PHI fields** — `patient_id` tokens + de-identified
bands only (§4). First candidate: `RiskInput` / `RiskResult` for readmission risk
(the existing `ai-readmission-predictor` is the Claude baseline to beat).

Empty until Phase 1 starts.
