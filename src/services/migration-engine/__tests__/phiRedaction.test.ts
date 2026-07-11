/**
 * Tests for phiRedaction — PHI-safe masking of sample values before they reach
 * the LLM. Behavior tests (Deletion Test): each fails if masking is removed or
 * weakened, not merely on an import error.
 */

import { describe, it, expect } from 'vitest';
import { redactSampleValue, redactSampleValues } from '../phiRedaction';

describe('redactSampleValue — character-class masking', () => {
  it('masks a name to its case-preserving letter template', () => {
    expect(redactSampleValue('John Smith')).toBe('Xxxx Xxxxx');
  });

  it('masks a date of birth, preserving the delimiter shape', () => {
    expect(redactSampleValue('1950-01-15')).toBe('9999-99-99');
  });

  it('masks an MRN (mixed letters + digits)', () => {
    expect(redactSampleValue('MRN001')).toBe('XXX999');
  });

  it('masks an SSN', () => {
    expect(redactSampleValue('123-45-6789')).toBe('999-99-9999');
  });

  it('masks an email, keeping @ and . structure', () => {
    expect(redactSampleValue('jane@example.com')).toBe('xxxx@xxxxxxx.xxx');
  });

  it('masks accented (non-ASCII) letters too — no PHI leaks through Unicode', () => {
    // "José" — the é must not survive as itself.
    expect(redactSampleValue('José')).toBe('Xxxx');
    expect(redactSampleValue('José')).not.toContain('é');
  });

  it('reduces every alphanumeric char to only X, x, or 9', () => {
    const out = redactSampleValue('Patient Zero 1988');
    for (const ch of out) {
      if (/[A-Za-z0-9]/.test(ch)) {
        expect('Xx9').toContain(ch);
      }
    }
    expect(out).toBe('Xxxxxxx Xxxx 9999');
  });
});

describe('redactSampleValue — no raw content survives', () => {
  it('never returns the original value for PHI-bearing strings', () => {
    for (const phi of ['John Smith', '1950-01-15', '123-45-6789', 'MRN12345', 'jane@x.com']) {
      expect(redactSampleValue(phi)).not.toBe(phi);
    }
  });

  it('output digits are all 9 (no original numbers survive)', () => {
    const out = redactSampleValue('DOB 1950-01-15');
    const digits = out.match(/[0-9]/g) ?? [];
    expect(digits.every((d) => d === '9')).toBe(true);
    expect(out).not.toContain('1950');
  });

  it('handles empty / whitespace input safely', () => {
    expect(redactSampleValue('')).toBe('');
    expect(redactSampleValue('   ')).toBe('   ');
  });
});

describe('redactSampleValues — list + cap', () => {
  it('masks every value and caps to the limit (defence in depth)', () => {
    const values = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve'];
    const out = redactSampleValues(values, 3);
    expect(out).toHaveLength(3);
    expect(out).toEqual(['Xxxxx', 'Xxx', 'Xxxxx']);
    // None of the originals survive.
    for (const name of values) {
      expect(out).not.toContain(name);
    }
  });

  it('defaults the cap to 3', () => {
    expect(redactSampleValues(['a', 'b', 'c', 'd', 'e'])).toHaveLength(3);
  });
});
