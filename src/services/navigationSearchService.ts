/**
 * Navigation Search Service
 *
 * Lets the global search jump straight to a dashboard/route by keyword, so a
 * user can type "bed board" or "risk assessment" and land there in one step
 * instead of clicking through the nav. This is a NON-PHI search source — it
 * matches only static route metadata (labels + keywords), never patient data.
 *
 * ATLUS: Intuitive Technology — reduce clicks, find the destination instantly.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { SearchResult } from '../contexts/VoiceActionContext';

// ============================================================================
// DESTINATION CATALOG
// ============================================================================

export interface NavDestination {
  /** Human label shown in the result row. */
  label: string;
  /** Route to navigate to (may include a query string, e.g. deep-link tab). */
  route: string;
  /** Extra terms that should match this destination (synonyms, abbreviations). */
  keywords: string[];
  /**
   * Admin roles allowed to see/reach this destination. Omit for "any role".
   * Matched case-insensitively against the caller's admin role. This mirrors
   * the role gating in AdminHeader / routeConfig so we never surface a jump to
   * a page the user cannot open.
   */
  roles?: string[];
  /** Optional one-line description shown as secondary text. */
  description?: string;
}

/**
 * Curated list of the destinations worth jumping to directly. Kept in sync with
 * the AdminHeader nav + routeConfig. Add entries here as dashboards are added.
 */
export const NAV_DESTINATIONS: NavDestination[] = [
  { label: 'Hub', route: '/hub', keywords: ['home', 'launcher', 'apps', 'start'] },
  { label: 'Community Dashboard', route: '/dashboard', keywords: ['community', 'senior', 'wellfit', 'home'] },
  {
    label: 'Readmission Prevention',
    route: '/community-readmission',
    keywords: ['readmission', 'readmit', 'prevention', 'high risk', 'community readmission'],
  },
  {
    label: 'Risk Assessment',
    route: '/admin-questions?tab=assessment',
    keywords: ['risk', 'assessment', 'health assessment', 'fall risk', 'functional', 'risk manager'],
    description: 'Health Assessments — Risk Assessment Manager',
  },
  {
    label: 'Nurse Questions',
    route: '/admin-questions?tab=questions',
    keywords: ['nurse questions', 'questionnaire', 'intake questions'],
  },
  { label: 'Billing', route: '/billing', keywords: ['billing', 'revenue', 'claims', 'invoice', 'payment'] },
  {
    label: 'Bed Board',
    route: '/bed-management',
    keywords: ['bed', 'beds', 'bed board', 'bed management', 'capacity', 'census board'],
  },
  { label: 'Nurse Dashboard', route: '/nurse-dashboard', keywords: ['nurse', 'nursing'] },
  { label: 'Physician Dashboard', route: '/physician-dashboard', keywords: ['physician', 'doctor', 'md'] },
  { label: 'ER Dashboard', route: '/er-dashboard', keywords: ['er', 'emergency', 'ed', 'emergency room'] },
  { label: 'Shift Handoff', route: '/shift-handoff', keywords: ['handoff', 'handover', 'shift', 'sbar', 'sign out'] },
  { label: 'Census', route: '/nurse-census', keywords: ['census', 'patient list', 'roster'] },
  { label: 'Care Coordination', route: '/care-coordination', keywords: ['care', 'coordination', 'care team', 'care plan'] },
  { label: 'Referrals', route: '/referrals', keywords: ['referral', 'referrals', 'refer'] },
  { label: 'Medications', route: '/medication-manager', keywords: ['medication', 'meds', 'drugs', 'pharmacy', 'rx'] },
  { label: 'Compass Riley', route: '/compass-riley', keywords: ['compass', 'riley', 'reasoning', 'assistant'] },
  { label: 'CHW Dashboard', route: '/chw/dashboard', keywords: ['chw', 'community health worker'] },
  { label: 'Public Health Reporting', route: '/public-health', keywords: ['public health', 'immunization registry', 'syndromic surveillance', 'ecr', 'reporting'] },
  { label: 'Admin Settings', route: '/admin/settings', keywords: ['settings', 'admin settings', 'configuration', 'config'] },
  { label: 'Audit Logs', route: '/admin/audit-logs', keywords: ['audit', 'logs', 'audit trail', 'compliance log'] },
  { label: 'Interoperability', route: '/interoperability', keywords: ['interop', 'interoperability', 'fhir', 'hl7', 'exchange'] },
  { label: 'Engagement Metrics', route: '/metrics', keywords: ['metrics', 'engagement', 'analytics'] },
  // Super-admin only surfaces
  { label: 'API Keys', route: '/admin/api-keys', keywords: ['api', 'api keys', 'keys', 'tokens'], roles: ['super_admin'] },
  { label: 'System Admin', route: '/admin/system', keywords: ['system', 'system admin', 'infrastructure'], roles: ['super_admin'] },
  { label: 'SMART Apps', route: '/admin/smart-apps', keywords: ['smart', 'smart apps', 'smart on fhir', 'oauth apps'], roles: ['super_admin'] },
  { label: 'Guardian Agent', route: '/guardian/dashboard', keywords: ['guardian', 'monitoring', 'auto heal', 'security agent'], roles: ['super_admin'] },
];

// ============================================================================
// MATCHING
// ============================================================================

/**
 * Score how well a destination matches the query (0 = no match, 100 = best).
 * Weights an exact/prefix label hit above a keyword hit so the most literal
 * destination sorts first.
 */
function scoreDestination(dest: NavDestination, normalizedQuery: string): number {
  const label = dest.label.toLowerCase();

  if (label === normalizedQuery) return 100;
  if (label.startsWith(normalizedQuery)) return 92;
  if (label.includes(normalizedQuery)) return 84;

  // Keyword matches
  let best = 0;
  for (const kw of dest.keywords) {
    const k = kw.toLowerCase();
    if (k === normalizedQuery) best = Math.max(best, 90);
    else if (k.startsWith(normalizedQuery)) best = Math.max(best, 80);
    else if (k.includes(normalizedQuery)) best = Math.max(best, 72);
  }
  if (best > 0) return best;

  // Per-word fallback: every query word must appear somewhere in the
  // label+keywords haystack (handles "bed board" vs "bed management board").
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const haystack = `${label} ${dest.keywords.join(' ').toLowerCase()}`;
    if (words.every((w) => haystack.includes(w))) return 68;
  }

  return 0;
}

/**
 * Search navigation destinations by keyword.
 *
 * @param query - free-text query the user typed
 * @param opts.role - caller's admin role; role-restricted destinations are
 *   hidden unless it matches. Omit to disable role filtering (show all).
 * @param opts.limit - max results (default 5, so nav never floods PHI results)
 */
export function searchNavigation(
  query: string,
  opts: { role?: string | null; limit?: number } = {},
): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  const { role, limit = 5 } = opts;
  const roleLower = role ? role.toLowerCase() : null;

  const results: SearchResult[] = [];

  for (const dest of NAV_DESTINATIONS) {
    // Role gate: if the destination is restricted and we know the caller's
    // role, only show it when the role is allowed. If role is unknown (null),
    // we do not hide restricted destinations (RouteRenderer still enforces it).
    if (dest.roles && roleLower && !dest.roles.map((r) => r.toLowerCase()).includes(roleLower)) {
      continue;
    }

    const score = scoreDestination(dest, normalizedQuery);
    if (score > 0) {
      results.push({
        id: `nav:${dest.route}`,
        type: 'navigation',
        primaryText: dest.label,
        secondaryText: dest.description ?? 'Go to dashboard',
        matchScore: score,
        metadata: { route: dest.route },
      });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

export default { searchNavigation, NAV_DESTINATIONS };
