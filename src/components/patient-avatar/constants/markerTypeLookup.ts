/**
 * Marker Type Lookup - Library assembly, groups, and search utilities
 *
 * Combines all marker type arrays into MARKER_TYPE_LIBRARY,
 * defines UI groups, and provides lookup/search functions.
 */

import type { MarkerTypeDefinition, MarkerTypeGroup } from '../../../types/patientAvatar';
import { VASCULAR_ACCESS_TYPES, VEIN_ACCESS_TYPES, DRAINAGE_TUBE_TYPES, MONITORING_DEVICE_TYPES } from './markerTypesDevices';
import { WOUND_SURGICAL_TYPES, ORTHOPEDIC_TYPES, IMPLANT_TYPES, CHRONIC_CONDITION_TYPES, NEUROLOGICAL_CONDITION_TYPES } from './markerTypesClinical';
import { PRECAUTION_TYPES, ISOLATION_TYPES, CODE_STATUS_TYPES, ALERT_TYPES } from './markerTypesSafety';
import { ALL_PREGNANCY_MARKER_TYPES, OBSTETRIC_ANATOMICAL_TYPES, OBSTETRIC_BADGE_TYPES } from './pregnancyMarkerTypes';

// ============================================================================
// COMBINED LIBRARY
// ============================================================================

/**
 * All marker type definitions — the single source of truth for marker types
 */
export const MARKER_TYPE_LIBRARY: MarkerTypeDefinition[] = [
  ...VASCULAR_ACCESS_TYPES,
  ...VEIN_ACCESS_TYPES,
  ...DRAINAGE_TUBE_TYPES,
  ...WOUND_SURGICAL_TYPES,
  ...ORTHOPEDIC_TYPES,
  ...MONITORING_DEVICE_TYPES,
  ...IMPLANT_TYPES,
  ...CHRONIC_CONDITION_TYPES,
  ...NEUROLOGICAL_CONDITION_TYPES,
  ...PRECAUTION_TYPES,
  ...ISOLATION_TYPES,
  ...CODE_STATUS_TYPES,
  ...ALERT_TYPES,
  ...ALL_PREGNANCY_MARKER_TYPES,
];

// ============================================================================
// GROUPED MARKER TYPES (for UI display)
// ============================================================================

/**
 * Grouped marker types for category-based UI display
 */
export const MARKER_TYPE_GROUPS: MarkerTypeGroup[] = [
  { label: 'Vascular Access', category: 'moderate', types: VASCULAR_ACCESS_TYPES },
  { label: 'Vein Access & Phlebotomy', category: 'moderate', types: VEIN_ACCESS_TYPES },
  { label: 'Drainage & Tubes', category: 'moderate', types: DRAINAGE_TUBE_TYPES },
  { label: 'Wounds & Surgical', category: 'informational', types: WOUND_SURGICAL_TYPES },
  { label: 'Orthopedic', category: 'informational', types: ORTHOPEDIC_TYPES },
  { label: 'Monitoring Devices', category: 'monitoring', types: MONITORING_DEVICE_TYPES },
  { label: 'Implants', category: 'informational', types: IMPLANT_TYPES },
  { label: 'Chronic Conditions', category: 'chronic', types: CHRONIC_CONDITION_TYPES },
  { label: 'Neurological Conditions', category: 'neurological', types: NEUROLOGICAL_CONDITION_TYPES },
  { label: 'Precautions & Safety', category: 'critical', types: PRECAUTION_TYPES },
  { label: 'Isolation', category: 'critical', types: ISOLATION_TYPES },
  { label: 'Code Status', category: 'critical', types: CODE_STATUS_TYPES },
  { label: 'Alerts', category: 'critical', types: ALERT_TYPES },
  { label: 'Obstetric', category: 'obstetric', types: OBSTETRIC_ANATOMICAL_TYPES },
  { label: 'OB Status', category: 'obstetric', types: OBSTETRIC_BADGE_TYPES },
];

// ============================================================================
// LOOKUP UTILITIES
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
