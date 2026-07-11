/**
 * Tests for enterpriseMigrationHelpers — pure grade/CSV helpers + the status
 * badge. Behavior tests (Deletion Test): each fails if the mapping logic is
 * removed. Real EABadge is rendered (no mocks).
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { getGrade, getGradeColor, getStatusBadge, parseCSV } from '../enterpriseMigrationHelpers';

describe('getGrade', () => {
  it('maps each score band to the right letter grade', () => {
    expect(getGrade(96)).toBe('A+');
    expect(getGrade(90)).toBe('A');
    expect(getGrade(85)).toBe('B+');
    expect(getGrade(80)).toBe('B');
    expect(getGrade(75)).toBe('C+');
    expect(getGrade(70)).toBe('C');
    expect(getGrade(60)).toBe('D');
    expect(getGrade(59)).toBe('F');
  });
});

describe('getGradeColor', () => {
  it('colors by grade family', () => {
    expect(getGradeColor('A+')).toContain('green');
    expect(getGradeColor('B')).toContain('blue');
    expect(getGradeColor('C+')).toContain('yellow');
    expect(getGradeColor('F')).toContain('red');
  });
});

describe('parseCSV', () => {
  it('parses headers + rows and strips surrounding quotes', () => {
    const rows = parseCSV('"first","last"\nJohn,Doe\nJane,Smith');
    expect(rows).toEqual([
      { first: 'John', last: 'Doe' },
      { first: 'Jane', last: 'Smith' },
    ]);
  });

  it('returns [] when there is only a header or the input is empty', () => {
    expect(parseCSV('only_header')).toEqual([]);
    expect(parseCSV('')).toEqual([]);
  });

  it('fills a missing trailing value with null', () => {
    const rows = parseCSV('a,b,c\n1,2');
    expect(rows[0]).toEqual({ a: '1', b: '2', c: null });
  });
});

describe('getStatusBadge', () => {
  it('renders the raw status text', () => {
    const { getByText } = render(<>{getStatusBadge('COMPLETED')}</>);
    expect(getByText('COMPLETED')).toBeInTheDocument();
  });

  it('maps COMPLETED -> normal (green) and FAILED -> critical (red)', () => {
    const completed = render(<>{getStatusBadge('COMPLETED')}</>);
    expect(completed.getByText('COMPLETED').className).toContain('green');

    const failed = render(<>{getStatusBadge('FAILED')}</>);
    expect(failed.getByText('FAILED').className).toContain('red');
  });

  it('defaults an unknown status to the info variant', () => {
    const { getByText } = render(<>{getStatusBadge('WEIRD_STATUS')}</>);
    // info variant uses the EA primary token, not a severity color.
    expect(getByText('WEIRD_STATUS').className).toContain('ea-primary');
  });
});
