/**
 * Patient Avatar Visualization System
 *
 * Main exports for the avatar component library.
 */

// Main container component
export { PatientAvatar } from './PatientAvatar';
export { default as PatientAvatarComponent } from './PatientAvatar';

// Core display components
export { AvatarBody } from './AvatarBody';
export { AvatarThumbnail } from './AvatarThumbnail';
export { AvatarFullBody } from './AvatarFullBody';
export { AvatarMarker } from './AvatarMarker';

// Form components
export { MarkerForm } from './MarkerForm';
export { MarkerDetailPopover } from './MarkerDetailPopover';

// Hooks
export { usePatientAvatar } from './hooks/usePatientAvatar';
export { usePatientMarkers } from './hooks/usePatientMarkers';

// Constants
export { SKIN_TONE_COLORS, SKIN_TONES, SKIN_TONE_LABELS } from './constants/skinTones';
export { ALL_BODY_REGIONS, BODY_REGIONS_FRONT, BODY_REGIONS_BACK, getBodyRegion, findClosestBodyRegion } from './constants/bodyRegions';
export {
  MARKER_TYPE_LIBRARY,
  MARKER_TYPE_GROUPS,
  getMarkerTypeDefinition,
  findMarkerTypeByKeywords,
  calculateMarkerPosition,
} from './constants/markerTypeLibrary';

// Re-export types
export type {
  SkinTone,
  GenderPresentation,
  BodyView,
  MarkerCategory,
  MarkerSource,
  MarkerStatus,
  MarkerDetails,
  PatientAvatar as PatientAvatarType,
  PatientMarker,
  PatientMarkersResponse,
  PatientMarkerHistory,
  MarkerTypeDefinition,
  MarkerTypeGroup,
  BodyRegion,
  PatientAvatarProps,
  AvatarBodyProps,
  AvatarMarkerProps,
  MarkerDetailPopoverProps,
} from '../../types/patientAvatar';
