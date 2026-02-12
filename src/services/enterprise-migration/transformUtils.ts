/**
 * Enterprise Migration Engine — Transform & Validation Utilities
 *
 * Pure functions for value transformation, date parsing,
 * state code conversion, and enterprise validation rules.
 */

import { PatternDetectorStatic } from '../migration-engine';

/** State name to two-letter code lookup */
const STATE_CODES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

/** Date format patterns for parsing */
const DATE_FORMATS = [
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  /^(\d{4})-(\d{2})-(\d{2})$/
];

/** Columns that require date format validation */
const DATE_COLUMNS = [
  'hire_date', 'termination_date', 'expiration_date', 'date_of_birth', 'issued_date'
];

/** Required columns that cannot be null */
const REQUIRED_COLUMNS = ['first_name', 'last_name', 'organization_id'];

/** Parse date to ISO format */
export function parseDateEnterprise(value: string): string | null {
  try {
    for (const format of DATE_FORMATS) {
      const match = value.match(format);
      if (match) {
        if (format === DATE_FORMATS[2]) {
          return `${match[1]}-${match[2]}-${match[3]}`;
        } else {
          const month = match[1].padStart(2, '0');
          const day = match[2].padStart(2, '0');
          const year = match[3];
          return `${year}-${month}-${day}`;
        }
      }
    }

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return null;
  } catch {
    return null;
  }
}

/** Convert state name to two-letter code */
export function stateToCodeEnterprise(state: string): string {
  const lower = state.toLowerCase();
  if (STATE_CODES[lower]) return STATE_CODES[lower];
  if (state.length === 2) return state.toUpperCase();
  return state;
}

/** Transform value with tracking */
export function transformValueWithTracking(value: unknown, transform?: string): unknown {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const strValue = String(value).trim();

  switch (transform) {
    case 'NORMALIZE_PHONE':
      return strValue.replace(/\D/g, '').slice(-10);

    case 'CONVERT_DATE_TO_ISO':
      return parseDateEnterprise(strValue);

    case 'PARSE_NAME_FIRST':
      if (strValue.includes(',')) {
        return strValue.split(',')[1]?.trim();
      }
      return strValue.split(' ')[0];

    case 'PARSE_NAME_LAST':
      if (strValue.includes(',')) {
        return strValue.split(',')[0]?.trim();
      }
      const parts = strValue.split(' ');
      return parts[parts.length - 1];

    case 'CONVERT_STATE_TO_CODE':
      return stateToCodeEnterprise(strValue);

    case 'UPPERCASE':
      return strValue.toUpperCase();

    case 'LOWERCASE':
      return strValue.toLowerCase();

    case 'TRIM':
      return strValue.trim();

    default:
      return strValue;
  }
}

/** Validate value with enterprise rules */
export function validateValueEnterprise(
  value: unknown,
  column: string,
  _table: string
): { valid: boolean; error?: string } {
  if (value === null) {
    if (REQUIRED_COLUMNS.includes(column)) {
      return { valid: false, error: `${column} is required` };
    }
    return { valid: true };
  }

  const strValue = String(value);

  // NPI validation with Luhn
  if (column === 'npi' && strValue) {
    if (!PatternDetectorStatic.validateNPI(strValue)) {
      return { valid: false, error: 'Invalid NPI (failed Luhn check)' };
    }
  }

  // Email validation
  if (column === 'email' && strValue) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)) {
      return { valid: false, error: 'Invalid email format' };
    }
  }

  // State code validation
  if (column === 'state' && strValue) {
    if (!/^[A-Z]{2}$/.test(strValue)) {
      return { valid: false, error: 'State must be 2-letter code' };
    }
  }

  // Date validation
  if (DATE_COLUMNS.includes(column)) {
    if (strValue && !/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
      return { valid: false, error: 'Date must be YYYY-MM-DD format' };
    }
  }

  return { valid: true };
}
