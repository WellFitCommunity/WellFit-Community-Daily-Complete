/**
 * Tests for navigationSearchService — keyword→dashboard jump (reduce clicks).
 *
 * These are behavior tests: each one fails if the matching/role-gating logic is
 * removed (Deletion Test), not merely if an import breaks.
 */

import { describe, it, expect } from 'vitest';
import { searchNavigation, NAV_DESTINATIONS } from '../navigationSearchService';

describe('navigationSearchService.searchNavigation', () => {
  it('matches a dashboard by a keyword synonym, not just its label', () => {
    // "bed board" is a keyword on the "Bed Board" destination, but this also
    // proves the multi-word keyword path resolves to /bed-management.
    const results = searchNavigation('bed board');
    const routes = results.map((r) => r.metadata.route);
    expect(routes).toContain('/bed-management');
  });

  it('resolves "risk assessment" to the deep-linked assessment tab', () => {
    const results = searchNavigation('risk assessment');
    const top = results[0];
    expect(top.primaryText).toBe('Risk Assessment');
    expect(top.metadata.route).toBe('/admin-questions?tab=assessment');
    expect(top.type).toBe('navigation');
  });

  it('ranks an exact label match above a mere keyword match', () => {
    // "billing" is the exact label of /billing and also not a keyword elsewhere.
    const results = searchNavigation('billing');
    expect(results[0].primaryText).toBe('Billing');
    expect(results[0].matchScore).toBeGreaterThanOrEqual(
      results[results.length - 1].matchScore
    );
  });

  it('returns nothing for a query shorter than 2 chars (no flooding on 1 keypress)', () => {
    expect(searchNavigation('b')).toEqual([]);
    expect(searchNavigation('')).toEqual([]);
  });

  it('returns nothing when no destination matches', () => {
    expect(searchNavigation('zzzznotathing')).toEqual([]);
  });

  it('hides super-admin-only destinations from a nurse role', () => {
    const nurse = searchNavigation('api keys', { role: 'nurse' });
    expect(nurse).toEqual([]);
  });

  it('shows super-admin-only destinations to a super_admin', () => {
    const superAdmin = searchNavigation('api keys', { role: 'super_admin' });
    expect(superAdmin.map((r) => r.metadata.route)).toContain('/admin/api-keys');
  });

  it('does not hide restricted destinations when role is unknown (RouteRenderer still enforces)', () => {
    const noRole = searchNavigation('api keys');
    expect(noRole.map((r) => r.metadata.route)).toContain('/admin/api-keys');
  });

  it('honors the result limit', () => {
    // "dashboard" appears across several destinations; cap should hold.
    const results = searchNavigation('dashboard', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('every catalog route is non-empty and every entry has keywords', () => {
    for (const dest of NAV_DESTINATIONS) {
      expect(dest.route.length).toBeGreaterThan(0);
      expect(dest.keywords.length).toBeGreaterThan(0);
    }
  });
});
