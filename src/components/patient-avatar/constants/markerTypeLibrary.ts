/**
 * Marker Type Library - Re-exports from modular structure
 *
 * This file maintains backward compatibility by re-exporting all marker types
 * and utilities from the new modular structure.
 *
 * The marker definitions are now organized in:
 * - markerTypes/vascularAccess.ts    - PICC, central lines, vein quality
 * - markerTypes/drainageAndTubes.ts  - Catheters, tubes, drains
 * - markerTypes/woundsAndSurgical.ts - Wounds, pressure injuries, ostomies
 * - markerTypes/orthopedic.ts        - Fractures, replacements, casts
 * - markerTypes/devicesAndImplants.ts - CGM, monitors, pacemakers, pumps
 * - markerTypes/conditions.ts        - Chronic & neurological conditions
 * - markerTypes/precautionsAndAlerts.ts - Safety badges, isolation, code status
 *
 * Utility functions are in:
 * - markerUtilities.ts               - Lookup, matching, position, priority
 */

// Re-export all marker type arrays
export {
  VASCULAR_ACCESS_TYPES,
  VEIN_ACCESS_TYPES,
  DRAINAGE_TUBE_TYPES,
  WOUND_SURGICAL_TYPES,
  ORTHOPEDIC_TYPES,
  MONITORING_DEVICE_TYPES,
  IMPLANT_TYPES,
  CHRONIC_CONDITION_TYPES,
  NEUROLOGICAL_CONDITION_TYPES,
  PRECAUTION_TYPES,
  ISOLATION_TYPES,
  CODE_STATUS_TYPES,
  ALERT_TYPES,
  MARKER_TYPE_LIBRARY,
  MARKER_TYPE_GROUPS,
} from './markerTypes';

// Re-export all utility functions
export {
  getStatusBadgeTypes,
  getAnatomicalMarkerTypes,
  getMarkerTypeDefinition,
  findMarkerTypeByKeywords,
  calculateMarkerPosition,
  calculateMarkerPriority,
  getTopPriorityMarkers,
} from './markerUtilities';
