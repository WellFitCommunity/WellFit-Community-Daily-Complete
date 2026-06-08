"""Toolchain sanity test — Phase 0.

Deletion Test (per CLAUDE.md): this fails if `toolchain_status()` logic is
removed/changed, not merely because the module imports. Synthetic only — no PHI.
"""

from ml._health import ToolchainStatus, toolchain_status


def test_toolchain_status_reports_ready_ml_package() -> None:
    status = toolchain_status()
    assert isinstance(status, ToolchainStatus)
    assert status.package == "ml"
    assert status.ready is True
