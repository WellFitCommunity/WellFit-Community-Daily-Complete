/**
 * Marker Utilities
 *
 * Utility functions for marker type lookup, keyword matching,
 * position calculation, and priority scoring.
 */

import { MarkerTypeDefinition } from '../../../types/patientAvatar';
import { MARKER_TYPE_LIBRARY } from './markerTypes';

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get all status badge types (displayed around avatar, not on body)
 */
export function getStatusBadgeTypes(): MarkerTypeDefinition[] {
  return MARKER_TYPE_LIBRARY.filter((t) => t.is_status_badge === true);
}

/**
 * Get all anatomical marker types (displayed on body)
 */
export function getAnatomicalMarkerTypes(): MarkerTypeDefinition[] {
  return MARKER_TYPE_LIBRARY.filter((t) => !t.is_status_badge);
}

/**
 * Find marker type definition by type ID
 */
export function getMarkerTypeDefinition(type: string): MarkerTypeDefinition | undefined {
  return MARKER_TYPE_LIBRARY.find((t) => t.type === type);
}

/**
 * Find marker type by keyword matching (for SmartScribe)
 */
export function findMarkerTypeByKeywords(text: string): MarkerTypeDefinition | undefined {
  const normalizedText = text.toLowerCase().trim();

  // First try exact match
  for (const def of MARKER_TYPE_LIBRARY) {
    for (const keyword of def.keywords) {
      if (normalizedText === keyword.toLowerCase()) {
        return def;
      }
    }
  }

  // Then try contains match
  for (const def of MARKER_TYPE_LIBRARY) {
    for (const keyword of def.keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return def;
      }
    }
  }

  return undefined;
}

/**
 * Calculate marker position with laterality adjustment
 */
export function calculateMarkerPosition(
  markerType: MarkerTypeDefinition,
  laterality?: 'left' | 'right' | 'bilateral'
): { x: number; y: number } {
  if (!laterality || laterality === 'bilateral' || !markerType.laterality_adjustments) {
    return markerType.default_position;
  }

  const adjustment = markerType.laterality_adjustments[laterality];
  return adjustment || markerType.default_position;
}

// ============================================================================
// PRIORITY SCORING FOR THUMBNAIL DISPLAY
// ============================================================================

/**
 * Priority weights for marker categories
 * Higher = more important = displayed first in thumbnail
 */
const CATEGORY_PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 100,
  neurological: 80,
  monitoring: 60,
  chronic: 50,
  moderate: 40,
  informational: 20,
};

/**
 * Priority weights for specific marker types (overrides category)
 * Acute conditions and life-threatening items get highest priority
 */
const MARKER_TYPE_PRIORITY_OVERRIDES: Record<string, number> = {
  // Life-threatening / Code Status
  code_dnr: 150,
  code_dni: 150,
  code_dnr_dni: 150,
  code_comfort: 140,

  // Critical Precautions
  fall_risk: 120,
  bleeding_precautions: 115,
  aspiration_risk: 115,
  seizure_precautions: 110,
  npo: 100,

  // Isolation (infection control)
  isolation_airborne: 130,
  isolation_droplet: 125,
  isolation_contact: 120,
  isolation_protective: 115,

  // Allergies & Access Alerts
  allergy_alert: 125,
  allergy_latex: 120,
  difficult_airway: 125,
  difficult_iv_access: 120, // Important for phlebotomy - bring equipment

  // Vein Access (for phlebotomy preparation)
  ultrasound_guided: 100, // Bring the machine
  avoid_access: 95, // Critical to know
  scarred_vein: 60,
  blown_vein: 55,
  rolling_veins: 50,
  fragile_veins: 50,
  small_gauge_needle: 45,
  vein_finder: 40,
  preferred_vein: 35, // Helpful but not critical
  warm_compress_first: 30,
  hand_veins_only: 50,
  foot_veins_backup: 40,
  external_jugular_backup: 85,

  // Critical devices (life-sustaining)
  tracheostomy: 110,
  central_line_subclavian: 105,
  central_line_jugular: 105,
  central_line_femoral: 105,
  chest_tube: 105,

  // Acute neuro
  stroke: 95,
  tbi: 95,
  seizure_disorder: 90,

  // Active monitoring
  cgm: 75,
  cardiac_monitor: 70,
  insulin_pump: 70,
};

/**
 * Priority bonus for markers with specific flags
 */
const PRIORITY_BONUSES = {
  requires_attention: 50,
  pending_confirmation: 25,
  recent_24h: 15,
  recent_12h: 25,
  has_complications: 20,
};

/**
 * Calculate priority score for a single marker
 * @param marker The patient marker to score
 * @param referenceTimes Optional reference times for recency scoring
 * @returns Priority score (higher = more important)
 */
export function calculateMarkerPriority(
  marker: {
    marker_type: string;
    category: string;
    requires_attention?: boolean;
    status?: string;
    created_at?: string;
    details?: { complications_watch?: string[] };
  },
  referenceTimes?: { now?: Date; threshold12h?: Date; threshold24h?: Date }
): number {
  let score = 0;

  // Base score from category
  score += CATEGORY_PRIORITY_WEIGHTS[marker.category] || 30;

  // Type-specific override (additive, not replacement)
  const typeOverride = MARKER_TYPE_PRIORITY_OVERRIDES[marker.marker_type];
  if (typeOverride) {
    score = Math.max(score, typeOverride);
  }

  // Bonus for attention-required markers
  if (marker.requires_attention) {
    score += PRIORITY_BONUSES.requires_attention;
  }

  // Bonus for pending confirmation (new discoveries)
  if (marker.status === 'pending_confirmation') {
    score += PRIORITY_BONUSES.pending_confirmation;
  }

  // Bonus for recent markers
  if (marker.created_at && referenceTimes) {
    const createdAt = new Date(marker.created_at);
    if (referenceTimes.threshold12h && createdAt >= referenceTimes.threshold12h) {
      score += PRIORITY_BONUSES.recent_12h;
    } else if (referenceTimes.threshold24h && createdAt >= referenceTimes.threshold24h) {
      score += PRIORITY_BONUSES.recent_24h;
    }
  }

  // Bonus for markers with complications to watch
  if (marker.details?.complications_watch?.length) {
    score += PRIORITY_BONUSES.has_complications;
  }

  return score;
}

/**
 * Get the top N priority markers for thumbnail display
 * @param markers All patient markers
 * @param limit Maximum number to return (default 6)
 * @param filterBadges If true, excludes status badges (they're shown separately)
 * @returns Sorted array of top priority markers
 */
export function getTopPriorityMarkers<T extends {
  marker_type: string;
  category: string;
  requires_attention?: boolean;
  status?: string;
  is_active?: boolean;
  created_at?: string;
  details?: { complications_watch?: string[] };
}>(
  markers: T[],
  limit: number = 6,
  filterBadges: boolean = true
): T[] {
  const now = new Date();
  const threshold12h = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Filter to active, non-rejected markers
  let activeMarkers = markers.filter((m) =>
    m.is_active !== false &&
    m.status !== 'rejected'
  );

  // Optionally filter out status badges
  if (filterBadges) {
    activeMarkers = activeMarkers.filter((m) => {
      const typeDef = getMarkerTypeDefinition(m.marker_type);
      return !typeDef?.is_status_badge;
    });
  }

  // Score and sort
  const scored = activeMarkers.map((marker) => ({
    marker,
    score: calculateMarkerPriority(marker, { now, threshold12h, threshold24h }),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.marker);
}
