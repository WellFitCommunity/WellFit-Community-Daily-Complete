/**
 * Tests for ONC 170.315(a)(5) OMB Race & Ethnicity constants.
 *
 * These constants drive:
 *   - profiles.race_omb_categories CHECK constraint
 *   - profiles.ethnicity_omb CHECK constraint
 *   - PatientDemographics type
 *   - Demographics form UI
 *
 * If these tests fail because a code was added/removed, you also need to
 * update the SQL CHECK constraint or new inserts will fail at runtime.
 */

import { describe, it, expect } from 'vitest';
import {
  OMB_RACE_CATEGORIES,
  OMB_RACE_PRIMARY,
  OMB_RACE_LABELS,
  OMB_ETHNICITY_VALUES,
  OMB_ETHNICITY_LABELS,
  isOmbRaceCategory,
  isOmbEthnicityValue,
} from '../omb-demographics';

describe('OMB demographics constants', () => {
  describe('OMB_RACE_CATEGORIES', () => {
    it('includes the 5 OMB 1997 minimum race categories', () => {
      expect(OMB_RACE_CATEGORIES).toContain('american-indian-or-alaska-native');
      expect(OMB_RACE_CATEGORIES).toContain('asian');
      expect(OMB_RACE_CATEGORIES).toContain('black-or-african-american');
      expect(OMB_RACE_CATEGORIES).toContain('native-hawaiian-or-pacific-islander');
      expect(OMB_RACE_CATEGORIES).toContain('white');
    });

    it('includes USCDI v3 nullFlavor codes', () => {
      expect(OMB_RACE_CATEGORIES).toContain('asked-but-unknown');
      expect(OMB_RACE_CATEGORIES).toContain('unknown');
      expect(OMB_RACE_CATEGORIES).toContain('asked-declined');
      expect(OMB_RACE_CATEGORIES).toContain('other');
    });

    it('matches the SQL CHECK constraint code list exactly (lockstep guard)', () => {
      // If this list changes, migration
      // 20260528094229_onc_a5_demographics_race_ethnicity.sql MUST be updated
      // and a new migration pushed, or the form will write codes the DB rejects.
      expect([...OMB_RACE_CATEGORIES].sort()).toEqual([
        'american-indian-or-alaska-native',
        'asian',
        'asked-but-unknown',
        'asked-declined',
        'black-or-african-american',
        'native-hawaiian-or-pacific-islander',
        'other',
        'unknown',
        'white',
      ]);
    });

    it('every category has a display label', () => {
      OMB_RACE_CATEGORIES.forEach((code) => {
        expect(OMB_RACE_LABELS[code]).toBeDefined();
        expect(OMB_RACE_LABELS[code].length).toBeGreaterThan(0);
      });
    });
  });

  describe('OMB_RACE_PRIMARY', () => {
    it('contains only the 5 OMB minimum categories (no nullFlavors)', () => {
      expect(OMB_RACE_PRIMARY).toHaveLength(5);
      expect(OMB_RACE_PRIMARY).not.toContain('asked-but-unknown');
      expect(OMB_RACE_PRIMARY).not.toContain('asked-declined');
      expect(OMB_RACE_PRIMARY).not.toContain('unknown');
      expect(OMB_RACE_PRIMARY).not.toContain('other');
    });

    it('every primary code is a valid OMB race category', () => {
      OMB_RACE_PRIMARY.forEach((code) => {
        expect(OMB_RACE_CATEGORIES).toContain(code);
      });
    });
  });

  describe('OMB_ETHNICITY_VALUES', () => {
    it('includes both OMB 1997 ethnicity categories', () => {
      expect(OMB_ETHNICITY_VALUES).toContain('hispanic-or-latino');
      expect(OMB_ETHNICITY_VALUES).toContain('not-hispanic-or-latino');
    });

    it('includes USCDI v3 nullFlavor codes', () => {
      expect(OMB_ETHNICITY_VALUES).toContain('asked-but-unknown');
      expect(OMB_ETHNICITY_VALUES).toContain('unknown');
      expect(OMB_ETHNICITY_VALUES).toContain('asked-declined');
    });

    it('matches the SQL CHECK constraint code list exactly (lockstep guard)', () => {
      expect([...OMB_ETHNICITY_VALUES].sort()).toEqual([
        'asked-but-unknown',
        'asked-declined',
        'hispanic-or-latino',
        'not-hispanic-or-latino',
        'unknown',
      ]);
    });

    it('every ethnicity has a display label', () => {
      OMB_ETHNICITY_VALUES.forEach((code) => {
        expect(OMB_ETHNICITY_LABELS[code]).toBeDefined();
        expect(OMB_ETHNICITY_LABELS[code].length).toBeGreaterThan(0);
      });
    });

    it('"black-or-african-american" is a RACE code, NOT an ethnicity (guard against historical bug)', () => {
      // Production DB had ethnicity='black' rows. That's a race in OMB.
      // Verify the type system makes that mistake impossible going forward.
      expect(OMB_ETHNICITY_VALUES).not.toContain('black-or-african-american');
      expect(OMB_ETHNICITY_VALUES).not.toContain('black');
      expect(OMB_RACE_CATEGORIES).toContain('black-or-african-american');
    });
  });

  describe('isOmbRaceCategory', () => {
    it('returns true for valid OMB race codes', () => {
      expect(isOmbRaceCategory('asian')).toBe(true);
      expect(isOmbRaceCategory('white')).toBe(true);
      expect(isOmbRaceCategory('asked-declined')).toBe(true);
    });

    it('returns false for legacy values that used to live in profiles.race', () => {
      // Legacy form options that should NOT round-trip through the new column
      expect(isOmbRaceCategory('hispanic')).toBe(false);
      expect(isOmbRaceCategory('native-american')).toBe(false);
      expect(isOmbRaceCategory('pacific-islander')).toBe(false);
      expect(isOmbRaceCategory('mixed')).toBe(false);
      expect(isOmbRaceCategory('prefer-not-to-say')).toBe(false);
    });

    it('returns false for non-string inputs', () => {
      expect(isOmbRaceCategory(null)).toBe(false);
      expect(isOmbRaceCategory(undefined)).toBe(false);
      expect(isOmbRaceCategory(42)).toBe(false);
      expect(isOmbRaceCategory(['asian'])).toBe(false);
    });
  });

  describe('isOmbEthnicityValue', () => {
    it('returns true for valid OMB ethnicity codes', () => {
      expect(isOmbEthnicityValue('hispanic-or-latino')).toBe(true);
      expect(isOmbEthnicityValue('not-hispanic-or-latino')).toBe(true);
      expect(isOmbEthnicityValue('asked-declined')).toBe(true);
    });

    it('returns false for race codes (catches the historical confusion bug)', () => {
      expect(isOmbEthnicityValue('black-or-african-american')).toBe(false);
      expect(isOmbEthnicityValue('asian')).toBe(false);
      expect(isOmbEthnicityValue('white')).toBe(false);
    });

    it('returns false for empty string and non-strings', () => {
      expect(isOmbEthnicityValue('')).toBe(false);
      expect(isOmbEthnicityValue(null)).toBe(false);
      expect(isOmbEthnicityValue(undefined)).toBe(false);
    });
  });
});
