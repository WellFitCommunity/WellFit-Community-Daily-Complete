#!/usr/bin/env node
/**
 * stamp-doc-frontmatter.mjs — Add lightweight freshness frontmatter to docs.
 *
 * Purpose: Clinical & compliance docs carry no "is this still true?" signal.
 * This stamps each with:
 *   owner          — responsible role (Clinical | Compliance), derived from path
 *   last_updated   — the file's last git-commit date (FACTUAL, not a review claim)
 *   review_status  — defaults to "needs-review"; a human flips this to
 *                    "reviewed" (and bumps a reviewed_on date) when they sign off
 *
 * It is INTENTIONALLY honest: last_updated is git history, never a fabricated
 * "verified" date. review_status starts pessimistic so staleness is visible.
 *
 * Idempotent: skips any file that already opens with a `---` frontmatter block,
 * and skips directory index files (README.md).
 *
 * This is a dev/ops CLI tool — stdout/stderr are its output contract
 * (see .claude/rules/python.md §6; the auditLogger rule governs src/ runtime code).
 *
 * Usage:
 *   node scripts/stamp-doc-frontmatter.mjs            # apply
 *   node scripts/stamp-doc-frontmatter.mjs --check    # CI: exit 1 if any unstamped
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const out = (m) => process.stdout.write(`${m}\n`);
const errOut = (m) => process.stderr.write(`${m}\n`);

// Directories whose docs get a freshness stamp, with the owner role for each.
const TARGETS = [
  { dir: 'docs/clinical', owner: 'Clinical' },
  { dir: 'docs/compliance', owner: 'Compliance' },
];

const CHECK = process.argv.includes('--check');

/** Recursively collect *.md files under a directory (skips README.md indexes). */
function collectMarkdown(dir) {
  const collected = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collected.push(...collectMarkdown(full));
    } else if (entry.endsWith('.md') && basename(entry) !== 'README.md') {
      collected.push(full);
    }
  }
  return collected;
}

/** Last git-commit date for a file (YYYY-MM-DD), or null if untracked. */
function lastCommitDate(file) {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
      encoding: 'utf8',
    }).trim();
    return date || null;
  } catch {
    return null;
  }
}

function hasFrontmatter(text) {
  return text.startsWith('---\n') || text.startsWith('---\r\n');
}

let stamped = 0;
let skipped = 0;
const unstamped = [];

for (const { dir, owner } of TARGETS) {
  let files;
  try {
    files = collectMarkdown(dir);
  } catch {
    errOut(`⚠️  Missing directory: ${dir}`);
    continue;
  }

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (hasFrontmatter(text)) {
      skipped++;
      continue;
    }

    if (CHECK) {
      unstamped.push(file);
      continue;
    }

    const updated = lastCommitDate(file) ?? 'unknown';
    const frontmatter =
      `---\n` +
      `owner: ${owner}\n` +
      `last_updated: ${updated}\n` +
      `review_status: needs-review\n` +
      `---\n\n`;

    writeFileSync(file, frontmatter + text);
    out(`✓ stamped ${file} (owner: ${owner}, last_updated: ${updated})`);
    stamped++;
  }
}

if (CHECK) {
  if (unstamped.length) {
    errOut(`❌ ${unstamped.length} doc(s) missing frontmatter:`);
    unstamped.forEach((f) => errOut(`   - ${f}`));
    process.exit(1);
  }
  out('✅ All clinical & compliance docs carry freshness frontmatter.');
} else {
  out(`\nDone: ${stamped} stamped, ${skipped} already had frontmatter.`);
}
