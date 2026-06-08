# Python Standards — AI / ML / Tooling

> **Scope.** Python in this codebase is **NOT** the LLM-orchestration layer — that is and stays TypeScript/Deno (edge functions + MCP servers). Python is allowed for exactly two purposes:
> 1. **Custom ML / data science** — training, evaluating, and serving models on our own tabular data (risk predictors, analytics) where there is no JS equivalent.
> 2. **Developer/ops tooling** — repo health scripts, drift checks, housekeeping (see `scripts/*.py`).
>
> Every rule in `CLAUDE.md` and the other `.claude/rules/` files applies to Python **in full** — no `any`-equivalent looseness, no `print()` debugging left in, no secrets in source, HIPAA/PHI rules, STOP AND ASK, 600-line file limit, verification checkpoint. This file adds the Python-specific specifics.
>
> **Reasoning engine stays where it is.** This system already has **Tree-of-Thought and Chain-of-Thought** reasoning (the Compass-Riley reasoning modes — `compass-riley-reasoning` / `compass-riley-v2-reasoning-modes` / `compass-riley-ambient-learning`). That ToT/CoT engine lives in the **TypeScript/Deno + Claude** layer and **stays there.** Python does **not** re-implement, replace, or override reasoning — it provides trained models/analytics that the reasoning layer may *consume*. Any ToT/CoT output that reaches Python is **untrusted until schema-validated** (§3), exactly like raw model output.

---

## The 5 AI Mistakes — Reject on Sight

| AI Mistake | Why It Is Dangerous | Correct Way | Instruction to AI |
|---|---|---|---|
| Using broad `except Exception` and hiding the real error | Masks failures, makes debugging impossible | Catch specific exceptions and return/log structured error details | Do not suppress errors. Catch only expected exceptions and preserve the failure reason. |
| Trusting raw AI output as valid JSON | AI may return malformed or unsafe output | Validate model output against a schema before using it | Treat AI output as untrusted until validated. |
| Hardcoding secrets / API keys | Exposes credentials, creates security risk | Use environment variables, never commit secrets | Never place keys, tokens, passwords, or secrets directly in Python files. |
| Letting Python agents access too much data | Privacy and compliance risk | Pass only the minimum approved fields needed for the task | Agents must receive scoped data, not entire database records. |
| Returning loose dictionaries everywhere | Schema drift and runtime surprises | Use typed models such as Pydantic or dataclasses | Define clear input/output shapes for every agent tool. |

---

## Common Claude Mistakes (Python) — My Actual Failure Patterns

The 5 above are general. These are the ones **Claude specifically** keeps making — same root causes documented in `CLAUDE.md`'s "Common AI Mistakes" table and `MEMORY.md` (skim-vs-ingest, training-data defaults), now in Python form. Reject on sight.

| Claude Mistake | Prevention | Why Claude Does This |
|---|---|---|
| `except Exception:` to make an error go away | Catch the specific type; preserve `str(err)`; fail loud | Training data is saturated with broad excepts — it's the path of least resistance |
| Mutable default argument: `def f(x=[])` / `={}` | Use `None` sentinel: `def f(x=None): x = x or []` | Classic Python footgun AI reproduces from memory without thinking about shared state |
| Building SQL with f-strings / `%`/`.format()` | Parameterized queries only (`%s` params, never interpolation) | "It reads cleaner" — same instinct as the SELECT * and the JWT-decode shortcuts |
| `dict` in / `dict` out instead of a typed model | Pydantic/`@dataclass` on every boundary (§2) | Dicts feel fast; types feel like ceremony. The Python `any`. |
| Reaching for `pandas`/`numpy` when stdlib does it | Use the smallest tool; justify every dependency | AI loves showing off abstractions — "surgeon, not butcher" |
| Pydantic v1 API (`parse_obj`, `.dict()`) on a v2 project | Pin the version, read it, use v2 (`model_validate`, `model_dump`) | Same as the React-19/forwardRef drift — training mixes incompatible versions |
| `os.environ["X"]` / `.get("X")` then using `None` | Read the env, check it exists, fail with a clear message | Assumes the var is set; doesn't handle the missing-secret path |
| Assuming a library's function signature without reading it | Read the actual def/stub before calling it | **Skim-vs-ingest** — the #1 documented Claude failure. Sees intended API, not real API |
| `print()` / `logging.debug` debugging left in | `audit_logger` structured events (§6) | Quick output during generation, never cleaned up |
| `float` for money or clinical thresholds | `Decimal` for money; explicit rounding for clinical values | Float "just works" in the demo, drifts in production |
| `json.loads(llm_output)` then indexing into it | Validate into a schema first; fail closed (§3) | Treats model output as trusted structured data — it is neither |
| Catch then bare `raise Exception("failed")` | Re-raise preserving the original, or return structured error | Loses the traceback — the reason vanishes, debugging dies |
| Writing the test to match the code it just wrote | Deletion Test: would it fail if the logic were removed? | Confirmation bias — writes code + test together, shapes test to pass |
| `pip install` into the system interpreter | venv always; pinned `requirements.txt` | Doesn't track which environment it's in — same as Deno-vs-Node import drift |
| Iterating on a failing mypy/test 3+ times | STOP AND ASK after 2 attempts | Sees intended code, not actual; needs the blind-spot broken by a human |

---

## The 18 Mistake Categories — Coverage Map

Every category below must be prevented. The "Covered in" column points to the enforcing section so nothing is missed.

| # | Mistake category | Rule / fix | Covered in |
|---|---|---|---|
| 1 | Missing type boundaries | Typed I/O (Pydantic/dataclass) on every boundary; mypy strict | §2 |
| 2 | Silent `None`/null failures | No silent `None` returns — fail closed with a structured reason; check env/lookups explicitly | §1, §3, §5 |
| 3 | Mutable default arguments | `None` sentinel, never `=[]`/`={}` | Claude-mistakes table, §7 |
| 4 | Overbroad exception handling | Catch the specific type; preserve `str(err)`; bare `except` only at process boundary, logged + loud | §1 |
| 5 | Unvalidated JSON from AI models | Validate into a schema before use; fail closed | §3 |
| 6 | Unsafe file/path handling | `pathlib`, resolve + confine to an allowed base; no untrusted path joins; no PHI to uncontrolled disk | §7 |
| 7 | Hardcoded secrets | Env only, never literal in source | §5 |
| 8 | Poor dependency pinning | Pinned `requirements.txt`, venv, justify each dep | §11 |
| 9 | No structured logging / audit trail | `audit_logger` structured events, never `print`; never log PHI | §6 |
| 10 | No timeout / retry limits | Explicit timeout + bounded retry with backoff on every network/model/DB call | §8 |
| 11 | Uncontrolled agent tool access | Allow-list tools; scope each tool's data + permissions; no open-ended exec | §4, §8 |
| 12 | Mixing business logic with script logic | Importable, testable functions; thin `main()`/`if __name__` entry; one language per tree | §11, §7 |
| 13 | No tests for edge cases | pytest with null/empty/boundary/timeout cases; Deletion Test; synthetic data only | §11, §12 |
| 14 | Bad async handling | `await` everything; never block the loop; bounded concurrency; cancel on timeout | §8 |
| 15 | DataFrame / schema drift | Validate columns/dtypes against an explicit schema on ingest; fail on drift | §9 |
| 16 | Environment variable confusion | Read via a single config module; `SB_*` not `SUPABASE_*`; never a secret in a client-visible var | §5 |
| 17 | Prompt output trusted without validation | Same as #5 — untrusted until schema-validated; constrain enums; fail closed | §3 |
| 18 | Healthcare claims / clinical overstatement | Models are **advisory only**; no diagnostic/treatment claims; HTI-2 transparency + model card + confidence + human-in-the-loop | §10 |

---

## 1. Error Handling — Specific, Structured, Logged

**Never `except Exception:` to make an error go away.** Catch the exception you expect, preserve the reason, return a structured result. This mirrors the TypeScript `ServiceResult` / `failure()` pattern.

```python
try:
    result = process_data(data)
except ValueError as err:
    audit_logger.warning(
        "patient_summary_validation_failed",
        extra={"error": str(err)},
    )
    return {
        "success": False,
        "error_type": "validation_error",
        "message": "Input data failed validation.",
    }
```

| Do This | Not This |
|---|---|
| `except ValueError as err:` (the specific type) | `except Exception:` / bare `except:` |
| Preserve `str(err)` in the structured log | Swallow the error silently |
| Return `{"success": False, "error_type": ..., "message": ...}` | `raise` past the boundary, or return `None` with no reason |
| Log via the audit logger (see §6) | `print(err)` / leave a `# TODO handle this` |

**A bare `except Exception` is only acceptable at the outermost process boundary** (e.g. a script's `main()` that must exit non-zero and report), and even there the caught error must be logged with its full reason and the process must fail loudly — never continue as if nothing happened.

---

## 2. Typed I/O — Pydantic or dataclasses, Never Loose Dicts

**Every function that crosses a boundary (tool input, tool output, model input, model output, API request/response) must have an explicit typed shape.** Loose `dict` in/out is the Python equivalent of the banned `any`.

```python
from pydantic import BaseModel, Field

class RiskInput(BaseModel):
    patient_id: str                      # token only — NEVER a name/DOB/SSN (see §4)
    age_band: str                        # scoped, de-identified band, not raw DOB
    systolic_bp: int = Field(ge=0, le=300)
    prior_admissions_12mo: int = Field(ge=0)

class RiskResult(BaseModel):
    patient_id: str
    risk_level: str                      # constrained — see §3
    score: float = Field(ge=0.0, le=1.0)
    model_version: str                   # pinned, reproducible (see §5)

def score_readmission(payload: RiskInput) -> RiskResult:
    ...
```

| Do This | Not This |
|---|---|
| `def f(payload: RiskInput) -> RiskResult:` | `def f(data: dict) -> dict:` |
| `BaseModel` / `@dataclass` for every shape | passing raw dicts around |
| Constrain values with `Field(...)` / enums | trusting any int/str/float |
| Type every function signature | untyped params, untyped return |

**Type checking is a hard gate.** Run `mypy` (or `pyright`) on changed Python files before the work is done — the Python equivalent of `scripts/typecheck-changed.sh`. Zero new type errors.

---

## 3. Validate AI / Model Output Before Use — Untrusted Until Proven

**Anything coming back from an LLM or a model is untrusted input.** Parse it into a typed schema and reject on mismatch. Never `json.loads(...)` an LLM string and index into it.

```python
import json
from pydantic import ValidationError

def parse_model_output(raw: str) -> RiskResult | None:
    try:
        return RiskResult.model_validate_json(raw)
    except (json.JSONDecodeError, ValidationError) as err:
        audit_logger.warning("model_output_invalid", extra={"error": str(err)})
        return None
```

- Constrain enum-like fields to a fixed set (`risk_level in {"low", "moderate", "high"}`) — never accept a free-text label the model invented.
- If validation fails, **fail closed** (return the `None`/error path), do not guess a default that could be clinically wrong.
- This is the Python mirror of the TS "Structured AI Output" rule in `.claude/rules/ai-services.md`.

---

## 4. PHI & Data Scoping — Minimum Necessary, Tokens Not Identifiers

The HIPAA rules in `CLAUDE.md` apply unchanged. Python ML/agents are **especially** prone to over-collecting because "more features = better model" is a training instinct.

| Rule | Detail |
|---|---|
| **Minimum necessary** | A function/agent receives only the fields it needs for that task — never a whole DB row, never `SELECT *`. |
| **Tokens, not identifiers** | Use `patient_id` / opaque tokens. Never names, SSN, DOB, MRN, address, phone in features or logs. De-identify (age bands, not DOB; region, not address). |
| **No PHI in logs** | Log `patient_id` + event, never the PHI values. The audit log is not a place to leak. |
| **No PHI to disk uncontrolled** | Training data extracts containing PHI stay server-side, access-controlled, and are deleted after use. No PHI in notebooks committed to the repo. |
| **Tenant scoping** | Any data pull is scoped to a tenant — Python does not get to bypass the RLS boundary that the rest of the system enforces. |

**Before writing any feature-extraction or data-pull code, ask: "Is every field here the minimum necessary, and is anything in it PHI that should be a token or a band instead?"**

---

## 5. Secrets & Model Versioning

### Secrets — environment only

```python
import os

api_key = os.environ["ANTHROPIC_API_KEY"]   # from env / Supabase secrets — NEVER literal
```

- **Never** a literal key, token, password, connection string, or webhook URL in a `.py` file.
- Secrets come from environment variables (locally `.env` that is git-ignored; in production, the platform's secret store).
- The `VITE_*`-style rule applies in spirit: a secret that ends up anywhere a client could read it is a breach. Server-side only.

### Model version pinning — reproducible clinical decisions

- Every trained model artifact carries an explicit **`model_version`** in its output (see §2). Never ship a model whose version is implicit or "latest".
- LLM calls from Python (if any) pin an exact model ID, same as the TS rule (`.claude/rules/ai-services.md`) — never `"claude-sonnet"` / `"latest"`.
- A model change is a conscious, tested migration, not an automatic upgrade.

---

## 6. Audit Logging — No `print`, Mirror the TS Audit Logger

`print()` is the Python `console.log` — **banned in non-script production code.** Use a structured audit logger that lands in the same audit trail as the rest of the system (the exact transport is defined when the first Python ML service is built — `audit_logger` in the examples is that shim).

| Do This | Not This |
|---|---|
| `audit_logger.warning("event_key", extra={...})` | `print(...)` / `logging.debug(...)` left in |
| Structured event key + scoped context | free-text log lines |
| Log the failure reason, never the PHI | logging raw patient data |

Dev/ops scripts under `scripts/*.py` may write a human report to stdout (that is their output contract) — but they still must not print secrets or PHI.

---

## 7. Safe File / Path Handling + No Mutable Defaults

```python
from pathlib import Path

ALLOWED_BASE = Path("/srv/ml/data").resolve()

def load_extract(rel_name: str) -> Path:
    target = (ALLOWED_BASE / rel_name).resolve()
    if not target.is_relative_to(ALLOWED_BASE):     # block ../ traversal
        raise ValueError("path escapes allowed base")
    return target

def build(rows: list[str] | None = None) -> list[str]:   # None sentinel, NOT =[]
    rows = rows if rows is not None else []
    ...
```

| Do This | Not This |
|---|---|
| `pathlib.Path`, `.resolve()`, confine to an allowed base | `open(user_supplied_path)` / `os.path.join` with untrusted parts |
| `None` sentinel for default lists/dicts | `def f(x=[])` / `def f(x={})` (shared mutable state) |
| Keep importable logic separate from `if __name__ == "__main__"` | business logic tangled into a script body (can't test it) |
| No PHI written to uncontrolled disk; delete extracts after use | dumping a training CSV with PHI into the repo or `/tmp` |

---

## 8. Timeouts, Retries, and Agent Tool Scope

**Every network / model / DB call has an explicit timeout and a bounded retry.** No unbounded waits, no infinite retry loops.

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10), reraise=True)
def call_model(payload: dict) -> httpx.Response:
    resp = httpx.post(MODEL_URL, json=payload, timeout=15.0)   # explicit timeout
    resp.raise_for_status()
    return resp
```

| Rule | Detail |
|---|---|
| Explicit timeout on every external call | A call with no timeout can hang the process forever |
| Bounded retry + backoff, then fail structured | Not infinite retry; not zero retry on a known-transient failure |
| Agent tool access is **allow-listed** | An agent gets a fixed, named set of tools — never open-ended shell/exec/DB |
| Each tool receives **scoped** data + permissions | Minimum necessary (§4) applies to tool inputs too |

---

## 9. DataFrame / Schema Drift

When ingesting tabular data, **validate the columns and dtypes against an explicit schema** before use. Never trust that a CSV / query result has the shape you expect.

```python
EXPECTED = {"patient_id": "object", "age_band": "object", "systolic_bp": "int64"}

def validate_frame(df) -> None:
    missing = set(EXPECTED) - set(df.columns)
    if missing:
        raise ValueError(f"schema drift — missing columns: {sorted(missing)}")
    for col, dtype in EXPECTED.items():
        if str(df[col].dtype) != dtype:
            raise ValueError(f"schema drift — {col} is {df[col].dtype}, expected {dtype}")
```

- Fail on drift; do not silently coerce or drop columns.
- Pin the schema next to the model version — a model trained on one schema must reject a different one.

---

## 10. Healthcare Claims — Advisory Only, No Overstatement

**Clinical ML output is advisory, never authoritative.** This is a compliance line, not a style preference.

| Rule | Detail |
|---|---|
| **Advisory only** | Output informs a clinician; it never diagnoses, prescribes, or auto-acts on a patient |
| **No overstatement** | No "diagnoses X", "confirms Y", "treats Z" language. Risk scores are likelihoods, not verdicts |
| **Human-in-the-loop** | A licensed clinician reviews before any clinical action — same bar as the TS clinical AI |
| **HTI-2 transparency** | Every model has a technical description **and** a plain-language `patient_description`, a model card, and a pinned version (§5) |
| **Confidence + provenance** | Surface confidence and the data it was computed from; log the decision to the audit trail |
| **Akima sign-off** | Any clinical-facing model path is a Tier-3 clinical decision — requires compliance review before it touches a real workflow |

---

## 11. Project Structure & Dependencies (when Python graduates beyond scripts)

- **Isolation:** Python ML/services live in a dedicated top-level dir (proposed `ml/`), never intermixed with `src/` (TypeScript) or `supabase/functions/` (Deno). One language per tree.
- **Pinned dependencies:** a `requirements.txt` (or `pyproject.toml`) with **pinned versions** — no unpinned ranges. The supply-chain rules apply.
- **Virtual env:** all work happens in a venv; never `pip install` into the system interpreter.
- **600-line limit:** same as everywhere — decompose by responsibility, don't grow a god module.
- **Tests required:** every new module ships with `pytest` tests that pass the Deletion Test (would it fail if the logic were removed?). Synthetic test data only — obviously fake `patient_id`s, no realistic PHI.

---

## 12. Verification Checkpoint (Python)

Before any Python work is "done" or committed, run and report counts — the Python mirror of the mandatory checkpoint:

```bash
mypy <changed files>      # 0 new type errors
ruff check <changed files># 0 lint errors (or the project's configured linter)
pytest <relevant tests>   # all pass, 0 skipped
```

Report format:
```
✅ mypy: 0 errors in changed files
✅ ruff: 0 errors
✅ pytest: X passed, 0 failed
```

Same hard-gate rules as the TS checkpoint: run the actual commands, report real counts, fix before commit, STOP AND ASK after 2+ failed fix attempts.

---

## Quick Reference — Python Commandments

1. `except SpecificError`, never bare/`except Exception` to hide failures — preserve the reason.
2. Typed I/O (Pydantic / dataclass) on every boundary — loose `dict` is the banned `any`.
3. Validate model/LLM output against a schema before use — untrusted until proven; fail closed.
4. Minimum-necessary, de-identified, tokenized data — never whole rows, never PHI in features/logs.
5. Secrets from env only — never literal in source.
6. Pin model versions — reproducible clinical decisions.
7. `audit_logger`, never `print`, in production code.
8. One language per tree, pinned deps, venv, 600-line limit, tests required.
9. mypy + ruff + pytest green with reported counts before "done."
10. STOP AND ASK when unclear — same as everywhere.
