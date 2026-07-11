/**
 * PHI-safe redaction for AI-assist prompts.
 *
 * The migration engine ingests heterogeneous healthcare data, so raw column
 * sample values routinely contain PHI (names, DOB, MRN, SSN). Those must NEVER
 * be sent to the LLM. This masks each value to its CHARACTER-CLASS TEMPLATE,
 * which preserves the format signal the column mapper actually needs (is it
 * `9999-99-99`? a 5-letter code? an email?) while removing the identifying
 * content.
 *
 *   "John Smith"        -> "Xxxx Xxxxx"
 *   "1950-01-15"        -> "9999-99-99"
 *   "MRN001"            -> "XXX999"
 *   "jane@example.com"  -> "xxxx@xxxxxxx.xxx"
 *
 * Character classes (Unicode-aware, so accented/CJK names are masked too):
 *   uppercase letter -> X   |   any other letter -> x   |   decimal digit -> 9
 * Structural characters (`-`, `/`, `:`, `@`, `.`, space, `_`, …) are preserved
 * because the punctuation layout is exactly the non-PHI shape signal we want.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

/** Mask a single value to its PHI-free character-class template. */
export function redactSampleValue(value: string): string {
  return String(value ?? '')
    .replace(/\p{Lu}/gu, 'X')
    .replace(/[\p{Ll}\p{Lo}\p{Lt}\p{Lm}]/gu, 'x')
    .replace(/\p{Nd}/gu, '9');
}

/**
 * Mask a list of sample values, capping how many are exposed (defence in depth:
 * fewer templates = less shape leakage, and the mapper only needs a few).
 */
export function redactSampleValues(values: readonly string[], limit = 3): string[] {
  return values.slice(0, limit).map(redactSampleValue);
}
