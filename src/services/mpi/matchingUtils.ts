/**
 * MPI Matching — string-similarity utilities + scoring constants
 *
 * Extracted from mpiMatchingService.ts (CLAUDE.md Commandment #12). Behavior unchanged.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_MATCH_THRESHOLD = 75.0;
export const AUTO_MERGE_THRESHOLD = 98.0;
export const MATCH_ALGORITHM_VERSION = 'v1.0-jaro-soundex';
export const DEFAULT_FIELD_WEIGHTS: Record<string, number> = {
  first_name: 15,
  last_name: 20,
  date_of_birth: 25,
  ssn_last_four: 15,
  phone: 10,
  address: 10,
  mrn: 5,
};

// =============================================================================
// JARO-WINKLER IMPLEMENTATION (Client-side matching)
// =============================================================================

/**
 * Calculate Jaro similarity between two strings
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;

  const str1 = s1.toUpperCase().trim();
  const str2 = s2.toUpperCase().trim();

  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || str1[i] !== str2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
}

/**
 * Calculate Jaro-Winkler similarity (enhanced with prefix bonus)
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;

  const jaro = jaroSimilarity(s1, s2);

  // Calculate common prefix (up to 4 characters)
  const str1 = s1.toUpperCase().trim();
  const str2 = s2.toUpperCase().trim();
  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(str1.length, str2.length));

  for (let i = 0; i < maxPrefix; i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  // Apply Winkler modification
  return jaro + prefixLength * 0.1 * (1 - jaro);
}

/**
 * Generate Soundex encoding for phonetic matching
 */
export function soundex(input: string): string | null {
  if (!input || input.trim().length === 0) return null;

  const cleaned = input.toUpperCase().replace(/[^A-Z]/g, '');
  if (cleaned.length === 0) return null;

  const firstChar = cleaned[0];
  let result = firstChar;
  let prevCode = '';

  const getCode = (char: string): string => {
    if ('BFPV'.includes(char)) return '1';
    if ('CGJKQSXZ'.includes(char)) return '2';
    if ('DT'.includes(char)) return '3';
    if (char === 'L') return '4';
    if ('MN'.includes(char)) return '5';
    if (char === 'R') return '6';
    return '';
  };

  for (let i = 1; i < cleaned.length && result.length < 4; i++) {
    const code = getCode(cleaned[i]);
    if (code && code !== prevCode) {
      result += code;
    }
    prevCode = code;
  }

  return result.padEnd(4, '0');
}

/**
 * Normalize name for matching (lowercase, remove diacritics, trim)
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;

  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Remove diacritics
    .replace(/[^a-z ]/g, '') // Remove non-alpha
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Normalize phone number (digits only)
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[^0-9]/g, '');
}
