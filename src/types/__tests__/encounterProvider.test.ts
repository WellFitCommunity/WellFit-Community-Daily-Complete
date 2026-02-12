/**
 * Encounter Provider Type Guards and Constants Tests
 *
 * Tests type guards, role definitions, and display metadata.
 *
 * Deletion Test: If the type definitions were removed, ALL tests fail
 * because they validate actual role constants and type guard behavior.
 */

import { describe, it, expect } from 'vitest';
import {
  isEncounterProviderRole,
  ENCOUNTER_PROVIDER_ROLES,
  ROLE_DISPLAY,
} from '../encounterProvider';

describe('encounterProvider type guards and constants', () => {
  it('validates all defined roles as valid', () => {
    for (const role of ENCOUNTER_PROVIDER_ROLES) {
      expect(isEncounterProviderRole(role)).toBe(true);
    }
  });

  it('rejects invalid role strings', () => {
    expect(isEncounterProviderRole('invalid')).toBe(false);
    expect(isEncounterProviderRole('')).toBe(false);
    expect(isEncounterProviderRole(42)).toBe(false);
    expect(isEncounterProviderRole(null)).toBe(false);
    expect(isEncounterProviderRole(undefined)).toBe(false);
  });

  it('has display metadata for every role', () => {
    for (const role of ENCOUNTER_PROVIDER_ROLES) {
      const display = ROLE_DISPLAY[role];
      expect(display).toBeDefined();
      expect(display.label).toBeTruthy();
      expect(display.description).toBeTruthy();
      expect(typeof display.required).toBe('boolean');
      expect(display.maxPerEncounter).toBeGreaterThan(0);
    }
  });

  it('marks attending as required, others as optional', () => {
    expect(ROLE_DISPLAY.attending.required).toBe(true);
    expect(ROLE_DISPLAY.supervising.required).toBe(false);
    expect(ROLE_DISPLAY.referring.required).toBe(false);
    expect(ROLE_DISPLAY.consulting.required).toBe(false);
  });

  it('allows multiple consulting providers but only one of other roles', () => {
    expect(ROLE_DISPLAY.attending.maxPerEncounter).toBe(1);
    expect(ROLE_DISPLAY.supervising.maxPerEncounter).toBe(1);
    expect(ROLE_DISPLAY.referring.maxPerEncounter).toBe(1);
    expect(ROLE_DISPLAY.consulting.maxPerEncounter).toBeGreaterThan(1);
  });

  it('defines exactly 4 roles', () => {
    expect(ENCOUNTER_PROVIDER_ROLES).toHaveLength(4);
    expect(ENCOUNTER_PROVIDER_ROLES).toContain('attending');
    expect(ENCOUNTER_PROVIDER_ROLES).toContain('supervising');
    expect(ENCOUNTER_PROVIDER_ROLES).toContain('referring');
    expect(ENCOUNTER_PROVIDER_ROLES).toContain('consulting');
  });

  it('attending is the only required role', () => {
    const requiredRoles = ENCOUNTER_PROVIDER_ROLES.filter(r => ROLE_DISPLAY[r].required);
    expect(requiredRoles).toEqual(['attending']);
  });
});
