#!/usr/bin/env python3
"""
Orphan-code detector.

Scans `src/` and `supabase/functions/` for .ts/.tsx files that are
exported-from but imported-by-nothing. Excludes entry points (index.ts,
main.tsx, App.tsx, *.test.ts, .d.ts, .generated.*).

Conservative by design — false positives are tolerated (a real import
hidden behind a tsconfig path alias or a string-template dynamic import
will look like an orphan). Always grep + read the candidate before
proposing deletion.

Usage:
    python3 scripts/find-orphan-code.py [--src|--functions|--all]
"""
from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

SCAN_DIRS = {
    "src": "src",
    "functions": "supabase/functions",
}

# Patterns that mark a file as an entry point (never an orphan).
ENTRY_PATTERNS = [
    re.compile(r"/index\.tsx?$"),  # barrel / function entry
    re.compile(r"/main\.tsx?$"),  # Vite entry
    re.compile(r"/App\.tsx?$"),  # React root
    re.compile(r"/__tests__/"),
    re.compile(r"\.test\.tsx?$"),
    re.compile(r"\.spec\.tsx?$"),
    re.compile(r"\.d\.ts$"),
    re.compile(r"\.generated\."),
    re.compile(r"/setupTests\.ts$"),  # referenced in vite.config.ts setupFiles
    re.compile(r"/vite\.config\.ts$"),
    re.compile(r"/vitest\.config\.ts$"),
]

# Capture: from '...', import '...', import('...'), export ... from '...'
IMPORT_RE = re.compile(
    r"""(?:from|import)\s*\(?\s*['"]([^'"]+)['"]"""
)


def is_entry(path: Path) -> bool:
    s = str(path)
    return any(p.search(s) for p in ENTRY_PATTERNS)


# Files containing this marker are intentionally NOT-YET-IMPORTED scaffolding
# for a planned feature (e.g., EnvisionAuthContext for the standalone Envision
# portal). They should be treated as future-use code, not dead code.
ORPHAN_KEEP_RE = re.compile(r"orphan-keep\s*:", re.IGNORECASE)


def has_orphan_keep_marker(path: Path) -> bool:
    """Check if file contains an `// orphan-keep: <reason>` marker."""
    try:
        # Only need to scan the head of the file — markers always live near
        # the top in the leading docblock or in a one-line comment.
        text = path.read_text()[:4096]
    except (OSError, UnicodeDecodeError):
        return False
    return bool(ORPHAN_KEEP_RE.search(text))


def collect_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for dirpath, _, files in os.walk(root):
        # skip node_modules and build artifacts
        if "/node_modules" in dirpath or "/dist/" in dirpath or "/build/" in dirpath:
            continue
        for f in files:
            if f.endswith((".ts", ".tsx")):
                out.append(Path(dirpath) / f)
    return out


def resolve_import(spec: str, importing_file: Path) -> set[Path]:
    """
    Resolve an import specifier to one or more candidate file paths.
    Returns absolute paths (resolved). Handles three forms:
      1. relative: `./foo`, `../foo` → resolved against importing file's dir
      2. baseUrl-rooted (tsconfig "baseUrl": "src"): `utils/foo` → `src/utils/foo`
      3. `@/foo` alias (only used in comments in this codebase but harmless)
         → `src/foo`
    External/URL/npm specifiers return empty set.
    """
    # Skip URL imports, jsr:, npm:, http(s):
    if spec.startswith(("http", "jsr:", "npm:", "data:")):
        return set()
    # Strip query/fragment (e.g. `?worker`, `?raw`, `?target=deno`)
    spec = spec.split("?", 1)[0].split("#", 1)[0]

    candidates: set[Path] = set()

    def _add_variants(root: Path, sub: str) -> None:
        # foo, foo.ts, foo.tsx, foo/index.ts, foo/index.tsx
        for suffix in ("", ".ts", ".tsx"):
            candidates.add((root / (sub + suffix)).resolve())
        for index in ("index.ts", "index.tsx"):
            candidates.add((root / sub / index).resolve())

    if spec.startswith("."):
        _add_variants(importing_file.parent, spec)
    elif spec.startswith("@/"):
        # @/foo → src/foo
        _add_variants(REPO / "src", spec[2:])
    elif "/" in spec and not spec.startswith("@"):
        # baseUrl-rooted: `utils/foo` → `src/utils/foo` (only meaningful
        # for our src/ tree, since edge functions don't use baseUrl).
        # Could also be a bare npm package — those are filtered later by
        # checking whether resolved path is inside the repo.
        _add_variants(REPO / "src", spec)
    return candidates


def strict_basename_search(orphan: Path, all_files: list[Path]) -> list[Path]:
    """
    Belt-and-suspenders verification: grep every file for an actual import
    of the candidate's basename. Catches imports that use exotic resolution
    we didn't model (deep tsconfig paths, wildcard re-exports, etc).
    """
    name = orphan.stem  # 'foo' for 'foo.ts'
    pattern = re.compile(
        rf"""(?:from|import)\s*\(?\s*['"][^'"]*/?{re.escape(name)}['"]"""
    )
    hits: list[Path] = []
    for f in all_files:
        if f == orphan:
            continue
        try:
            text = f.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        if pattern.search(text):
            hits.append(f)
    return hits


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "scope",
        nargs="?",
        choices=["src", "functions", "all"],
        default="all",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Run a second-pass strict basename search to filter false positives.",
    )
    args = parser.parse_args()

    scopes = (
        list(SCAN_DIRS.values())
        if args.scope == "all"
        else [SCAN_DIRS[args.scope]]
    )

    all_files: list[Path] = []
    for s in scopes:
        all_files.extend(collect_files(REPO / s))

    # Walk every file and collect every import path it expresses.
    imported: set[Path] = set()
    for f in all_files:
        try:
            text = f.read_text()
        except (OSError, UnicodeDecodeError):
            continue
        for m in IMPORT_RE.finditer(text):
            for resolved in resolve_import(m.group(1), f):
                imported.add(resolved)

    orphans: list[Path] = []
    kept: list[Path] = []
    for f in all_files:
        if is_entry(f):
            continue
        # Compare resolved absolute paths so symlinks/case differences match.
        if f.resolve() not in imported:
            if has_orphan_keep_marker(f):
                kept.append(f)
            else:
                orphans.append(f)

    orphans.sort()

    if args.strict:
        # Second pass: re-verify each candidate with a basename grep across
        # every source file. Splits into HIGH-CONFIDENCE (truly zero refs)
        # vs LOW-CONFIDENCE (some import-shape line matched the basename).
        confirmed: list[Path] = []
        suspect: list[tuple[Path, list[Path]]] = []
        # Also scan vite/vitest config files for setup-file references.
        config_files = [
            REPO / "vite.config.ts",
            REPO / "vitest.config.ts",
            REPO / "vitest.config.mts",
        ]
        scan_set = all_files + [c for c in config_files if c.exists()]
        for o in orphans:
            hits = strict_basename_search(o, scan_set)
            if hits:
                suspect.append((o, hits))
            else:
                confirmed.append(o)

        print(f"\n## HIGH-CONFIDENCE orphans ({len(confirmed)})")
        print("  (zero import-shape references to the basename anywhere)")
        for o in confirmed:
            print(f"  {o.relative_to(REPO)}")

        print(f"\n## LOW-CONFIDENCE — needs manual review ({len(suspect)})")
        print("  (resolver missed an import, OR basename collides with a")
        print("   different file's import path. Inspect each before deciding.)")
        for o, hits in suspect:
            print(f"  {o.relative_to(REPO)}")
            for h in hits[:2]:
                print(f"      hit: {h.relative_to(REPO)}")

        print(f"\n{'=' * 60}")
        print(f"Total candidates:      {len(orphans)}")
        print(f"HIGH-confidence:       {len(confirmed)}")
        print(f"LOW-confidence:        {len(suspect)}")
        if kept:
            print(f"Allow-listed (kept):   {len(kept)} (have // orphan-keep: marker)")
            for k in kept:
                print(f"    {k.relative_to(REPO)}")
    else:
        by_dir: dict[str, list[Path]] = {}
        for o in orphans:
            rel = o.relative_to(REPO)
            top = rel.parts[0] if rel.parts else "?"
            if top == "supabase":
                top = "supabase/functions"
            by_dir.setdefault(top, []).append(rel)

        for top in sorted(by_dir):
            print(f"\n## {top} ({len(by_dir[top])} candidates)")
            for rel in by_dir[top]:
                print(f"  {rel}")
        print(f"\n{'=' * 60}")
        print(f"Total orphan candidates: {len(orphans)}")
        if kept:
            print(f"Allow-listed (skipped):  {len(kept)} (have // orphan-keep: marker)")
    print(f"Scanned: {len(all_files)} .ts/.tsx files")
    print()
    print("Reminder: these are CANDIDATES. Verify each manually before")
    print("deleting — tsconfig path aliases, dynamic string-template")
    print("imports, and tooling references will look like orphans here.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
