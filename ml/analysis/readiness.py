"""Training-data readiness gate.

Answers ONE question with a hard GO / NO-GO: is there enough real labeled
outcome data to train a supervised clinical risk model that could plausibly
beat the existing Claude-based predictor?

This exists so the decision "is it time to build the model?" is a repeatable,
evidence-based check — not anyone's opinion. Pure functions (no DB import) so it
is fully unit-testable; a thin adapter maps live row-counts into the census.

Governance: .claude/rules/python.md — typed I/O (§2), advisory/honest (§10, §12),
stdout is this tool's output contract (§6). No PHI: counts only, never rows.
"""

from __future__ import annotations

from collections.abc import Mapping
from enum import Enum

from pydantic import BaseModel, Field

# --- Conservative minimums for a tabular clinical risk model -----------------
# These are floors, not targets. Below them a trained model overfits and will
# not reliably beat a well-prompted LLM baseline. Raise as data accrues.
MIN_LABELED_EXAMPLES = 500   # cohort rows with a known outcome (the denominator)
MIN_POSITIVE_EVENTS = 50     # minority/event class (e.g. actual readmissions)


class Decision(str, Enum):
    GO = "GO"
    NO_GO = "NO_GO"


class CohortCensus(BaseModel):
    """Counts describing the available training data for one prediction target.

    All fields are row COUNTS only — never patient rows (no PHI).
    """

    target: str = Field(description="prediction target, e.g. 'readmission_30d'")
    labeled_examples: int = Field(ge=0, description="cohort rows with a known outcome")
    positive_events: int = Field(ge=0, description="rows where the event occurred (minority class)")
    feature_rows: int = Field(ge=0, description="supporting feature rows available")

    @classmethod
    def from_counts(cls, target: str, counts: Mapping[str, int]) -> CohortCensus:
        """Build a census from a name->count mapping (e.g. the live DB census)."""
        return cls(
            target=target,
            labeled_examples=int(counts.get("labeled_examples", 0)),
            positive_events=int(counts.get("positive_events", 0)),
            feature_rows=int(counts.get("feature_rows", 0)),
        )


class ReadinessReport(BaseModel):
    """Typed GO / NO-GO verdict with the reasons and the numbers behind it."""

    target: str
    decision: Decision
    reasons: list[str]
    labeled_examples: int
    positive_events: int
    min_labeled_examples: int = MIN_LABELED_EXAMPLES
    min_positive_events: int = MIN_POSITIVE_EVENTS

    @property
    def is_go(self) -> bool:
        return self.decision is Decision.GO


def assess_readiness(census: CohortCensus) -> ReadinessReport:
    """Pure decision function: census -> GO/NO-GO with explicit reasons."""
    reasons: list[str] = []

    if census.labeled_examples == 0:
        reasons.append(
            "No labeled outcomes — a supervised model cannot be trained on 0 examples."
        )
    elif census.labeled_examples < MIN_LABELED_EXAMPLES:
        reasons.append(
            f"Only {census.labeled_examples} labeled examples; "
            f"need >= {MIN_LABELED_EXAMPLES} to avoid overfitting."
        )

    if census.positive_events < MIN_POSITIVE_EVENTS:
        reasons.append(
            f"Only {census.positive_events} positive events; "
            f"need >= {MIN_POSITIVE_EVENTS} for a learnable signal."
        )

    decision = Decision.GO if not reasons else Decision.NO_GO
    if decision is Decision.GO:
        reasons.append(
            f"{census.labeled_examples} labeled examples / {census.positive_events} "
            f"positive events meet the conservative minimums — training is justified."
        )

    return ReadinessReport(
        target=census.target,
        decision=decision,
        reasons=reasons,
        labeled_examples=census.labeled_examples,
        positive_events=census.positive_events,
    )


def render_report(report: ReadinessReport) -> str:
    """Human-readable report for stdout (the CLI's output contract)."""
    lines = [
        f"Training-data readiness — target: {report.target}",
        f"  Decision: {report.decision.value}",
        f"  Labeled examples: {report.labeled_examples} (min {report.min_labeled_examples})",
        f"  Positive events:  {report.positive_events} (min {report.min_positive_events})",
        "  Reasons:",
    ]
    lines.extend(f"    - {r}" for r in report.reasons)
    return "\n".join(lines)


# --- Live DB census adapter (documentation; not run in CI / unit tests) ------
# Run this SQL via Supabase MCP execute_sql, then feed the counts to
# CohortCensus.from_counts(). For readmission_30d:
#   labeled_examples := count(*) FROM patient_admissions   (cohort w/ known outcome)
#   positive_events  := count(*) FROM patient_readmissions (the event)
#   feature_rows     := count(*) FROM check_ins
# As of 2026-06-08 the live DB returns 0 / 0 / 69  -> NO_GO.
READMISSION_CENSUS_SQL = """
SELECT
  (SELECT count(*) FROM patient_admissions)   AS labeled_examples,
  (SELECT count(*) FROM patient_readmissions) AS positive_events,
  (SELECT count(*) FROM check_ins)            AS feature_rows;
""".strip()


def _main() -> int:
    # Reflects the live 2026-06-08 census. Update the counts (or wire the SQL
    # above through an adapter) when re-checking readiness.
    census = CohortCensus.from_counts(
        "readmission_30d",
        {"labeled_examples": 0, "positive_events": 0, "feature_rows": 69},
    )
    report = assess_readiness(census)
    print(render_report(report))  # stdout is this tool's output contract (§6)
    return 0 if report.is_go else 1


if __name__ == "__main__":
    raise SystemExit(_main())
