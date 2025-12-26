/**
 * Marker Types Index
 *
 * Combines all marker type definitions from category-specific files.
 * Import from here for access to all types.
 */

// Category exports
export { VASCULAR_ACCESS_TYPES, VEIN_ACCESS_TYPES } from './vascularAccess';
export { DRAINAGE_TUBE_TYPES } from './drainageAndTubes';
export { WOUND_SURGICAL_TYPES } from './woundsAndSurgical';
export { ORTHOPEDIC_TYPES } from './orthopedic';
export { MONITORING_DEVICE_TYPES, IMPLANT_TYPES } from './devicesAndImplants';
export { CHRONIC_CONDITION_TYPES, NEUROLOGICAL_CONDITION_TYPES } from './conditions';
export {
  PRECAUTION_TYPES,
  ISOLATION_TYPES,
  CODE_STATUS_TYPES,
  ALERT_TYPES,
} from './precautionsAndAlerts';

// Re-import for combined library
import { VASCULAR_ACCESS_TYPES, VEIN_ACCESS_TYPES } from './vascularAccess';
import { DRAINAGE_TUBE_TYPES } from './drainageAndTubes';
import { WOUND_SURGICAL_TYPES } from './woundsAndSurgical';
import { ORTHOPEDIC_TYPES } from './orthopedic';
import { MONITORING_DEVICE_TYPES, IMPLANT_TYPES } from './devicesAndImplants';
import { CHRONIC_CONDITION_TYPES, NEUROLOGICAL_CONDITION_TYPES } from './conditions';
import {
  PRECAUTION_TYPES,
  ISOLATION_TYPES,
  CODE_STATUS_TYPES,
  ALERT_TYPES,
} from './precautionsAndAlerts';

import { MarkerTypeDefinition, MarkerTypeGroup } from '../../../../types/patientAvatar';

/**
 * All marker type definitions combined
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
];

/**
 * Grouped marker types for UI display
 */
export const MARKER_TYPE_GROUPS: MarkerTypeGroup[] = [
  {
    label: 'Vascular Access',
    category: 'moderate',
    types: VASCULAR_ACCESS_TYPES,
  },
  {
    label: 'Vein Access & Phlebotomy',
    category: 'moderate',
    types: VEIN_ACCESS_TYPES,
  },
  {
    label: 'Drainage & Tubes',
    category: 'moderate',
    types: DRAINAGE_TUBE_TYPES,
  },
  {
    label: 'Wounds & Surgical',
    category: 'informational',
    types: WOUND_SURGICAL_TYPES,
  },
  {
    label: 'Orthopedic',
    category: 'informational',
    types: ORTHOPEDIC_TYPES,
  },
  {
    label: 'Monitoring Devices',
    category: 'monitoring',
    types: MONITORING_DEVICE_TYPES,
  },
  {
    label: 'Implants',
    category: 'informational',
    types: IMPLANT_TYPES,
  },
  {
    label: 'Chronic Conditions',
    category: 'chronic',
    types: CHRONIC_CONDITION_TYPES,
  },
  {
    label: 'Neurological Conditions',
    category: 'neurological',
    types: NEUROLOGICAL_CONDITION_TYPES,
  },
  {
    label: 'Precautions & Safety',
    category: 'critical',
    types: PRECAUTION_TYPES,
  },
  {
    label: 'Isolation',
    category: 'critical',
    types: ISOLATION_TYPES,
  },
  {
    label: 'Code Status',
    category: 'critical',
    types: CODE_STATUS_TYPES,
  },
  {
    label: 'Alerts',
    category: 'critical',
    types: ALERT_TYPES,
  },
];
