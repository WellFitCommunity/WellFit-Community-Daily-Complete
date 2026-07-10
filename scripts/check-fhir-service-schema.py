#!/usr/bin/env python3
"""
FHIR schema-drift gate.

Statically diffs the column names the FHIR code references (in `.select(...)` lists,
`.eq/.order/.contains/...` filters, and table-keyed column maps like FHIR_SELECT_COLUMNS)
against a committed snapshot of the live schema (scripts/fhir-schema-snapshot.json).

Scope (both are scanned):
  - src/services/fhir/*Service.ts          (the app-side FHIR service layer)
  - supabase/functions/mcp-fhir-server/*.ts (the MCP FHIR server — tools.ts, resourceQueries.ts,
                                             patientSummary.ts, toolHandlers.ts, bundleBuilder.ts)

Why: a drifted SELECT / column-map compiles fine in TypeScript; only the live DB knows it is
wrong, so it fails at runtime with 42703 and (worst case) a swallowed error renders as empty
data. The 2026-06-01 clinical audit found this in the fhir services; the 2026-07-10 session
found the ENTIRE MCP FHIR server was runtime-dead the same way (export_patient_bundle,
get_patient_summary, and 8 resource types selecting columns that don't exist live) because the
MCP server was never in this gate's scope AND its column lists live in an object map
(FHIR_SELECT_COLUMNS), not in `.select()` calls. This gate now covers both.

CI has no live-DB credentials, so the gate compares against the checked-in snapshot. Refresh it
after ANY migration touching a covered table with scripts/refresh-fhir-schema-snapshot.sql.

Coverage is defined by the snapshot: a referenced table is validated only if it is in the
snapshot. A `fhir_`-prefixed table that is referenced but ABSENT from the snapshot is reported as
a missing table (the snapshot covers all fhir_* tables). Non-fhir tables absent from the snapshot
are skipped (out of coverage) — so the gate under-reports rather than producing false positives.

Pre-existing violations are grandfathered in scripts/fhir-schema-gate-baseline.txt so the gate can
be adopted without first fixing every legacy reference. NEW violations fail the build.

Exit 0 = clean (or only baselined violations). Exit 1 = new violation. Exit 2 = config error.

Conservative by design: only flags single-token, literal column references. It skips embeds
(`rel:other(col)`), `select('*')`, computed/template selects, `.or(...)`, and dynamic
`.from(variable)` / `.select(fn(...))` — so it under-reports rather than false-positives.
"""

import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOT = os.path.join(REPO_ROOT, "scripts", "fhir-schema-snapshot.json")
BASELINE = os.path.join(REPO_ROOT, "scripts", "fhir-schema-gate-baseline.txt")

# (directory, filename predicate) pairs to scan. __tests__ dirs are excluded.
SCAN_TARGETS = [
    (os.path.join(REPO_ROOT, "src", "services", "fhir"),
     lambda f: f.endswith("Service.ts")),
    (os.path.join(REPO_ROOT, "supabase", "functions", "mcp-fhir-server"),
     lambda f: f.endswith(".ts") and not f.endswith(".test.ts")),
]

MISSING_TABLE = "*MISSING_TABLE*"

# Filter methods whose FIRST string argument is a column name.
FILTER_METHODS = (
    "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike",
    "is", "in", "contains", "containedBy", "overlaps", "order",
)

RE_FROM_LITERAL = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]")
RE_FROM_ANY = re.compile(r"\.from\(")
RE_SELECT_LITERAL = re.compile(r"\.select\(\s*(['\"])(.*?)\1", re.DOTALL)
RE_SELECT_CONST = re.compile(r"\.select\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)")
RE_FILTER = re.compile(
    r"\.(" + "|".join(FILTER_METHODS) + r")\(\s*['\"]([a-zA-Z_][a-zA-Z0-9_]*)['\"]"
)
RE_CONST = re.compile(
    r"\bconst\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['\"])(.*?)\2", re.DOTALL
)
# Table-keyed column-map entry: 'table_name': 'col1, col2, ...'  (single-line string value).
# Self-scopes via the snapshot: only entries whose quoted key is a known table are validated,
# so ordinary config objects and the FHIR_TABLES resource map ('Patient': 'profiles') are ignored.
RE_MAP_ENTRY = re.compile(
    r"(['\"])([a-z_][a-z0-9_]*)\1\s*:\s*(['\"])([^'\"\n]+)\3"
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
    """Yield (line_no, table, column) references found in one file.

    Two reference kinds:
      1. `.from('t')` + a following literal/const `.select(...)` or `.eq('col')` filter
         (table resolved from the nearest preceding `.from`).
      2. Table-keyed column-map entries `'t': 'col, col'` (table = the map key itself).
    """
    with open(path) as f:
        src = f.read()
    consts_local = {**consts, **resolve_consts(src)}
    # Build the .from() table timeline. A dynamic `.from(variable)` is a BARRIER: it
    # resolves to None so later `.select()`/`.eq()` refs in that statement are not
    # mis-attributed to an earlier literal table from a different statement.
    literal_at = {m.start(): m.group(1) for m in RE_FROM_LITERAL.finditer(src)}
    froms = sorted((m.start(), literal_at.get(m.start())) for m in RE_FROM_ANY.finditer(src))

    def line_of(pos):
        return src.count("\n", 0, pos) + 1

    # Kind 1 — from/select/filter refs, table = nearest .from()
    for m in RE_SELECT_LITERAL.finditer(src):
        table = nearest_table(froms, m.start())
        if table:
            for col in columns_from_select_string(m.group(2)):
                yield (line_of(m.start()), table, col)
    for m in RE_SELECT_CONST.finditer(src):
        val = consts_local.get(m.group(1))
        if val is None:
            continue
        table = nearest_table(froms, m.start())
        if table:
            for col in columns_from_select_string(val):
                yield (line_of(m.start()), table, col)
    for m in RE_FILTER.finditer(src):
        table = nearest_table(froms, m.start())
        if table:
            yield (line_of(m.start()), table, m.group(2))

    # Kind 2 — table-keyed column maps (e.g. FHIR_SELECT_COLUMNS). table = the map key.
    for m in RE_MAP_ENTRY.finditer(src):
        key, val = m.group(2), m.group(4)
        for col in columns_from_select_string(val):
            yield (line_of(m.start()), key, col)


def gather_files():
    files = []
    for directory, pred in SCAN_TARGETS:
        if not os.path.isdir(directory):
            continue
        for name in sorted(os.listdir(directory)):
            if name == "__tests__":
                continue
            full = os.path.join(directory, name)
            if os.path.isfile(full) and pred(name):
                files.append(full)
    return files


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
    files = gather_files()

    # Collect ALL current violations (deduped by key), independent of the baseline.
    all_by_key = {}  # key -> (rel, line_no, kind)
    for path in files:
        rel = os.path.relpath(path, REPO_ROOT)
        for line_no, table, col in scan_file(path, {}):
            if table not in snapshot:
                # A fhir_ table missing from the (fhir-complete) snapshot is genuine drift;
                # any other uncovered table is simply out of scope — skip it.
                if not table.startswith("fhir_"):
                    continue
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
        print("❌ FHIR schema drift (CLAUDE.md #18 — verify vs live DB):\n")
        for rel, line_no, kind, key in new_violations:
            print(f"   {rel}:{line_no}  {kind}")
        print(
            "\nFix the SELECT/filter/column-map to match the live column set, or — if the\n"
            "snapshot is stale after a migration — refresh it with\n"
            "scripts/refresh-fhir-schema-snapshot.sql. Only add to\n"
            "scripts/fhir-schema-gate-baseline.txt for a KNOWN pre-existing gap\n"
            "(record it in the clinical audit tracker)."
        )
        return 1

    print(
        f"✅ FHIR schema gate: {len(files)} files clean "
        f"({baselined_hits} baselined pre-existing references skipped)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
