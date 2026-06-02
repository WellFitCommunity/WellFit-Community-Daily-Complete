#!/usr/bin/env python3
"""
FHIR service schema-drift gate.

Statically diffs the column names each `src/services/fhir/*Service.ts` references
(in `.select(...)` lists and `.eq/.order/.contains/...` filters) against a committed
snapshot of the live `public.fhir_*` schema (scripts/fhir-schema-snapshot.json).

This is the FHIR analogue of scripts/check-edge-sdk-hygiene.sh. It exists because the
clinical adversarial audit (2026-06-01) found multiple services querying columns/tables
that do not exist in the live DB (AV-1 allergy_intolerances, AV-2 fhir_medications,
AV-3 fhir_conditions, DiagnosticReportService) — every read silently threw and, in the
worst case, a swallowed error rendered as "no known allergies." A drifted SELECT compiles
fine in TypeScript; only the live DB knows it is wrong. This gate makes that class of bug
mechanical to catch.

CI has no live-DB credentials, so the gate compares against the checked-in snapshot.
Refresh the snapshot after any fhir_* migration with scripts/refresh-fhir-schema-snapshot.sql.

Pre-existing violations are grandfathered in scripts/fhir-schema-gate-baseline.txt so the
gate can be adopted without first fixing every legacy service. NEW violations fail the build.

Exit 0 = clean (or only baselined violations). Exit 1 = new violation. Exit 2 = config error.

Conservative by design: only flags single-token, literal column references. It skips
embeds (`rel:other(col)`), `select('*')`, computed/template selects, and `.or(...)` — so
it under-reports rather than producing false positives.
"""

import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVICE_DIR = os.path.join(REPO_ROOT, "src", "services", "fhir")
SNAPSHOT = os.path.join(REPO_ROOT, "scripts", "fhir-schema-snapshot.json")
BASELINE = os.path.join(REPO_ROOT, "scripts", "fhir-schema-gate-baseline.txt")

MISSING_TABLE = "*MISSING_TABLE*"

# Filter methods whose FIRST string argument is a column name.
FILTER_METHODS = (
    "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike",
    "is", "in", "contains", "containedBy", "overlaps", "order",
)

RE_FROM = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]")
RE_SELECT_LITERAL = re.compile(r"\.select\(\s*(['\"])(.*?)\1", re.DOTALL)
RE_SELECT_CONST = re.compile(r"\.select\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)")
RE_FILTER = re.compile(
    r"\.(" + "|".join(FILTER_METHODS) + r")\(\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]"
)
RE_CONST = re.compile(
    r"\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['\"])(.*?)\2", re.DOTALL
)

# A literal column token is a bare snake_case identifier. Anything with embed/alias/star
# syntax is skipped (we cannot statically resolve it without false positives).
RE_PLAIN_COL = re.compile(r"^[a-z_][a-z0-9_]*$")


def load_json(path):
    with open(path) as f:
        return json.load(f)


def resolve_consts(src):
    """Map const NAME -> its string value for `.select(NAME)` resolution."""
    return {m.group(1): m.group(3) for m in RE_CONST.finditer(src)}


def columns_from_select_string(s):
    """Split a select() string into plain column tokens, skipping embeds/aliases/star."""
    cols = []
    for raw in s.split(","):
        tok = raw.strip()
        if not tok or tok == "*":
            continue
        if any(c in tok for c in "():.*`"):  # embed, alias, star, template, json path
            continue
        if RE_PLAIN_COL.match(tok):
            cols.append(tok)
    return cols


def nearest_table(froms, pos):
    """Return the table from the most recent `.from(...)` before `pos`, else None."""
    current = None
    for fpos, table in froms:
        if fpos <= pos:
            current = table
        else:
            break
    return current


def scan_file(path, consts):
    """Yield (line_no, table, column) references found in one service file."""
    with open(path) as f:
        src = f.read()
    consts_local = {**consts, **resolve_consts(src)}
    froms = sorted((m.start(), m.group(1)) for m in RE_FROM.finditer(src))

    def line_of(pos):
        return src.count("\n", 0, pos) + 1

    refs = []
    for m in RE_SELECT_LITERAL.finditer(src):
        for col in columns_from_select_string(m.group(2)):
            refs.append((m.start(), col))
    for m in RE_SELECT_CONST.finditer(src):
        val = consts_local.get(m.group(1))
        if val is not None:
            for col in columns_from_select_string(val):
                refs.append((m.start(), col))
    for m in RE_FILTER.finditer(src):
        refs.append((m.start(), m.group(2)))

    for pos, col in refs:
        table = nearest_table(froms, pos)
        if table and table.startswith("fhir_"):
            yield (line_of(pos), table, col)


def load_baseline():
    if not os.path.exists(BASELINE):
        return set()
    out = set()
    with open(BASELINE) as f:
        for line in f:
            line = line.split("#", 1)[0].strip()
            if line:
                out.add(line)
    return out


def main():
    if not os.path.exists(SNAPSHOT):
        print(f"❌ FHIR schema snapshot missing: {SNAPSHOT}", file=sys.stderr)
        return 2
    snapshot = load_json(SNAPSHOT).get("tables", {})
    if not snapshot:
        print("❌ Snapshot has no 'tables' — regenerate it.", file=sys.stderr)
        return 2
    baseline = load_baseline()

    files = sorted(
        os.path.join(SERVICE_DIR, f)
        for f in os.listdir(SERVICE_DIR)
        if f.endswith("Service.ts")
    )

    # Collect ALL current violations (deduped by key), independent of the baseline.
    all_by_key = {}  # key -> (rel, line_no, kind)
    for path in files:
        rel = os.path.relpath(path, REPO_ROOT)
        for line_no, table, col in scan_file(path, {}):
            if table not in snapshot:
                key = f"{rel}::{table}::{MISSING_TABLE}"
                kind = f"table '{table}' does not exist in the live DB"
            elif col not in snapshot[table]:
                key = f"{rel}::{table}::{col}"
                kind = f"column '{col}' not in {table}"
            else:
                continue
            if key not in all_by_key:  # keep first occurrence
                all_by_key[key] = (rel, line_no, kind)

    if "--write-baseline" in sys.argv:
        with open(BASELINE, "w") as f:
            f.write(
                "# FHIR schema gate baseline — KNOWN pre-existing service/schema drift.\n"
                "# One key per line: <relpath>::<table>::<column|*MISSING_TABLE*>.\n"
                "# Regenerate with: python3 scripts/check-fhir-service-schema.py --write-baseline\n"
                "# Each entry is a real gap to close (see the clinical adversarial audit tracker);\n"
                "# baselining only stops NEW drift from landing on top of the known set.\n"
            )
            for key in sorted(all_by_key):
                f.write(key + "\n")
        print(f"Wrote {len(all_by_key)} baseline entries to {BASELINE}")
        return 0

    new_violations = [
        (r, ln, k, key)
        for key, (r, ln, k) in all_by_key.items()
        if key not in baseline
    ]
    new_violations.sort(key=lambda v: (v[0], v[1]))
    baselined_hits = sum(1 for key in all_by_key if key in baseline)

    if new_violations:
        print("❌ FHIR service schema drift (CLAUDE.md #18 — verify vs live DB):\n")
        for rel, line_no, kind, key in new_violations:
            print(f"   {rel}:{line_no}  {kind}")
        print(
            "\nFix the SELECT/filter to match the live column set, or — if the snapshot is\n"
            "stale after a migration — refresh it with scripts/refresh-fhir-schema-snapshot.sql.\n"
            "Only add to scripts/fhir-schema-gate-baseline.txt for a KNOWN pre-existing gap\n"
            "(record it in the clinical audit tracker)."
        )
        return 1

    print(
        f"✅ FHIR service schema gate: {len(files)} services clean "
        f"({baselined_hits} baselined pre-existing references skipped)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
