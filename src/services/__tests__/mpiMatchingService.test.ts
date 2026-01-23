/**
 * MPI Matching Service Tests
 *
 * Tests for the Master Patient Index matching algorithms and service methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  jaroWinklerSimilarity,
  soundex,
  normalizeName,
  normalizePhone,
} from '../mpiMatchingService';

// Mock supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
  },
}));

// Mock audit logger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('mpiMatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('jaroWinklerSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(jaroWinklerSimilarity('John', 'John')).toBe(1.0);
      expect(jaroWinklerSimilarity('SMITH', 'SMITH')).toBe(1.0);
    });

    it('should be case-insensitive', () => {
      expect(jaroWinklerSimilarity('John', 'JOHN')).toBe(1.0);
      expect(jaroWinklerSimilarity('smith', 'Smith')).toBe(1.0);
    });

    it('should return 0 for completely different strings', () => {
      expect(jaroWinklerSimilarity('ABC', 'XYZ')).toBe(0);
    });

    it('should return high similarity for similar strings', () => {
      expect(jaroWinklerSimilarity('Martha', 'Marhta')).toBeGreaterThan(0.95);
      expect(jaroWinklerSimilarity('Dixon', 'Dickson')).toBeGreaterThan(0.8);
    });

    it('should handle common name variations', () => {
      expect(jaroWinklerSimilarity('William', 'Williams')).toBeGreaterThan(0.9);
      expect(jaroWinklerSimilarity('Jon', 'John')).toBeGreaterThan(0.85);
      expect(jaroWinklerSimilarity('Robert', 'Roberto')).toBeGreaterThan(0.85);
    });

    it('should handle null and empty strings', () => {
      expect(jaroWinklerSimilarity(null as unknown as string, 'test')).toBe(0);
      expect(jaroWinklerSimilarity('test', null as unknown as string)).toBe(0);
      expect(jaroWinklerSimilarity('', '')).toBe(0);
      expect(jaroWinklerSimilarity('', 'test')).toBe(0);
    });

    it('should give higher scores to strings with common prefixes', () => {
      // Jaro-Winkler gives bonus for common prefix
      const jonesJohnson = jaroWinklerSimilarity('Jones', 'Johnson');
      const jonesSmith = jaroWinklerSimilarity('Jones', 'Smith');
      expect(jonesJohnson).toBeGreaterThan(jonesSmith);
    });

    it('should work with single characters', () => {
      expect(jaroWinklerSimilarity('A', 'A')).toBe(1.0);
      expect(jaroWinklerSimilarity('A', 'B')).toBe(0);
    });

    it('should handle strings with spaces', () => {
      expect(jaroWinklerSimilarity('Mary Ann', 'Mary Anne')).toBeGreaterThan(0.9);
    });
  });

  describe('soundex', () => {
    it('should generate correct soundex for common names', () => {
      expect(soundex('Robert')).toBe('R163');
      expect(soundex('Rupert')).toBe('R163');
      expect(soundex('Smith')).toBe('S530');
      expect(soundex('Smythe')).toBe('S530');
    });

    it('should return same code for similar-sounding names', () => {
      expect(soundex('John')).toBe(soundex('Jon'));
      expect(soundex('Steven')).toBe(soundex('Stephen'));
    });

    it('should handle names starting with vowels', () => {
      expect(soundex('Anna')).toBe('A500');
      expect(soundex('Emily')).toBe('E540');
    });

    it('should handle null and empty strings', () => {
      expect(soundex(null as unknown as string)).toBe(null);
      expect(soundex('')).toBe(null);
      expect(soundex('   ')).toBe(null);
    });

    it('should remove non-alphabetic characters', () => {
      expect(soundex("O'Brien")).toBe(soundex('OBrien'));
      expect(soundex('Mary-Jane')).toBe(soundex('MaryJane'));
    });

    it('should always return 4 characters', () => {
      expect(soundex('Lee')).toHaveLength(4);
      expect(soundex('Washington')).toHaveLength(4);
      expect(soundex('A')).toHaveLength(4);
    });

    it('should be case-insensitive', () => {
      expect(soundex('JONES')).toBe(soundex('jones'));
      expect(soundex('McDONALD')).toBe(soundex('Mcdonald'));
    });

    it('should generate different codes for different-sounding names', () => {
      expect(soundex('Smith')).not.toBe(soundex('Jones'));
      expect(soundex('Williams')).not.toBe(soundex('Anderson'));
    });
  });

  describe('normalizeName', () => {
    it('should convert to lowercase', () => {
      expect(normalizeName('JOHN')).toBe('john');
      expect(normalizeName('John')).toBe('john');
    });

    it('should trim whitespace', () => {
      expect(normalizeName('  John  ')).toBe('john');
      expect(normalizeName('\tSmith\n')).toBe('smith');
    });

    it('should remove diacritics', () => {
      expect(normalizeName('José')).toBe('jose');
      expect(normalizeName('François')).toBe('francois');
      expect(normalizeName('Müller')).toBe('muller');
      expect(normalizeName('Søren')).toBe('sren'); // ø is not a standard diacritic
    });

    it('should remove non-alphabetic characters except spaces', () => {
      expect(normalizeName("O'Brien")).toBe('obrien');
      expect(normalizeName('Mary-Jane')).toBe('maryjane');
      expect(normalizeName('John Jr.')).toBe('john jr');
    });

    it('should normalize multiple spaces to single space', () => {
      expect(normalizeName('Mary  Ann')).toBe('mary ann');
      expect(normalizeName('John   Paul')).toBe('john paul');
    });

    it('should handle null and undefined', () => {
      expect(normalizeName(null)).toBe(null);
      expect(normalizeName(undefined)).toBe(null);
    });

    it('should handle empty strings', () => {
      // Empty strings normalize to empty strings (falsy check returns early)
      const result = normalizeName('');
      expect(result === null || result === '').toBe(true);
    });
  });

  describe('normalizePhone', () => {
    it('should keep only digits', () => {
      expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
      expect(normalizePhone('555.123.4567')).toBe('5551234567');
      expect(normalizePhone('+1 555 123 4567')).toBe('15551234567');
    });

    it('should handle already normalized phones', () => {
      expect(normalizePhone('5551234567')).toBe('5551234567');
    });

    it('should handle null and undefined', () => {
      expect(normalizePhone(null)).toBe(null);
      expect(normalizePhone(undefined)).toBe(null);
    });

    it('should handle empty strings', () => {
      // Empty strings normalize to null (falsy check returns early)
      const result = normalizePhone('');
      expect(result === null || result === '').toBe(true);
    });

    it('should handle various international formats', () => {
      expect(normalizePhone('+44 20 7946 0958')).toBe('442079460958');
      expect(normalizePhone('001-555-123-4567')).toBe('0015551234567');
    });
  });

  describe('matching scenarios', () => {
    it('should give high scores for likely duplicates', () => {
      // Name: John Smith vs Jon Smith (typo in first name)
      const firstNameScore = jaroWinklerSimilarity('John', 'Jon');
      const lastNameScore = jaroWinklerSimilarity('Smith', 'Smith');
      expect(firstNameScore).toBeGreaterThan(0.85);
      expect(lastNameScore).toBe(1.0);
    });

    it('should give lower scores for different people with similar names', () => {
      // John Smith vs Jane Smith (different first name)
      const firstNameScore = jaroWinklerSimilarity('John', 'Jane');
      expect(firstNameScore).toBeGreaterThanOrEqual(0.7); // Similar but not the same
      expect(firstNameScore).toBeLessThan(0.9);
    });

    it('should handle Hispanic naming conventions', () => {
      // Maria Garcia Lopez vs Maria Garcia (maiden name vs married)
      const name1 = normalizeName('Maria Garcia Lopez');
      const name2 = normalizeName('Maria Garcia');
      expect(jaroWinklerSimilarity(name1 || '', name2 || '')).toBeGreaterThan(0.8);
    });

    it('should handle name variations with Jr/Sr suffixes', () => {
      const name1 = normalizeName('John Smith Jr');
      const name2 = normalizeName('John Smith');
      expect(jaroWinklerSimilarity(name1 || '', name2 || '')).toBeGreaterThan(0.9);
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', () => {
      const longName = 'Bartholomew Christopher Alexander Maximilian';
      expect(normalizeName(longName)).toBe(longName.toLowerCase());
      expect(soundex(longName)).toBe('B634');
    });

    it('should handle single character names', () => {
      expect(soundex('X')).toBe('X000');
      expect(normalizeName('X')).toBe('x');
    });

    it('should handle names with numbers', () => {
      expect(normalizeName('John Smith 3rd')).toBe('john smith rd');
      expect(normalizeName('Mary II')).toBe('mary ii');
    });

    it('should handle unicode characters', () => {
      expect(normalizeName('北京')).toBe(''); // Non-Latin removed
      expect(normalizeName('Αλέξανδρος')).toBe(''); // Greek removed
    });
  });
});
