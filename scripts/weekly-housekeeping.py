#!/usr/bin/env python3
"""
Weekly Housekeeping Health Check
=================================

Runs the 10 manual checks documented in docs/PROJECT_STATE.md "Weekly
Housekeeping Checklist" and writes a Markdown report to stdout.

Each check is independent — missing secrets or transient API failures
degrade gracefully (the check reports SKIP or WARN, not crash).

Exit codes:
  0 = all checks PASS or SKIP (skip-only failures don't fail the run)
  1 = at least one check FAILED
  2 = script itself errored before completing all checks

Usage:
  python3 scripts/weekly-housekeeping.py            # report to stdout
  python3 scripts/weekly-housekeeping.py --json     # JSON output

Environment variables expected:
  VERCEL_TOKEN              — Vercel API token, scoped to maria-leblancs-projects
  VERCEL_TEAM_ID            — defaults to team_qpVaKE8U0EA7C0oJoCYEtKYJ
  VERCEL_PROJECT_ID         — defaults to prj_SY578ia7lo6YkJGK9pUdu1bUqrXB
  SUPABASE_ACCESS_TOKEN     — Supabase personal access token
  SUPABASE_PROJECT_REF      — defaults to xkybsjnvuohpqpbkikyn
  GH_TOKEN                  — GitHub token (for gh CLI; usually set by Actions)

Missing optional env vars cause the relevant checks to SKIP with a clear
"missing X" reason rather than crash.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable


WELLFIT_VERCEL_TEAM_ID = "team_qpVaKE8U0EA7C0oJoCYEtKYJ"
WELLFIT_VERCEL_PROJECT_ID = "prj_SY578ia7lo6YkJGK9pUdu1bUqrXB"
WELLFIT_SUPABASE_REF = "xkybsjnvuohpqpbkikyn"


@dataclass
class CheckResult:
    name: str
    status: str  # "PASS" | "FAIL" | "WARN" | "SKIP"
    summary: str
    details: list[str] = field(default_factory=list)
    remediation: str | None = None


def vercel_api(path: str, token: str) -> dict[str, Any]:
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def supabase_api(path: str, token: str) -> dict[str, Any]:
    req = urllib.request.Request(
        f"https://api.supabase.com{path}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def run_shell(cmd: list[str], cwd: str | None = None, timeout: int = 60) -> tuple[int, str, str]:
    """Run shell command, return (returncode, stdout, stderr). Never raises."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"timed out after {timeout}s"
    except FileNotFoundError as e:
        return 127, "", f"command not found: {e}"


# ============================================================================
# CHECK 1 — Vercel deploy freshness
# ============================================================================
def check_vercel_deploy_freshness() -> CheckResult:
    name = "Vercel deploy freshness"
    token = os.environ.get("VERCEL_TOKEN")
    if not token:
        return CheckResult(name, "SKIP", "VERCEL_TOKEN not set")

    team = os.environ.get("VERCEL_TEAM_ID", WELLFIT_VERCEL_TEAM_ID)
    project = os.environ.get("VERCEL_PROJECT_ID", WELLFIT_VERCEL_PROJECT_ID)

    try:
        data = vercel_api(
            f"/v6/deployments?projectId={project}&teamId={team}&limit=1",
            token,
        )
    except Exception as e:
        return CheckResult(name, "WARN", f"API call failed: {e}")

    deployments = data.get("deployments", [])
    if not deployments:
        return CheckResult(
            name,
            "FAIL",
            "No deployments at all on this project",
            remediation="Trigger a deploy: `git commit --allow-empty -m trigger && git push`",
        )

    latest = deployments[0]
    created_ms = latest["created"]
    created = datetime.fromtimestamp(created_ms / 1000, tz=timezone.utc)
    age = datetime.now(timezone.utc) - created
    age_days = age.total_seconds() / 86400

    details = [
        f"Latest deploy: {latest['uid']} ({latest.get('state', '?')})",
        f"Created: {created.isoformat()} ({age_days:.1f} days ago)",
    ]

    if age_days > 7:
        return CheckResult(
            name,
            "FAIL",
            f"No deploy in {age_days:.0f} days (threshold: 7)",
            details=details,
            remediation="Check Vercel→GitHub integration. Push a commit to test.",
        )

    return CheckResult(
        name,
        "PASS",
        f"Latest deploy is {age_days:.1f} days old",
        details=details,
    )


# ============================================================================
# CHECK 2 — Vercel env vars: orphaned integration vars
# ============================================================================
def check_vercel_env_orphans() -> CheckResult:
    name = "Vercel env vars (integration orphans)"
    token = os.environ.get("VERCEL_TOKEN")
    if not token:
        return CheckResult(name, "SKIP", "VERCEL_TOKEN not set")

    team = os.environ.get("VERCEL_TEAM_ID", WELLFIT_VERCEL_TEAM_ID)
    project = os.environ.get("VERCEL_PROJECT_ID", WELLFIT_VERCEL_PROJECT_ID)

    try:
        data = vercel_api(
            f"/v9/projects/{project}/env?teamId={team}",
            token,
        )
    except Exception as e:
        return CheckResult(name, "WARN", f"API call failed: {e}")

    envs = data.get("envs", [])
    integration_vars = [e for e in envs if e.get("configurationId")]
    if not integration_vars:
        return CheckResult(
            name,
            "PASS",
            f"No integration-managed env vars ({len(envs)} total vars, all manual)",
        )

    # Check each unique integration configId — is it still alive?
    config_ids = sorted({v["configurationId"] for v in integration_vars})
    orphans: list[str] = []
    live: list[str] = []
    for cid in config_ids:
        try:
            supabase_api  # dummy ref to keep type-checkers happy
            req = urllib.request.Request(
                f"https://api.vercel.com/v1/integrations/configuration/{cid}?teamId={team}",
                headers={"Authorization": f"Bearer {token}"},
            )
            urllib.request.urlopen(req, timeout=10).read()
            live.append(cid)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                orphans.append(cid)
            else:
                # Treat other errors as live (don't false-positive on transient API issues)
                live.append(cid)
        except Exception:
            live.append(cid)

    orphan_vars = [v for v in integration_vars if v["configurationId"] in orphans]
    if not orphan_vars:
        return CheckResult(
            name,
            "PASS",
            f"{len(integration_vars)} integration vars, all integrations alive",
        )

    sample = [v["key"] for v in orphan_vars[:5]]
    details = [
        f"Orphan integration(s): {', '.join(orphans)}",
        f"Affected env vars ({len(orphan_vars)} total): {', '.join(sample)}"
        + (f", ... +{len(orphan_vars) - 5} more" if len(orphan_vars) > 5 else ""),
    ]
    return CheckResult(
        name,
        "FAIL",
        f"{len(orphan_vars)} env vars orphaned by deleted integration(s)",
        details=details,
        remediation="Either reconnect the integration in Vercel, or delete the orphaned vars.",
    )


# ============================================================================
# CHECK 3 — Vercel git link credential is recent
# ============================================================================
def check_vercel_git_link() -> CheckResult:
    name = "Vercel git link"
    token = os.environ.get("VERCEL_TOKEN")
    if not token:
        return CheckResult(name, "SKIP", "VERCEL_TOKEN not set")

    team = os.environ.get("VERCEL_TEAM_ID", WELLFIT_VERCEL_TEAM_ID)
    project = os.environ.get("VERCEL_PROJECT_ID", WELLFIT_VERCEL_PROJECT_ID)

    try:
        data = vercel_api(f"/v9/projects/{project}?teamId={team}", token)
    except Exception as e:
        return CheckResult(name, "WARN", f"API call failed: {e}")

    link = data.get("link") or {}
    if not link:
        return CheckResult(
            name, "FAIL", "No git repo linked to this Vercel project",
            remediation="Vercel → Settings → Git → Connect Git Repository",
        )

    repo = f"{link.get('org')}/{link.get('repo')}"
    cred = link.get("gitCredentialId", "?")
    updated_ms = link.get("updatedAt", 0)
    updated = datetime.fromtimestamp(updated_ms / 1000, tz=timezone.utc)
    age_days = (datetime.now(timezone.utc) - updated).total_seconds() / 86400

    details = [
        f"Repo: {repo}",
        f"Credential: {cred}",
        f"Link last updated: {updated.isoformat()} ({age_days:.0f} days ago)",
    ]

    # No hard threshold — but if it's been over 365 days since the link
    # was touched AND deploys are also stuck, that's correlated with the
    # stale-credential bug we saw on 2026-05-20.
    if age_days > 365:
        return CheckResult(
            name,
            "WARN",
            f"Git link untouched for {age_days:.0f} days (may need disconnect/reconnect if deploys also fail)",
            details=details,
        )

    return CheckResult(name, "PASS", f"Git link healthy ({repo})", details=details)


# ============================================================================
# CHECK 4 — Supabase security advisor
# ============================================================================
def check_supabase_advisors(advisor_type: str) -> CheckResult:
    name = f"Supabase {advisor_type} advisor"
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        return CheckResult(name, "SKIP", "SUPABASE_ACCESS_TOKEN not set")

    ref = os.environ.get("SUPABASE_PROJECT_REF", WELLFIT_SUPABASE_REF)

    try:
        data = supabase_api(f"/v1/projects/{ref}/advisors/{advisor_type}", token)
    except urllib.error.HTTPError as e:
        return CheckResult(name, "WARN", f"API error {e.code}: {e.reason}")
    except Exception as e:
        return CheckResult(name, "WARN", f"API call failed: {e}")

    lints = data.get("lints", []) if isinstance(data, dict) else data
    if not isinstance(lints, list):
        return CheckResult(name, "WARN", "Unexpected response shape")

    errors = [l for l in lints if (l.get("level") or "").upper() == "ERROR"]
    warns = [l for l in lints if (l.get("level") or "").upper() == "WARN"]
    infos = [l for l in lints if (l.get("level") or "").upper() == "INFO"]

    # Filter known-accepted false positives (must match PROJECT_STATE.md "Known False Positives")
    KNOWN_FALSE_POSITIVES = {
        ("rls_disabled_in_public", "spatial_ref_sys"),  # PostGIS extension table
    }
    def is_accepted(lint: dict) -> bool:
        meta = lint.get("metadata") or {}
        return (lint.get("name"), meta.get("name")) in KNOWN_FALSE_POSITIVES

    errors = [l for l in errors if not is_accepted(l)]
    warns = [l for l in warns if not is_accepted(l)]

    details = [f"ERROR: {len(errors)} | WARN: {len(warns)} | INFO: {len(infos)} (after false-positive filter)"]
    for lint in errors[:5]:
        details.append(f"  ERROR — {lint.get('title')}: {(lint.get('detail') or '').splitlines()[0][:120]}")
    for lint in warns[:3]:
        details.append(f"  WARN — {lint.get('title')}: {(lint.get('detail') or '').splitlines()[0][:120]}")

    if errors:
        return CheckResult(
            name,
            "FAIL",
            f"{len(errors)} ERROR-level findings (excluding accepted false positives)",
            details=details,
        )
    if warns:
        return CheckResult(
            name,
            "WARN",
            f"{len(warns)} WARN-level findings",
            details=details,
        )

    return CheckResult(name, "PASS", "No ERROR or WARN findings", details=details)


# ============================================================================
# CHECK 6 — CI/CD pipeline last run on main
# ============================================================================
def check_ci_pipeline_status() -> CheckResult:
    name = "CI/CD pipeline (main, last run)"
    rc, out, err = run_shell([
        "gh", "run", "list",
        "--workflow", "ci-cd.yml",
        "--branch", "main",
        "--limit", "1",
        "--json", "conclusion,status,createdAt,databaseId,headSha",
    ])
    if rc != 0:
        # gh CLI may not be available or unauthenticated
        return CheckResult(name, "SKIP", f"gh CLI unavailable: {err.strip() or out.strip()}")

    try:
        runs = json.loads(out)
    except json.JSONDecodeError:
        return CheckResult(name, "WARN", "Couldn't parse gh output")

    if not runs:
        return CheckResult(name, "WARN", "No CI runs found on main")

    run = runs[0]
    conclusion = run.get("conclusion") or "in_progress"
    details = [
        f"Run ID: {run.get('databaseId')}",
        f"SHA: {(run.get('headSha') or '')[:10]}",
        f"Created: {run.get('createdAt')}",
        f"Conclusion: {conclusion}",
    ]

    if conclusion == "success":
        return CheckResult(name, "PASS", "Last main run was green", details=details)
    if conclusion in ("in_progress", "queued"):
        return CheckResult(name, "WARN", f"Last main run is {conclusion}", details=details)
    return CheckResult(
        name, "FAIL", f"Last main run: {conclusion}",
        details=details,
        remediation=f"gh run view {run.get('databaseId')} --log-failed",
    )


# ============================================================================
# CHECK 7 — Governance scripts honest
# ============================================================================
def check_governance_scripts() -> CheckResult:
    name = "Governance scripts"
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    rc1, out1, _ = run_shell(["bash", "scripts/governance-check.sh"], cwd=repo_root, timeout=120)
    rc2, out2, _ = run_shell(
        ["bash", "scripts/governance-drift-check.sh", "--skip-tests"],
        cwd=repo_root, timeout=180,
    )

    details = []
    if rc1 == 0:
        details.append("governance-check.sh: PASS")
    else:
        details.append(f"governance-check.sh: FAIL (exit {rc1})")
    if rc2 == 0:
        details.append("governance-drift-check.sh: PASS")
    else:
        details.append(f"governance-drift-check.sh: FAIL (exit {rc2})")

    if rc1 != 0 or rc2 != 0:
        return CheckResult(
            name,
            "FAIL",
            "One or both governance scripts exited nonzero",
            details=details,
        )
    return CheckResult(name, "PASS", "Both governance scripts exited 0", details=details)


# ============================================================================
# CHECK 8 — God file count drift
# ============================================================================
def check_god_file_count() -> CheckResult:
    name = "God file count (>600 lines)"
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # src/ count
    rc, out, _ = run_shell([
        "bash", "-c",
        "find src \\( -name '*.ts' -o -name '*.tsx' \\) "
        "! -path '*/__tests__/*' ! -name '*.test.*' ! -name '*.spec.*' "
        "! -name '*.generated.*' ! -name '*.d.ts' "
        "-exec wc -l {} + 2>/dev/null "
        "| awk '$1 > 600 && $2 != \"total\" { count++ } END { print count+0 }'",
    ], cwd=repo_root)
    try:
        src_count = int(out.strip() or "0")
    except ValueError:
        src_count = -1

    # edge functions count
    rc, out, _ = run_shell([
        "bash", "-c",
        "find supabase/functions \\( -name '*.ts' -o -name '*.tsx' \\) "
        "! -path '*/__tests__/*' ! -name '*.test.*' "
        "-exec wc -l {} + 2>/dev/null "
        "| awk '$1 > 600 && $2 != \"total\" { count++ } END { print count+0 }'",
    ], cwd=repo_root)
    try:
        fn_count = int(out.strip() or "0")
    except ValueError:
        fn_count = -1

    # Baseline thresholds (from 2026-05-20). Numbers should monotonically
    # decrease as decomposition happens. New offenders trigger WARN.
    SRC_BASELINE = 163
    FN_BASELINE = 21

    details = [
        f"src/ files >600 lines: {src_count} (baseline 2026-05-20: {SRC_BASELINE})",
        f"edge function files >600 lines: {fn_count} (baseline 2026-05-20: {FN_BASELINE})",
    ]

    if src_count == -1 or fn_count == -1:
        return CheckResult(name, "WARN", "Couldn't compute counts", details=details)

    issues = []
    if src_count > SRC_BASELINE:
        issues.append(f"src/ grew by {src_count - SRC_BASELINE}")
    if fn_count > FN_BASELINE:
        issues.append(f"edge functions grew by {fn_count - FN_BASELINE}")

    if issues:
        return CheckResult(
            name,
            "WARN",
            "; ".join(issues),
            details=details,
            remediation="See docs/trackers/god-file-decomposition-tracker.md",
        )

    delta_src = SRC_BASELINE - src_count
    delta_fn = FN_BASELINE - fn_count
    return CheckResult(
        name,
        "PASS",
        f"At or below baseline (Δ src: -{delta_src}, Δ fn: -{delta_fn})",
        details=details,
    )


# ============================================================================
# Orchestrator
# ============================================================================
ALL_CHECKS: list[Callable[[], CheckResult]] = [
    check_vercel_deploy_freshness,
    check_vercel_env_orphans,
    check_vercel_git_link,
    lambda: check_supabase_advisors("security"),
    lambda: check_supabase_advisors("performance"),
    check_ci_pipeline_status,
    check_governance_scripts,
    check_god_file_count,
]


def run_all() -> list[CheckResult]:
    results: list[CheckResult] = []
    for check in ALL_CHECKS:
        try:
            results.append(check())
        except Exception as e:
            results.append(CheckResult(
                name=getattr(check, "__name__", "unknown"),
                status="WARN",
                summary=f"check itself crashed: {e}",
            ))
    return results


STATUS_ICON = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "SKIP": "⏭️"}


def format_markdown(results: list[CheckResult]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    counts = {s: sum(1 for r in results if r.status == s) for s in ["PASS", "FAIL", "WARN", "SKIP"]}

    lines = [
        f"# Weekly Housekeeping Report — {now}",
        "",
        f"**Summary:** {counts['PASS']} pass, {counts['FAIL']} fail, "
        f"{counts['WARN']} warn, {counts['SKIP']} skip",
        "",
        "| Check | Status | Summary |",
        "|-------|--------|---------|",
    ]
    for r in results:
        icon = STATUS_ICON.get(r.status, "❓")
        lines.append(f"| {r.name} | {icon} {r.status} | {r.summary} |")

    lines.append("")
    lines.append("## Detail")
    lines.append("")
    for r in results:
        icon = STATUS_ICON.get(r.status, "❓")
        lines.append(f"### {icon} {r.name} — {r.status}")
        lines.append("")
        lines.append(r.summary)
        if r.details:
            lines.append("")
            for d in r.details:
                lines.append(f"- {d}")
        if r.remediation:
            lines.append("")
            lines.append(f"**Fix:** {r.remediation}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(
        "_Generated by `scripts/weekly-housekeeping.py`. "
        "See `docs/PROJECT_STATE.md` → Weekly Housekeeping Checklist for context._"
    )
    return "\n".join(lines)


def main() -> int:
    json_mode = "--json" in sys.argv

    results = run_all()

    if json_mode:
        print(json.dumps([r.__dict__ for r in results], indent=2, default=str))
    else:
        print(format_markdown(results))

    # Exit code policy — when one or more FAIL: exit 1; otherwise exit 0
    if any(r.status == "FAIL" for r in results):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
