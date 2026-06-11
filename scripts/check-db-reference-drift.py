#!/usr/bin/env python3
"""
DB-reference drift gate (the generalized sibling of check-fhir-service-schema.py).

Statically verifies that every `.from('<table>')` and `.rpc('<function>')` referenced in
production code (src/ + supabase/functions/, excluding tests) names an object that ACTUALLY
EXISTS in the live database, by diffing against a committed snapshot
(scripts/db-objects-snapshot.json).

Why: the clinical adversarial audit found whole subsystems calling tables/functions that
don't exist in the live DB (AV-2 fhir_medications, dead Goal/Location/Org/Provenance services,
~45 missing RPCs incl. a fail-open medication-allergy check). Those compile fine in TypeScript;
only the live DB knows they're wrong. This gate makes that class mechanical to catch.

Scope: OBJECT EXISTENCE only (does the table/function exist). Column-level checking for the
fhir_* services is handled by the deeper check-fhir-service-schema.py.

CI has no live-DB creds, so it diffs the committed snapshot. Refresh after any migration with
scripts/refresh-db-objects-snapshot.sql. Pre-existing drift is grandfathered in
scripts/db-reference-drift-baseline.txt (regenerate with --write-baseline); NEW drift fails CI.

Exit 0 = clean (or only baselined). Exit 1 = new drift. Exit 2 = config error.
"""

import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAPSHOT = os.path.join(REPO_ROOT, "scripts", "db-objects-snapshot.json")
BASELINE = os.path.join(REPO_ROOT, "scripts", "db-reference-drift-baseline.txt")
SCAN_DIRS = ["src", os.path.join("supabase", "functions")]
EXCLUDE_DIR_PARTS = {"__tests__", "__mocks__", "node_modules"}

RE_FROM = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]")
RE_RPC = re.compile(r"\.rpc\(\s*['\"]([a-z_][a-z0-9_]*)['\"]")

# PostgREST resource embedding lives inside .select(...) strings, e.g.
#   .select('id, patient:patients(name), procedures:encounter_procedures(*)')
#   .select(`... patient:profiles!encounters_patient_id_fkey(id) ...`)
# These reference a related table/view but use NEITHER .from() NOR .rpc(), so the
# checks above miss them — exactly the blind spot that let 5 `patient:patients(...)`
# sister-bugs survive (2026-06-11). RE_SELECT grabs each select string; RE_EMBED finds
# each embedded resource within it (stripping any `alias:` prefix and `!fk`/`!inner`
# hint). EMBED_SKIP drops PostgREST aggregate functions, which share the `name(` shape.
RE_SELECT = re.compile(r"\.select\(\s*([`'\"])(.*?)\1", re.DOTALL)
RE_EMBED = re.compile(
    r"(?<![\w.])"                     # token boundary (not mid-identifier, not `col.agg()`)
    r"(?:[a-z_][a-z0-9_]*\s*:\s*)?"   # optional `alias:`
    r"(?P<table>[a-z_][a-z0-9_]*)"    # the embedded resource (table/view)
    r"(?:\s*!\s*[a-z_][a-z0-9_]*)?"   # optional `!fk_hint` or `!inner` / `!left`
    r"\s*\("                          # opening paren marks the embed
)
EMBED_SKIP = {"count", "sum", "avg", "min", "max"}


def is_excluded(path):
    parts = set(path.split(os.sep))
    if parts & EXCLUDE_DIR_PARTS:
        return True
    base = os.path.basename(path)
    return base.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"))


def iter_code_files():
    for d in SCAN_DIRS:
        root = os.path.join(REPO_ROOT, d)
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [dn for dn in dirnames if dn not in EXCLUDE_DIR_PARTS]
            for fn in filenames:
                if fn.endswith((".ts", ".tsx")):
                    p = os.path.join(dirpath, fn)
                    if not is_excluded(p):
                        yield p


def load_baseline():
    out = set()
    if os.path.exists(BASELINE):
        with open(BASELINE) as f:
            for line in f:
                line = line.split("#", 1)[0].strip()
                if line:
                    out.add(line)
    return out


def main():
    if not os.path.exists(SNAPSHOT):
        print(f"❌ DB objects snapshot missing: {SNAPSHOT}", file=sys.stderr)
        return 2
    snap = json.load(open(SNAPSHOT))
    tables = set(snap.get("tables") or [])
    functions = set(snap.get("functions") or [])
    if not tables or not functions:
        print("❌ Snapshot missing tables/functions — regenerate it.", file=sys.stderr)
        return 2

    # key -> first "rel:line" seen (for reporting); dedup by key (object name).
    all_drift = {}
    for path in iter_code_files():
        rel = os.path.relpath(path, REPO_ROOT)
        with open(path, encoding="utf-8", errors="ignore") as f:
            src = f.read()
        for m in RE_FROM.finditer(src):
            name = m.group(1)
            if name not in tables:
                all_drift.setdefault(f"table::{name}", (rel, src.count("\n", 0, m.start()) + 1))
        for m in RE_RPC.finditer(src):
            name = m.group(1)
            if name not in functions:
                all_drift.setdefault(f"rpc::{name}", (rel, src.count("\n", 0, m.start()) + 1))
        # PostgREST embeds inside .select(...) strings → table references.
        for sel in RE_SELECT.finditer(src):
            base = sel.start(2)
            for em in RE_EMBED.finditer(sel.group(2)):
                name = em.group("table")
                # PostgREST also embeds via the FK *column* (`alias:origin_unit_id(...)`),
                # where the token before `(` is a column, not a table. Those FK columns end
                # in `_id`/`_by`/`_to`; real table/view embeds (`patients`, `code_icd`) don't.
                if name in EMBED_SKIP or name in tables or name.endswith(("_id", "_by", "_to")):
                    continue
                line = src.count("\n", 0, base + em.start("table")) + 1
                all_drift.setdefault(f"table::{name}", (rel, line))

    if "--write-baseline" in sys.argv:
        with open(BASELINE, "w") as f:
            f.write(
                "# DB-reference drift baseline — KNOWN pre-existing references to tables/functions\n"
                "# that do not exist in the live DB. One key per line: table::<name> | rpc::<name>.\n"
                "# Regenerate: python3 scripts/check-db-reference-drift.py --write-baseline\n"
                "# Each entry is real drift to triage (legacy/renamed object, dead code, or a bug).\n"
                "# Baselining only stops NEW drift from landing on top of the known set.\n"
            )
            for key in sorted(all_drift):
                f.write(key + "\n")
        print(f"Wrote {len(all_drift)} baseline entries to {BASELINE}")
        return 0

    baseline = load_baseline()
    new = sorted((k, v) for k, v in all_drift.items() if k not in baseline)
    if new:
        print("❌ NEW DB-reference drift (table/function not in the live DB, CLAUDE.md #18):\n")
        for key, (rel, line) in new:
            kind, name = key.split("::", 1)
            print(f"   {rel}:{line}  {kind} '{name}' does not exist in the live DB")
        print(
            "\nFix the reference (correct name / create via migration), or — if the snapshot is\n"
            "stale after a migration — refresh it with scripts/refresh-db-objects-snapshot.sql.\n"
            "Only add to scripts/db-reference-drift-baseline.txt for a KNOWN pre-existing gap."
        )
        return 1

    baselined_hits = sum(1 for k in all_drift if k in baseline)
    print(
        f"✅ DB-reference gate: all .from()/.rpc()/embed targets exist live "
        f"({baselined_hits} baselined pre-existing refs skipped)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
