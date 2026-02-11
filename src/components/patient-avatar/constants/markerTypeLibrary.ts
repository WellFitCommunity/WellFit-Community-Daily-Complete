/**
 * Marker Type Library - Barrel Re-export
 *
 * This file was decomposed from a 1,637-line god file into focused modules:
 *   - markerTypesDevices.ts    — Vascular access, vein access, drainage, monitoring
 *   - markerTypesClinical.ts   — Wounds, orthopedic, implants, chronic, neurological
 *   - markerTypesSafety.ts     — Precautions, isolation, code status, alerts
 *   - markerTypeLookup.ts      — Combined library, groups, lookup/search utilities
 *   - markerPriority.ts        — Priority weights, scoring functions
 *
 * All original exports are preserved. Zero breaking changes to importers.
 */

// --- Device marker types ---
export {
  VASCULAR_ACCESS_TYPES,
  VEIN_ACCESS_TYPES,
  DRAINAGE_TUBE_TYPES,
  MONITORING_DEVICE_TYPES,
} from './markerTypesDevices';

// --- Clinical condition marker types ---
export {
  WOUND_SURGICAL_TYPES,
  ORTHOPEDIC_TYPES,
  IMPLANT_TYPES,
  CHRONIC_CONDITION_TYPES,
  NEUROLOGICAL_CONDITION_TYPES,
} from './markerTypesClinical';

// --- Safety marker types ---
export {
  PRECAUTION_TYPES,
  ISOLATION_TYPES,
  CODE_STATUS_TYPES,
  ALERT_TYPES,
} from './markerTypesSafety';

// --- Combined library, groups, and lookup utilities ---
export {
  MARKER_TYPE_LIBRARY,
  MARKER_TYPE_GROUPS,
  getStatusBadgeTypes,
  getAnatomicalMarkerTypes,
  getMarkerTypeDefinition,
  findMarkerTypeByKeywords,
  calculateMarkerPosition,
} from './markerTypeLookup';

// --- Priority scoring ---
export {
  calculateMarkerPriority,
  getTopPriorityMarkers,
} from './markerPriority';

// --- Re-export type for consumers that imported from here ---
export type { MarkerTypeDefinition } from '../../../types/patientAvatar';
