"""Scaffolding sanity module — Phase 0.

Exists only to prove the toolchain (mypy strict / ruff / pytest) is green on a
real typed module before any Phase 1 contract code lands. Carries no business
logic and touches no data. Safe to delete once `contracts/` has real models.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ToolchainStatus:
    """Typed result (no loose dicts — §2). Reports the ml/ tree is wired."""

    package: str
    ready: bool


def toolchain_status() -> ToolchainStatus:
    """Return a typed, deterministic status for the ml/ package."""
    return ToolchainStatus(package="ml", ready=True)
