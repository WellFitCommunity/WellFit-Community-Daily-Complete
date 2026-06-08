"""Tests for the training-data readiness gate.

Deletion Test: each fails if assess_readiness's decision logic is removed.
Synthetic counts only — no PHI.
"""

from ml.analysis.readiness import (
    MIN_LABELED_EXAMPLES,
    MIN_POSITIVE_EVENTS,
    CohortCensus,
    Decision,
    assess_readiness,
)


def test_zero_labels_is_no_go_with_explicit_reason() -> None:
    """The live 2026-06-08 reality: 0 labels -> NO_GO, and it says why."""
    report = assess_readiness(
        CohortCensus.from_counts(
            "readmission_30d",
            {"labeled_examples": 0, "positive_events": 0, "feature_rows": 69},
        )
    )
    assert report.decision is Decision.NO_GO
    assert report.is_go is False
    assert any("0 examples" in r for r in report.reasons)


def test_features_but_no_labels_is_no_go() -> None:
    """Feature rows do NOT substitute for labels."""
    report = assess_readiness(
        CohortCensus.from_counts(
            "readmission_30d",
            {"labeled_examples": 0, "positive_events": 0, "feature_rows": 100_000},
        )
    )
    assert report.decision is Decision.NO_GO


def test_too_few_positive_events_is_no_go() -> None:
    """Enough cohort rows but too few events (class imbalance) -> NO_GO."""
    report = assess_readiness(
        CohortCensus(
            target="readmission_30d",
            labeled_examples=MIN_LABELED_EXAMPLES,
            positive_events=MIN_POSITIVE_EVENTS - 1,
            feature_rows=MIN_LABELED_EXAMPLES,
        )
    )
    assert report.decision is Decision.NO_GO
    assert any("positive events" in r for r in report.reasons)


def test_sufficient_data_is_go() -> None:
    """At/above both conservative minimums -> GO."""
    report = assess_readiness(
        CohortCensus(
            target="readmission_30d",
            labeled_examples=MIN_LABELED_EXAMPLES,
            positive_events=MIN_POSITIVE_EVENTS,
            feature_rows=MIN_LABELED_EXAMPLES,
        )
    )
    assert report.decision is Decision.GO
    assert report.is_go is True
    assert any("justified" in r for r in report.reasons)
