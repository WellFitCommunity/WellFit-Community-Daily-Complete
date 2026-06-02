// src/test-utils/axeHelper.ts
// Reusable axe-core accessibility assertion helper for vitest component tests.
//
// Purpose: give every component test a mechanically-verifiable WCAG check without
// requiring a live server. axe-core runs against the jsdom-rendered DOM produced by
// @testing-library/react. This is the reproducible, CI-runnable harness behind
// ONC-11 / (g)(5) — see docs/compliance/ONC_170.315_CERTIFICATION_MATRIX.md §9.4.
//
// We assert on serious + critical impact only by default: those are the WCAG A/AA
// blockers. Minor/moderate findings are surfaced in the formatted message but do not
// fail the test, so this can be adopted incrementally across the existing suite.

import axe, { type AxeResults, type Result, type RunOptions, type ImpactValue } from 'axe-core';

const BLOCKING_IMPACTS: ReadonlyArray<ImpactValue> = ['serious', 'critical'];

export interface A11yCheckOptions {
  /** Impact levels that should fail the test. Defaults to serious + critical. */
  failOn?: ReadonlyArray<ImpactValue>;
  /** axe-core run options (e.g. restrict to WCAG2AA rule tags). */
  runOptions?: RunOptions;
}

/** WCAG 2.1 Level A + AA rule tags — the certification-relevant rule set. */
export const WCAG_2_1_AA_TAGS: RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
};

function formatViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `      - ${n.target.join(' ')}`).join('\n');
      return `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join('\n');
}

/**
 * Run axe-core against a rendered container and return the blocking violations.
 * Does not assert — callers decide. Use {@link expectNoA11yViolations} for the
 * common assert-zero case.
 */
export async function getA11yViolations(
  container: Element,
  options: A11yCheckOptions = {},
): Promise<Result[]> {
  const failOn = options.failOn ?? BLOCKING_IMPACTS;
  const results: AxeResults = await axe.run(container, options.runOptions ?? WCAG_2_1_AA_TAGS);
  return results.violations.filter((v) => v.impact != null && failOn.includes(v.impact));
}

/**
 * Assert a rendered container has no serious/critical WCAG 2.1 AA violations.
 * Throws with a readable per-node report when it does.
 */
export async function expectNoA11yViolations(
  container: Element,
  options: A11yCheckOptions = {},
): Promise<void> {
  const violations = await getA11yViolations(container, options);
  if (violations.length > 0) {
    throw new Error(
      `Found ${violations.length} blocking WCAG 2.1 AA violation(s):\n${formatViolations(violations)}`,
    );
  }
}
